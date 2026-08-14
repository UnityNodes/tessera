"use client";

import { useCallback, useMemo, useState } from "react";
import { useAccount, useConfig, useReadContract, useReadContracts } from "wagmi";
import { simulateContract, writeContract, waitForTransactionReceipt } from "wagmi/actions";
import { useQuery } from "@tanstack/react-query";
import { parseEventLogs, type ContractFunctionParameters } from "viem";
import { TESSERA_DECK_ABI } from "@/lib/abi";
import { DECK_ADDRESS, txUrl } from "@/lib/chain";
import { revealHandles } from "@/lib/inco";
import { approveOnce } from "@/lib/approve";
import { explain, type Explained } from "@/lib/errors";

const deck = { address: DECK_ADDRESS, abi: TESSERA_DECK_ABI } as const;

export const ZERO = "0x0000000000000000000000000000000000000000";

/** How many recent battles we keep in the list. Beyond that it is an archive, not a game. */
const RECENT = 24;

export interface Battle {
  id: bigint;
  a: `0x${string}`;
  b: `0x${string}`;
  slotA: number;
  slotB: number;
  /** Which deck both are drawing from. */
  deckId: number;
  openedAt: number;
  resolved: boolean;
  /** An opponent joined, so both cards are public already. */
  joined: boolean;
  /** Still looking for an opponent. */
  waiting: boolean;
}

export type BattlePhase = "idle" | "approving" | "signing" | "confirming" | "done" | "failed";

export interface BattleState {
  phase: BattlePhase;
  txUrl?: string;
  error?: Explained;
}

/**
 * Shared write machinery. Both the list and the battle page write to one
 * contract in the same steps, so the phases and the error explanations are
 * shared too.
 */
function useBattleWrites(onSettled?: () => void) {
  const config = useConfig();
  const { address } = useAccount();
  const [state, setState] = useState<BattleState>({ phase: "idle" });

  // Returns the RECEIPT rather than the hash. Nobody here needed the hash, and
  // every caller threw it away, while the receipt carries the events, and it is
  // from those that you learn the id of the battle just opened.
  const run = useCallback(
    async (fn: () => Promise<`0x${string}`>) => {
      try {
        setState({ phase: "signing" });
        const hash = await fn();
        setState({ phase: "confirming", txUrl: txUrl(hash) });
        const receipt = await waitForTransactionReceipt(config, { hash });
        if (receipt.status !== "success") throw new Error("The transaction reverted on chain");
        setState({ phase: "done", txUrl: txUrl(hash) });
        onSettled?.();
        return receipt;
      } catch (err) {
        setState({ phase: "failed", error: explain(err) });
        onSettled?.();
      }
    },
    [config, onSettled],
  );

  /** The dollar is charged exactly as for an ordinary case, and the approval is one time too. */
  const pay = useCallback(
    async (needsApproval: boolean) => {
      if (!needsApproval) return;
      setState({ phase: "approving" });
      await approveOnce(config, address!);
    },
    [config, address],
  );

  const send = useCallback(
    async (functionName: string, args: readonly unknown[] = []) => {
      const sim = await simulateContract(config, {
        ...deck,
        functionName,
        args,
        account: address!,
      } as never);
      return writeContract(config, sim.request);
    },
    [config, address],
  );

  return {
    state,
    reset: useCallback(() => setState({ phase: "idle" }), []),
    busy:
      state.phase === "approving" || state.phase === "signing" || state.phase === "confirming",
    run,
    pay,
    send,
  };
}

function toBattle(id: bigint, r: unknown): Battle | null {
  const x = r as
    | {
        a: `0x${string}`;
        b: `0x${string}`;
        slotA: bigint;
        slotB: bigint;
        deckId: number;
        openedAt: bigint;
        resolved: boolean;
      }
    | undefined;
  if (!x || x.a === ZERO) return null;
  const joined = x.b !== ZERO;
  return {
    id,
    a: x.a,
    b: x.b,
    slotA: Number(x.slotA),
    slotB: Number(x.slotB),
    deckId: Number(x.deckId),
    openedAt: Number(x.openedAt),
    resolved: x.resolved,
    joined,
    waiting: !x.resolved && !joined,
  };
}

/**
 * The list of battles.
 *
 * We read the last `RECENT` by id rather than only the open ones: the page has
 * to show both what is running and what has just finished, otherwise an empty
 * list looks like a broken game rather than a quiet moment.
 */
