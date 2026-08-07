"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { present, revealHandles } from "@/lib/inco";
import { specOf, weightOf, isPrize, type DeckShape } from "@/lib/deck";
import { useOpens } from "./useOpens";

export interface Standing {
  player: `0x${string}`;
  opens: number;
  prizes: number;
  weight: number;
  tickets: number;
  best?: ReturnType<typeof specOf>;
  pending: number;
}

/**
 *
 *
 *
 */
export function useStandings(decks: DeckShape[]) {
  const opens = useOpens();
  const events = opens.data;

  const values = useQuery({
    queryKey: ["standings-values", events?.length ?? 0],
    enabled: Boolean(events?.length) && decks.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
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
          row.weight += weightOf(v, shape) * (e.risk ? 2 : 1);
          if (!row.best || rank(spec) > rank(row.best)) row.best = spec;
        }
      }
      table.set(key, row);
    }

    for (const row of table.values()) row.tickets = Math.floor(row.weight / 5);

    return [...table.values()].sort(
      (a, b) => b.weight - a.weight || b.prizes - a.prizes || b.opens - a.opens,
    );
  }, [events, decks, values.data]);
}

const rank = (spec: ReturnType<typeof specOf>) =>
  spec.rarity === "vault" ? Number.MAX_SAFE_INTEGER : spec.tickets;
