"use client";

import { useContext, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { present, revealHandles } from "@/lib/inco";
import { specOf, specFor, weightOf, type DeckShape } from "@/lib/deck";
import { useOpens, type OpenEvent } from "./useOpens";
import { FeedSeed } from "@/app/providers";

/** What the server already put in the markup: an event plus its value. */
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
  /** The slot's value. undefined until the covalidators return it. */
  value?: number;
  weight: number;
  spec: ReturnType<typeof specFor>;
}

/**
 * Who just opened what.
 *
 * The deck is shared, so somebody else's open takes a slot from you as well.
 * When somebody draws the porphyry it disappears for everyone, and that has to
 * be visible, otherwise "an exhaustible pool" stays a word in the description.
 *
 * The values come from the same public reveals as the pool counter, so the feed
 * needs neither a backend nor any trust in us.
 */
// The window is wider than what fits on screen: the feed shows prizes only, and
// in the pool there is roughly one per ten opens, so across sixteen recent
// events it would be empty more often than not. Wider than fifty is not
// possible: the covalidators return a batch whole, and on a hundred handles the
// first pass takes so long that the feed manages to show emptiness.
export function useFeed(decks: DeckShape[], limit = 44) {
  const opens = useOpens();
  // The feed from the server, exactly until our own reads arrive. After that
  // useOpens remains the source, as it always was.
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

  /** Values from the markup, so that the first feed is real rather than grey. */
  const fromSeed = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of seeded ?? []) if (e.value !== undefined) m.set(e.handle.toLowerCase(), e.value);
    return m;
  }, [seeded]);

  // An intermediate result: what has already arrived while the rest is on its
  // way. Without it the feed stays silent until the last batch is revealed, and
  // that is minutes, because the covalidators return batch after batch.
  const [partial, setPartial] = useState<Map<string, number>>(new Map());

  const revealed = useQuery({
    queryKey: ["feed-values", recent.map((o) => o.handle).join(",")],
    // We wait for /api/opens even though the feed itself is already drawn.
    //
    // The values for the first screen come from the markup, so the delay here is
    // invisible. Starting earlier, on the other hand, would mean asking the
    // covalidators for what the server has already revealed: `seedRevealed` puts
    // ready values into the cache from the /api/opens response, and before it
    // that cache is empty. Measured: 103 requests a minute instead of 21, all of
    // the extras going to Inco contracts.
    enabled: recent.length > 0 && decks.length > 0 && opens.data !== undefined,
    staleTime: Infinity,
    queryFn: async () => {
      // Background priority: the feed must never stand ahead of the open a
      // player is watching right now.
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
        // ITS OWN deck's table. A value of 3 is a ticket in one deck and
        // emptiness in the next, so judging by somebody else's would mean lying
        // about their drop in a shared feed.
        const shape = decks[o.deckId];
        const value =
          revealed.data?.get(o.handle.toLowerCase()) ??
          partial.get(o.handle.toLowerCase()) ??
          fromSeed.get(o.handle.toLowerCase());
        const weight = value === undefined || !shape ? 0 : weightOf(value, shape);
        // specOf rather than specFor: a vault slot weighs zero, and by weight
        // the deck's headline prize would appear in the feed as emptiness.
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