export function useBattleList(onSettled?: () => void) {
  const writes = useBattleWrites(onSettled);

  const count = useReadContract({
    ...deck,
    functionName: "battleCount",
    query: { refetchInterval: 8_000 },
  });

  const total = Number((count.data as bigint | undefined) ?? 0n);

  const ids = useMemo(() => {
    const out: bigint[] = [];
    for (let i = total; i > 0 && out.length < RECENT; i--) out.push(BigInt(i));
    return out;
  }, [total]);

  const details = useReadContracts({
    contracts: ids.map(
      (id) => ({ ...deck, functionName: "battleAt", args: [id] }) as ContractFunctionParameters,
    ),
    query: { enabled: ids.length > 0, refetchInterval: 8_000 },
  });

  const all = useMemo(
    () =>
      ids
        .map((id, i) => toBattle(id, details.data?.[i]?.result))
        .filter((b): b is Battle => b !== null),
    [ids, details.data],
  );

  const refetch = useCallback(async () => {
    await Promise.all([count.refetch(), details.refetch()]);
  }, [count, details]);

  return {
    ...writes,
    total,
    all,
    open: useMemo(() => all.filter((b) => b.waiting), [all]),
    live: useMemo(() => all.filter((b) => b.joined && !b.resolved), [all]),
    loading: count.isLoading || details.isLoading,
    refetch,

    /**
     * Open a battle and report WHICH one opened.
     *
     * The id comes from the BattleOpened event in the receipt rather than from
     * battleCount() after the transaction. The difference is not theoretical:
     * the counter is a separate request made afterwards, and between those two
     * moments another player manages to open theirs. Then a person pays a dollar
     * and lands in somebody else's room. The event, on the other hand, sits in
     * their OWN receipt and speaks about exactly what was paid for.
     *
     * Returns undefined when the transaction did not go through: then there is
     * nowhere to lead them, and the error is already shown by the state.
     */
    create: async (deckId: number, needsApproval: boolean) => {
      const receipt = await writes.run(async () => {
        await writes.pay(needsApproval);
        return writes.send("openBattle", [deckId]);
      });
      if (!receipt) return undefined;
      const opened = parseEventLogs({
        abi: TESSERA_DECK_ABI,
        eventName: "BattleOpened",
        logs: receipt.logs,
      });
      return (opened[0]?.args as { id?: bigint } | undefined)?.id;
    },

    join: async (id: bigint, needsApproval: boolean) => {
      const receipt = await writes.run(async () => {
        await writes.pay(needsApproval);
        return writes.send("joinBattle", [id]);
      });
      return receipt ? id : undefined;
    },
  };
}

/**
 * A single battle.
 *
 * The cards come from the chain and are revealed at foreground priority: this is
 * the same moment of truth as an ordinary open, and it should not queue behind
 * the inventory or the feed.
 */
export function useBattle(id: bigint | undefined, onSettled?: () => void) {
  const writes = useBattleWrites(onSettled);

  const read = useReadContract({
    ...deck,
    functionName: "battleAt",
    args: [id ?? 0n],
    query: { enabled: id !== undefined, refetchInterval: 6_000 },
  });

  const battle = useMemo(
    () => (id === undefined ? undefined : (toBattle(id, read.data) ?? undefined)),
    [id, read.data],
  );

  const handles = useReadContracts({
    contracts: battle?.joined
      ? ([
          { ...deck, functionName: "handleOf", args: [battle.a, BigInt(battle.slotA)] },
          { ...deck, functionName: "handleOf", args: [battle.b, BigInt(battle.slotB)] },
        ] as ContractFunctionParameters[])
      : [],
    query: { enabled: Boolean(battle?.joined) },
  });

  const handleA = handles.data?.[0]?.result as `0x${string}` | undefined;
  const handleB = handles.data?.[1]?.result as `0x${string}` | undefined;

  const cards = useQuery({
    queryKey: ["battle-cards", handleA, handleB],
    enabled: Boolean(handleA && handleB),
    staleTime: Infinity,
    queryFn: async () => {
      // Both or neither. Half a table is not "partly shown" but a card labelled
      // with somebody else's name: places in the result follow the order of the
      // handles, and one missing would shift the other to its neighbour.
      const [a, b] = await revealHandles([handleA!, handleB!], { waitForAll: true });
      if (!a || !b) throw new Error("covalidators have not turned both cards over yet");
      return { a, b };
    },
  });

  return {
    ...writes,
    battle,
    cards: cards.data,
    /** The cards are on the table, but the covalidators have not turned them over yet. */
    revealing: Boolean(battle?.joined) && !cards.data,
    refetch: read.refetch,

    join: (needsApproval: boolean) =>
      writes.run(async () => {
        await writes.pay(needsApproval);
        return writes.send("joinBattle", [id!]);
      }),

    abandon: () => writes.run(() => writes.send("abandonBattle", [id!])),

    resolve: () =>
      writes.run(async () => {
        const c = cards.data;
        if (!c) throw new Error("The cards are not decrypted yet");
        return writes.send("resolveBattle", [
          id!,
          BigInt(c.a.value),
          c.a.signatures,
          BigInt(c.b.value),
          c.b.signatures,
        ]);
      }),
  };
}
