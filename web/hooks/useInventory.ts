"use client";

import { useAccount, useConfig } from "wagmi";
import { readContract, readContracts } from "wagmi/actions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { ContractFunctionParameters } from "viem";
import { TESSERA_DECK_ABI } from "@/lib/abi";
import { DECK_ADDRESS } from "@/lib/chain";
import { present, revealHandles } from "@/lib/inco";
import { weightOf, WEIGHT_PER_TICKET, type DeckShape } from "@/lib/deck";

export interface Slot {
  index: number;
  /** Which deck the slot came from. It is judged by that deck's table. */
  deckId: number;
  handle: `0x${string}`;
  /** The slot's value. undefined until the covalidators return it. */
  value?: number;
  /** Covalidator signatures, which is what redeem() accepts. */
  signatures?: `0x${string}`[];
  /// What the slot is worth by ITS OWN season's table, doubled if it was risked.
  weight: number;
  /** The player gave up a ticket to the vault for this slot, so it weighs double. */
  risk: boolean;
  spent: boolean;
  /** Locked in a battle still looking for an opponent: silent even for its owner. */
  sealed: boolean;
  /**
   * Committed to an unfinished battle: readable, but not spendable.
   *
   * This is not the same as `sealed`, and that difference is exactly where
   * things broke. `sealedSlotsOf` returns only cards from battles still looking
   * for an opponent: the moment one joins, both cards become public and leave
   * that list. The contract, meanwhile, keeps them locked until `resolveBattle`,
   * and a battle is resolved not by a machine but by a hand pressing a button.
   * In between, the card sat in the inventory like any other, `pickForRedeem`
   * took it first (battle cards are the heaviest), and the redemption reverted
   * with SlotInBattle.
   */
  locked: boolean;
}

const KEY = (address?: string) => ["inventory", address] as const;

/**
 * A player's inventory.
 *
 * The contract cannot see what is in a slot, because decryption lives off chain.
 * So the inventory is assembled in two steps: handles from the chain, values and
 * signatures from the covalidators. The signatures are kept right away, since
 * they are what redeem() will verify.
 *
 * The slot count is read INSIDE the query rather than arriving as a prop.
 * Otherwise a refetch after an open would go with the old number and a fresh
 * shard would not reach the inventory until the next render.
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

      // ContractFunctionParameters rather than an inferred type: on an array of
      // calls built from the deck's full ABI, tsc goes into infinite type
      // recursion.
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
        // The doubling lives in the contract rather than in the drop table, so
        // the only way to learn about it is to ask the chain. Computing weight
        // from the value alone would show the player half of what they are
        // actually owed.
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

      // A card in a battle still looking for an opponent has not become public
      // and will not until that opponent pays. Asking the covalidators for it is
      // not an option: a batch is returned whole, so one such handle would hang
      // the entire inventory.
      const sealed = new Set(
        ((await readContract(config, {
          address: DECK_ADDRESS,
          abi: TESSERA_DECK_ABI,
          functionName: "sealedSlotsOf",
          args: [address!],
        })) as readonly bigint[]).map(Number),
      );

      // Locked is broader than sealed, and has to be asked about separately.
      // The contract considers a card busy until the battle is `resolved`; there
      // is no dedicated view for that, but there is the player's list of
      // battles, and each records which card is whose. A player with no battles
      // never makes the second request at all, because the list is empty.
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

      // One request for every handle: the covalidators accept a batch, and
      // anything already revealed comes from the cache and never touches the
      // network.
      // Background priority: the inventory can wait while the player gets what
      // they are watching right now.
      const revealed = await revealHandles(
        list.filter((s) => !sealed.has(s.index)).map((s) => s.handle),
        { priority: "background" },
      ).catch(() => []);
      const byHandle = new Map(present(revealed).map((r) => [r.handle.toLowerCase(), r]));

      return list.map((s, i) => {
        const r = byHandle.get(s.handle.toLowerCase());
        const base = r && decks[s.deckId] ? weightOf(r.value, decks[s.deckId]) : 0;
        return {
          ...s,
          value: r?.value,
          signatures: r?.signatures,
          // Doubling zero is zero: an empty slot does not become a prize
          // because it was risked. The contract computes it the same way.
          weight: s.risk ? base * 2 : base,
          spent: spentFlags[i]?.result ?? false,
          sealed: sealed.has(s.index),
          locked: locked.has(s.index),
        };
      });
    },
  });
}

/**
 * Mark slots as spent immediately, without waiting for a re-read.
 *
 * Neither optimism nor a guess: this is called only once the transaction has
 * landed in a block, which means the chain ALREADY considers those slots burned.
 * The re-read follows anyway and says the same thing, simply seconds later,
 * because the inventory reads every slot separately and on a large wallet that
 * is noticeable.
 *
 * Without this a person saw "Claimed" while the TESA and bonus counters still
 * showed the old numbers, and the only way to see the truth was to reload the
 * page.
 */
export function useMarkSpent() {
  const client = useQueryClient();
  const { address } = useAccount();
  return useCallback(
    (indexes: number[]) => {
      const burned = new Set(indexes);
      client.setQueriesData<Slot[]>({ queryKey: KEY(address) }, (old) =>
        old?.map((s) => (burned.has(s.index) ? { ...s, spent: true } : s)),
      );
    },
    [client, address],
  );
}

/** Refresh the inventory after an open or a redemption. */
export function useRefreshInventory() {
  const client = useQueryClient();
  const { address } = useAccount();
  return useCallback(
    () => client.invalidateQueries({ queryKey: KEY(address) }),
    [client, address],
  );
}

/**
 * Slots that are worth something and are not spent yet.
 *
 * Ones locked in a battle do not appear here: the contract will not take them
 * for a redemption, a stake or the vault. Showing them in the weight would mean
 * promising a ticket the player cannot get right now.
 */
export function spendable(slots: Slot[] | undefined): Slot[] {
  return (slots ?? []).filter(
    (s) => s.weight > 0 && !s.spent && !s.locked && s.signatures?.length,
  );
}

/** How much weight is in hand. */
export function heldWeight(slots: Slot[] | undefined): number {
  return spendable(slots).reduce((sum, s) => sum + s.weight, 0);
}

/**
 * What exactly to give up for a redemption: the heaviest first, so that a player
 * does not burn five shards where one ticket slot would have done.
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
