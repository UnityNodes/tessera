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
  onRedeem,
  redeeming,
}: {
  stake: ReturnType<typeof useStake>;
  toRedeem: Slot[];
  weight: number;
  decided?: { value: number; signatures: `0x${string}`[] };
  onRedeem: () => void;
  redeeming: boolean;
}) {
  const busy = stake.state.phase === "signing" || stake.state.phase === "confirming";

  if (stake.bankedWeight >= WEIGHT_PER_TICKET) {
    return (
      <div className="mt-6">
        <p className="mb-3 text-[0.9375rem] text-[var(--color-ochre-300)]">
          You won. {stake.bankedWeight} weight banked, {" "}
          {Math.floor(stake.bankedWeight / WEIGHT_PER_TICKET)} real ticket
          {Math.floor(stake.bankedWeight / WEIGHT_PER_TICKET) > 1 ? "s" : ""} waiting.
        </p>
        <Button block disabled={busy} onClick={() => void stake.claim()}>
          {busy ? "Claiming…" : "Claim what you won"}
        </Button>
        {stake.state.error && (
          <p className="mt-3 text-[0.9375rem] text-[var(--color-sinopia-400)]">
            {stake.state.error.title}
            {stake.state.error.next && (
              <span className="block text-[var(--color-travertine-faint)]">
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
        <p className="mt-6 text-[0.9375rem] text-[var(--color-travertine-dim)]">
          <span className="t-chain text-[var(--color-travertine)]">{stake.stakedWeight}</span>{" "}
          weight is riding on your next case. Open one to find out.
        </p>
      );
    }
    return (
      <div className="mt-6">
        <p className="mb-3 text-[0.9375rem] text-[var(--color-travertine-dim)]">
          Your next case is drawn. It decides the{" "}
          <span className="t-chain text-[var(--color-travertine)]">{stake.stakedWeight}</span> you
          staked.
        </p>
        <Button
          block
          disabled={busy || !decided}
          onClick={() => decided && void stake.settle(decided.value, decided.signatures)}
        >
          {busy ? "Settling…" : decided ? "Settle the stake" : "Waiting for the covalidators…"}
        </Button>
        {stake.state.phase === "done" && stake.state.won === false && (
          <p className="mt-3 text-[0.9375rem] text-[var(--color-travertine-dim)]">
            Empty. The stake burned, but every ticket you paid for is still yours.
          </p>
        )}
      </div>
    );
  }

  if (toRedeem.length === 0) return null;

  const tickets = Math.floor(weight / WEIGHT_PER_TICKET);

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button block disabled={redeeming || busy} onClick={onRedeem}>
          {redeeming ? "Claiming…" : `Take ${tickets} ticket${tickets > 1 ? "s" : ""}`}
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
      <p className="mt-3 text-[0.9375rem] text-[var(--color-travertine-faint)]">
        Risking stakes the bonus, never your money, the dollar you paid already
        bought a real ticket. Your next case decides it: anything at all doubles
        the {weight}, an empty slot burns it.
      </p>
      {stake.budgetLeft > 0 && (
        <p className="mt-2 t-label">
          season prize budget left: {stake.budgetLeft} weight
        </p>
      )}
    </div>
  );
}
