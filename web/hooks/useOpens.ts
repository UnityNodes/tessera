"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { seedRevealed, type Revealed } from "@/lib/inco";

export interface OpenEvent {
  player: `0x${string}`;
  /** Which deck. A drop is judged by ITS OWN deck's table, not a neighbour's. */
  deckId: number;
  index: number;
  handle: `0x${string}`;
  block: bigint;
  /** The player gave up a ticket to the vault, so this slot weighs double. */
  risk?: boolean;
  /**
   * The number of the deck's deal this open came from. Zero is the first.
   *
   * A deck reshuffles itself when it is played out or when its vault is taken,
   * and after that the old opens belong to a pool that no longer exists.
   * Counting them together would show a fresh deck as empty.
   */
  cut?: number;
}

/**
 * Every open of the current season, in one request for everyone.
 *
 * Both the pool counter and the drop feed look at the same events, so there is
 * one source and the consumers take it from the cache.
 *
 * The history itself is read by the server; see app/api/opens. It is the same
 * for everyone, and the public RPC will not return a range wider than two
 * thousand blocks, so a browser reading it for itself made three dozen requests
 * before it could show the feed. The older the season the longer that queue, and
 * the closer the 429 a player sees as "RPC Request failed" at the very moment of
 * opening a case.
 */
export function useOpens() {
  return useQuery({
    queryKey: ["opens"],
    refetchInterval: 10_000,
    staleTime: 8_000,
    queryFn: async (): Promise<OpenEvent[]> => {
      // The server reads the history, since it is the same for everyone. A
      // browser reading it for itself made three dozen getLogs before it could
      // show the feed, and the older the season the longer that queue. Now it is
      // one request.
      const res = await fetch("/api/opens", { cache: "no-store" });
      if (!res.ok) throw new Error(`opens: ${res.status}`);
      const body = (await res.json()) as {
        events: (Omit<OpenEvent, "block"> & { block: string })[];
        revealed?: Revealed[];
      };
      // The server reveals the slot values itself, so we put them in the cache
      // and the feed is drawn at once instead of a minute of silence on a first
      // visit.
      if (body.revealed?.length) seedRevealed(body.revealed);
      return body.events.map((e) => ({ ...e, block: BigInt(e.block) }));
    },
  });
}

/**
 * Re-read the feed immediately.
 *
 * Without this your own open appeared in "live drops" only with the next poll,
 * that is, up to ten seconds after you had already seen the prize. A feed that
 * does not notice an event happening right now reads as dead, and it is exactly
 * that feed the home screen shows.
 */
export function useRefreshOpens() {
  const client = useQueryClient();
  return useCallback(
    () => client.invalidateQueries({ queryKey: ["opens"] }),
    [client],
  );
}
