"use client";

import { useQuery } from "@tanstack/react-query";
import { present, revealHandles } from "@/lib/inco";
import { weightOf, slotsPerTier, type DeckShape } from "@/lib/deck";
import { useOpens } from "./useOpens";

export interface PoolTier {
  spec: ReturnType<typeof slotsPerTier>[number]["spec"];
  weight: number;
  total: number;
  left: number;
}

export interface PoolState {
  size: number;
  drawn: number;
  remaining: number;
  tiers: PoolTier[];
  prizesLeft: number;
  oddsNext: number;
  unknown: number;
  vaultTaken: boolean;
  vaultFinder?: `0x${string}`;
}

/**
 *
 *
 */
export function usePool(deck: DeckShape, drawn: number, deckId: number) {
  //
  const opens = useOpens();
  const events = (opens.data ?? []).filter((o) => o.deckId === deckId);
  const handles = events.map((o) => o.handle);

  return useQuery({
    queryKey: ["pool", deckId, deck.size, drawn, deck.tiers.length, deck.vaultUpTo, handles.length],
    enabled: deck.size > 0 && deck.tiers.length > 0,
    staleTime: 20_000,
    queryFn: async (): Promise<PoolState> => {
      const revealed = present(
        await revealHandles(handles, { priority: "background" }).catch(() => []),
      );

      const drawnByWeight = new Map<number, number>();
      for (const r of revealed) {
        const w = weightOf(r.value, deck);
        drawnByWeight.set(w, (drawnByWeight.get(w) ?? 0) + 1);
      }

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
