"use client";

import { type ReactNode, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { blo } from "blo";
import { useAccount, useChainId, useDisconnect, useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";
import { ConfidentialNegotiation } from "~~/contracts/ConfidentialNegotiation";
import { useOutsideClick } from "~~/hooks/helper";
import { deploymentFor } from "~~/utils/contract";
import { getBlockExplorerAddressLink } from "~~/utils/helper";
import { truncate } from "~~/utils/negotiations";

function CopyGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5" aria-hidden>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </svg>
  );
}

function NetworkStatus() {
  const chainId = useChainId();
  const { chain } = useAccount();
  const { switchChain, isPending } = useSwitchChain();
  const hasContract = Boolean(deploymentFor(ConfidentialNegotiation, chainId)?.address);

  if (hasContract) {
    return <span className="text-xs text-muted-foreground">{chain?.name ?? "Connected"}</span>;
  }

  return (
    <button
      onClick={() => switchChain({ chainId: sepolia.id })}
      disabled={isPending}
      className="inline-flex items-center gap-1.5 rounded-full border border-foreground px-2.5 py-1 text-[11px] font-medium text-foreground transition-opacity hover:opacity-70 disabled:opacity-40"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
      {isPending ? "Switching…" : `${chain?.name ?? "Unsupported network"}, switch to Sepolia`}
    </button>
  );
}

function AccountMenu({ address }: { address: `0x${string}` }) {
  const { chain } = useAccount();
  const { disconnect } = useDisconnect();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useOutsideClick(menuRef, () => setOpen(false));

  const explorerLink = chain ? getBlockExplorerAddressLink(chain, address) : null;
  const isLocalExplorer = explorerLink?.startsWith("/blockexplorer");

  return (
    <div className="flex items-center gap-2">
      <NetworkStatus />
      <div ref={menuRef} className="relative">
        <button
          onClick={() => setOpen(o => !o)}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={blo(address)} alt="" width={20} height={20} className="rounded-full" />
          {truncate(address)}
        </button>
        {open ? (
          <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-52 overflow-hidden rounded-2xl border border-border bg-card shadow-md">
            <button
              onClick={() => {
                navigator.clipboard.writeText(address);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="flex w-full items-center gap-2 px-4 py-3 text-left text-xs font-medium text-foreground transition-colors hover:bg-secondary"
            >
              <CopyGlyph />
              {copied ? "Copied" : "Copy address"}
            </button>
            {explorerLink && !isLocalExplorer ? (
              <a
                href={explorerLink}
                target="_blank"
                rel="noreferrer"
                className="block px-4 py-3 text-left text-xs font-medium text-foreground transition-colors hover:bg-secondary"
              >
                View on Etherscan
              </a>
            ) : null}
            <button
              onClick={() => {
                setOpen(false);
                disconnect();
                router.push("/");
              }}
              className="block w-full border-t border-border px-4 py-3 text-left text-xs font-medium text-foreground transition-colors hover:bg-secondary"
            >
              Disconnect
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { address } = useAccount();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 mx-auto flex w-full max-w-5xl items-center justify-between bg-background px-6 py-5 sm:py-7">
        <Link href="/" className="text-sm font-medium tracking-tight text-foreground/90 hover:text-foreground">
          Confidential Negotiation
        </Link>
        {address ? <AccountMenu address={address} /> : null}
      </header>
      <main className="mx-auto w-full max-w-5xl px-6 pb-24">{children}</main>
    </div>
  );
}
