"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export interface OpenEvent {
  player: `0x${string}`;
  deckId: number;
  index: number;
  handle: `0x${string}`;
  block: bigint;
  risk?: boolean;
}

/**
 *
 *
 */
export function useOpens() {
  return useQuery({
    queryKey: ["opens"],
    refetchInterval: 10_000,
    staleTime: 8_000,
    queryFn: async (): Promise<OpenEvent[]> => {
      const res = await fetch("/api/opens", { cache: "no-store" });
      if (!res.ok) throw new Error(`opens: ${res.status}`);
      const body = (await res.json()) as {
        events: (Omit<OpenEvent, "block"> & { block: string })[];
      };
      return body.events.map((e) => ({ ...e, block: BigInt(e.block) }));
    },
  });
}

/**
 *
 */
export function useRefreshOpens() {
  const client = useQueryClient();
  return useCallback(
    () => client.invalidateQueries({ queryKey: ["opens"] }),
    [client],
  );
}
