"use client";

import { useMemo } from "react";
import { useAccount } from "wagmi";
import { Chest } from "@/components/Chest";
import { Tally } from "@/components/ui/Tally";
import { useDeck } from "@/hooks/useDeck";
import { useStandings } from "@/hooks/useStandings";
import { addressUrl } from "@/lib/chain";

/**
 * The players table.
 *
 * Computed from public events rather than kept by the contract, and that is said
 * right on the page. The difference is not a formality: a ranking kept by a
 * server has to be taken on faith, and this one anyone can recompute themselves
 * from the same source as the pool counter.
 *
 * So there is no "level" here, no "points" and no "streak": none of those numbers
 * lie in the chain, and an invented number next to a real one devalues both.
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
        {/* "This many players" lives here rather than in a bar above every page.
            This number makes sense exactly where the players themselves are
            visible: next to the list it can be checked by eye, and above a case
            catalogue it was just a figure to be taken on faith. */}
        <div className="flex flex-wrap items-end justify-between gap-5 border-b border-slate-800 pb-6">
          <div>
            <h1 className="t-page text-white">Standings</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Counted from the chain, not kept by it. Every open is a public event with the
              player&apos;s address, and every revealed slot is a public value, so this table is
              arithmetic anyone can repeat, from the same data the pool counter uses.
            </p>
          </div>
          <Tally label="players" value={rows.length} />
        </div>

        {rows.length === 0 ? (
          <p className="py-20 text-center text-slate-300">
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
                    {/* The tier's chest rather than an avatar: in a game about
                        items what should be recognisable is what a person drew,
                        not a random picture derived from an address. */}
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
                        <span className="block truncate text-xs" style={{ color: r.best.ink }}>
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
                    // A zero is set in quieter ink, but not the quietest:
                    // ink-faint gives 3.8 against the 4.5 required, and in a
                    // column of numbers read in a run it is the zero that is
                    // unreadable, that is, the row where a person is looking for
                    // whether they have anything at all.
                    style={{ color: r.tickets > 0 ? "var(--color-accent)" : "var(--color-ink-dim)" }}
                  >
                    {r.tickets}
                  </span>
                </a>
              );
            })}
          </div>
        )}

        <p className="text-xs text-slate-400">
          Sorted by the TESA won, not by cases opened: the second is only money spent, and
          putting it first would make this a table of spending. Slots the covalidators have not
          returned yet are counted as opens but not as prizes.
        </p>
      </div>
    </div>
  );
}

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
