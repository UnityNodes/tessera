"use client";

import { useAccount, useConfig } from "wagmi";
import { readContract, readContracts } from "wagmi/actions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { ContractFunctionParameters } from "viem";
import { TESSERA_DECK_ABI } from "@/lib/abi";
import { DECK_ADDRESS } from "@/lib/chain";
import { revealHandles } from "@/lib/inco";
import { weightOf, WEIGHT_PER_TICKET, type DeckShape } from "@/lib/deck";

export interface Slot {
  index: number;
  deckId: number;
  handle: `0x${string}`;
  value?: number;
  signatures?: `0x${string}`[];
  weight: number;
  risk: boolean;
  spent: boolean;
  sealed: boolean;
  /**
   *
   */
  locked: boolean;
}

const KEY = (address?: string) => ["inventory", address] as const;

/**
 *
 *
 */
export function useInventory(decks: DeckShape[]) {
  const config = useConfig();
  const { address } = useAccount();

  return useQuery({
    queryKey: [...KEY(address), decks.length, decks.reduce((n, d) => n + d.tiers.length, 0)],
    enabled: Boolean(address) && decks.length > 0,
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

      const handleCalls: ContractFunctionParameters[] = indexes.flatMap((i) => [
        {
          address: DECK_ADDRESS,
          abi: TESSERA_DECK_ABI,
          functionName: "handleOf",
          args: [address!, BigInt(i)],
        },
        {
          address: DECK_ADDRESS,
          abi: TESSERA_DECK_ABI,
          functionName: "slotDeck",
          args: [address!, BigInt(i)],
        },
        {
          address: DECK_ADDRESS,
          abi: TESSERA_DECK_ABI,
          functionName: "slotIsRisk",
          args: [address!, BigInt(i)],
        },
      ]);
      const reads = (await readContracts(config, { contracts: handleCalls })) as {
        result?: `0x${string}` | number | boolean;
      }[];

      const list = indexes
        .map((i) => ({
          index: i,
          handle: reads[i * 3]?.result as `0x${string}` | undefined,
          deckId: Number(reads[i * 3 + 1]?.result ?? 0),
          risk: Boolean(reads[i * 3 + 2]?.result),
        }))
        .filter(
          (x): x is { index: number; handle: `0x${string}`; deckId: number; risk: boolean } =>
            Boolean(x.handle),
        );

      const spentCalls: ContractFunctionParameters[] = list.map((s) => ({
        address: DECK_ADDRESS,
        abi: TESSERA_DECK_ABI,
        functionName: "shardSpent",
        args: [s.handle],
      }));
      const spentFlags = (await readContracts(config, { contracts: spentCalls })) as {
        result?: boolean;
      }[];

      const sealed = new Set(
        ((await readContract(config, {
          address: DECK_ADDRESS,
          abi: TESSERA_DECK_ABI,
          functionName: "sealedSlotsOf",
          args: [address!],
        })) as readonly bigint[]).map(Number),
      );

      const mine = (await readContract(config, {
        address: DECK_ADDRESS,
        abi: TESSERA_DECK_ABI,
        functionName: "battlesOf",
        args: [address!],
      })) as readonly bigint[];

      const locked = new Set(sealed);
      if (mine.length > 0) {
        const battleCalls: ContractFunctionParameters[] = mine.map((id) => ({
          address: DECK_ADDRESS,
          abi: TESSERA_DECK_ABI,
          functionName: "battleAt",
          args: [id],
        }));
        const fought = (await readContracts(config, { contracts: battleCalls })) as {
          result?: { a: string; b: string; slotA: bigint; slotB: bigint; resolved: boolean };
        }[];
        const me = address!.toLowerCase();
        for (const r of fought) {
          const bt = r.result;
          if (!bt || bt.resolved) continue;
          if (bt.a.toLowerCase() === me) locked.add(Number(bt.slotA));
          if (bt.b.toLowerCase() === me) locked.add(Number(bt.slotB));
        }
      }

      const revealed = await revealHandles(
        list.filter((s) => !sealed.has(s.index)).map((s) => s.handle),
        { priority: "background" },
      ).catch(() => []);
      const byHandle = new Map(revealed.map((r) => [r.handle.toLowerCase(), r]));

      return list.map((s, i) => {
        const r = byHandle.get(s.handle.toLowerCase());
        const base = r && decks[s.deckId] ? weightOf(r.value, decks[s.deckId]) : 0;
        return {
          ...s,
          value: r?.value,
          signatures: r?.signatures,
          weight: s.risk ? base * 2 : base,
          spent: spentFlags[i]?.result ?? false,
          sealed: sealed.has(s.index),
          locked: locked.has(s.index),
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

/**
 *
 */
export function spendable(slots: Slot[] | undefined): Slot[] {
  return (slots ?? []).filter(
    (s) => s.weight > 0 && !s.spent && !s.locked && s.signatures?.length,
  );
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
