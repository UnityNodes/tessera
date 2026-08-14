"use client";

import { useQuery } from "@tanstack/react-query";

/** Decks hidden from the catalogue by the owner. By direct link they are alive. */
export function useHidden() {
  const q = useQuery({
    queryKey: ["hidden"],
    queryFn: async () => {
      const r = await fetch("/api/decks/hidden");
      if (!r.ok) return { hidden: [] as number[] };
      return (await r.json()) as { hidden: number[] };
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  return new Set(q.data?.hidden ?? []);
}
