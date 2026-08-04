"use client";

import { useConfig } from "wagmi";
import { getPublicClient } from "wagmi/actions";
import { useQuery } from "@tanstack/react-query";
import { parseAbiItem } from "viem";
import { DECK_ADDRESS, DECK_FROM_BLOCK } from "@/lib/chain";

const CASE_OPENED = parseAbiItem(
  "event CaseOpened(address indexed player, uint16 index, bytes32 handle, uint256 paid)",
);

/**
 */
const WINDOW = 1900n;

/**
 *
 */
const WINDOWS_PER_PASS = 12;

export interface OpenEvent {
  player: `0x${string}`;
  index: number;
  handle: `0x${string}`;
  block: bigint;
}

/**
 *
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

      const cache = load();
      let from = cache.scanned + 1n;
      const latest = await client.getBlockNumber();

      for (let i = 0; i < WINDOWS_PER_PASS && from <= latest; i++) {
        const to = from + WINDOW - 1n > latest ? latest : from + WINDOW - 1n;
        const logs = await client.getLogs({
          address: DECK_ADDRESS,
          event: CASE_OPENED,
          fromBlock: from,
          toBlock: to,
        });

        for (const l of logs) {
          if (!l.args.player || !l.args.handle) continue;
          cache.events.push({
            player: l.args.player,
            index: Number(l.args.index ?? 0),
            handle: l.args.handle,
            block: l.blockNumber ?? 0n,
          });
        }
        cache.scanned = to;
        from = to + 1n;
      }

      save(cache);
      return cache.events;
    },
  });
}


interface Cache {
  scanned: bigint;
  events: OpenEvent[];
}

const KEY = "tessera.opens.v1";

/**
 */
function load(): Cache {
  const empty: Cache = { scanned: DECK_FROM_BLOCK - 1n, events: [] };
  if (typeof window === "undefined") return empty;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return empty;
    const saved = JSON.parse(raw);
    if (saved.deck !== DECK_ADDRESS || saved.from !== String(DECK_FROM_BLOCK)) return empty;
    return {
      scanned: BigInt(saved.scanned),
      events: saved.events.map((e: OpenEvent & { block: string }) => ({
        ...e,
        block: BigInt(e.block),
      })),
    };
  } catch {
    return empty;
  }
}

function save(cache: Cache) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        deck: DECK_ADDRESS,
        from: String(DECK_FROM_BLOCK),
        scanned: String(cache.scanned),
        events: cache.events.map((e) => ({ ...e, block: String(e.block) })),
      }),
    );
  } catch {
  }
}
