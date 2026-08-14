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
 * The phases of an open. Split this way because the nature of time differs in
 * each:
 *
 *   approving/signing   exactly as long as the player looks at their wallet
 *   confirming          0.8 to 1.6 s, deterministic, progress belongs here
 *   revealing           5.9 to 8.6 s, unknown, progress MUST NOT be shown
 *   done                the result arrived
 *
 * The animation has to be able to run through revealing indefinitely and stop
 * not on a timer but on the fact of the value arriving.
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
  /** The slot index, known from the simulation, before sending. */
  index?: number;
  handle?: `0x${string}`;
  /** The slot's value. Appears only in the done phase. */
  value?: number;
  txHash?: `0x${string}`;
  txUrl?: string;
  error?: Explained;
  /** How long we have waited on the covalidator, ms. For animation, not progress. */
  waitedMs: number;
  /** This open began before the player left, and we are catching up with it. */
  resumed?: boolean;
  /**
   * A batch: several cases in one transaction.
   *
   * A separate field rather than an array in place of `value`, deliberately. A
   * single open is a full screen performance with one card, and all of its paths
   * are built around one value. A batch is shown differently, as a row of
   * results. Merging them into one field would mean rewriting the theatre for a
   * case it does not have.
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
   * Wait for the value of a handle that is already drawn and paid for.
   * A shared tail for an ordinary open and for resuming after a return, so that
   * "let us carry on where we left off" is not separate logic that drifts away
   * from the main one.
   */
  const awaitReveal = useCallback(
    async (handle: `0x${string}`, ctl: AbortController) => {
      const startedWaiting = Date.now();
      setState((s) => ({ ...s, phase: "revealing", waitedMs: 0 }));

      const [revealed] = await revealHandles([handle], {
        signal: ctl.signal,
        // This is the very slot the player is watching right now, so a partial
        // answer makes no sense here; we wait for that one.
        waitForAll: true,
        onAttempt: () =>
          setState((s) =>
            s.phase === "revealing" ? { ...s, waitedMs: Date.now() - startedWaiting } : s,
          ),
      });
      if (ctl.signal.aborted) return;
      // A minute of silence from the covalidators. The slot is drawn and paid
      // for and is not going anywhere: the intent sits on disk, and returning to
      // the page picks it up from the same place.
      if (!revealed) {
        throw new Error("covalidators did not return the value in time");
      }

      forgetPending();
      // The value is ours already, but first the strip has to settle on it. The
      // duration comes from Roll rather than being written as a number twice: if
      // the two drifted apart by half a second the chest would open on top of a
      // strip still moving.
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
   * The player closed the tab while waiting. The transaction has gone through,
   * the slot is drawn and belongs to them, and all that is left is to show what
   * it was.
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
    });
    awaitReveal(p.handle, ctl).catch((err) => {
      if (ctl.signal.aborted) return;
      setState((s) => ({ ...s, phase: "failed", error: explain(err) }));
    });

    return () => ctl.abort();
    // Deliberately only on a change of wallet: restarting the recovery on every
    // phase change would send it round in circles.
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
        // ── approval, first time only ────────────────────────────────────
        if (needsApproval) {
          setState({ phase: "approving", waitedMs: 0 });
          await approveOnce(config, address, ctl.signal);
        }

        // ── simulation ───────────────────────────────────────────────────
        // The handle comes from here, BEFORE sending. The public RPC lags 1 to
        // 1.6 s behind a write, so a read immediately after the transaction
        // fails with array out-of-bounds. A simulation is both faster and one
        // request fewer.
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
          // viem resolves even on a reverted transaction, so the status has to
          // be checked by hand, otherwise we show success on a revert.
          throw new Error("The transaction reverted on chain");
        }
        if (ctl.signal.aborted) return;

        // From this moment the slot is drawn and paid for. If the player leaves
        // now the prize is still theirs, so the intent goes to disk BEFORE the
        // wait.
        rememberPending({
          address,
          index: Number(index),
          handle,
          txHash: hash,
          at: Date.now(),
        });

        // The money is already spent, and the numbers in the header have to
        // show it immediately rather than after six to eight seconds of
        // decryption. Until now the balance updated only together with the
        // result, and a player saw that they had paid while the figure had not
        // changed: the worst possible impression a payment screen can leave.
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
   * Open several cases in one transaction.
   *
   * The handles come from the receipt's events rather than from a simulation:
   * `openMany` returns nothing, and returning an array just for this is not
   * worth it, since the contract emits `CaseOpened` events in any case and it is
   * those that the rest of the site listens to.
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

        // How many strips there will be is known ALREADY, before the signature.
        // Until now the theatre learned it only from the receipt, so it first
        // drew one strip (as in a single open), then blinked and rebuilt itself
        // to the right count. The places for the handles are left empty; they
        // arrive with the events.
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
            // Each strip brakes as soon as ITS value arrives rather than when
            // all ten have gathered. The covalidators return batches of six, so
            // waiting for the last would mean keeping nine already known ones
            // moving for nothing, which is exactly why a ten felt endless.
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
