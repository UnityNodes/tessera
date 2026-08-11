"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount, useConfig } from "wagmi";
import { parseEventLogs } from "viem";
import { simulateContract, writeContract, waitForTransactionReceipt } from "wagmi/actions";
import { TESSERA_DECK_ABI } from "@/lib/abi";
import { DECK_ADDRESS, txUrl } from "@/lib/chain";
import { approveOnce } from "@/lib/approve";
import { revealHandles } from "@/lib/inco";
import { forgetPending, pendingFor, rememberPending } from "@/lib/pending";
import { explain, type Explained } from "@/lib/errors";
import { SETTLE_MS } from "@/components/Roll";

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
  | "landing"
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
  resumed?: boolean;
  risk?: boolean;
  /**
   *
   */
  batch?: { handle: `0x${string}`; index: number; value?: number }[];
}

const IDLE: OpenState = { phase: "idle", waitedMs: 0 };

export function useOpenCase(onSettled?: () => void) {
  const config = useConfig();
  const { address } = useAccount();
  const [state, setState] = useState<OpenState>(IDLE);
  const abort = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abort.current?.abort();
    forgetPending();
    setState(IDLE);
  }, []);

  /**
   */
  const awaitReveal = useCallback(
    async (handle: `0x${string}`, ctl: AbortController) => {
      const startedWaiting = Date.now();
      setState((s) => ({ ...s, phase: "revealing", waitedMs: 0 }));

      const [revealed] = await revealHandles([handle], {
        signal: ctl.signal,
        waitForAll: true,
        onAttempt: () =>
          setState((s) =>
            s.phase === "revealing" ? { ...s, waitedMs: Date.now() - startedWaiting } : s,
          ),
      });
      if (ctl.signal.aborted) return;
      if (!revealed) {
        throw new Error("covalidators did not return the value in time");
      }

      forgetPending();
      setState((s) => ({
        ...s,
        phase: "landing",
        value: revealed.value,
        waitedMs: Date.now() - startedWaiting,
      }));
      await new Promise((r) => setTimeout(r, SETTLE_MS + 200));
      if (ctl.signal.aborted) return;
      setState((s) => ({ ...s, phase: "done" }));
      onSettled?.();
    },
    [onSettled],
  );

  /**
   */
  useEffect(() => {
    const p = pendingFor(address);
    if (!p || state.phase !== "idle") return;

    const ctl = new AbortController();
    abort.current = ctl;
    setState({
      phase: "revealing",
      resumed: true,
      index: p.index,
      handle: p.handle,
      txHash: p.txHash,
      txUrl: txUrl(p.txHash),
      waitedMs: 0,
      risk: p.risk,
    });
    awaitReveal(p.handle, ctl).catch((err) => {
      if (ctl.signal.aborted) return;
      setState((s) => ({ ...s, phase: "failed", error: explain(err) }));
    });

    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const open = useCallback(
    async ({
      deckId,
      needsApproval,
    }: {
      deckId: number;
      needsApproval: boolean;
    }) => {
      if (!address) return;
      abort.current?.abort();
      const ctl = new AbortController();
      abort.current = ctl;

      try {
        if (needsApproval) {
          setState({ phase: "approving", waitedMs: 0 });
          await approveOnce(config, address, ctl.signal);
        }

        setState({ phase: "signing", waitedMs: 0 });
        const sim = await simulateContract(config, {
          address: DECK_ADDRESS,
          abi: TESSERA_DECK_ABI,
          functionName: "openCase",
          args: [deckId],
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

        rememberPending({
          address,
          index: Number(index),
          handle,
          txHash: hash,
          at: Date.now(),
        });

        onSettled?.();

        await awaitReveal(handle, ctl);
      } catch (err) {
        if (ctl.signal.aborted) return;
        setState((s) => ({ ...s, phase: "failed", error: explain(err) }));
        onSettled?.();
      }
    },
    [address, config, onSettled, awaitReveal],
  );

  /**
   *
   */
  const openBatch = useCallback(
    async ({
      deckId,
      needsApproval,
      count,
    }: {
      deckId: number;
      needsApproval: boolean;
      count: number;
    }) => {
      if (!address) return;
      abort.current?.abort();
      const ctl = new AbortController();
      abort.current = ctl;

      try {
        if (needsApproval) {
          setState({ phase: "approving", waitedMs: 0 });
          await approveOnce(config, address, ctl.signal);
        }

        const pending = Array.from({ length: count }, (_, i) => ({
          handle: `pending-${i}` as `0x${string}`,
          index: -1,
        }));

        setState({ phase: "signing", waitedMs: 0, batch: pending });
        const sim = await simulateContract(config, {
          address: DECK_ADDRESS,
          abi: TESSERA_DECK_ABI,
          functionName: "openMany",
          args: [deckId, count],
          account: address,
        });
        const hash = await writeContract(config, sim.request);
        setState({
          phase: "confirming",
          txHash: hash,
          txUrl: txUrl(hash),
          waitedMs: 0,
          batch: pending,
        });

        const receipt = await waitForTransactionReceipt(config, { hash });
        if (receipt.status !== "success") throw new Error("The transaction reverted on chain");
        if (ctl.signal.aborted) return;

        const mine = parseEventLogs({
          abi: TESSERA_DECK_ABI,
          eventName: "CaseOpened",
          logs: receipt.logs,
        })
          .map((l) => l.args as { player: string; handle: `0x${string}`; index: number })
          .filter((a) => a.player.toLowerCase() === address.toLowerCase());

        const batch = mine.map((a) => ({ handle: a.handle, index: Number(a.index) }));
        setState({ phase: "revealing", txHash: hash, txUrl: txUrl(hash), waitedMs: 0, batch });
        onSettled?.();

        const started = Date.now();
        const revealed = await revealHandles(
          batch.map((b) => b.handle),
          {
            signal: ctl.signal,
            waitForAll: true,
            onAttempt: () =>
              setState((s) =>
                s.phase === "revealing" ? { ...s, waitedMs: Date.now() - started } : s,
              ),
            onChunk: (chunk) => {
              const byHandle = new Map(
                chunk.map((r) => [r.handle.toLowerCase(), r.value] as const),
              );
              setState((s) =>
                s.batch
                  ? {
                      ...s,
                      batch: s.batch.map((b) =>
                        b.value == null && byHandle.has(b.handle.toLowerCase())
                          ? { ...b, value: byHandle.get(b.handle.toLowerCase()) }
                          : b,
                      ),
                    }
                  : s,
              );
            },
          },
        );
        if (ctl.signal.aborted) return;

        setState((s) => ({
          ...s,
          phase: "done",
          batch: batch.map((b, i) => ({ ...b, value: revealed[i]?.value })),
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

  return { state, open, openBatch, reset };
}
