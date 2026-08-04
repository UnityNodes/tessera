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
export function useFeed(deck: DeckShape, limit = 16) {
  const opens = useOpens();
  const recent = useMemo(
    () => (opens.data ?? []).slice(-limit).reverse(),
    [opens.data, limit],
  );

  const revealed = useQuery({
    queryKey: ["feed-values", recent.map((o) => o.handle).join(",")],
    enabled: recent.length > 0 && deck.tiers.length > 0,
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
        const value = revealed.data?.get(o.handle.toLowerCase());
        const weight = value === undefined ? 0 : weightOf(value, deck);
        return { ...o, value, weight, spec: value === undefined ? specFor(0) : specOf(value, deck) };
      }),
    [recent, revealed.data, deck],
  );
}
