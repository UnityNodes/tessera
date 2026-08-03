"use client";

import { useConfig } from "wagmi";
import { getPublicClient } from "wagmi/actions";
import { useQuery } from "@tanstack/react-query";
import { parseAbiItem } from "viem";
import { DECK_ADDRESS } from "@/lib/chain";
import { revealHandles } from "@/lib/inco";
import { weightOf, slotsPerTier, type DeckShape } from "@/lib/deck";

const DECK_CREATED = parseAbiItem(
  "event DeckCreated(uint32 indexed season, uint16 size, uint16 shardSlots, uint256 feePaid)",
);
const CASE_OPENED = parseAbiItem(
  "event CaseOpened(address indexed player, uint16 index, bytes32 handle, uint256 paid)",
);

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
}

/**
 *
 *
 */
export function usePool(deck: DeckShape, drawn: number) {
  const config = useConfig();

  return useQuery({
    queryKey: ["pool", deck.size, drawn, deck.tiers.length],
    enabled: deck.size > 0 && deck.tiers.length > 0,
    staleTime: 20_000,
    queryFn: async (): Promise<PoolState> => {
      const client = getPublicClient(config);
      if (!client) throw new Error("no client");

      const decks = await client.getLogs({
        address: DECK_ADDRESS,
        event: DECK_CREATED,
        fromBlock: "earliest",
        toBlock: "latest",
      });
      const fromBlock = decks.length ? decks[decks.length - 1].blockNumber! : 0n;

      const opens = await client.getLogs({
        address: DECK_ADDRESS,
        event: CASE_OPENED,
        fromBlock,
        toBlock: "latest",
      });

      const handles = opens
        .map((l) => l.args.handle)
        .filter((h): h is `0x${string}` => Boolean(h));

      const revealed = await revealHandles(handles, { priority: "background" }).catch(() => []);

      const drawnByWeight = new Map<number, number>();
      for (const r of revealed) {
        const w = weightOf(r.value, deck);
        drawnByWeight.set(w, (drawnByWeight.get(w) ?? 0) + 1);
      }

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
      };
    },
  });
}
