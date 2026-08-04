"use client";

import Link from "next/link";
import { formatUnits } from "viem";
import { Button } from "@/components/ui/Button";
import { Crate } from "@/components/Crate";
import { useDeck, type DeckInfo } from "@/hooks/useDeck";
import { useBattleList } from "@/hooks/useBattles";
import { slotsPerTier, specFor } from "@/lib/deck";

/**
 *
 *
 */
export default function Home() {
  const game = useDeck();
  const battles = useBattleList();

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
              Every ticket is still bought against the real Megapot contract, the money is the
              only part that is fake.
            </p>
          </div>
          <Link href="/battles">
            <Button variant="quiet">
              Battles{battles.open.length > 0 ? ` · ${battles.open.length} waiting` : ""}
            </Button>
          </Link>
        </div>
      </section>

      <section className="surface relative mt-5 overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute right-[8%] top-1/2 hidden h-[34rem] w-[34rem] -translate-y-1/2 rounded-full lg:block"
          style={{
            background:
              "radial-gradient(closest-side, color-mix(in oklab, var(--color-accent) 22%, transparent), transparent 70%)",
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
              <a href="#cases">
                <Button>Pick a case · $1</Button>
              </a>
              <Link href="/battles">
                <Button variant="quiet">Battles</Button>
              </Link>
            </div>
          </div>

          <div className="grid place-items-center">
            <Crate rarity="sealed" size={280} drift />
          </div>
        </div>
      </section>

      <div id="cases">
        <Heading
          title="the cases"
          note={
            game.decks.length > 0
              ? `${game.decks.length} decks, each shuffled once before anyone opened one`
              : "reading the chain…"
          }
        />
        <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {game.decks.map((d) => (
            <DeckCard key={d.id} deck={d} />
          ))}
        </div>
      </div>
    </>
  );
}

function Heading({ title, note }: { title: string; note: string }) {
  return (
    <div className="mb-5 mt-12 text-center">
      <div className="flex items-center justify-center gap-3">
        <span className="h-px w-8" style={{ background: "var(--color-accent)" }} aria-hidden />
        <h2 className="t-inscription text-base">{title}</h2>
        <span className="h-px w-8" style={{ background: "var(--color-accent)" }} aria-hidden />
      </div>
      <p className="t-label mt-2">{note}</p>
    </div>
  );
}

/**
 *
 */
function DeckCard({ deck }: { deck: DeckInfo }) {
  const tiers = slotsPerTier(deck);
  const empty = specFor(0).name;
  const best = tiers.find((t) => t.spec.name !== empty)?.spec;
  const top = tiers.reduce((n, t) => Math.max(n, t.spec.tickets), 0);

  const prizes = tiers.filter((t) => t.weight > 0).reduce((n, t) => n + t.count, 0);
  const vault = Number(formatUnits(deck.vault, 6)).toFixed(2);

  return (
    <Link href={`/case/${deck.id}`} className="group block h-full">
      <div className="surface flex h-full flex-col overflow-hidden transition-transform duration-300 group-hover:-translate-y-1">
        <div className="grid flex-1 place-items-center p-6">
          <Crate
            rarity={deck.empty ? "grout" : (best?.rarity ?? "sealed")}
            size={150}
            className="transition-transform duration-500 group-hover:scale-105"
          />
        </div>

        <div className="border-t border-[var(--edge)] px-5 py-4">
          <div className="flex items-baseline justify-between gap-3">
            <span
              className="t-inscription text-[0.6875rem]"
              style={{ color: best?.ink ?? "var(--color-ink-faint)" }}
            >
              {deck.vaultUpTo > 0 ? "vault" : "no vault"}
              {top > 0 && ` · up to +${top}`} · {prizes} prize{prizes === 1 ? "" : "s"}
            </span>
            <span className="chip py-0.5">$1</span>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="t-label">
              {deck.empty ? "all opened" : `${deck.remaining} of ${deck.size} left`}
            </span>
            {deck.vaultUpTo > 0 && (
              <span
                className="t-chain text-[0.9375rem]"
                style={{ color: "var(--color-tier-vault)" }}
              >
                ${vault}
              </span>
            )}
          </div>

          <div className="mt-3 h-1 overflow-hidden rounded-full bg-[var(--color-raised)]">
            <div
              className="h-full rounded-full transition-[width] duration-700"
              style={{
                width: `${deck.size > 0 ? (deck.drawn / deck.size) * 100 : 0}%`,
                background: "var(--color-accent)",
              }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
