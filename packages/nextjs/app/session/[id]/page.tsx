"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { AppShell } from "~~/components/AppShell";
import { useNegotiationSession } from "~~/hooks/negotiation/useNegotiationSession";
import { getStatus, truncate } from "~~/utils/negotiations";

function SessionMissing() {
  return (
    <AppShell>
      <div className="mx-auto mt-24 max-w-md text-center">
        <h1 className="text-2xl font-semibold">Negotiation not found</h1>
        <Link href="/dashboard" className="mt-6 inline-block text-sm text-muted-foreground hover:text-foreground">
          ← Back to dashboard
        </Link>
      </div>
    </AppShell>
  );
}

export default function SessionDetail() {
  const params = useParams<{ id: string }>();
  const sessionId = useMemo(() => {
    try {
      return BigInt(params.id);
    } catch {
      return null;
    }
  }, [params.id]);

  const { isConnected } = useAccount();
  const router = useRouter();

  useEffect(() => {
    if (!isConnected) router.push("/");
  }, [isConnected, router]);

  if (sessionId === null) return <SessionMissing />;
  return <SessionDetailInner sessionId={sessionId} />;
}

function SessionDetailInner({ sessionId }: { sessionId: bigint }) {
  const {
    negotiation,
    isLoadingSession,
    isSubmitting,
    isRevealing,
    isAllowing,
    isDecrypting,
    canStartDecrypt,
    message,
    submitNumber,
    reveal,
    startDecrypt,
    result,
  } = useNegotiationSession(sessionId);

  if (isLoadingSession) {
    return (
      <AppShell>
        <p className="mt-16 text-center text-sm text-muted-foreground">Loading negotiation…</p>
      </AppShell>
    );
  }

  if (!negotiation) return <SessionMissing />;

  const status = getStatus(negotiation);

  return (
    <AppShell>
      <div className="animate-fade-up mx-auto mt-8 max-w-xl sm:mt-14">
        <Link href="/dashboard" className="text-xs text-muted-foreground hover:text-foreground">
          ← All negotiations
        </Link>

        <div className="mt-6 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">With</div>
            <div className="mt-1 truncate font-mono text-lg font-medium">{truncate(negotiation.counterparty)}</div>
          </div>
        </div>

        <div className="mt-10">
          {status === "awaiting_you" ? (
            <SubmitCard role={negotiation.role} isSubmitting={isSubmitting} onSubmit={submitNumber} />
          ) : null}

          {status === "awaiting_counterparty" ? <WaitingCard address={negotiation.counterparty} /> : null}

          {status === "ready_to_reveal" ? <ReadyToRevealCard isRevealing={isRevealing} onReveal={reveal} /> : null}

          {status === "revealed" && !result ? (
            <DecryptCard isBusy={isAllowing || isDecrypting} canStart={canStartDecrypt} onDecrypt={startDecrypt} />
          ) : null}

          {result ? <ResultCard deal={result.deal} midpoint={result.midpoint} /> : null}
        </div>

        {message ? <p className="mt-6 text-center text-xs text-muted-foreground/70">{message}</p> : null}

        <TrustLine />
      </div>
    </AppShell>
  );
}

function LockGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4" aria-hidden>
      <rect x="4" y="10" width="16" height="10" rx="2.5" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" strokeLinecap="round" />
    </svg>
  );
}

function SubmitCard({
  role,
  isSubmitting,
  onSubmit,
}: {
  role: "initiator" | "counterparty";
  isSubmitting: boolean;
  onSubmit: (v: number) => void;
}) {
  const [value, setValue] = useState("");
  const label = role === "initiator" ? "Your maximum offer" : "Your minimum acceptable amount";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(value.replace(/,/g, ""));
    if (!Number.isFinite(n) || n <= 0) return;
    onSubmit(n);
  };

  return (
    <form onSubmit={submit} className="rounded-3xl border border-border bg-card p-8 shadow-sm sm:p-10">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-3xl font-light text-muted-foreground sm:text-4xl">$</span>
        <input
          autoFocus
          inputMode="decimal"
          placeholder="0"
          value={value}
          onChange={e => setValue(e.target.value.replace(/[^0-9.,]/g, ""))}
          className="w-full bg-transparent text-5xl font-semibold tracking-tight text-foreground outline-none placeholder:text-muted-foreground/30 sm:text-6xl"
        />
      </div>

      <div className="mt-8 flex items-start gap-2 text-xs text-muted-foreground">
        <span className="mt-0.5 shrink-0">
          <LockGlyph />
        </span>
        <p>Encrypted on your device before it&apos;s sent. No one — including us — can see this number.</p>
      </div>

      <button
        type="submit"
        disabled={!value || isSubmitting}
        className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-primary px-6 text-[15px] font-medium text-primary-foreground shadow-sm transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-30"
      >
        {isSubmitting ? "Submitting…" : "Submit privately"}
      </button>
    </form>
  );
}

