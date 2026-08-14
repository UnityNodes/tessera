"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { present, revealHandles } from "@/lib/inco";
import { specOf, weightOf, isPrize, type DeckShape } from "@/lib/deck";
import { useOpens } from "./useOpens";

export interface Standing {
  player: `0x${string}`;
  /** How many cases they opened in this contract. */
  opens: number;
  /** How many of those gave anything at all. */
  prizes: number;
  /** The total weight won, doubled where it was risked. */
  weight: number;
  /** How much of that weight adds up to real tickets. */
  tickets: number;
  /** The best thing they drew. */
  best?: ReturnType<typeof specOf>;
  /** How many of their opens the covalidators have not revealed yet. */
  pending: number;
}

/**
 * The standings, computed rather than kept.
 *
 * The contract keeps no leaderboard, and inventing one is not allowed. Nor is it
 * needed: every open is a public event carrying the player's address, and every
 * reveal is a public slot value. So "who opened how many and what they drew" is
 * the same arithmetic anyone can repeat, from the same data as the pool counter.
 *
 * Which is why there is not a single figure here that would have to be taken on
 * trust: no "level", no "points", no "streak". Only what happened on chain.
 *
 * A slot is judged by ITS OWN deck's table: seasons have different tables, and
 * the same value number costs different things in different decks.
 */
export function useStandings(decks: DeckShape[]) {
  const opens = useOpens();
  const events = opens.data;

  const values = useQuery({
    queryKey: ["standings-values", events?.length ?? 0],
    enabled: Boolean(events?.length) && decks.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      // The values are in the cache already: the server revealed them along with
      // the history and seeded them through seedRevealed. So in the normal case
      // this call does not touch the network at all; it merely gathers what is
      // there and does not wait for the rest.
      const rows = present(
        await revealHandles(events!.map((e) => e.handle), { priority: "background" }).catch(
          () => [],
        ),
      );
      return new Map(rows.map((r) => [r.handle.toLowerCase(), r.value]));
    },
  });

  return useMemo<Standing[]>(() => {
    if (!events?.length || decks.length === 0) return [];
    const byValue = values.data ?? new Map<string, number>();
    const table = new Map<string, Standing>();

    for (const e of events) {
      const shape = decks[e.deckId];
      const key = e.player.toLowerCase();
      const row =
        table.get(key) ??
        ({ player: e.player, opens: 0, prizes: 0, weight: 0, tickets: 0, pending: 0 } as Standing);
      row.opens += 1;

      const v = byValue.get(e.handle.toLowerCase());
      if (v === undefined || !shape) {
        row.pending += 1;
      } else {
        const spec = specOf(v, shape);
        if (isPrize(spec)) {
          row.prizes += 1;
          // The doubling for a risk lives in the contract rather than in the
          // drop table, and here it is visible from the event itself.
          row.weight += weightOf(v, shape) * (e.risk ? 2 : 1);
          if (!row.best || rank(spec) > rank(row.best)) row.best = spec;
        }
      }
      table.set(key, row);
    }

    for (const row of table.values()) row.tickets = Math.floor(row.weight / 5);

    // Sorted by weight rather than by number of opens: the first is luck and
    // play, the second is only money spent, and putting it first would make this
    // a table of spending.
    return [...table.values()].sort(
      (a, b) => b.weight - a.weight || b.prizes - a.prizes || b.opens - a.opens,
    );
  }, [events, decks, values.data]);
}

/** The vault outranks everything, exactly as the contract judges it in a battle. */
const rank = (spec: ReturnType<typeof specOf>) =>
  spec.rarity === "vault" ? Number.MAX_SAFE_INTEGER : spec.tickets;
