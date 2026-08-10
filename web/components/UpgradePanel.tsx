"use client";

import { useCallback, useState } from "react";
import { useConfig } from "wagmi";
import { simulateContract, writeContract, waitForTransactionReceipt } from "wagmi/actions";
import { useQuery } from "@tanstack/react-query";
import { getPublicClient } from "wagmi/actions";
import { ArrowUpCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TESSERA_DECK_ABI } from "@/lib/abi";
import { DECK_ADDRESS, addressUrl, txUrl } from "@/lib/chain";
import { explain } from "@/lib/errors";

/**
 *
 */
const IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc" as const;

/**
 *
 *
 */
export function UpgradePanel({ owner }: { owner: boolean }) {
  const config = useConfig();
  const [target, setTarget] = useState("");
  const [state, setState] = useState<{ phase: string; url?: string; error?: string }>({
    phase: "idle",
  });

  const live = useQuery({
    queryKey: ["implementation", DECK_ADDRESS],
    queryFn: async () => {
      const client = getPublicClient(config);
      if (!client) return null;
      const word = await client.getStorageAt({ address: DECK_ADDRESS, slot: IMPL_SLOT });
      if (!word || /^0x0+$/.test(word)) return null;
      return `0x${word.slice(26)}` as `0x${string}`;
    },
    refetchInterval: 15_000,
  });

  const valid = /^0x[0-9a-fA-F]{40}$/.test(target.trim());
  const same = valid && live.data && target.trim().toLowerCase() === live.data.toLowerCase();

  const run = useCallback(async () => {
    setState({ phase: "signing" });
    try {
      const sim = await simulateContract(config, {
        address: DECK_ADDRESS,
        abi: TESSERA_DECK_ABI,
        functionName: "upgradeToAndCall",
        args: [target.trim() as `0x${string}`, "0x"],
      });
      const hash = await writeContract(config, sim.request);
      setState({ phase: "confirming", url: txUrl(hash) });
      const receipt = await waitForTransactionReceipt(config, { hash });
      if (receipt.status !== "success") throw new Error("The transaction reverted on chain");
      setState({ phase: "done", url: txUrl(hash) });
      await live.refetch();
    } catch (err) {
      setState({ phase: "failed", error: explain(err).title });
    }
  }, [config, target, live]);

  if (!owner) return null;

  return (
    <div
      className="rounded-[var(--radius-panel)] border p-6"
      style={{
        background: "var(--color-surface)",
        borderColor: "color-mix(in oklab, var(--color-accent) 22%, transparent)",
      }}
    >
      <h2 className="t-display flex items-center gap-2 text-xl text-white">
        <ArrowUpCircle className="h-5 w-5" style={{ color: "var(--color-accent)" }} />
        <span>Game logic</span>
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
        The game sits behind a proxy, so changing the rules replaces the logic and leaves the board
        alone, decks, slots, vaults and open battles all stay exactly where they are. Only the
        owner can switch it.
      </p>

      <dl className="mt-5 flex flex-col gap-2 text-sm">
        <div className="flex flex-wrap items-baseline gap-2">
          <dt className="t-label w-28">game</dt>
          <dd className="t-addr text-slate-300">
            <a href={addressUrl(DECK_ADDRESS)} target="_blank" rel="noreferrer">
              {DECK_ADDRESS}
            </a>
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline gap-2">
          <dt className="t-label w-28">running now</dt>
          <dd className="t-addr text-slate-300">
            {live.isLoading ? "reading the chain…" : live.data ? (
              <a href={addressUrl(live.data)} target="_blank" rel="noreferrer">
                {live.data}
              </a>
            ) : (
              "not a proxy"
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-5">
        <label className="t-label mb-2 block" htmlFor="impl">
          switch to
        </label>
        <input
          id="impl"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="0x… address of the new logic"
          spellCheck={false}
          className="w-full rounded-[var(--radius-control)] border border-slate-800 bg-slate-950 px-4 py-3 font-mono text-sm text-white outline-none focus:border-slate-600"
        />
        {same && (
          <p className="mt-2 text-sm text-slate-400">That is the logic already running.</p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          disabled={!valid || Boolean(same) || state.phase === "signing" || state.phase === "confirming"}
          onClick={() => void run()}
        >
          {state.phase === "signing"
            ? "Sign in your wallet…"
            : state.phase === "confirming"
              ? "Confirming…"
              : "Switch the logic"}
        </Button>
        {state.url && (
          <a className="t-chain text-sm text-slate-400" href={state.url} target="_blank" rel="noreferrer">
            transaction
          </a>
        )}
      </div>

      {state.phase === "done" && (
        <p className="mt-3 text-sm" style={{ color: "var(--color-accent-hover)" }}>
          Switched. The board is untouched.
        </p>
      )}
      {state.error && <p className="mt-3 text-sm text-[var(--color-danger)]">{state.error}</p>}
    </div>
  );
}
