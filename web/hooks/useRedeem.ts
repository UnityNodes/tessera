"use client";

import { useCallback, useState } from "react";
import { useAccount, useConfig } from "wagmi";
import { simulateContract, writeContract, waitForTransactionReceipt } from "wagmi/actions";
import { TESSERA_DECK_ABI } from "@/lib/abi";
import { DECK_ADDRESS, txUrl } from "@/lib/chain";

import { explain, type Explained } from "@/lib/errors";
import type { Slot } from "./useInventory";

export type RedeemPhase = "idle" | "signing" | "confirming" | "done" | "failed";

export interface RedeemState {
  phase: RedeemPhase;
  txHash?: `0x${string}`;
  txUrl?: string;
  burned?: number[];
  tickets?: number;
  error?: Explained;
}

/**
 *
 *
 */
export function useRedeem(onSettled?: () => void) {
  const config = useConfig();
  const { address } = useAccount();
  const [state, setState] = useState<RedeemState>({ phase: "idle" });

  const reset = useCallback(() => setState({ phase: "idle" }), []);

  const redeem = useCallback(
    async (shards: Slot[]) => {
      if (!address) return;
      const five = shards;
      if (five.length === 0) return;

      try {
        setState({ phase: "signing" });

        const sim = await simulateContract(config, {
          address: DECK_ADDRESS,
          abi: TESSERA_DECK_ABI,
          functionName: "redeem",
          args: [
            five.map((s) => BigInt(s.index)),
            five.map((s) => BigInt(s.value!)),
            five.map((s) => s.signatures!),
          ],
          account: address,
        });

        const hash = await writeContract(config, sim.request);
        setState({ phase: "confirming", txHash: hash, txUrl: txUrl(hash) });

        const receipt = await waitForTransactionReceipt(config, { hash });
        if (receipt.status !== "success") throw new Error("The transaction reverted on chain");

        const [tickets] = (sim.result as readonly [bigint, bigint]) ?? [0n];
        setState({
          phase: "done",
          txHash: hash,
          txUrl: txUrl(hash),
          burned: five.map((s) => s.index),
          tickets: Number(tickets),
        });
        onSettled?.();
      } catch (err) {
        setState({ phase: "failed", error: explain(err) });
        onSettled?.();
      }
    },
    [address, config, onSettled],
  );

  return { state, redeem, reset };
}
