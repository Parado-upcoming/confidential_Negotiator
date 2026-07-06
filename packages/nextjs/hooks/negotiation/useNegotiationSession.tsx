"use client";

import { useCallback, useMemo, useState } from "react";
import { useAllow, useEncrypt, useIsAllowed, useUserDecrypt } from "@zama-fhe/react-sdk";
import { bytesToHex } from "viem";
import { useAccount, useChainId, useReadContract, useWriteContract } from "wagmi";
import { ConfidentialNegotiation } from "~~/contracts/ConfidentialNegotiation";
import { deploymentFor } from "~~/utils/contract";
import { type Negotiation, type Role } from "~~/utils/negotiations";

type SessionResult = readonly [`0x${string}`, `0x${string}`, boolean, boolean, boolean, boolean];

/** Drives a single negotiation session: reads on-chain state, submits the
 * caller's encrypted ceiling/floor (role-aware), triggers reveal(), and once
 * revealed, decrypts the outcome via the same EIP-712 user-decrypt flow used
 * for ERC-7984 balances. Neither party's submitted number is ever read back;
 * only the boolean/aggregate outcome ciphertexts are decrypted. */
export function useNegotiationSession(sessionId: bigint) {
  const { address } = useAccount();
  const chainId = useChainId();
  const deployment = useMemo(() => deploymentFor(ConfidentialNegotiation, chainId), [chainId]);
  const hasContract = Boolean(deployment?.address);

  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const sessionRead = useReadContract({
    address: hasContract ? deployment!.address : undefined,
    abi: hasContract ? deployment!.abi : undefined,
    functionName: "getSession" as const,
    args: [sessionId],
    query: { enabled: hasContract, refetchInterval: 4000 },
  });

  const session = sessionRead.data as SessionResult | undefined;
  const [partyA, partyB, ceilingSet, floorSet, revealed, cancelled] = session ?? [
    "0x0000000000000000000000000000000000000000",
    "0x0000000000000000000000000000000000000000",
    false,
    false,
    false,
    false,
  ];

  const role: Role | null = useMemo(() => {
    if (!session || !address) return null;
    if (partyA.toLowerCase() === address.toLowerCase()) return "initiator";
    if (partyB.toLowerCase() === address.toLowerCase()) return "counterparty";
    return null;
  }, [session, address, partyA, partyB]);

  const negotiation: Negotiation | null = useMemo(() => {
    if (!session || !role) return null;
    const isA = role === "initiator";
    return {
      id: sessionId,
      counterparty: isA ? partyB : partyA,
      role,
      youSubmitted: isA ? ceilingSet : floorSet,
      counterpartySubmitted: isA ? floorSet : ceilingSet,
      revealed,
    };
  }, [session, role, sessionId, partyA, partyB, ceilingSet, floorSet, revealed]);

  const { writeContractAsync } = useWriteContract();
  const encrypt = useEncrypt();

  const submitNumber = useCallback(
    async (value: number) => {
      if (!hasContract || !address || !role) return;
      setIsSubmitting(true);
      try {
        setMessage("Encrypting value...");
        const enc = await encrypt.mutateAsync({
          values: [{ value: BigInt(Math.round(value)), type: "euint64" }],
          contractAddress: deployment!.address,
          userAddress: address,
        });
        setMessage("Sending transaction...");
        await writeContractAsync({
          address: deployment!.address,
          abi: deployment!.abi,
          functionName: role === "initiator" ? "submitCeiling" : "submitFloor",
          args: [sessionId, bytesToHex(enc.handles[0]!), bytesToHex(enc.inputProof)],
        });
        setMessage("Submitted privately.");
        sessionRead.refetch();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : String(e));
      } finally {
        setIsSubmitting(false);
      }
    },
    [hasContract, address, role, encrypt, deployment, writeContractAsync, sessionId, sessionRead],
  );

  const reveal = useCallback(async () => {
    if (!hasContract) return;
    setIsRevealing(true);
    try {
      setMessage("Revealing outcome...");
      await writeContractAsync({
        address: deployment!.address,
        abi: deployment!.abi,
        functionName: "reveal",
        args: [sessionId],
      });
      setMessage("Revealed. Sign to decrypt the result.");
      sessionRead.refetch();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setIsRevealing(false);
    }
  }, [hasContract, deployment, writeContractAsync, sessionId, sessionRead]);

  const cancelSession = useCallback(async () => {
    if (!hasContract) return;
    setIsCancelling(true);
    try {
      setMessage("Cancelling negotiation...");
      await writeContractAsync({
        address: deployment!.address,
        abi: deployment!.abi,
        functionName: "cancelSession",
        args: [sessionId],
      });
      setMessage("Cancelled.");
      sessionRead.refetch();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setIsCancelling(false);
    }
  }, [hasContract, deployment, writeContractAsync, sessionId, sessionRead]);

  // Outcome decryption, only enabled once reveal() has landed on-chain.
  const dealExistsRead = useReadContract({
    address: hasContract ? deployment!.address : undefined,
    abi: hasContract ? deployment!.abi : undefined,
    functionName: "getDealExists" as const,
    args: [sessionId],
    query: { enabled: hasContract && revealed },
  });
  const suggestedValueRead = useReadContract({
    address: hasContract ? deployment!.address : undefined,
    abi: hasContract ? deployment!.abi : undefined,
    functionName: "getSuggestedValue" as const,
    args: [sessionId],
    query: { enabled: hasContract && revealed },
  });

  const dealExistsHandle = dealExistsRead.data as `0x${string}` | undefined;
  const suggestedValueHandle = suggestedValueRead.data as `0x${string}` | undefined;

  const decryptHandles = useMemo(() => {
    if (!dealExistsHandle || !suggestedValueHandle || !deployment?.address) return [];
    return [
      { handle: dealExistsHandle, contractAddress: deployment.address },
      { handle: suggestedValueHandle, contractAddress: deployment.address },
    ];
  }, [dealExistsHandle, suggestedValueHandle, deployment]);

  const { mutate: allow, isPending: isAllowing } = useAllow();
  const contractAddr = (deployment?.address ?? "0x0") as `0x${string}`;
  const { data: isAllowed } = useIsAllowed({ contractAddresses: [contractAddr] });
  const [decryptEnabled, setDecryptEnabled] = useState(false);
  const decrypt = useUserDecrypt(
    { handles: decryptHandles },
    { enabled: decryptEnabled && !!isAllowed && decryptHandles.length > 0 },
  );

  const startDecrypt = useCallback(() => {
    setDecryptEnabled(true);
    if (!isAllowed && deployment?.address) {
      setMessage("Sign to authorize decryption...");
      allow([deployment.address]);
      return;
    }
    setMessage("Decrypting...");
  }, [isAllowed, allow, deployment]);

  const result = useMemo(() => {
    if (!decrypt.data || !dealExistsHandle || !suggestedValueHandle) return null;
    const dealRaw = decrypt.data[dealExistsHandle];
    const suggestedRaw = decrypt.data[suggestedValueHandle];
    if (dealRaw === undefined || suggestedRaw === undefined) return null;
    const deal = Boolean(dealRaw);
    return { deal, midpoint: deal ? Number(suggestedRaw) : undefined };
  }, [decrypt.data, dealExistsHandle, suggestedValueHandle]);

  return {
    negotiation,
    isCancelled: cancelled,
    isLoadingSession: sessionRead.isFetching && !session,
    isSubmitting,
    isRevealing,
    isCancelling,
    isAllowing,
    isDecrypting: decrypt.isFetching,
    canStartDecrypt: revealed && !result,
    message,
    submitNumber,
    reveal,
    cancelSession,
    startDecrypt,
    result,
  };
}
