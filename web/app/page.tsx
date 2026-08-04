"use client";

import { useMemo } from "react";
import Link from "next/link";
import { formatUnits } from "viem";
import { Button } from "@/components/ui/Button";
import { Contents } from "@/components/Contents";
import { useDeck } from "@/hooks/useDeck";
import { usePool } from "@/hooks/usePool";
import { useBattleList } from "@/hooks/useBattles";
import { slotsPerTier } from "@/lib/deck";

/**
 *
 *
 */
export default function Home() {
  const deck = useDeck();
  const shape = useMemo(
    () => ({ size: deck.size, tiers: deck.tiers, vaultUpTo: deck.vaultUpTo }),
    [deck.size, deck.tiers, deck.vaultUpTo],
  );
  const pool = usePool(shape, deck.drawn);
  const battles = useBattleList();

  const vault = Number(formatUnits(deck.vault, 6)).toFixed(2);
  const prizesLeft =
    pool.data?.prizesLeft ??
    slotsPerTier(shape)
      .filter((t) => t.weight > 0)
      .reduce((n, t) => n + t.count, 0);

  return (
    <>
      <section className="surface relative overflow-hidden rounded-[3px]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(70% 120% at 82% 50%, color-mix(in oklab, var(--color-porphyry-900) 70%, transparent), transparent 70%)",
          }}
        />
        <div className="relative grid items-center gap-6 p-6 sm:p-10 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <h1 className="t-display text-[clamp(1.9rem,4vw,3.25rem)]">
              $1 buys a real lottery ticket.
              <br />
              <span className="text-[var(--color-sinopia-400)]">The case is free.</span>
            </h1>
            <p className="mt-4 max-w-xl text-[1.0625rem] text-[var(--color-travertine-dim)]">
              The same ticket sold on megapot.io, bought for you in the same transaction that
              opens the case. What is inside sits in an encrypted, finite pool, shuffled once,
              drawn without replacement, and countable by anyone.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/case">
                <Button>Open a case · $1</Button>
              </Link>
              <Link href="/battles">
                <Button variant="quiet">
                  Battles{battles.open.length > 0 ? ` · ${battles.open.length} waiting` : ""}
                </Button>
              </Link>
            </div>

            <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4">
              <Figure label="the vault" value={`$${vault}`} ink="var(--color-porphyry-300)" />
              <Figure label="prizes left" value={`${prizesLeft} of ${deck.remaining}`} />
              <Figure label="cases opened" value={String(deck.drawn)} />
            </dl>
          </div>

          <Link href="/case" className="group grid place-items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/cases/hero.png"
              alt="A sealed case"
              className="w-full max-w-[420px] transition-transform duration-500 group-hover:-translate-y-2"
              draggable={false}
            />
          </Link>
        </div>
      </section>

      <section className="surface mt-5 rounded-[3px] p-6 sm:p-8">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="t-label">what is in this case</p>
            <p className="mt-1 text-[1.0625rem] text-[var(--color-travertine-dim)]">
              Season {deck.season} · {deck.size} cases, shuffled once before anyone opened one.
            </p>
          </div>
          <p className="text-[0.9375rem] text-[var(--color-travertine-faint)]">
            counted from the public reveals, not promised
          </p>
        </div>
        <Contents deck={shape} pool={pool.data} />
      </section>

      <section className="surface mt-5 flex flex-wrap items-center justify-between gap-4 rounded-[3px] p-6 sm:p-8">
        <div className="max-w-2xl">
          <p className="t-label">battles</p>
          <p className="mt-1 text-[1.0625rem] text-[var(--color-travertine-dim)]">
            Two cases open at once and the better card takes both prizes. Neither card can be
            read until both players have paid, not even by the one who opened the battle.
          </p>
        </div>
        <Link href="/battles">
          <Button variant="quiet">
            {battles.open.length > 0
              ? `${battles.open.length} waiting for an opponent`
              : "Open the first one"}
          </Button>
        </Link>
      </section>
    </>
  );
}

function Figure({ label, value, ink }: { label: string; value: string; ink?: string }) {
  return (
    <div>
      <dt className="t-label">{label}</dt>
      <dd
        className="t-chain mt-1 text-2xl leading-none"
        style={{ color: ink ?? "var(--color-travertine)" }}
      >
        {value}
      </dd>
    </div>
  );
}
