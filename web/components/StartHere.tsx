"use client";

import { useAccount, useConnect } from "wagmi";
import { Wallet, Coins } from "lucide-react";
import { useDeck } from "@/hooks/useDeck";
import { useMint } from "@/hooks/useMint";
import { WalletButtons } from "./Wallets";
import { chiselSkin } from "./ui/Button";

/**
 * The next step, which can always be taken.
 *
 * Before this, every screen ended in a dead end: an inactive grey "Start
 * battle" button with the reason in small grey type BELOW it; on the case page
 * there was no button at all, only the line "Connect a wallet to open a case".
 * This is the most frequent first screen of the site, and it offered nothing.
 *
 * Here the same obstacle becomes a step. The action on the button is always
 * alive and always leads onward:
 *
 *   no wallet              -> connect one
 *   wallet, no money       -> get test dollars
 *   everything in place    -> the screen's own action
 *
 * The explanation stands ABOVE the action rather than below it: a person reads
 * the reason before reaching for the button, not after.
 *
 * The connector choice is the same <details> as in the header. An identical
 * obstacle should look identical, and disclosure works from the keyboard out
 * of the box and closes on Escape.
 */
export function StartHere({
  what,
  /** A tight spot, a row in a list: only the button stays, without the explanation. */
  compact = false,
}: {
  /**
   * What exactly costs a dollar, "A case", "A seat". Without it the
   * explanation is not printed at all.
   *
   * This is not a whim: on the cut page, under the button, stood "Your own case
   * costs $1 and buys you a real Megapot lottery ticket", and right above it,
   * in the same panel, "it costs you $5.00 + gas". Two different prices side by
   * side, of which the smaller answers a question nobody asked here: the dollar
   * is the price of SOMEBODY ELSE'S open in a future deck, not of the cut.
   */
  what?: string;
  compact?: boolean;
}) {
  const { isConnected, status } = useAccount();
  const { isPending } = useConnect();
  const game = useDeck();
  const { mint, minting } = useMint(game.refetch);

  /**
   * While the wallet is RECONNECTING we still know nothing.
   *
   * wagmi restores the session asynchronously: the first frame after a page
   * reload arrives in the "not connected" state, and only then, a few hundred
   * milliseconds later, it becomes "connected". So on a reload "Connect a
   * wallet" flashed at someone who was already connected, and then the button
   * jumped to the open action. That is exactly what is seen as "it twitches and
   * shows the wrong thing".
   *
   * "I do not know" is a third state, and it has to be shown as not knowing: a
   * space of the same height, dimmed, without a single assertion. The header has
   * done that for a long time (see ConnectBar) and this did not, hence the
   * discrepancy between them for the first second.
   */
  if (status === "connecting" || status === "reconnecting") {
    return (
      <div className={compact ? "relative" : undefined} aria-busy>
        {!compact && what && <p className="mb-3 text-sm leading-relaxed text-transparent">&nbsp;</p>}
        <span
          className={`${chiselSkin(compact ? "sm" : "md")} ${compact ? "" : "w-full"} pointer-events-none opacity-40`}
        >
          <Wallet className={compact ? "h-4 w-4" : "h-5 w-5"} />
          {compact ? "…" : "Checking your wallet…"}
        </span>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className={compact ? "relative" : undefined}>
        {!compact && what && (
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
            <WalletButtons />
          </div>
        </details>
      </div>
    );
  }

  return (
    <div>
      {!compact && what && (
        <p className="mb-3 text-sm leading-relaxed text-slate-200">
          You need $1 to play. Base Sepolia dollars are free and mint straight to your wallet. The
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
