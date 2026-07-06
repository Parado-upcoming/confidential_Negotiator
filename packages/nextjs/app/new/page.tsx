"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { AppShell } from "~~/components/AppShell";
import { useCreateNegotiation } from "~~/hooks/negotiation/useCreateNegotiation";

export default function NewNegotiation() {
  const { isConnected } = useAccount();
  const router = useRouter();
  const { createNegotiation, isCreating } = useCreateNegotiation();
  const [addr, setAddr] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!isConnected) router.push("/");
  }, [isConnected, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = addr.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(v)) {
      setErr("Enter a valid wallet address (0x…, 40 hex characters).");
      return;
    }
    try {
      const id = await createNegotiation(v as `0x${string}`);
      router.push(`/session/${id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <AppShell>
      <div className="animate-fade-up mx-auto mt-8 max-w-lg sm:mt-16">
        <Link href="/dashboard" className="text-xs text-muted-foreground hover:text-foreground">
          ← Back
        </Link>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">New negotiation</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Who are you negotiating with? Enter their wallet address to start.
        </p>

        <form onSubmit={submit} className="mt-10 space-y-6">
          <div>
            <label htmlFor="addr" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Counterparty address
            </label>
            <input
              id="addr"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              placeholder="0x…"
              value={addr}
              onChange={e => {
                setAddr(e.target.value);
                setErr(null);
              }}
              className="mt-3 w-full rounded-2xl border border-border bg-card px-5 py-4 font-mono text-base text-foreground shadow-sm outline-none transition-all placeholder:text-muted-foreground/60 focus:border-foreground focus:ring-2 focus:ring-foreground/10"
            />
            {err ? <p className="mt-2 text-xs text-foreground/70">{err}</p> : null}
          </div>

          <button
            type="submit"
            disabled={isCreating}
            className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-primary px-6 text-[15px] font-medium text-primary-foreground shadow-sm transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-30 sm:w-auto sm:min-w-[220px]"
          >
            {isCreating ? "Starting…" : "Start negotiation"}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
