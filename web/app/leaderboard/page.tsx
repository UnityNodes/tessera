"use client";

import { useMemo } from "react";
import { useAccount } from "wagmi";
import { Chest } from "@/components/Chest";
import { Tally } from "@/components/ui/Tally";
import { useDeck } from "@/hooks/useDeck";
import { useStandings } from "@/hooks/useStandings";
import { addressUrl } from "@/lib/chain";

/**
 *
 *
 */
export default function LeaderboardPage() {
  const { address } = useAccount();
  const game = useDeck();
  const shapes = useMemo(
    () => game.decks.map((d) => ({ size: d.size, tiers: d.tiers, vaultUpTo: d.vaultUpTo })),
    [game.decks],
  );
  const rows = useStandings(shapes);
  const me = address?.toLowerCase();

  return (
    <div className="w-full bg-[var(--color-section)] px-4 py-10 lg:px-8 2xl:px-14">
      <div className="mx-auto flex max-w-[900px] flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-5 border-b border-slate-800 pb-6">
          <div>
            <h1 className="t-page text-white">Standings</h1>
            <p className="mt-2 max-w-2xl text-[0.9375rem] text-slate-400">
              Counted from the chain, not kept by it. Every open is a public event with the
              player&apos;s address, and every revealed slot is a public value, so this table is
              arithmetic anyone can repeat, from the same data the pool counter uses.
            </p>
          </div>
          <Tally label="players" value={rows.length} />
        </div>

        {rows.length === 0 ? (
          <p className="py-20 text-center text-slate-400">
            {game.isLoading ? "Reading the chain…" : "Nobody has opened a case yet."}
          </p>
        ) : (
          <div className="overflow-hidden rounded-[var(--radius-panel)] border border-[var(--edge)]">
            <div className="t-label grid grid-cols-[2.5rem_1fr_auto] items-center gap-4 border-b border-[var(--edge)] bg-[var(--color-surface)] px-5 py-3 sm:grid-cols-[2.5rem_1fr_5rem_5rem_6rem]">
              <span>#</span>
              <span>player</span>
              <span className="hidden text-right sm:block">opened</span>
              <span className="hidden text-right sm:block">prizes</span>
              <span className="text-right">tickets won</span>
            </div>

            {rows.map((r, i) => {
              const mine = r.player.toLowerCase() === me;
              return (
                <a
                  key={r.player}
                  href={addressUrl(r.player)}
                  target="_blank"
                  rel="noreferrer"
                  className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-4 border-b border-[var(--edge)] px-5 py-4 transition-colors last:border-0 hover:bg-[var(--color-raised)] sm:grid-cols-[2.5rem_1fr_5rem_5rem_6rem]"
                  style={
                    mine
                      ? { background: "color-mix(in oklab, var(--color-accent) 5%, transparent)" }
                      : undefined
                  }
                >
                  <span className="t-chain text-sm font-extrabold text-[var(--color-ink-dim)]">
                    {i + 1}
                  </span>

                  <span className="flex min-w-0 items-center gap-3">
                    {r.best && <Chest rarity={r.best.rarity} size={36} className="shrink-0" />}
                    <span className="min-w-0">
                      <span
                        className="t-addr block truncate text-sm font-bold"
                        style={{ color: mine ? "var(--color-accent)" : "var(--color-ink)" }}
                      >
                        {short(r.player)}
                        {mine ? " · you" : ""}
                      </span>
                      {r.best && (
                        <span className="block truncate text-[0.6875rem]" style={{ color: r.best.ink }}>
                          best: {r.best.name}
                          {r.pending > 0 ? ` · ${r.pending} still decrypting` : ""}
                        </span>
                      )}
                    </span>
                  </span>

                  <span className="t-chain hidden text-right text-sm text-slate-400 sm:block">
                    {r.opens}
                  </span>
                  <span className="t-chain hidden text-right text-sm text-slate-400 sm:block">
                    {r.prizes}
                  </span>
                  <span
                    className="t-chain text-right text-sm font-extrabold"
                    style={{ color: r.tickets > 0 ? "var(--color-accent)" : "var(--color-ink-faint)" }}
                  >
                    {r.tickets}
                  </span>
                </a>
              );
            })}
          </div>
        )}

        <p className="text-xs text-slate-500">
          Sorted by the TESA won, not by cases opened, the second is only money spent, and
          putting it first would make this a table of spending. Slots the covalidators have not
          returned yet are counted as opens but not as prizes.
        </p>
      </div>
    </div>
  );
}

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
