"use client";

import { useCallback, useMemo, useState } from "react";
import { decodeEventLog } from "viem";
import { useChainId, usePublicClient, useWriteContract } from "wagmi";
import { ConfidentialNegotiation } from "~~/contracts/ConfidentialNegotiation";
import { deploymentFor } from "~~/utils/contract";

/** Sends `createSession(counterparty)` and resolves with the new session id,
 * decoded from the `SessionCreated` event in the mined receipt (rather than
 * assuming it equals the pre-tx `nextSessionId`, which would race against
 * any other session created in between). */
export function useCreateNegotiation() {
  const chainId = useChainId();
  const deployment = useMemo(() => deploymentFor(ConfidentialNegotiation, chainId), [chainId]);
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const [isCreating, setIsCreating] = useState(false);

  const createNegotiation = useCallback(
    async (counterparty: `0x${string}`): Promise<bigint> => {
      if (!deployment?.address || !publicClient) throw new Error("Contract not deployed on this chain");
      setIsCreating(true);
      try {
        const hash = await writeContractAsync({
          address: deployment.address,
          abi: deployment.abi,
          functionName: "createSession",
          args: [counterparty],
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        for (const log of receipt.logs) {
          if (log.address.toLowerCase() !== deployment.address.toLowerCase()) continue;
          try {
            const decoded = decodeEventLog({ abi: deployment.abi, data: log.data, topics: log.topics });
            if (decoded.eventName === "SessionCreated") {
              return (decoded.args as { sessionId: bigint }).sessionId;
            }
          } catch {
            // not the event we're looking for
          }
        }
        throw new Error("SessionCreated event not found in receipt");
      } finally {
        setIsCreating(false);
      }
    },
    [deployment, publicClient, writeContractAsync],
  );

  return { createNegotiation, isCreating, hasContract: Boolean(deployment?.address) };
}
