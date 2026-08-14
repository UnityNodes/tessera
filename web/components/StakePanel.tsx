"use client";

import { Button } from "./ui/Button";
import { WEIGHT_PER_TICKET } from "@/lib/deck";
import type { useStake } from "@/hooks/useStake";
import type { Slot } from "@/hooks/useInventory";

/**
 * Take it or risk it.
 *
 * Both buttons sit side by side and are equally prominent: that is a decision,
 * not a hint. The text names the price of the choice in figures every time,
 * because "double" without "or lose" is no longer an offer but an incitement.
 *
 * The unit here is TESA, and nothing else.
 *
 * The panel used to say "58 weight", "Risk 25 for 50", "budget left: N weight",
 * a word that does not exist in the game. lib/deck.ts says it outright: "The
 * player never sees the word 'weight'... those are the contract's accounting
 * units." The rule was written down and broken in exactly the place where the
 * player spends what they collected: they collect TESA, and the exchange panel
 * speaks a different language to them and offers to risk "weight".
 *
 * The unit matches one to one: TESA weighs 1, five make up a ticket. So "58
 * weight" is exactly 58 TESA, with no conversion at all.
 */
export function StakePanel({
  stake,
  toRedeem,
  decided,
  decidingInBattle,
  onRedeem,
  redeeming,
  treasury,
  ticketPrice,
  treasuryPerOpen,
}: {
  stake: ReturnType<typeof useStake>;
  /** Exactly the slots that go into the transaction: both the exchange and the stake act on them. */
  toRedeem: Slot[];
  /** The value of the slot that decides the stake, and the labels, once known. */
  decided?: { value: number; signatures: `0x${string}`[] };
  /** The slot that decides the stake is currently in an unfinished battle. */
  decidingInBattle?: boolean;
  onRedeem: () => void;
  redeeming: boolean;
  /** How much the treasury can pay out right now, in the ticket token. */
  treasury: bigint;
  ticketPrice: bigint;
  /** How much the treasury takes from ONE open, after the vault share. */
  treasuryPerOpen: bigint;
}) {
  const busy = stake.state.phase === "signing" || stake.state.phase === "confirming";

  // -- the stake is closed, there is something to take ---------------------
  if (stake.bankedWeight >= WEIGHT_PER_TICKET) {
    return (
      <div className="mt-6">
        <p className="mb-3 text-sm" style={{ color: "var(--color-tier-aureus)" }}>
          You won. {stake.bankedWeight} TESA banked,{" "}
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
              <span className="block text-slate-400">
                {stake.state.error.next}
              </span>
            )}
          </p>
        )}
      </div>
    );
  }

  // -- the stake is open ---------------------------------------------------
  if (stake.open) {
    if (!stake.ready) {
      return (
        <p className="mt-6 text-sm text-slate-300">
          <span className="t-chain font-bold text-slate-100">{stake.stakedWeight} TESA</span>{" "}
          are riding on your next case. Open one to find out.
        </p>
      );
    }
    return (
      <div className="mt-6">
        <p className="mb-3 text-sm text-slate-300">
          Your next case is drawn. It decides the{" "}
          <span className="t-chain font-bold text-slate-100">{stake.stakedWeight} TESA</span> you
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
        {/* "Waiting for the covalidators" would be a lie here: the value is
            already known, it is the battle that holds it. The difference matters:
            covalidators answer in seconds, and a battle waits for a person. */}
        {decidingInBattle && (
          <p className="mt-3 text-sm text-slate-300">
            The case that decides this stake was drawn into a battle. Settle the battle
            first: anyone can, and the loser cannot freeze it by staying away.
          </p>
        )}
        {stake.state.phase === "done" && stake.state.won === false && (
          <p className="mt-3 text-sm text-slate-300">
            Empty. The stake burned, but every ticket you paid for is still yours.
          </p>
        )}
      </div>
    );
  }

  // -- nothing is staked ---------------------------------------------------
  if (toRedeem.length === 0) return null;

  // Count from WHAT goes into the transaction, not from everything in hand.
  //
  // Both buttons act on `toRedeem`, the set pickForRedeem assembled: heaviest
  // first, exactly up to a whole ticket. But the labels and the funds check
  // were taken from the full weight of the inventory, and on the discrepancy
  // the screen started to lie. Measured: 58 weight in hand, $9.15 in the
  // treasury, and the panel counted 11 tickets for $11, found no money and
  // dimmed the button with "Not funded yet". In reality it could be pressed at
  // any time: the exchange would submit one slot of 25 weight, that is, 5
  // tickets for $5.
  //
  // A button that names somebody else's number and disables itself for
  // somebody else's reason is worse than no button: the player sees that the
  // game owes them, and that it does not pay.
  const picked = toRedeem.reduce((n, s) => n + s.weight, 0);
  const tickets = Math.floor(picked / WEIGHT_PER_TICKET);
  const needed = ticketPrice * BigInt(tickets);
  // The treasury fills up from the fee on opens, so a won ticket sometimes has
  // to wait. Better to say so in advance than to let someone press a button
  // that will fail.
  const canPay = treasury >= needed;
  const shortBy = canPay ? 0n : needed - treasury;
  const opensLeft =
    treasuryPerOpen > 0n ? Math.ceil(Number(shortBy) / Number(treasuryPerOpen)) : 0;

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
          {busy ? "Staking…" : `Risk ${picked} TESA for ${picked * 2}`}
        </Button>
      </div>
      {!canPay && (
        <p className="mt-3 text-sm text-slate-300">
          The game funds prizes out of the commission it earns, and it is{" "}
          <span className="t-chain">${(Number(shortBy) / 1e6).toFixed(2)}</span> short.
          {/* We divide by what actually reaches the treasury from an open rather
              than by the whole fee: the vault share settles across the decks and
              pays for no prizes. While the whole fee stood here, the caption
              "another five opens" was more optimistic than the chain by exactly
              that share, and in the very place where a player is told a
              deadline. */}
          About {opensLeft} more open{opensLeft > 1 ? "s" : ""}, by anyone, and this
          ticket is yours. Nothing expires.
        </p>
      )}
      {/* "Anything at all doubles" was untrue in exactly one case, and in the best
          one at that. A stake is settled by `settleStake`, and it judges by
          WEIGHT: `weightOf(value) > 0`. A vault slot weighs zero, its value is
          not in weight but in the money itself, so a card that opens the vault
          BURNS the stake. The player takes the vault all the same, but the row
          would promise them a doubling on top that will not happen. So what is
          said here is what the contract actually checks: a card with weight
          doubles. */}
      <p className="mt-3 text-sm text-slate-400">
        Risking stakes the bonus, never your money: the dollar you paid already
        bought a real ticket. Your next case decides it: a card that carries TESA
        or tickets doubles the {picked}; an empty one burns it, and so does the
        vault card: it pays money, not weight.
      </p>
      {stake.budgetLeft > 0 && (
        <p className="t-label mt-2">
          season prize budget left: {stake.budgetLeft} TESA
        </p>
      )}
    </div>
  );
}
