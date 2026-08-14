"use client";

import { useCallback, useState } from "react";
import { useAccount, useConfig } from "wagmi";
import { simulateContract, writeContract, waitForTransactionReceipt } from "wagmi/actions";
import { TESSERA_DECK_ABI } from "@/lib/abi";
import { DECK_ADDRESS, txUrl } from "@/lib/chain";
import { explain, type Explained } from "@/lib/errors";

/**
 * Open the vault.
 *
 * Half of the commission is not handed out ticket by ticket but accumulates, and
 * one slot in the deck takes all of it. The same money gathered into a heap,
 * which is exactly why it is worth spinning for, and exactly why an exhaustible
 * pool finally works for the thrill: both the vault and the number of cases left
 * are on screen.
 */
export function useVault(onSettled?: () => void) {
  const config = useConfig();
  const { address } = useAccount();
  const [state, setState] = useState<{
    phase: "idle" | "signing" | "confirming" | "done" | "failed";
    paid?: bigint;
    txUrl?: string;
    error?: Explained;
  }>({ phase: "idle" });

  const claim = useCallback(
    async (slotIndex: number, value: number, signatures: `0x${string}`[]) => {
      if (!address) return;
      try {
        setState({ phase: "signing" });
        const sim = await simulateContract(config, {
          address: DECK_ADDRESS,
          abi: TESSERA_DECK_ABI,
          functionName: "claimVault",
          args: [BigInt(slotIndex), BigInt(value), signatures],
          account: address,
        });
        const hash = await writeContract(config, sim.request);
        setState({ phase: "confirming", txUrl: txUrl(hash) });
        const rcpt = await waitForTransactionReceipt(config, { hash });
        if (rcpt.status !== "success") throw new Error("The transaction reverted on chain");
        setState({ phase: "done", paid: sim.result as bigint, txUrl: txUrl(hash) });
        onSettled?.();
      } catch (err) {
        setState({ phase: "failed", error: explain(err) });
        onSettled?.();
      }
    },
    [address, config, onSettled],
  );

  return { state, claim, reset: useCallback(() => setState({ phase: "idle" }), []) };
}
