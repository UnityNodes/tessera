"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { revealHandles } from "@/lib/inco";
import { specOf, specFor, weightOf, type DeckShape } from "@/lib/deck";
import { useOpens, type OpenEvent } from "./useOpens";

export interface FeedItem extends OpenEvent {
  value?: number;
  weight: number;
  spec: ReturnType<typeof specFor>;
}

/**
 *
 *
 */
export function useFeed(decks: DeckShape[], limit = 16) {
  const opens = useOpens();
  const recent = useMemo(
    () => (opens.data ?? []).slice(-limit).reverse(),
    [opens.data, limit],
  );

  const revealed = useQuery({
    queryKey: ["feed-values", recent.map((o) => o.handle).join(",")],
    enabled: recent.length > 0 && decks.length > 0,
    staleTime: Infinity,
    queryFn: async () => {
      const out = await revealHandles(
        recent.map((o) => o.handle),
        { priority: "background" },
      ).catch(() => []);
      return new Map(out.map((r) => [r.handle.toLowerCase(), r.value]));
    },
  });

  return useMemo<FeedItem[]>(
    () =>
      recent.map((o) => {
        const shape = decks[o.deckId];
        const value = revealed.data?.get(o.handle.toLowerCase());
        const weight = value === undefined || !shape ? 0 : weightOf(value, shape);
        return {
          ...o,
          value,
          weight,
          spec: value === undefined || !shape ? specFor(0) : specOf(value, shape),
        };
      }),
    [recent, revealed.data, decks],
  );
}
