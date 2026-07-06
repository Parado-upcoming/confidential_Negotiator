#!/usr/bin/env bash
# Start anvil + FHEVM cleartext host stack + ConfidentialNegotiation in one command.
#
# Flow (2 terminals):
#   pnpm chain   # this script: anvil + FHEVM host + ConfidentialNegotiation
#   pnpm start   # frontend
#
# To redeploy ConfidentialNegotiation without restarting anvil, run
# `pnpm deploy:localhost` in another terminal.
set -euo pipefail

PORT="${ANVIL_PORT:-8545}"
RPC_URL="http://127.0.0.1:$PORT"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# forge-fhevm is installed as a soldeer dependency of packages/foundry. The
# installed source tree includes deploy-local.sh (the canonical FHEVM host
# deploy script) and the full script/ directory it needs.
FORGE_FHEVM_DIR="$(find "$REPO_ROOT/packages/foundry/dependencies" -maxdepth 1 -type d -name 'forge-fhevm-*' | head -1)"

if [[ -z "$FORGE_FHEVM_DIR" || ! -d "$FORGE_FHEVM_DIR" ]]; then
  echo "error: forge-fhevm not found under packages/foundry/dependencies/" >&2
  echo "run: (cd packages/foundry && forge soldeer install)" >&2
  exit 1
fi

for bin in anvil forge cast jq pnpm; do
  command -v "$bin" >/dev/null || { echo "error: missing '$bin' on PATH" >&2; exit 1; }
done

if lsof -ti :"$PORT" >/dev/null 2>&1; then
  echo "port $PORT in use, killing stale process..."
  lsof -ti :"$PORT" | xargs kill -9 2>/dev/null || true
  sleep 1
fi

# Build forge-fhevm artifacts once. deploy-local.sh reads from out/.
if [[ ! -d "$FORGE_FHEVM_DIR/out" ]]; then
  echo "building forge-fhevm (first run)..."
  (cd "$FORGE_FHEVM_DIR" && forge soldeer install && forge build)
fi

ANVIL_PID=
cleanup() { [[ -n "$ANVIL_PID" ]] && kill "$ANVIL_PID" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

echo "starting anvil on port $PORT..."
ANVIL_STATE="${ANVIL_STATE:-$REPO_ROOT/.anvil-state.json}"
ANVIL_ARGS="--host 127.0.0.1 --port $PORT --chain-id 31337 --auto-impersonate --silent"
if [[ -f "$ANVIL_STATE" ]]; then
  echo "  restoring anvil state from $ANVIL_STATE"
  anvil $ANVIL_ARGS --load-state "$ANVIL_STATE" --dump-state "$ANVIL_STATE" &
else
  anvil $ANVIL_ARGS --dump-state "$ANVIL_STATE" &
fi
ANVIL_PID=$!

# Wait for RPC
for _ in $(seq 1 150); do
  cast chain-id --rpc-url "$RPC_URL" >/dev/null 2>&1 && break
  sleep 0.2
done
kill -0 "$ANVIL_PID" 2>/dev/null \
  || { echo "anvil failed to start on port $PORT (already in use?)" >&2; exit 1; }

# Redeploying the FHEVM host stack (ACL/Executor/KMSVerifier/InputVerifier) on
# top of already-restored state resets its internal registries even though the
# contracts land at the same fixed addresses, so any input proof a client already
# has cached (or any ciphertext handle registered under the previous instance)
# stops verifying afterwards. Confirmed by trace: a submitFloor call reverted
# deep inside InputVerifier.verifyInput after a chain restart that re-ran this
# unconditionally. Only deploy when the ACL contract isn't already live.
ACL_ADDR=0x50157CFfD6bBFA2DECe204a89ec419c23ef5755D
if [[ "$(cast code "$ACL_ADDR" --rpc-url "$RPC_URL")" == "0x" ]]; then
  echo "deploying FHEVM cleartext host stack..."
  # Unset any chain override inherited from the calling shell, since cast reads
  # CHAIN (and legacy FOUNDRY_CHAIN / DAPP_CHAIN) and would fail if set to an
  # invalid value such as "testnet".
  (unset CHAIN FOUNDRY_CHAIN DAPP_CHAIN; cd "$FORGE_FHEVM_DIR" && ./deploy-local.sh --rpc-url "$RPC_URL")
else
  echo "FHEVM host stack already live (restored from state), skipping redeploy"
fi

# wagmi's useReadContracts batches reads via Multicall3, which is deployed at
# this canonical address on every real network (mainnet, Sepolia, ...) but not
# on a bare anvil instance. Without it, every multicall-based read in the
# frontend (e.g. listing negotiations) silently fails. Deploy it once via the
# well-known pre-signed transaction (github.com/mds1/multicall3). Idempotent,
# and persists in --dump-state once deployed.
MULTICALL3_ADDR=0xcA11bde05977b3631167028862bE2a173976CA11
if [[ "$(cast code "$MULTICALL3_ADDR" --rpc-url "$RPC_URL")" == "0x" ]]; then
  echo "deploying Multicall3..."
  cast send 0x05f32b3cc3888453ff71b01135b34ff8e41263f2 --value 1ether \
    --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
    --rpc-url "$RPC_URL" >/dev/null
  cast publish "$(cat "$SCRIPT_DIR/multicall3-deploy-tx.txt")" --rpc-url "$RPC_URL" >/dev/null
fi

# If anvil state was restored, ConfidentialNegotiation (and its session data)
# may already exist on-chain at the address from the last broadcast. Redeploying
# unconditionally would silently orphan that data behind a fresh address on every
# restart, so only deploy when there's no live contract at the last known address.
LATEST_BROADCAST="$REPO_ROOT/packages/foundry/broadcast/DeployConfidentialNegotiation.s.sol/31337/run-latest.json"
EXISTING_ADDR=""
if [[ -f "$LATEST_BROADCAST" ]]; then
  EXISTING_ADDR="$(jq -r '[.transactions[] | select(.contractName=="ConfidentialNegotiation" and .transactionType=="CREATE") | .contractAddress] | last // ""' "$LATEST_BROADCAST")"
fi

if [[ -n "$EXISTING_ADDR" ]] && [[ "$(cast code "$EXISTING_ADDR" --rpc-url "$RPC_URL")" != "0x" ]]; then
  echo "ConfidentialNegotiation already live at $EXISTING_ADDR (restored from state), skipping redeploy"
  (cd "$REPO_ROOT" && pnpm generate)
else
  echo "deploying ConfidentialNegotiation..."
  RPC_URL="$RPC_URL" "$SCRIPT_DIR/deploy-localhost.sh"
fi

echo
echo "✓ anvil + FHEVM host + ConfidentialNegotiation ready on $RPC_URL (chain id 31337)"
echo "  next: pnpm start (in another terminal)"
echo

wait "$ANVIL_PID"
