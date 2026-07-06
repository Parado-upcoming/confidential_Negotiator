# Confidential Negotiation

Two people agree on a number without either one ever revealing it — even if no deal is reached.

Built for the [Zama Developer Program Mainnet Season 3](https://www.zama.org/post/zama-developer-program-mainnet-season-3-composable-privacy-is-the-key) Builder Track.

## The idea

Classic secure-computation problem: an employer has a maximum budget, a candidate has a minimum acceptable salary. Today, negotiating that on-chain means someone has to name a number first, or trust a third party. This contract lets both sides submit their number **fully encrypted**, computes the comparison homomorphically, and reveals only:

- whether a deal exists (`ceiling >= floor`), and
- if so, a suggested midpoint value.

Neither party's actual number is ever decrypted — not by the other party, not by the contract owner, not by us. If there's no deal, nothing leaks beyond that fact.

The same mechanism generalizes to any bilateral price negotiation (real-estate offers, B2B deal terms, etc.) — salary is just the concrete framing used here.

## How it works

1. **Create a session** — either party calls `createSession(counterparty)`.
2. **Submit privately** — the employer submits their encrypted ceiling via `submitCeiling`, the candidate their encrypted floor via `submitFloor`. Values are encrypted client-side before ever touching the chain.
3. **Reveal** — once both are in, either party calls `reveal()`. The contract computes, homomorphically:
   - `dealExists = FHE.ge(ceiling, floor)` (an encrypted boolean)
   - `suggestedValue = FHE.select(dealExists, (ceiling + floor) / 2, 0)` — zeroed out on a no-deal outcome so nothing meaningful leaks either way
4. **Decrypt** — both parties can decrypt the outcome (and only the outcome) via the standard EIP-712 user-decrypt flow. The raw ceiling/floor ciphertexts are never granted decrypt permission to anyone.

See [`ConfidentialNegotiation.sol`](packages/foundry/src/ConfidentialNegotiation.sol) for the full contract.

## Stack

- **Contracts** — Foundry, Solidity 0.8.27, [`@fhevm/solidity`](https://docs.zama.org/protocol) for encrypted types, [forge-fhevm](https://github.com/zama-ai/forge-fhevm) for local testing
- **Frontend** — Next.js 15 (App Router), React 19, wagmi, viem, RainbowKit, Tailwind v4
- **FHE SDK** — `@zama-fhe/sdk` + `@zama-fhe/react-sdk`; `RelayerCleartext` on localhost, `RelayerWeb` on Sepolia

This repo started from Zama's [`fhevm-react-template`](https://github.com/zama-ai/fhevm-react-template); the scaffolding (wallet wiring, encrypt/decrypt hooks pattern, ABI generation) is template-provided, the contract and UI are this project's.

## Prerequisites

Node.js ≥ 20, pnpm, [Foundry](https://book.getfoundry.sh/getting-started/installation) (`forge` / `anvil` / `cast`), `jq`, MetaMask.

## Quick start

```bash
pnpm install            # node deps + regenerate ABIs
pnpm contracts:install  # forge soldeer install — required before `pnpm chain`
```

### Local

```bash
# Terminal 1 — anvil + FHEVM cleartext host + ConfidentialNegotiation
pnpm chain

# Terminal 2 — frontend (http://localhost:3000)
pnpm start
```

Add the local network to MetaMask: RPC `http://127.0.0.1:8545`, chain id `31337`. Import two different anvil dev accounts (printed by `pnpm chain` / `anvil`'s own startup log) to play both sides of a negotiation — one as the employer, one as the candidate.

To redeploy `ConfidentialNegotiation` without restarting anvil: `pnpm deploy:localhost`.

### Sepolia

```bash
cp .env.example .env.local   # then fill in the values below
```

```bash
DEPLOYER_PRIVATE_KEY=0x...                         # deployer funded with Sepolia ETH
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
ETHERSCAN_API_KEY=...                              # optional, enables --verify
```

Add an Alchemy key to `packages/nextjs/.env.local`:

```bash
NEXT_PUBLIC_ALCHEMY_API_KEY=YOUR_KEY
```

Deploy + run:

```bash
pnpm deploy:sepolia
pnpm start
```

## Scripts

| Command                  | What it does                                                                                 |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| `pnpm chain`             | Anvil + FHEVM cleartext host + `ConfidentialNegotiation` on port 8545                        |
| `pnpm deploy:localhost`  | Deploys `ConfidentialNegotiation` to local anvil, then regenerates frontend ABIs             |
| `pnpm deploy:sepolia`    | Deploys to Sepolia (reads `.env.local`), then regenerates frontend ABIs                      |
| `pnpm contracts:install` | `forge soldeer install` — fetches forge-fhevm and other contract deps                        |
| `pnpm contracts:build`   | `forge build` in `packages/foundry`                                                          |
| `pnpm contracts:test`    | `forge test -vv` in `packages/foundry`                                                       |
| `pnpm generate`          | Emits `packages/nextjs/contracts/<Name>.ts` + `<Name>.local.ts` from forge broadcasts + out/ |
| `pnpm start`             | `next dev`                                                                                   |
| `pnpm next:build`        | Production build of the frontend                                                             |
| `pnpm next:check-types`  | TypeScript check on the frontend                                                             |

## Project structure

```
confidential-negotiation/
├── scripts/                              # chain.sh, deploy-*.sh, generateTsAbis.ts
├── packages/foundry/
│   ├── src/ConfidentialNegotiation.sol
│   ├── script/DeployConfidentialNegotiation.s.sol
│   └── test/ConfidentialNegotiation.t.sol      # deal / no-deal / access-control cases
└── packages/nextjs/
    ├── app/
    │   ├── page.tsx                # landing
    │   ├── dashboard/page.tsx      # your negotiations
    │   ├── new/page.tsx            # start a negotiation
    │   └── session/[id]/page.tsx   # submit → wait → reveal → decrypt → result
    ├── hooks/negotiation/
    │   ├── useMyNegotiations.tsx       # lists sessions the wallet is party to
    │   ├── useCreateNegotiation.tsx    # createSession + decode SessionCreated
    │   └── useNegotiationSession.tsx   # submit / reveal / decrypt for one session
    ├── components/AppShell.tsx
    └── utils/negotiations.ts           # shared types + status helpers
```

## FHEVM notes

- **ACL is mandatory.** Every encrypted value needs `FHE.allowThis(handle)` + `FHE.allow(handle, user)` — reads silently fail without it.
- **The raw inputs are never granted decrypt access to anyone** — that's the entire privacy property. Only the derived `dealExists`/`suggestedValue` ciphertexts get `FHE.allow`'d, and only to the two parties.
- **`nextSessionId` + per-id reads, not an index.** The contract has no "sessions by user" mapping; the frontend lists sessions by reading `nextSessionId` and multicalling `getSession(i)` for every id, filtering client-side. Fine at demo scale — would need an on-chain index or event-log scan at real scale.
- **Local runs cleartext mode.** Anvil hosts a `CleartextFHEVMExecutor`; `RelayerCleartext` reads plaintext directly. Dev-only.
- **Sepolia uses the real relayer.** `RelayerWeb` needs `NEXT_PUBLIC_ALCHEMY_API_KEY`.

## References

[Zama Protocol docs](https://docs.zama.org/) · [`@zama-fhe/sdk`](https://github.com/zama-ai/sdk) · [forge-fhevm](https://github.com/zama-ai/forge-fhevm) · [fhevm-react-template](https://github.com/zama-ai/fhevm-react-template)

## License

BSD-3-Clause-Clear. See [LICENSE](LICENSE).
