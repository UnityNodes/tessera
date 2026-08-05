"use client";

import Link from "next/link";
import { formatUnits } from "viem";
import { Button } from "@/components/ui/Button";
import { Crate } from "@/components/Crate";
import { PoolGrid } from "@/components/PoolGrid";
import { Counter } from "@/components/ui/Counter";
import { useDeck, type DeckInfo } from "@/hooks/useDeck";
import { useBattleList } from "@/hooks/useBattles";
import { slotsPerTier } from "@/lib/deck";

/**
 *
 *
 *
 */
export default function Home() {
  const game = useDeck();
  const battles = useBattleList();
  const first = game.decks.find((d) => !d.empty) ?? game.decks[0];

  return (
    <>
      <section className="relative -mx-5 -mt-8 overflow-hidden border-b border-[var(--edge)] sm:-mx-8 2xl:-mx-12">
        <div className="relative mx-auto max-w-[1800px] px-5 pb-14 pt-16 sm:px-8 sm:pt-20 2xl:px-12">
          <div className="grid items-end gap-10 lg:grid-cols-[minmax(0,1fr)_auto]">
            <h1 className="t-display max-w-[16ch] text-balance text-[clamp(2.8rem,7vw,5.2rem)] leading-[0.94]">
              A finite pool,
              <br />
              drawn without
              <br />
              <span className="text-[var(--color-accent-bright)]">replacement.</span>
            </h1>

            <div className="lg:text-right">
              <span className="t-label block text-[0.5625rem]">still sealed, all decks</span>
              <span className="mt-2 flex items-baseline gap-2 lg:justify-end">
                <Counter
                  value={game.remaining}
                  className="t-chain text-[clamp(3rem,7vw,4.75rem)] font-medium leading-[0.9]"
                  style={{
                    color: "var(--color-ink)",
                    textShadow: "0 0 44px color-mix(in oklab, var(--color-accent) 45%, transparent)",
                  }}
                />
                <span className="t-chain text-[1.25rem] text-[var(--color-ink-faint)]">
                  / {game.decks.reduce((n, d) => n + d.size, 0) || ", "}
                </span>
              </span>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-end gap-x-14 gap-y-8">
            <p className="max-w-[46ch] text-[1.0625rem] leading-relaxed text-[var(--color-ink-dim)]">
              A case costs $1 and buys you a real Megapot lottery ticket, the same one sold on
              megapot.io, bought in the transaction that opens the case. What is inside the case
              was shuffled once, before anyone opened one, and is drawn in order. A prize someone
              else takes is gone for everybody.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Link href={`/case/${first?.id ?? 0}`}>
                <Button>Open a case · $1</Button>
              </Link>
              <Link href="/battles">
                <Button variant="quiet">
                  Battles{battles.open.length > 0 ? ` · ${battles.open.length} waiting` : ""}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-14">
        <div className="mb-8 flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--edge)] pb-4">
          <h2 className="t-display text-[clamp(1.5rem,3vw,2.1rem)]">the pools</h2>
          <p className="t-label">
            {game.decks.length > 0
              ? `${game.decks.length} decks · ${game.remaining} of ${game.decks.reduce((n, d) => n + d.size, 0)} slots still sealed`
              : "reading the chain…"}
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {game.decks.map((d) => (
            <PoolRow key={d.id} deck={d} />
          ))}
        </div>
      </section>
    </>
  );
}

/**
 *
 */
function PoolRow({ deck }: { deck: DeckInfo }) {
  const tiers = slotsPerTier(deck);
  const best = tiers
    .filter((t) => t.weight > 0)
    .reduce<(typeof tiers)[number] | undefined>(
      (a, b) => (b.spec.tickets > (a?.spec.tickets ?? -1) ? b : a),
      undefined,
    )?.spec;

  const ink = best?.ink ?? "var(--color-accent)";
  const top = tiers.reduce((n, t) => Math.max(n, t.spec.tickets), 0);
  const prizes = tiers.filter((t) => t.weight > 0).reduce((n, t) => n + t.count, 0);
  const paying = prizes + deck.vaultUpTo;
  const oneIn = paying > 0 ? Math.max(1, Math.round(deck.size / paying)) : 0;

  return (
    <Link
      href={`/case/${deck.id}`}
      className="group block border border-[var(--edge)] bg-[color-mix(in_oklab,var(--color-surface)_45%,transparent)] p-5 transition-colors hover:border-[color-mix(in_oklab,var(--card-ink)_45%,transparent)] sm:p-6"
      style={{ ["--card-ink" as string]: ink }}
    >
      <div className="grid items-center gap-6 lg:grid-cols-[auto_minmax(0,1fr)_auto]">
        <div className="flex items-center gap-4">
          <Crate
            rarity={deck.empty ? "grout" : (best?.rarity ?? "sealed")}
            size={132}
            className="shrink-0 transition-transform duration-500 group-hover:scale-105"
          />
          <div className="min-w-0">
            <p className="t-display text-[1.5rem] leading-none" style={{ color: ink }}>
              {deck.empty ? "Emptied" : (best?.name ?? "Sealed")}
            </p>
            <p className="mt-2 text-[0.875rem] leading-snug text-[var(--color-ink-dim)]">
              {deck.empty
                ? "every case opened"
                : oneIn > 0
                  ? `1 in ${oneIn} pays · best ${top > 0 ? `+${top}` : "the vault"}`
                  : "no prizes left"}
            </p>
          </div>
        </div>

        <div className="min-w-0">
          <PoolGrid size={deck.size} drawn={deck.drawn} ink={ink} />
          <div className="mt-3 flex items-baseline justify-between gap-4">
            <span className="t-label">
              <Counter
                value={deck.remaining}
                className="t-chain text-[1.125rem] font-medium"
                style={{ color: "var(--color-ink)" }}
              />{" "}
              of {deck.size} sealed
            </span>
            <span className="t-label">
              {deck.drawn} drawn
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6 lg:flex-col lg:items-end lg:gap-3">
          {deck.vaultUpTo > 0 ? (
            <div className="lg:text-right">
              <span className="t-label block text-[0.5625rem]">vault</span>
              <span
                className="t-chain text-[1.75rem] leading-none"
                style={{
                  color: "var(--color-tier-vault)",
                  textShadow:
                    "0 0 28px color-mix(in oklab, var(--color-tier-vault) 50%, transparent)",
                }}
              >
                ${Number(formatUnits(deck.vault, 6)).toFixed(2)}
              </span>
            </div>
          ) : (
            <span className="t-label">tickets only</span>
          )}
          <span
            className="t-label whitespace-nowrap transition-colors group-hover:text-[var(--color-ink)]"
            style={{ color: ink }}
          >
            open · $1 →
          </span>
        </div>
      </div>
    </Link>
  );
}
