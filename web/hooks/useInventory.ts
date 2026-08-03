"use client";

import { useAccount, useConfig } from "wagmi";
import { readContract, readContracts } from "wagmi/actions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { TESSERA_DECK_ABI } from "@/lib/abi";
import { DECK_ADDRESS } from "@/lib/chain";
import { revealHandles } from "@/lib/inco";
import { weightOf, WEIGHT_PER_TICKET, type DeckShape } from "@/lib/deck";

export interface Slot {
  index: number;
  handle: `0x${string}`;
  value?: number;
  signatures?: `0x${string}`[];
  weight: number;
  spent: boolean;
}

const KEY = (address?: string) => ["inventory", address] as const;

/**
 *
 *
 */
export function useInventory(deck: DeckShape) {
  const config = useConfig();
  const { address } = useAccount();

  return useQuery({
    queryKey: [...KEY(address), deck.tiers.length],
    enabled: Boolean(address) && deck.tiers.length > 0,
    staleTime: 15_000,
    queryFn: async (): Promise<Slot[]> => {
      const count = Number(
        await readContract(config, {
          address: DECK_ADDRESS,
          abi: TESSERA_DECK_ABI,
          functionName: "countOf",
          args: [address!],
        }),
      );
      if (count === 0) return [];

      const indexes = Array.from({ length: count }, (_, i) => i);

      const handles = (await readContracts(config, {
        contracts: indexes.map((i) => ({
          address: DECK_ADDRESS,
          abi: TESSERA_DECK_ABI,
          functionName: "handleOf",
          args: [address!, BigInt(i)],
        })),
      })) as { result?: `0x${string}` }[];

      const list = handles
        .map((h, i) => ({ index: i, handle: h.result }))
        .filter((x): x is { index: number; handle: `0x${string}` } => Boolean(x.handle));

      const spentFlags = (await readContracts(config, {
        contracts: list.map((s) => ({
          address: DECK_ADDRESS,
          abi: TESSERA_DECK_ABI,
          functionName: "shardSpent",
          args: [s.handle],
        })),
      })) as { result?: boolean }[];

      const revealed = await revealHandles(list.map((s) => s.handle), {
        priority: "background",
      }).catch(() => []);
      const byHandle = new Map(revealed.map((r) => [r.handle.toLowerCase(), r]));

      return list.map((s, i) => {
        const r = byHandle.get(s.handle.toLowerCase());
        return {
          ...s,
          value: r?.value,
          signatures: r?.signatures,
          weight: r ? weightOf(r.value, deck) : 0,
          spent: spentFlags[i]?.result ?? false,
        };
      });
    },
  });
}

export function useRefreshInventory() {
  const client = useQueryClient();
  const { address } = useAccount();
  return useCallback(
    () => client.invalidateQueries({ queryKey: KEY(address) }),
    [client, address],
  );
}

export function spendable(slots: Slot[] | undefined): Slot[] {
  return (slots ?? []).filter((s) => s.weight > 0 && !s.spent && s.signatures?.length);
}

export function heldWeight(slots: Slot[] | undefined): number {
  return spendable(slots).reduce((sum, s) => sum + s.weight, 0);
}

/**
 */
export function pickForRedeem(slots: Slot[] | undefined): Slot[] {
  const sorted = [...spendable(slots)].sort((a, b) => b.weight - a.weight);
  const out: Slot[] = [];
  let weight = 0;
  for (const s of sorted) {
    if (weight >= WEIGHT_PER_TICKET && weight % WEIGHT_PER_TICKET === 0) break;
    out.push(s);
    weight += s.weight;
  }
  return weight >= WEIGHT_PER_TICKET ? out : [];
}
