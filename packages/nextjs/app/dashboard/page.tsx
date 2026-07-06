"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { AppShell } from "~~/components/AppShell";
import { useMyNegotiations } from "~~/hooks/negotiation/useMyNegotiations";
import { getStatus, statusLabel, truncate } from "~~/utils/negotiations";

export default function Dashboard() {
  const { isConnected } = useAccount();
  const router = useRouter();
  const { negotiations, isLoading } = useMyNegotiations();

  useEffect(() => {
    if (!isConnected) router.push("/");
  }, [isConnected, router]);

  return (
    <AppShell>
      <div className="animate-fade-up mt-6 sm:mt-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Your negotiations</h1>
            <p className="mt-2 text-sm text-muted-foreground">Private by design. Only outcomes are ever shared.</p>
          </div>
          <Link
            href="/new"
            className="inline-flex h-11 items-center justify-center self-start rounded-2xl bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:opacity-90 active:scale-[0.98] sm:self-auto"
          >
            + New negotiation
          </Link>
        </div>

        <div className="mt-8">
          {negotiations.length === 0 ? (
            isLoading ? (
              <p className="mt-4 text-sm text-muted-foreground">Loading your negotiations…</p>
            ) : (
              <EmptyState />
            )
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {negotiations.map(n => {
                const s = getStatus(n);
                return (
                  <li key={n.id.toString()}>
                    <Link
                      href={`/session/${n.id}`}
                      className="group block rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-[1px] hover:shadow-md sm:p-6"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-xs uppercase tracking-wider text-muted-foreground">Counterparty</div>
                          <div className="mt-1 truncate font-mono text-base font-medium text-foreground">
                            {truncate(n.counterparty)}
                          </div>
                        </div>
                        <StatusPill status={s} />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function EmptyState() {
  return (
    <div className="mt-4 rounded-3xl border border-dashed border-border bg-card/50 px-6 py-16 text-center sm:py-24">
      <div className="mx-auto max-w-sm">
        <h2 className="text-lg font-medium">No negotiations yet</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Start one by entering the other person&apos;s wallet address. They&apos;ll be notified without seeing anything
          else.
        </p>
        <Link
          href="/new"
          className="mt-8 inline-flex h-11 items-center justify-center rounded-2xl bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:opacity-90 active:scale-[0.98]"
        >
          + New negotiation
        </Link>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: ReturnType<typeof getStatus> }) {
  const isRevealed = status === "revealed";
  return (
    <span
      className={[
        "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        isRevealed
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-secondary text-muted-foreground",
      ].join(" ")}
    >
      {statusLabel(status)}
    </span>
  );
}
