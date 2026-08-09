"use client";

import { useQuery } from "@tanstack/react-query";

/**
 *
 *
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
  return (deckId: number) => (set.has(deckId) ? `/api/skin/${deckId}` : undefined);
}
