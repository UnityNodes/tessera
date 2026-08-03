"use client";

import { useCallback, useRef, useState } from "react";
import { useAccount, useConfig } from "wagmi";
import { simulateContract, writeContract, waitForTransactionReceipt } from "wagmi/actions";
import { maxUint256 } from "viem";
import { TESSERA_DECK_ABI } from "@/lib/abi";
import { DECK_ADDRESS, TICKET_TOKEN, TOKEN_ABI, txUrl } from "@/lib/chain";
import { revealHandles } from "@/lib/inco";
import { explain, type Explained } from "@/lib/errors";

/**
 *
 *
 */
export type OpenPhase =
  | "idle"
  | "approving"
  | "signing"
  | "confirming"
  | "revealing"
  | "done"
  | "failed";

export interface OpenState {
  phase: OpenPhase;
  index?: number;
  handle?: `0x${string}`;
  value?: number;
  txHash?: `0x${string}`;
  txUrl?: string;
  error?: Explained;
  waitedMs: number;
}

const IDLE: OpenState = { phase: "idle", waitedMs: 0 };

export function useOpenCase(onSettled?: () => void) {
  const config = useConfig();
  const { address } = useAccount();
  const [state, setState] = useState<OpenState>(IDLE);
  const abort = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abort.current?.abort();
    setState(IDLE);
  }, []);

  const open = useCallback(
    async ({ needsApproval }: { needsApproval: boolean }) => {
      if (!address) return;
      abort.current?.abort();
      const ctl = new AbortController();
      abort.current = ctl;

      try {
        if (needsApproval) {
          setState({ phase: "approving", waitedMs: 0 });
          const { request } = await simulateContract(config, {
            address: TICKET_TOKEN,
            abi: TOKEN_ABI,
            functionName: "approve",
            args: [DECK_ADDRESS, maxUint256],
            account: address,
          });
          const hash = await writeContract(config, request);
          await waitForTransactionReceipt(config, { hash });
        }

        setState({ phase: "signing", waitedMs: 0 });
        const sim = await simulateContract(config, {
          address: DECK_ADDRESS,
          abi: TESSERA_DECK_ABI,
          functionName: "openCase",
          account: address,
        });
        const [index, handle] = sim.result as readonly [number, `0x${string}`];

        const hash = await writeContract(config, sim.request);
        setState({
          phase: "confirming",
          index: Number(index),
          handle,
          txHash: hash,
          txUrl: txUrl(hash),
          waitedMs: 0,
        });

        const receipt = await waitForTransactionReceipt(config, { hash });
        if (receipt.status !== "success") {
          throw new Error("The transaction reverted on chain");
        }
        if (ctl.signal.aborted) return;

        const startedWaiting = Date.now();
        setState((s) => ({ ...s, phase: "revealing", waitedMs: 0 }));

        const [revealed] = await revealHandles([handle], {
          signal: ctl.signal,
          onAttempt: () =>
            setState((s) =>
              s.phase === "revealing" ? { ...s, waitedMs: Date.now() - startedWaiting } : s,
            ),
        });

        if (ctl.signal.aborted) return;
        setState((s) => ({
          ...s,
          phase: "done",
          value: revealed.value,
          waitedMs: Date.now() - startedWaiting,
        }));
        onSettled?.();
      } catch (err) {
        if (ctl.signal.aborted) return;
        setState((s) => ({ ...s, phase: "failed", error: explain(err) }));
        onSettled?.();
      }
    },
    [address, config, onSettled],
  );

  return { state, open, reset };
}
