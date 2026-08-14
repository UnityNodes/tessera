"use client";

import { useCallback, useState } from "react";
import { useConfig, useReadContracts } from "wagmi";
import { simulateContract, writeContract, waitForTransactionReceipt } from "wagmi/actions";
import { Scale } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TESSERA_DECK_ABI } from "@/lib/abi";
import { DECK_ADDRESS, txUrl } from "@/lib/chain";
import { explain } from "@/lib/errors";
import { WEIGHT_PER_TICKET } from "@/lib/deck";
import type { DeckInfo } from "@/hooks/useDeck";

const deck = { address: DECK_ADDRESS, abi: TESSERA_DECK_ABI } as const;

/** Megapot's referral commission: ten cents on the dollar. */
const COMMISSION_PER_OPEN = 100_000n;

/**
 * Whether there is enough money for the prizes the decks have already promised.
 *
 * Not an accounting question but the most important one in the game. A player's
 * dollar goes whole into Megapot and buys a real ticket; what comes back is only
 * the referral commission, ten cents. That is the ONLY money the game has. Part
 * settles in the vaults, the rest buys bonus tickets.
 *
 * So the sum of all promised weight, divided by five, is the game's promise in
 * dollars, and it has to fit inside the treasury share of the commission from
 * ALL slots. If it does not, a player sees "+5 tickets", presses redeem and gets
 * a TreasuryEmpty revert. Won, but cannot collect.
 *
 * The panel shows both numbers side by side precisely because neither means
 * anything alone: a promise without cover looks like generosity.
 */
