"use client";

import { formatUnits } from "viem";
import { Button } from "./ui/Button";
import { DataRow } from "./ui/Panel";
import type { useMegapot } from "@/hooks/useMegapot";

const usd = (v: bigint) =>
  // minimumFractionDigits as well: without it $515.10 came out as "$515.1" and
  // a sum of money looked truncated.
  `$${Number(formatUnits(v, 6)).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/**
 * A player's ticket, from purchase to payout, without a trip to Megapot's site.
 *
 * Everything here is read from the jackpot itself and called by the player's own
 * wallet directly; we only display it. Which is why "depth of integration" here
 * is not about our calling purchaseTickets but about a person having nowhere
 * else to go.
 */
export function MegapotPanel({ mp }: { mp: ReturnType<typeof useMegapot> }) {
  const busy = mp.claim.phase === "signing" || mp.claim.phase === "confirming";

  return (
    <div>
      <div className="mb-5">
        <span className="t-label block">the jackpot your tickets are in</span>
        <span
          className="t-chain mt-2 block text-3xl font-extrabold"
          style={{
            color: "var(--color-tier-aureus)",
            textShadow: "0 0 30px rgb(251 191 36 / 0.35)",
          }}
        >
          {usd(mp.prizePool)}
        </span>
      </div>

      {/* "your tickets" moved from here into the wallet panel, together with
          the rest of what is yours. The number was the same one from the same
          hook, and showing it twice within two clicks of each other meant
          asking the reader whether those might be different numbers.

          "liquidity behind it" went away entirely. The Megapot liquidity pool
          is a real number from the chain, but it changes no decision of the
          player and explains nothing about their ticket. A number that stands
          there only to make the panel look weighty is noise, however real it
          may be.

          Two are left: how much is in the pot, because that is the very lottery
          the ticket was bought into, and the state of the draw. */}
      <DataRow
        name="draw"
        value={mp.stalled ? "stalled" : new Date(mp.endsAt).toUTCString().slice(5, 22)}
        // A stopped drawing used to be green, that is, the colour of action and
        // luck. Green read as "all is well" when in fact it is a state in which
        // winning is impossible.
        ink={mp.stalled ? "var(--color-ink-dim)" : "var(--color-ink)"}
      />

      {mp.hasWinnings ? (
        <div className="mt-6">
          <p className="mb-3 text-lg" style={{ color: "var(--color-tier-aureus)" }}>
            You won {usd(mp.winnings)}.
          </p>
          <Button block disabled={busy} onClick={() => void mp.withdraw()}>
            {busy ? "Claiming…" : "Withdraw your winnings"}
          </Button>
          {mp.claim.error && (
            <p className="mt-3 text-sm text-[var(--color-danger)]">
              {mp.claim.error.title}
            </p>
          )}
        </div>
      ) : mp.stalled ? (
        <p className="mt-5 border-t border-slate-800 pt-4 text-sm leading-relaxed text-slate-300">
          Megapot&apos;s testnet draw is frozen: <span className="t-chain">runJackpot()</span>{" "}
          reverts even for its owner, so no winner is picked here. Your ticket is a real
          purchase against the real contract; it just has nothing to play in on Sepolia.
          On Base mainnet the same contract draws every day.
        </p>
      ) : (
        <p className="mt-5 border-t border-slate-800 pt-4 text-sm leading-relaxed text-slate-300">
          Nothing to withdraw yet. If your ticket wins, the button to claim it appears
          right here, and you never have to leave.
        </p>
      )}
    </div>
  );
}
