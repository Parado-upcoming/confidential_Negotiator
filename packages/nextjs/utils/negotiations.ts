export type Role = "initiator" | "counterparty";
export type Status = "awaiting_you" | "awaiting_counterparty" | "ready_to_reveal" | "revealed";

export interface Negotiation {
  id: bigint;
  counterparty: `0x${string}`;
  role: Role;
  youSubmitted: boolean;
  counterpartySubmitted: boolean;
  revealed: boolean;
}

export function getStatus(n: Negotiation): Status {
  if (n.revealed) return "revealed";
  if (n.youSubmitted && n.counterpartySubmitted) return "ready_to_reveal";
  if (n.youSubmitted && !n.counterpartySubmitted) return "awaiting_counterparty";
  return "awaiting_you";
}

export function statusLabel(s: Status): string {
  switch (s) {
    case "awaiting_you":
      return "Your turn";
    case "awaiting_counterparty":
      return "Awaiting counterparty";
    case "ready_to_reveal":
      return "Ready to reveal";
    case "revealed":
      return "Revealed";
  }
}

export function truncate(addr: string) {
  if (!addr) return "";
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-3)}`;
}