export function BudgetPanel({ decks, owner }: { decks: DeckInfo[]; owner: boolean }) {
  const config = useConfig();
  const [bps, setBps] = useState("");
  const [state, setState] = useState<{
    phase: "idle" | "signing" | "confirming" | "done" | "failed";
    url?: string;
    error?: string;
  }>({ phase: "idle" });

  const head = useReadContracts({
    contracts: [
      { ...deck, functionName: "budgetWeight" },
      { ...deck, functionName: "paidWeight" },
      { ...deck, functionName: "vaultShareBps" },
      // We ask the chain rather than the build: behind a proxy the owner
      // changes the logic in a separate transaction, and while the old logic is
      // in place this function simply does not exist in the contract. A silent
      // zero here would be worse than an honest "switch the logic first".
      { ...deck, functionName: "maxVaultShare" },
    ],
    query: { refetchInterval: 15_000 },
  });

  const budgetWeight = (head.data?.[0]?.result as bigint | undefined) ?? 0n;
  const paidWeight = (head.data?.[1]?.result as bigint | undefined) ?? 0n;
  const share = BigInt((head.data?.[2]?.result as number | undefined) ?? 0);
  const maxShare = head.data?.[3]?.result as number | undefined;

  const slots = decks.reduce((n, d) => n + BigInt(d.size), 0n);
  const promised = (budgetWeight * 1_000_000n) / BigInt(WEIGHT_PER_TICKET);
  const funded = (slots * COMMISSION_PER_OPEN * (10_000n - share)) / 10_000n;
  const covered = funded >= promised;

  const run = useCallback(async () => {
    setState({ phase: "signing" });
    try {
      const sim = await simulateContract(config, {
        ...deck,
        functionName: "setVaultShare",
        args: [Number(bps)],
      });
      const hash = await writeContract(config, sim.request);
      setState({ phase: "confirming", url: txUrl(hash) });
      const receipt = await waitForTransactionReceipt(config, { hash });
      if (receipt.status !== "success") throw new Error("The transaction reverted on chain");
      setState({ phase: "done", url: txUrl(hash) });
      await head.refetch();
    } catch (err) {
      setState({ phase: "failed", error: explain(err).title });
    }
  }, [config, bps, head]);

  if (!owner) return null;

  const usd = (v: bigint) => `$${(Number(v) / 1e6).toFixed(2)}`;
  const busy = state.phase === "signing" || state.phase === "confirming";
  const wanted = /^\d{1,5}$/.test(bps.trim()) ? Number(bps.trim()) : null;
  const tooBig = wanted != null && maxShare != null && wanted > maxShare;

  return (
    <div
      className="rounded-[var(--radius-panel)] border p-6"
      style={{
        background: "var(--color-surface)",
        borderColor: covered
          ? "color-mix(in oklab, var(--color-accent) 22%, transparent)"
          : "color-mix(in oklab, var(--color-danger) 45%, transparent)",
      }}
    >
      <h2 className="t-display flex items-center gap-2 text-xl text-white">
        <Scale
          className="h-5 w-5"
          style={{ color: covered ? "var(--color-accent)" : "var(--color-danger)" }}
        />
        <span>Prize budget</span>
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
        A player&apos;s dollar goes to Megapot whole and buys them a real ticket. All the game ever
        gets back is the referral commission, ten cents. Part of it settles into the vaults, the
        rest buys the bonus tickets the decks promise. So every promise on the board has to fit
        inside that commission, or the first person to redeem meets a revert instead of a prize.
      </p>

      <dl className="mt-5 flex flex-col gap-2 text-sm">
        <Row label="promised" value={`${usd(promised)} · ${budgetWeight} weight over ${slots} slots`} />
        <Row label="already paid" value={`${usd((paidWeight * 1_000_000n) / BigInt(WEIGHT_PER_TICKET))} · ${paidWeight} weight`} />
        <Row label="commission funds" value={`${usd(funded)} · ${Number(10_000n - share) / 100}% of ten cents a slot`} />
        <Row label="vault takes" value={`${Number(share) / 100}%`} />
        <Row
          label="ceiling"
          value={
            maxShare == null
              ? "the running logic cannot say; switch it first"
              : `the vault may take at most ${maxShare / 100}%`
          }
        />
      </dl>

      <p
        className="mt-4 text-sm font-bold"
        style={{ color: covered ? "var(--color-accent-hover)" : "var(--color-danger)" }}
      >
        {covered
          ? `Covered, with ${usd(funded - promised)} of slack.`
          : `Short by ${usd(promised - funded)}. Every prize on the board is not backed by money yet.`}
      </p>

      {maxShare != null && (
        <>
          <div className="mt-5">
            <label className="t-label mb-2 block" htmlFor="bps">
              vault share, in basis points (2000 = 20%)
            </label>
            <input
              id="bps"
              value={bps}
              onChange={(e) => setBps(e.target.value)}
              placeholder={String(maxShare)}
              spellCheck={false}
              inputMode="numeric"
              className="w-full max-w-xs rounded-[var(--radius-control)] border border-slate-800 bg-slate-950 px-4 py-3 font-mono text-sm text-white outline-none focus:border-slate-600"
            />
            {tooBig && (
              <p className="mt-2 text-sm text-[var(--color-danger)]">
                Above the ceiling; the contract will refuse it. Prizes already promised are paid
                out of what the vault does not take.
              </p>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button disabled={wanted == null || tooBig || busy} onClick={() => void run()}>
              {state.phase === "signing"
                ? "Sign in your wallet…"
                : state.phase === "confirming"
                  ? "Confirming…"
                  : "Set the vault share"}
            </Button>
            {state.url && (
              <a
                className="t-chain text-sm text-slate-400"
                href={state.url}
                target="_blank"
                rel="noreferrer"
              >
                transaction
              </a>
            )}
          </div>
        </>
      )}

      {state.phase === "done" && (
        <p className="mt-3 text-sm" style={{ color: "var(--color-accent-hover)" }}>
          Set. Vaults already filled keep what they hold; only the split from here on changes.
        </p>
      )}
      {state.error && <p className="mt-3 text-sm text-[var(--color-danger)]">{state.error}</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <dt className="t-label w-36 shrink-0">{label}</dt>
      <dd className="t-chain text-slate-300">{value}</dd>
    </div>
  );
}
