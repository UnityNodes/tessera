"use client";

import { useAccount, useConfig } from "wagmi";
import { readContract, readContracts } from "wagmi/actions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { TESSERA_DECK_ABI } from "@/lib/abi";
import { DECK_ADDRESS } from "@/lib/chain";
import { revealHandles } from "@/lib/inco";

export interface Slot {
  index: number;
  handle: `0x${string}`;
  value?: number;
  signatures?: `0x${string}`[];
  isShard: boolean;
  spent: boolean;
}

const KEY = (address?: string) => ["inventory", address] as const;

/**
 *
 *
 */
export function useInventory(shardSlots: number) {
  const config = useConfig();
  const { address } = useAccount();

  return useQuery({
    queryKey: KEY(address),
    enabled: Boolean(address) && shardSlots > 0,
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

      const revealed = await revealHandles(list.map((s) => s.handle)).catch(() => []);
      const byHandle = new Map(revealed.map((r) => [r.handle.toLowerCase(), r]));

      return list.map((s, i) => {
        const r = byHandle.get(s.handle.toLowerCase());
        return {
          ...s,
          value: r?.value,
          signatures: r?.signatures,
          isShard: r ? r.value >= 1 && r.value <= shardSlots : false,
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

export function spendableShards(slots: Slot[] | undefined): Slot[] {
  return (slots ?? []).filter((s) => s.isShard && !s.spent && s.signatures?.length);
}
