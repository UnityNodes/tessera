"use client";

import { useMemo } from "react";
import Link from "next/link";
import { formatUnits } from "viem";
import { Button } from "@/components/ui/Button";
import { useDeck } from "@/hooks/useDeck";
import { usePool } from "@/hooks/usePool";
import { useBattleList } from "@/hooks/useBattles";
import type { Rarity } from "@/lib/deck";
import { Crate } from "@/components/Crate";
import { Contents } from "@/components/Contents";

/**
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

  return (
    <>
      <section className="surface relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-1/2"
          style={{
            background:
              "radial-gradient(60% 120% at 90% 50%, color-mix(in oklab, var(--color-accent) 16%, transparent), transparent 70%)",
          }}
        />
        <div className="relative flex flex-wrap items-center justify-between gap-6 px-6 py-6 sm:px-10">
          <div className="max-w-2xl">
            <h2 className="t-display text-[clamp(1.15rem,2vw,1.6rem)] leading-snug">
              Play for free. The dollars are test dollars, minted from the header.
            </h2>
            <p className="mt-2 text-[var(--color-ink-dim)]">
              Every ticket is still bought against the real Megapot contract, the money is
              the only part that is fake.
            </p>
          </div>
          <Link href="/case">
            <Button>Open a case · $1</Button>
          </Link>
        </div>
      </section>

      <section className="surface relative mt-5 overflow-hidden rounded-[var(--radius-panel)]">
        <div
          aria-hidden
          className="pointer-events-none absolute right-[8%] top-1/2 hidden h-[34rem] w-[34rem] -translate-y-1/2 rounded-full lg:block"
          style={{
            background:
              "radial-gradient(closest-side, color-mix(in oklab, var(--color-accent) 26%, transparent), transparent 70%)",
            filter: "blur(30px)",
          }}
        />
        <div className="relative grid items-center gap-8 px-6 py-12 sm:px-10 lg:grid-cols-[1.05fr_1fr] lg:py-16">
          <div>
            <h1 className="t-display text-[clamp(2rem,4.4vw,3.4rem)]">
              $1 buys a real lottery ticket.
              <br />
              <span className="text-[var(--color-accent-bright)]">The case is free.</span>
            </h1>
            <p className="mt-5 max-w-xl text-[1.0625rem] text-[var(--color-ink-dim)]">
              The same ticket sold on megapot.io, bought for you in the same transaction that
              opens the case. What is inside sits in an encrypted, finite pool, shuffled once,
              drawn without replacement, and countable by anyone.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/case">
                <Button>Open a case · $1</Button>
              </Link>
              <Link href="/battles">
                <Button variant="quiet">
                  Battles{battles.open.length > 0 ? ` · ${battles.open.length} waiting` : ""}
                </Button>
              </Link>
            </div>
          </div>

          <Link
            href="/case"
            className="group grid place-items-center transition-transform duration-500 hover:-translate-y-2"
            aria-label="Open a case"
          >
            <Crate rarity="sealed" size={300} drift />
          </Link>
        </div>
      </section>

      <Heading title="the case" note={`season ${deck.season} · ${deck.size} of them, shuffled once`} />
      <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CaseCard
          href="/case"
          rarity="sealed"
          name={`Season ${deck.season}`}
          price="$1"
          note={`${deck.remaining} unopened`}
          accent="var(--color-accent-bright)"
        />
        <CaseCard
          href="/case"
          rarity="vault"
          name="The Vault"
          price={`$${vault}`}
          note={
            !pool.data
              ? "counting the pool…"
              : pool.data.vaultTaken
                ? "already drawn"
                : "one case takes all of it"
          }
          accent="var(--color-tier-vault)"
        />
        <CaseCard
          href="/battles"
          rarity="sealed"
          name="Battles"
          price="$1"
          note={`${battles.open.length} waiting for an opponent`}
          accent="var(--color-accent-bright)"
        />
        <CaseCard
          href="/case"
          rarity="denarius"
          name="Bonus tickets"
          price="free"
          note="won cases pay real tickets"
          accent="var(--color-accent-bright)"
        />
      </div>

      <Heading title="what is in this case" note="counted from the public reveals, not promised" />
      <Contents deck={shape} pool={pool.data} />
    </>
  );
}

function Heading({ title, note }: { title: string; note: string }) {
  return (
    <div className="mb-5 mt-12 text-center">
      <div className="flex items-center justify-center gap-3">
        <span
          className="h-px w-8"
          style={{ background: "var(--color-accent)" }}
          aria-hidden
        />
        <h2 className="t-inscription text-base">{title}</h2>
        <span
          className="h-px w-8"
          style={{ background: "var(--color-accent)" }}
          aria-hidden
        />
      </div>
      <p className="t-label mt-2">{note}</p>
    </div>
  );
}

/**
 *
 */
function CaseCard({
  href,
  rarity,
  name,
  price,
  note,
  accent,
}: {
  href: string;
  rarity: Rarity;
  name: string;
  price: string;
  note: string;
  accent: string;
}) {
  return (
    <Link href={href} className="group block h-full">
      <div className="surface flex h-full flex-col overflow-hidden transition-transform duration-300 group-hover:-translate-y-1">
        <div className="grid flex-1 place-items-center p-5">
          <Crate
            rarity={rarity}
            size={140}
            className="transition-transform duration-500 group-hover:scale-105"
          />
        </div>
        <div className="border-t border-[var(--edge)] px-4 py-4 text-center">
          <div className="t-inscription text-[0.6875rem]" style={{ color: accent }}>
            {name}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <span className="chip py-0.5">{price}</span>
            <span className="t-label">{note}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
