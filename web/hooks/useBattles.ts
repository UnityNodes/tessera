"use client";

import { useCallback, useMemo, useState } from "react";
import { useAccount, useConfig, useReadContract, useReadContracts } from "wagmi";
import { simulateContract, writeContract, waitForTransactionReceipt } from "wagmi/actions";
import { useQuery } from "@tanstack/react-query";
import type { ContractFunctionParameters } from "viem";
import { TESSERA_DECK_ABI } from "@/lib/abi";
import { DECK_ADDRESS, txUrl } from "@/lib/chain";
import { revealHandles } from "@/lib/inco";
import { approveOnce } from "@/lib/approve";
import { explain, type Explained } from "@/lib/errors";

const deck = { address: DECK_ADDRESS, abi: TESSERA_DECK_ABI } as const;

export const ZERO = "0x0000000000000000000000000000000000000000";

const RECENT = 24;

export interface Battle {
  id: bigint;
  a: `0x${string}`;
  b: `0x${string}`;
  slotA: number;
  slotB: number;
  openedAt: number;
  resolved: boolean;
  joined: boolean;
  waiting: boolean;
}

export type BattlePhase = "idle" | "approving" | "signing" | "confirming" | "done" | "failed";

export interface BattleState {
  phase: BattlePhase;
  txUrl?: string;
  error?: Explained;
}

/**
 */
function useBattleWrites(onSettled?: () => void) {
  const config = useConfig();
  const { address } = useAccount();
  const [state, setState] = useState<BattleState>({ phase: "idle" });

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
        return hash;
      } catch (err) {
        setState({ phase: "failed", error: explain(err) });
        onSettled?.();
      }
    },
    [config, onSettled],
  );

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
    openedAt: Number(x.openedAt),
    resolved: x.resolved,
    joined,
    waiting: !x.resolved && !joined,
  };
}

/**
 *
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

    create: (needsApproval: boolean) =>
      writes.run(async () => {
        await writes.pay(needsApproval);
        return writes.send("openBattle");
      }),

    join: (id: bigint, needsApproval: boolean) =>
      writes.run(async () => {
        await writes.pay(needsApproval);
        return writes.send("joinBattle", [id]);
      }),
  };
}

/**
 *
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
      const [a, b] = await revealHandles([handleA!, handleB!]);
      return { a, b };
    },
  });

  return {
    ...writes,
    battle,
    cards: cards.data,
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
