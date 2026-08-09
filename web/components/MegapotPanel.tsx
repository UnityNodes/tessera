"use client";

import { formatUnits } from "viem";
import { Button } from "./ui/Button";
import { DataRow } from "./ui/Panel";
import type { useMegapot } from "@/hooks/useMegapot";

const usd = (v: bigint) =>
  `$${Number(formatUnits(v, 6)).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/**
 *
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



      <DataRow
        name="draw"
        value={mp.stalled ? "stalled" : new Date(mp.endsAt).toUTCString().slice(5, 22)}
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
          Megapot&apos;s testnet draw is frozen, <span className="t-chain">runJackpot()</span>{" "}
          reverts even for its owner, so no winner is picked here. Your ticket is a real
          purchase against the real contract; it just has nothing to play in on Sepolia.
          On Base mainnet the same contract draws every day.
        </p>
      ) : (
        <p className="mt-5 border-t border-slate-800 pt-4 text-sm leading-relaxed text-slate-300">
          Nothing to withdraw yet. If your ticket wins, the button to claim it appears
          right here, you never have to leave.
        </p>
      )}
    </div>
  );
}
