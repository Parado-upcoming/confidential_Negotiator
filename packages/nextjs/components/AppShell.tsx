"use client";

import { type ReactNode, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAccount, useDisconnect } from "wagmi";
import { useOutsideClick } from "~~/hooks/helper";
import { truncate } from "~~/utils/negotiations";

function AccountMenu({ address }: { address: `0x${string}` }) {
  const { disconnect } = useDisconnect();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useOutsideClick(menuRef, () => setOpen(false));

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        {truncate(address)}
      </button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+8px)] w-40 overflow-hidden rounded-2xl border border-border bg-card shadow-md">
          <button
            onClick={() => {
              setOpen(false);
              disconnect();
              router.push("/");
            }}
            className="block w-full px-4 py-3 text-left text-xs font-medium text-foreground transition-colors hover:bg-secondary"
          >
            Disconnect
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { address } = useAccount();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5 sm:py-7">
        <Link href="/" className="text-sm font-medium tracking-tight text-foreground/90 hover:text-foreground">
          Confidential Negotiation
        </Link>
        {address ? <AccountMenu address={address} /> : null}
      </header>
      <main className="mx-auto w-full max-w-5xl px-6 pb-24">{children}</main>
    </div>
  );
}
