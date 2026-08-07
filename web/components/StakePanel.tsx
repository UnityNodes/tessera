"use client";

import { Button } from "./ui/Button";
import { WEIGHT_PER_TICKET } from "@/lib/deck";
import type { useStake } from "@/hooks/useStake";
import type { Slot } from "@/hooks/useInventory";

/**
 *
 */
export function StakePanel({
  stake,
  toRedeem,
  weight,
  decided,
  decidingInBattle,
  onRedeem,
  redeeming,
  treasury,
  ticketPrice,
}: {
  stake: ReturnType<typeof useStake>;
  toRedeem: Slot[];
  weight: number;
  decided?: { value: number; signatures: `0x${string}`[] };
  decidingInBattle?: boolean;
  onRedeem: () => void;
  redeeming: boolean;
  treasury: bigint;
  ticketPrice: bigint;
}) {
  const busy = stake.state.phase === "signing" || stake.state.phase === "confirming";

  if (stake.bankedWeight >= WEIGHT_PER_TICKET) {
    return (
      <div className="mt-6">
        <p className="mb-3 text-sm" style={{ color: "var(--color-tier-aureus)" }}>
          You won. {stake.bankedWeight} weight banked, {" "}
          {Math.floor(stake.bankedWeight / WEIGHT_PER_TICKET)} real ticket
          {Math.floor(stake.bankedWeight / WEIGHT_PER_TICKET) > 1 ? "s" : ""} waiting.
        </p>
        <Button block disabled={busy} onClick={() => void stake.claim()}>
          {busy ? "Claiming…" : "Claim what you won"}
        </Button>
        {stake.state.error && (
          <p className="mt-3 text-sm text-[var(--color-danger)]">
            {stake.state.error.title}
            {stake.state.error.next && (
              <span className="block text-slate-500">
                {stake.state.error.next}
              </span>
            )}
          </p>
        )}
      </div>
    );
  }

  if (stake.open) {
    if (!stake.ready) {
      return (
        <p className="mt-6 text-sm text-slate-400">
          <span className="t-chain font-bold text-slate-100">{stake.stakedWeight}</span>{" "}
          weight is riding on your next case. Open one to find out.
        </p>
      );
    }
    return (
      <div className="mt-6">
        <p className="mb-3 text-sm text-slate-400">
          Your next case is drawn. It decides the{" "}
          <span className="t-chain font-bold text-slate-100">{stake.stakedWeight}</span> you
          staked.
        </p>
        <Button
          block
          disabled={busy || !decided}
          onClick={() => decided && void stake.settle(decided.value, decided.signatures)}
        >
          {busy
            ? "Settling…"
            : decidingInBattle
              ? "That card is in a battle"
              : decided
                ? "Settle the stake"
                : "Waiting for the covalidators…"}
        </Button>
        {decidingInBattle && (
          <p className="mt-3 text-sm text-slate-400">
            The case that decides this stake was drawn into a battle. Settle the battle
            first, anyone can, and the loser cannot freeze it by staying away.
          </p>
        )}
        {stake.state.phase === "done" && stake.state.won === false && (
          <p className="mt-3 text-sm text-slate-400">
            Empty. The stake burned, but every ticket you paid for is still yours.
          </p>
        )}
      </div>
    );
  }

  if (toRedeem.length === 0) return null;

  const tickets = Math.floor(weight / WEIGHT_PER_TICKET);
  const needed = ticketPrice * BigInt(tickets);
  const canPay = treasury >= needed;
  const shortBy = canPay ? 0n : needed - treasury;

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button block disabled={redeeming || busy || !canPay} onClick={onRedeem}>
          {redeeming
            ? "Claiming…"
            : canPay
              ? `Take ${tickets} ticket${tickets > 1 ? "s" : ""}`
              : "Not funded yet"}
        </Button>
        <Button
          block
          variant="quiet"
          disabled={busy}
          onClick={() => void stake.stake(toRedeem)}
        >
          {busy ? "Staking…" : `Risk ${weight} for ${weight * 2}`}
        </Button>
      </div>
      {!canPay && (
        <p className="mt-3 text-sm text-slate-400">
          The game funds prizes out of the commission it earns, and it is{" "}
          <span className="t-chain">${(Number(shortBy) / 1e6).toFixed(2)}</span> short.
          About {Math.ceil(Number(shortBy) / 100_000)} more opens, by anyone, and this
          ticket is yours. Nothing expires.
        </p>
      )}
      <p className="mt-3 text-sm text-slate-500">
        Risking stakes the bonus, never your money, the dollar you paid already
        bought a real ticket. Your next case decides it: anything at all doubles
        the {weight}, an empty slot burns it.
      </p>
      {stake.budgetLeft > 0 && (
        <p className="t-label mt-2">
          season prize budget left: {stake.budgetLeft} weight
        </p>
      )}
    </div>
  );
}
