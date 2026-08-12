"use client";

import { useContext, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { present, revealHandles } from "@/lib/inco";
import { specOf, specFor, weightOf, type DeckShape } from "@/lib/deck";
import { useOpens, type OpenEvent } from "./useOpens";
import { FeedSeed } from "@/app/providers";

interface SeedItem {
  player: `0x${string}`;
  deckId: number;
  index: number;
  handle: `0x${string}`;
  block: string;
  risk?: boolean;
  value?: number;
}

export interface FeedItem extends OpenEvent {
  value?: number;
  weight: number;
  spec: ReturnType<typeof specFor>;
}

/**
 *
 *
 */
export function useFeed(decks: DeckShape[], limit = 44) {
  const opens = useOpens();
  const seeded = useContext(FeedSeed) as SeedItem[] | null;
  const recent = useMemo(
    () =>
      opens.data
        ? opens.data.slice(-limit).reverse()
        : (seeded ?? [])
            .slice(-limit)
            .reverse()
            .map((e) => ({ ...e, block: BigInt(e.block) }) as OpenEvent),
    [opens.data, seeded, limit],
  );

  const fromSeed = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of seeded ?? []) if (e.value !== undefined) m.set(e.handle.toLowerCase(), e.value);
    return m;
  }, [seeded]);

  const [partial, setPartial] = useState<Map<string, number>>(new Map());

  const revealed = useQuery({
    queryKey: ["feed-values", recent.map((o) => o.handle).join(",")],
    //
    enabled: recent.length > 0 && decks.length > 0 && opens.data !== undefined,
    staleTime: Infinity,
    queryFn: async () => {
      const out = await revealHandles(recent.map((o) => o.handle), {
        priority: "background",
        onChunk: (got) => setPartial(new Map(got.map((r) => [r.handle.toLowerCase(), r.value]))),
      }).catch(() => []);
      return new Map(present(out).map((r) => [r.handle.toLowerCase(), r.value]));
    },
  });

  return useMemo<FeedItem[]>(
    () =>
      recent.map((o) => {
        const shape = decks[o.deckId];
        const value =
          revealed.data?.get(o.handle.toLowerCase()) ??
          partial.get(o.handle.toLowerCase()) ??
          fromSeed.get(o.handle.toLowerCase());
        const weight = value === undefined || !shape ? 0 : weightOf(value, shape);
        return {
          ...o,
          value,
          weight,
          spec: value === undefined || !shape ? specFor(0) : specOf(value, shape),
        };
      }),
    [recent, revealed.data, partial, fromSeed, decks],
  );
}
