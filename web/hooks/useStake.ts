"use client";

import { useCallback, useState } from "react";
import { useAccount, useConfig, useReadContracts } from "wagmi";
import { simulateContract, writeContract, waitForTransactionReceipt } from "wagmi/actions";
import { TESSERA_DECK_ABI } from "@/lib/abi";
import { DECK_ADDRESS, txUrl } from "@/lib/chain";
import { explain, type Explained } from "@/lib/errors";
import type { Slot } from "./useInventory";

const deck = { address: DECK_ADDRESS, abi: TESSERA_DECK_ABI } as const;

export type StakePhase = "idle" | "signing" | "confirming" | "done" | "failed";

export interface StakeState {
  phase: StakePhase;
  txHash?: `0x${string}`;
  txUrl?: string;
  weight?: number;
  won?: boolean;
  error?: Explained;
}

/**
 *
 *
 */
export function useStake(onSettled?: () => void) {
  const config = useConfig();
  const { address } = useAccount();
  const [state, setState] = useState<StakeState>({ phase: "idle" });

  const status = useReadContracts({
    contracts: address
      ? [
          { ...deck, functionName: "stakeOf", args: [address] },
          { ...deck, functionName: "bankedWeight", args: [address] },
          { ...deck, functionName: "countOf", args: [address] },
          { ...deck, functionName: "budgetLeft" },
        ]
      : [],
    query: { enabled: Boolean(address), refetchInterval: 10_000 },
  });

  const raw = status.data?.[0]?.result as readonly [bigint, bigint, boolean] | undefined;
  const open = raw?.[2] ?? false;
  const stakedWeight = Number(raw?.[0] ?? 0n);
  const decidingSlot = Number(raw?.[1] ?? 0n);
  const slotCount = Number((status.data?.[2]?.result as bigint | undefined) ?? 0n);

  const run = useCallback(
    async (
      functionName: "stake" | "settleStake" | "claimBanked",
      args: readonly unknown[],
      after: (result: unknown) => Partial<StakeState>,
    ) => {
      if (!address) return;
      try {
        setState({ phase: "signing" });
        const sim = await simulateContract(config, {
          address: DECK_ADDRESS,
          abi: TESSERA_DECK_ABI,
          functionName,
          args,
          account: address,
        } as never);
        const hash = await writeContract(config, sim.request);
        setState({ phase: "confirming", txHash: hash, txUrl: txUrl(hash) });
        const receipt = await waitForTransactionReceipt(config, { hash });
        if (receipt.status !== "success") throw new Error("The transaction reverted on chain");
        setState({ phase: "done", txHash: hash, txUrl: txUrl(hash), ...after(sim.result) });
        await status.refetch();
        onSettled?.();
      } catch (err) {
        setState({ phase: "failed", error: explain(err) });
        onSettled?.();
      }
    },
    [address, config, onSettled, status],
  );

  return {
    state,
    reset: useCallback(() => setState({ phase: "idle" }), []),

    open,
    stakedWeight,
    ready: open && slotCount > decidingSlot,
    decidingSlot,
    bankedWeight: Number((status.data?.[1]?.result as bigint | undefined) ?? 0n),
    budgetLeft: Number((status.data?.[3]?.result as bigint | undefined) ?? 0n),
    refetch: status.refetch,

    stake: (slots: Slot[]) =>
      run(
        "stake",
        [
          slots.map((s) => BigInt(s.index)),
          slots.map((s) => BigInt(s.value!)),
          slots.map((s) => s.signatures!),
        ],
        (r) => ({ weight: Number((r as readonly [bigint, bigint])[0]) }),
      ),

    settle: (value: number, signatures: `0x${string}`[]) =>
      run("settleStake", [BigInt(value), signatures], (r) => {
        const [won, banked] = r as readonly [boolean, bigint];
        return { won, weight: Number(banked) };
      }),

    claim: () =>
      run("claimBanked", [], (r) => ({
        weight: Number((r as readonly [bigint, bigint])[0]),
      })),
  };
}