function WaitingCard({ address }: { address: string }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-10 text-center shadow-sm sm:p-14">
      <div className="mx-auto flex items-center justify-center gap-2">
        <span className="animate-soft-pulse inline-block h-2 w-2 rounded-full bg-foreground" />
      </div>
      <h2 className="mt-6 text-xl font-medium tracking-tight sm:text-2xl">Waiting for {truncate(address)}</h2>
      <p className="mt-3 text-sm text-muted-foreground">
        Your number is locked in. We&apos;ll let you know the moment they respond.
      </p>
    </div>
  );
}

function ReadyToRevealCard({ isRevealing, onReveal }: { isRevealing: boolean; onReveal: () => void }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-10 text-center shadow-sm sm:p-14">
      <h2 className="text-xl font-medium tracking-tight sm:text-2xl">Both numbers are in</h2>
      <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">
        The comparison is ready. Reveal the outcome — never either number.
      </p>
      <button
        onClick={onReveal}
        disabled={isRevealing}
        className="mt-8 inline-flex h-12 min-w-[220px] items-center justify-center rounded-2xl bg-primary px-6 text-[15px] font-medium text-primary-foreground shadow-sm transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-30"
      >
        {isRevealing ? "Revealing…" : "Reveal outcome"}
      </button>
    </div>
  );
}

function DecryptCard({ isBusy, canStart, onDecrypt }: { isBusy: boolean; canStart: boolean; onDecrypt: () => void }) {
  if (isBusy) {
    return (
      <div className="rounded-3xl border border-border bg-card p-14 text-center shadow-sm">
        <div className="mx-auto flex items-center justify-center gap-1.5">
          <span
            className="animate-soft-pulse inline-block h-1.5 w-1.5 rounded-full bg-foreground"
            style={{ animationDelay: "0ms" }}
          />
          <span
            className="animate-soft-pulse inline-block h-1.5 w-1.5 rounded-full bg-foreground"
            style={{ animationDelay: "200ms" }}
          />
          <span
            className="animate-soft-pulse inline-block h-1.5 w-1.5 rounded-full bg-foreground"
            style={{ animationDelay: "400ms" }}
          />
        </div>
        <p className="mt-6 text-sm text-muted-foreground">Decrypting…</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-10 text-center shadow-sm sm:p-14">
      <h2 className="text-xl font-medium tracking-tight sm:text-2xl">Sign to decrypt the result</h2>
      <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">
        Only you can unlock the outcome. Approve the signature in your wallet to continue.
      </p>
      <button
        onClick={onDecrypt}
        disabled={!canStart}
        className="mt-8 inline-flex h-12 min-w-[220px] items-center justify-center rounded-2xl bg-primary px-6 text-[15px] font-medium text-primary-foreground shadow-sm transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-30"
      >
        Decrypt result
      </button>
    </div>
  );
}

function ResultCard({ deal, midpoint }: { deal: boolean; midpoint?: number }) {
  return (
    <div className="animate-fade-up rounded-3xl border border-border bg-card p-10 text-center shadow-sm sm:p-14">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-border sm:h-20 sm:w-20">
        {deal ? (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-8 w-8 sm:h-10 sm:w-10"
          >
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            className="h-8 w-8 sm:h-10 sm:w-10"
          >
            <path d="M7 7l10 10M17 7L7 17" />
          </svg>
        )}
      </div>

      <h2 className="mt-8 text-2xl font-semibold tracking-tight sm:text-3xl">
        {deal ? "Deal possible" : "No overlap found"}
      </h2>

      {deal && typeof midpoint === "number" ? (
        <div className="mt-6">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Suggested midpoint</div>
          <div className="mt-2 text-5xl font-semibold tracking-tight sm:text-6xl">${midpoint.toLocaleString()}</div>
        </div>
      ) : (
        <p className="mx-auto mt-4 max-w-sm text-sm text-muted-foreground">
          Neither number was revealed. You can try a new negotiation any time.
        </p>
      )}
    </div>
  );
}

function TrustLine() {
  return (
    <p className="mt-8 text-center text-xs text-muted-foreground">
      Only this outcome was ever shared. Your number stayed private the whole time.
    </p>
  );
}
