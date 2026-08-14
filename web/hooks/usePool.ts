"use client";

import { useQuery } from "@tanstack/react-query";
import { present, revealHandles } from "@/lib/inco";
import { weightOf, slotsPerTier, type DeckShape } from "@/lib/deck";
import { useOpens } from "./useOpens";

export interface PoolTier {
  spec: ReturnType<typeof slotsPerTier>[number]["spec"];
  weight: number;
  /// How many such slots the deck held at the start of the season.
  total: number;
  /// How many are still unrevealed: counted, not estimated.
  left: number;
}

export interface PoolState {
  size: number;
  drawn: number;
  remaining: number;
  tiers: PoolTier[];
  /// How many prizes are still in the pool.
  prizesLeft: number;
  /// The chance the next open gives something. Exact, not approximate.
  oddsNext: number;
  /// How many opens we could not decrypt yet: honesty instead of round numbers.
  unknown: number;
  /// The vault slot has been drawn. Then "one case in N opens it" is a lie.
  vaultTaken: boolean;
  /// Who drew it. The money waits for them until they collect it.
  vaultFinder?: `0x${string}`;
}

/**
 * How many shards are still in the pool.
 *
 * This is the project's central claim, and it is not a marketing one. The deck
 * is shuffled once and drawn without replacement, and every opened value is
 * publicly revealed, so anyone can recompute the same thing and get the same
 * figure. Not "forty percent on average" but "this much is left, and here is
 * where you can see it from".
 *
 * The side effect, which is the game: towards the end of a season the odds are
 * no longer what they were at the start, and that is visible in advance. A pool
 * can be caught while it is hot.
 */
export function usePool(deck: DeckShape, drawn: number, deckId: number, cut = 0) {
  // The events come from a shared source: when the counter and the feed pulled
  // logs each on their own, the public RPC started returning 429.
  //
  // Filtering by deck is mandatory: other decks' opens do not drain this pool,
  // and counting them together would show the deck emptier than it is.
  const opens = useOpens();
  // Filtering by deck is mandatory, and so is filtering by DEAL.
  //
  // A deck reshuffles itself: played out or with its vault taken, and after that
  // a new pool with the same contents follows. Old opens do not leave the
  // history, so without this condition a fresh deck would show itself empty:
  // "200 of 200 drawn" when in fact not one has been.
  const events = (opens.data ?? []).filter((o) => o.deckId === deckId && (o.cut ?? 0) === cut);
  const handles = events.map((o) => o.handle);

  return useQuery({
    queryKey: ["pool", deckId, cut, deck.size, drawn, deck.tiers.length, deck.vaultUpTo, handles.length],
    enabled: deck.size > 0 && deck.tiers.length > 0,
    staleTime: 20_000,
    queryFn: async (): Promise<PoolState> => {
      // Background priority: recomputing the pool must never stand ahead of the
      // open a player is watching right now.
      const revealed = present(
        await revealHandles(handles, { priority: "background" }).catch(() => []),
      );

      // How many slots of each rung have been drawn, and how many are left.
      const drawnByWeight = new Map<number, number>();
      for (const r of revealed) {
        const w = weightOf(r.value, deck);
        drawnByWeight.set(w, (drawnByWeight.get(w) ?? 0) + 1);
      }

      // The vault weighs zero, so in drawnByWeight it is indistinguishable from
      // emptiness. And we need to know: while its slot is in the pool the
      // promise "one case in N opens it" is true, and afterwards it is not.
      const byHandle = new Map(revealed.map((r) => [r.handle.toLowerCase(), r.value]));
      const vaultOpen =
        deck.vaultUpTo > 0
          ? events.find((o) => {
              const v = byHandle.get(o.handle.toLowerCase());
              return v !== undefined && v >= 1 && v <= deck.vaultUpTo;
            })
          : undefined;

      const tiers = slotsPerTier(deck)
        .filter((t) => t.weight > 0)
        .map((t) => ({
          spec: t.spec,
          weight: t.weight,
          total: t.count,
          left: Math.max(0, t.count - (drawnByWeight.get(t.weight) ?? 0)),
        }));

      const remaining = Math.max(0, deck.size - drawn);
      const prizesLeft = tiers.reduce((n, t) => n + t.left, 0);

      return {
        size: deck.size,
        drawn,
        remaining,
        tiers,
        prizesLeft,
        oddsNext: remaining > 0 ? prizesLeft / remaining : 0,
        unknown: handles.length - revealed.length,
        vaultTaken: Boolean(vaultOpen),
        vaultFinder: vaultOpen?.player,
      };
    },
  });
}
