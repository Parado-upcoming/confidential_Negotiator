"use client";

import { useMemo } from "react";
import { useAccount, useChainId, useReadContract, useReadContracts } from "wagmi";
import { ConfidentialNegotiation } from "~~/contracts/ConfidentialNegotiation";
import { deploymentFor } from "~~/utils/contract";
import { type Negotiation } from "~~/utils/negotiations";

type SessionResult = readonly [`0x${string}`, `0x${string}`, boolean, boolean, boolean];

/** Lists every session the connected wallet is a party to. The contract has
 * no enumerable "sessions by user" index, so this reads `nextSessionId` and
 * multicalls `getSession(i)` for every id, filtering client-side. Fine at
 * demo scale; would need an on-chain index or event-log scan at real scale. */
export function useMyNegotiations() {
  const { address } = useAccount();
  const chainId = useChainId();
  const deployment = useMemo(() => deploymentFor(ConfidentialNegotiation, chainId), [chainId]);
  const hasContract = Boolean(deployment?.address);

  const { data: nextIdRaw, isFetching: isFetchingCount } = useReadContract({
    address: hasContract ? deployment!.address : undefined,
    abi: hasContract ? deployment!.abi : undefined,
    functionName: "nextSessionId" as const,
    query: { enabled: hasContract, refetchInterval: 4000 },
  });
  const nextId = Number((nextIdRaw as bigint | undefined) ?? 0n);

  const contracts = useMemo(() => {
    if (!hasContract) return [];
    return Array.from({ length: nextId }, (_, i) => ({
      address: deployment!.address,
      abi: deployment!.abi,
      functionName: "getSession" as const,
      args: [BigInt(i)] as const,
    }));
  }, [hasContract, deployment, nextId]);

  const { data: results, isFetching: isFetchingSessions } = useReadContracts({
    contracts,
    query: { enabled: contracts.length > 0, refetchInterval: 4000 },
  });

  const negotiations = useMemo<Negotiation[]>(() => {
    if (!address || !results) return [];
    const list: Negotiation[] = [];
    results.forEach((r, i) => {
      if (r.status !== "success" || !r.result) return;
      const [partyA, partyB, ceilingSet, floorSet, revealed] = r.result as SessionResult;
      const isA = partyA.toLowerCase() === address.toLowerCase();
      const isB = partyB.toLowerCase() === address.toLowerCase();
      if (!isA && !isB) return;
      list.push({
        id: BigInt(i),
        counterparty: isA ? partyB : partyA,
        role: isA ? "initiator" : "counterparty",
        youSubmitted: isA ? ceilingSet : floorSet,
        counterpartySubmitted: isA ? floorSet : ceilingSet,
        revealed,
      });
    });
    return list.reverse();
  }, [address, results]);

  return { negotiations, isLoading: isFetchingCount || isFetchingSessions, hasContract };
}
