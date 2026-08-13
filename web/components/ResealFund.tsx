"use client";

import { useCallback, useState } from "react";
import { useBalance, useConfig, useReadContracts } from "wagmi";
import { sendTransaction, waitForTransactionReceipt } from "wagmi/actions";
import { formatEther, parseEther, type ContractFunctionParameters } from "viem";
import { Shuffle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TESSERA_DECK_ABI } from "@/lib/abi";
import { DECK_ADDRESS, addressUrl, txUrl } from "@/lib/chain";
import { explain } from "@/lib/errors";
import type { DeckInfo } from "@/hooks/useDeck";

/**
 *
 *
 *
 */
export function ResealFund({ decks }: { decks: DeckInfo[] }) {
  const config = useConfig();
  const [amount, setAmount] = useState("0.01");
  const [state, setState] = useState<{ phase: string; url?: string; error?: string }>({
    phase: "idle",
  });

  const balance = useBalance({ address: DECK_ADDRESS, query: { refetchInterval: 15_000 } });

  const fees = useReadContracts({
    contracts: decks.map(
      (d) =>
        ({
          address: DECK_ADDRESS,
          abi: TESSERA_DECK_ABI,
          functionName: "deckFee",
          args: [d.size],
        }) as ContractFunctionParameters,
    ),
    query: { enabled: decks.length > 0 },
  });

  const priced = decks
    .map((d, i) => ({ deck: d, fee: fees.data?.[i]?.result as bigint | undefined }))
    .filter((x): x is { deck: DeckInfo; fee: bigint } => typeof x.fee === "bigint");

  const have = balance.data?.value ?? 0n;
  const dearest = priced.reduce((max, x) => (x.fee > max ? x.fee : max), 0n);
  const cheapest = priced.reduce((min, x) => (min === 0n || x.fee < min ? x.fee : min), 0n);

  const valid = /^\d*\.?\d+$/.test(amount.trim()) && Number(amount) > 0;

  const run = useCallback(async () => {
    setState({ phase: "signing" });
    try {
      const hash = await sendTransaction(config, {
        to: DECK_ADDRESS,
        value: parseEther(amount.trim()),
      });
      setState({ phase: "confirming", url: txUrl(hash) });
      const receipt = await waitForTransactionReceipt(config, { hash });
      if (receipt.status !== "success") throw new Error("The transaction reverted on chain");
      setState({ phase: "done", url: txUrl(hash) });
      void balance.refetch();
    } catch (err) {
      setState({ phase: "idle", error: explain(err).title });
    }
  }, [config, amount, balance]);

  return (
    <div
      className="rounded-[var(--radius-panel)] border bg-slate-950/40 p-6"
      style={{
        borderColor: "color-mix(in oklab, var(--color-accent) 22%, transparent)",
      }}
    >
      <h2 className="t-display flex items-center gap-2 text-xl text-white">
        <Shuffle className="h-5 w-5" style={{ color: "var(--color-accent)" }} />
        <span>Reseal fund</span>
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
        A deck deals itself again when its last card is drawn or when its vault is taken, nobody
        triggers it, the contract does it inside the next player&rsquo;s transaction. Dealing costs
        ETH, paid to the Inco covalidators who shuffle the cards, and it comes out of this balance.
        Anyone can top it up; when it runs dry the decks simply end, exactly as they used to.
      </p>

      <dl className="mt-5 flex flex-col gap-2 text-sm">
        <div className="flex flex-wrap items-baseline gap-2">
          <dt className="t-label w-28">in the fund</dt>
          <dd className="t-chain text-slate-300">
            <a href={addressUrl(DECK_ADDRESS)} target="_blank" rel="noreferrer">
              {balance.isLoading ? "reading the chain…" : `${formatEther(have)} ETH`}
            </a>
          </dd>
        </div>
        {dearest > 0n && (
          <div className="flex flex-wrap items-baseline gap-2">
            <dt className="t-label w-28">buys</dt>
            <dd className="t-chain text-slate-300">
              {have / dearest === have / cheapest ? (
                <>{String(have / dearest)} reseals</>
              ) : (
                <>
                  {String(have / dearest)}–{String(have / cheapest)} reseals
                  <span className="ml-2 text-slate-500">
                    biggest deck first, smallest last
                  </span>
                </>
              )}
            </dd>
          </div>
        )}
      </dl>

      <div className="mt-5">
        <label className="t-label mb-2 block" htmlFor="topup">
          add
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <input
            id="topup"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            spellCheck={false}
            className="w-40 rounded-[var(--radius-control)] border border-slate-800 bg-slate-950 px-4 py-3 font-mono text-sm text-white outline-none focus:border-slate-600"
          />
          <span className="t-label">ETH</span>
          <Button
            disabled={!valid || state.phase === "signing" || state.phase === "confirming"}
            onClick={() => void run()}
          >
            {state.phase === "signing"
              ? "Sign in your wallet…"
              : state.phase === "confirming"
                ? "Confirming…"
                : "Top up the fund"}
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
      </div>

      {state.phase === "done" && (
        <p className="mt-3 text-sm" style={{ color: "var(--color-accent-hover)" }}>
          Topped up. The decks keep themselves alive from here.
        </p>
      )}
      {state.error && <p className="mt-3 text-sm text-[var(--color-danger)]">{state.error}</p>}
    </div>
  );
}
