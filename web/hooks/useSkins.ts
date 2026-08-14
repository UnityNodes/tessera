"use client";

import { useQuery } from "@tanstack/react-query";

/**
 * The ids of decks whose picture is approved and shown.
 *
 * One list for all rather than a request per deck: there are as many cards in
 * the catalogue as there are decks, and ten separate requests for ten pictures
 * is ten requests for one bit each.
 *
 * The list is short and changes rarely, so it refreshes rarely too. If a picture
 * is taken down it disappears with the next refresh, and until then serving it
 * returns a 404 anyway, because the state is checked on delivery.
 */
export function useSkins() {
  const q = useQuery({
    queryKey: ["skins"],
    queryFn: async () => {
      const r = await fetch("/api/skin");
      if (!r.ok) return { approved: [] as number[] };
      return (await r.json()) as { approved: number[] };
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const set = new Set(q.data?.approved ?? []);
  /** The URL of a deck's picture, if there is one and it is approved. */
  return (deckId: number) => (set.has(deckId) ? `/api/skin/${deckId}` : undefined);
}
