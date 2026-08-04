"use client";

import { useCallback, useMemo, useState } from "react";
import { useAccount, useConfig, useReadContract, useReadContracts } from "wagmi";
import { simulateContract, writeContract, waitForTransactionReceipt } from "wagmi/actions";
import { useQuery } from "@tanstack/react-query";
import { TESSERA_DECK_ABI } from "@/lib/abi";
import { DECK_ADDRESS, txUrl } from "@/lib/chain";
import { revealHandles } from "@/lib/inco";
import { approveOnce } from "@/lib/approve";
import { explain, type Explained } from "@/lib/errors";

const deck = { address: DECK_ADDRESS, abi: TESSERA_DECK_ABI } as const;

const SHOWN = 6;

export interface Battle {
  id: bigint;
  a: `0x${string}`;
  b: `0x${string}`;
  slotA: number;
  slotB: number;
  openedAt: number;
  resolved: boolean;
  joined: boolean;
}

export type BattlePhase = "idle" | "approving" | "signing" | "confirming" | "done" | "failed";

export interface BattleState {
  phase: BattlePhase;
  txUrl?: string;
  error?: Explained;
}

const EMPTY: readonly bigint[] = [];

/**
 *
 *
 */
export function useBattles(onSettled?: () => void) {
  const config = useConfig();
  const { address } = useAccount();
  const [state, setState] = useState<BattleState>({ phase: "idle" });

  const openIds = useReadContract({
    ...deck,
    functionName: "openBattleIds",
    args: [BigInt(SHOWN + 1)],
    query: { refetchInterval: 8_000 },
  });

  const mineIds = useReadContract({
    ...deck,
    functionName: "battlesOf",
    args: [address ?? "0x"],
    query: { enabled: Boolean(address), refetchInterval: 8_000 },
  });

  const ids = useMemo(() => {
    const open = (openIds.data ?? EMPTY) as readonly bigint[];
    const mine = ((mineIds.data ?? EMPTY) as readonly bigint[]).slice(-4);
    return [...new Set([...open, ...mine].map(String))].map(BigInt);
  }, [openIds.data, mineIds.data]);

  const details = useReadContracts({
    contracts: ids.map((id) => ({ ...deck, functionName: "battleAt", args: [id] }) as const),
    query: { enabled: ids.length > 0, refetchInterval: 8_000 },
  });

  const battles = useMemo<Battle[]>(() => {
    return ids
      .map((id, i) => {
        const r = details.data?.[i]?.result as
          | {
              a: `0x${string}`;
              b: `0x${string}`;
              slotA: bigint;
              slotB: bigint;
              openedAt: bigint;
              resolved: boolean;
            }
          | undefined;
        if (!r) return null;
        return {
          id,
          a: r.a,
          b: r.b,
          slotA: Number(r.slotA),
          slotB: Number(r.slotB),
          openedAt: Number(r.openedAt),
          resolved: r.resolved,
          joined: r.b !== "0x0000000000000000000000000000000000000000",
        };
      })
      .filter((b): b is Battle => b !== null);
  }, [ids, details.data]);

  const waiting = useMemo(
    () => battles.filter((b) => !b.resolved && !b.joined),
    [battles],
  );

  /**
   *
   */
  const [dismissed, setDismissed] = useState<string[]>([]);
  const mine = useMemo(() => {
    if (!address) return undefined;
    const me = address.toLowerCase();
    const ours = battles
      .filter((b) => b.a.toLowerCase() === me || b.b.toLowerCase() === me)
      .filter((b) => !dismissed.includes(String(b.id)))
      .sort((x, y) => (x.id < y.id ? -1 : 1));
    return ours.find((b) => !b.resolved) ?? ours[ours.length - 1];
  }, [battles, address, dismissed]);

  const handles = useReadContracts({
    contracts:
      mine && mine.joined
        ? ([
            { ...deck, functionName: "handleOf", args: [mine.a, BigInt(mine.slotA)] },
            { ...deck, functionName: "handleOf", args: [mine.b, BigInt(mine.slotB)] },
          ] as const)
        : [],
    query: { enabled: Boolean(mine?.joined) },
  });

  const handleA = handles.data?.[0]?.result as `0x${string}` | undefined;
  const handleB = handles.data?.[1]?.result as `0x${string}` | undefined;

  /**
   */
  const cards = useQuery({
    queryKey: ["battle-cards", handleA, handleB],
    enabled: Boolean(handleA && handleB),
    staleTime: Infinity,
    queryFn: async () => {
      const [a, b] = await revealHandles([handleA!, handleB!]);
      return { a, b };
    },
  });

  const run = useCallback(
    async (fn: () => Promise<`0x${string}`>) => {
      try {
        setState({ phase: "signing" });
        const hash = await fn();
        setState({ phase: "confirming", txUrl: txUrl(hash) });
        const receipt = await waitForTransactionReceipt(config, { hash });
        if (receipt.status !== "success") throw new Error("The transaction reverted on chain");
        setState({ phase: "done", txUrl: txUrl(hash) });
        await Promise.all([openIds.refetch(), mineIds.refetch(), details.refetch()]);
        onSettled?.();
      } catch (err) {
        setState({ phase: "failed", error: explain(err) });
        onSettled?.();
      }
    },
    [config, onSettled, openIds, mineIds, details],
  );

  const write = useCallback(
    async (functionName: "openBattle" | "joinBattle" | "abandonBattle", args: readonly unknown[]) => {
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

  const pay = useCallback(
    async (needsApproval: boolean) => {
      if (!needsApproval) return;
      setState({ phase: "approving" });
      await approveOnce(config, address!);
    },
    [config, address],
  );

  return {
    state,
    reset: useCallback(() => setState({ phase: "idle" }), []),

    waiting: useMemo(
      () => waiting.filter((b) => b.a.toLowerCase() !== address?.toLowerCase()).slice(0, SHOWN),
      [waiting, address],
    ),
    mine,
    dismiss: useCallback((id: bigint) => {
      setDismissed((d) => [...d, String(id)]);
      setState({ phase: "idle" });
    }, []),
    cards: cards.data,
    revealing: cards.isLoading,

    open: (needsApproval: boolean) =>
      run(async () => {
        await pay(needsApproval);
        return write("openBattle", []);
      }),

    join: (id: bigint, needsApproval: boolean) =>
      run(async () => {
        await pay(needsApproval);
        return write("joinBattle", [id]);
      }),

    abandon: (id: bigint) => run(() => write("abandonBattle", [id])),

    resolve: (id: bigint) =>
      run(async () => {
        const c = cards.data;
        if (!c) throw new Error("The cards are not decrypted yet");
        const sim = await simulateContract(config, {
          ...deck,
          functionName: "resolveBattle",
          args: [id, BigInt(c.a.value), c.a.signatures, BigInt(c.b.value), c.b.signatures],
          account: address!,
        });
        return writeContract(config, sim.request);
      }),
  };
}
