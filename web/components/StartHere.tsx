"use client";

import { useAccount, useConnect } from "wagmi";
import { Wallet, Coins } from "lucide-react";
import { useDeck } from "@/hooks/useDeck";
import { useMint } from "@/hooks/useMint";
import { chiselSkin } from "./ui/Button";

/**
 *
 *
 *
 *
 *
 */
export function StartHere({
  what,
  compact = false,
}: {
  what: string;
  compact?: boolean;
}) {
  const { isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const game = useDeck();
  const { mint, minting } = useMint(game.refetch);

  if (!isConnected) {
    return (
      <div className={compact ? "relative" : undefined}>
        {!compact && (
          <p className="mb-3 text-sm leading-relaxed text-slate-200">
            {what} costs $1 and buys you a real Megapot lottery ticket. On this testnet the dollars
            are free.
          </p>
        )}
        <details className="group/s">
          <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            <span className={`${chiselSkin(compact ? "sm" : "md")} ${compact ? "" : "w-full"}`}>
              <Wallet className={compact ? "h-4 w-4" : "h-5 w-5"} />
              {isPending ? "Connecting…" : compact ? "Connect to join" : "Connect a wallet"}
            </span>
          </summary>
          <div
            className={`flex flex-col gap-1 rounded-[var(--radius-panel)] border border-slate-800 bg-[var(--color-modal)] p-2 ${
              compact ? "absolute right-0 z-[var(--z-sticky)] mt-2 w-48 shadow-2xl" : "mt-2"
            }`}
          >
            {connectors.map((c) => (
              <button
                key={c.uid}
                type="button"
                onClick={() => connect({ connector: c })}
                className="flex min-h-11 cursor-pointer items-center rounded-[var(--radius-control)] px-3 py-2.5 text-left text-sm font-bold text-slate-200 transition-colors hover:bg-slate-800 hover:text-[var(--color-accent-hover)]"
              >
                {c.name}
              </button>
            ))}
          </div>
        </details>
      </div>
    );
  }

  return (
    <div>
      {!compact && (
        <p className="mb-3 text-sm leading-relaxed text-slate-200">
          You need $1 to play. Base Sepolia dollars are free and mint straight to your wallet, the
          money is fake, the ticket contract is not.
        </p>
      )}
      <button
        type="button"
        onClick={() => void mint()}
        disabled={minting}
        className={`${chiselSkin(compact ? "sm" : "md")} cursor-pointer disabled:cursor-progress disabled:opacity-60 ${
          compact ? "" : "w-full"
        }`}
      >
        <Coins className={compact ? "h-4 w-4" : "h-5 w-5"} />
        {minting ? "Minting…" : compact ? "Get $20 free" : "Get $20 in test dollars"}
      </button>
    </div>
  );
}
