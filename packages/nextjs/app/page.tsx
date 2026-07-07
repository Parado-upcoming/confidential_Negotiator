"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";

export default function Landing() {
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const router = useRouter();

  useEffect(() => {
    if (isConnected) router.push("/dashboard");
  }, [isConnected, router]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5 sm:py-7">
        <span className="text-sm font-medium tracking-tight">Confidential Negotiation</span>
      </div>
      <main className="flex flex-1 items-center justify-center px-6">
        <div className="animate-fade-up mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-6xl sm:leading-[1.05]">
            Agree on a number.
            <br />
            <span className="relative inline-block">
              <span className="text-muted-foreground">Reveal nothing else.</span>
              <svg
                className="pointer-events-none absolute -inset-x-3 top-[100%] h-6 w-[calc(100%+1.5rem)] text-foreground sm:-inset-x-4 sm:h-8"
                viewBox="0 0 400 32"
                preserveAspectRatio="none"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M12 8 C 40 4, 60 18, 95 10 S 165 2, 200 12 S 270 20, 310 8 S 365 2, 388 10"
                  stroke="currentColor"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-md text-base text-muted-foreground sm:mt-8 sm:text-lg">
            Two people. One number each. Find out if they meet, without either one ever seeing the other&apos;s.
          </p>
          <div className="mt-10 sm:mt-12">
            <button
              onClick={openConnectModal}
              className="inline-flex h-12 min-w-[220px] items-center justify-center rounded-2xl bg-primary px-8 text-[15px] font-medium text-primary-foreground shadow-sm transition-all hover:opacity-90 active:scale-[0.98]"
            >
              Connect wallet
            </button>
          </div>
          <p className="mt-6 text-xs text-muted-foreground/80">Your number stays on your device. Always.</p>
        </div>
      </main>
    </div>
  );
}
