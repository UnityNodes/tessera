"use client";

import { useConfig } from "wagmi";
import { getPublicClient } from "wagmi/actions";
import { useQuery } from "@tanstack/react-query";
import { parseAbiItem } from "viem";
import { DECK_ADDRESS, DECK_FROM_BLOCK } from "@/lib/chain";

const DECK_CREATED = parseAbiItem(
  "event DeckCreated(uint32 indexed season, uint16 size, uint16 totalWeight, uint256 feePaid)",
);
const CASE_OPENED = parseAbiItem(
  "event CaseOpened(address indexed player, uint16 index, bytes32 handle, uint256 paid)",
);

export interface OpenEvent {
  player: `0x${string}`;
  index: number;
  handle: `0x${string}`;
  block: bigint;
}

/**
 *
 *
 */
export function useOpens() {
  const config = useConfig();

  return useQuery({
    queryKey: ["opens"],
    refetchInterval: 10_000,
    staleTime: 8_000,
    queryFn: async (): Promise<OpenEvent[]> => {
      const client = getPublicClient(config);
      if (!client) return [];

      const decks = await client.getLogs({
        address: DECK_ADDRESS,
        event: DECK_CREATED,
        fromBlock: DECK_FROM_BLOCK,
        toBlock: "latest",
      });
      const from = decks.length ? decks[decks.length - 1].blockNumber! : DECK_FROM_BLOCK;

      const logs = await client.getLogs({
        address: DECK_ADDRESS,
        event: CASE_OPENED,
        fromBlock: from,
        toBlock: "latest",
      });

      return logs
        .filter((l) => l.args.player && l.args.handle)
        .map((l) => ({
          player: l.args.player!,
          index: Number(l.args.index ?? 0),
          handle: l.args.handle!,
          block: l.blockNumber ?? 0n,
        }));
    },
  });
}
