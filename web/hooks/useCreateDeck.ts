"use client";

import { useCallback, useState } from "react";
import { useAccount, useConfig, useReadContracts } from "wagmi";
import {
  readContract,
  simulateContract,
  writeContract,
  waitForTransactionReceipt,
} from "wagmi/actions";
import { parseEventLogs } from "viem";
import { TESSERA_DECK_ABI } from "@/lib/abi";
import { DECK_ADDRESS, TICKET_TOKEN, TOKEN_ABI, txUrl } from "@/lib/chain";
import { explain, type Explained } from "@/lib/errors";

const deck = { address: DECK_ADDRESS, abi: TESSERA_DECK_ABI } as const;

export type CreatePhase = "idle" | "approving" | "signing" | "confirming" | "done" | "failed";

export interface DeckPlan {
  name: string;
  hue: number;
  size: number;
  upTo: number[];
  weight: number[];
  vaultSlots: number;
  sharePercent: number;
}

/**
 *
 */
export function useCreateDeck() {
  const { address } = useAccount();
  const config = useConfig();
  const [state, setState] = useState<{
    phase: CreatePhase;
    txUrl?: string;
    deckId?: number;
    error?: Explained;
  }>({ phase: "idle" });

  const rules = useReadContracts({
    contracts: [
      { ...deck, functionName: "customDeckFee" },
      { ...deck, functionName: "maxCreatorBps" },
      { ...deck, functionName: "minCustomSize" },
      {
        address: TICKET_TOKEN,
        abi: TOKEN_ABI,
        functionName: "allowance",
        args: [address ?? "0x0000000000000000000000000000000000000000", DECK_ADDRESS],
      },
    ],
    query: { refetchInterval: 20_000 },
  });

  const fee = (rules.data?.[0]?.result as bigint | undefined) ?? 0n;
  const maxBps = Number((rules.data?.[1]?.result as number | undefined) ?? 5000);
  const minSize = Number((rules.data?.[2]?.result as number | undefined) ?? 50);
  const allowance = (rules.data?.[3]?.result as bigint | undefined) ?? 0n;

  const create = useCallback(
    async (plan: DeckPlan) => {
      if (!address) return undefined;
      try {
        if (allowance < fee) {
          setState({ phase: "approving" });
          const sim = await simulateContract(config, {
            address: TICKET_TOKEN,
            abi: TOKEN_ABI,
            functionName: "approve",
            args: [DECK_ADDRESS, fee * 100n],
            account: address,
          });
          const hash = await writeContract(config, sim.request);
          await waitForTransactionReceipt(config, { hash });
        }

        setState({ phase: "signing" });
        const incoFee = (await readContract(config, {
          ...deck,
          functionName: "deckFee",
          args: [plan.size],
        })) as bigint;

        const sim = await simulateContract(config, {
          ...deck,
          functionName: "createCustomDeck",
          args: [
            plan.size,
            plan.upTo,
            plan.weight,
            plan.vaultSlots,
            Math.round(plan.sharePercent * 100),
            `${plan.name}:${plan.hue}`,
          ],
          value: incoFee,
          account: address,
        });
        const hash = await writeContract(config, sim.request);
        setState({ phase: "confirming", txUrl: txUrl(hash) });

        const receipt = await waitForTransactionReceipt(config, { hash });
        if (receipt.status !== "success") throw new Error("The transaction reverted on chain");

        const made = parseEventLogs({
          abi: TESSERA_DECK_ABI,
          eventName: "DeckCreated",
          logs: receipt.logs,
        });
        const id = Number((made[0]?.args as { deckId?: number } | undefined)?.deckId ?? 0);
        setState({ phase: "done", txUrl: txUrl(hash), deckId: id });
        await rules.refetch();
        return id;
      } catch (err) {
        setState({ phase: "failed", error: explain(err) });
        return undefined;
      }
    },
    [address, config, allowance, fee, rules],
  );

  return {
    state,
    reset: useCallback(() => setState({ phase: "idle" }), []),
    busy: ["approving", "signing", "confirming"].includes(state.phase),
    fee,
    maxBps,
    minSize,
    create,
  };
}
