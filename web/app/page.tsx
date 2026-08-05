"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Crate } from "@/components/Crate";
import { DeckShelf } from "@/components/DeckShelf";
import { useDeck } from "@/hooks/useDeck";
import { useBattleList } from "@/hooks/useBattles";

/**
 *
 */
export default function Home() {
  const game = useDeck();
  const battles = useBattleList();
  const first = game.decks.find((d) => !d.empty) ?? game.decks[0];

  return (
    <>
      <section className="surface relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(90% 120% at 78% 44%, color-mix(in oklab, var(--color-accent) 20%, transparent), transparent 62%)",
          }}
        />
        <div className="relative grid items-center gap-10 px-6 py-14 sm:px-12 lg:grid-cols-[1.05fr_1fr] lg:py-20">
          <div className="min-w-0">
            <h1 className="t-display text-[clamp(2.2rem,4.6vw,3.6rem)]">
              $1 buys a real lottery ticket.
              <br />
              <span className="text-[var(--color-accent-bright)]">The case is free.</span>
            </h1>
            <p className="mt-5 max-w-[62ch] text-[1.0625rem] text-[var(--color-ink-dim)]">
              The same ticket sold on megapot.io, bought for you in the same transaction that
              opens the case. What is inside sits in an encrypted, finite pool, shuffled once,
              drawn without replacement, and countable by anyone.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href={`/case/${first?.id ?? 0}`}>
                <Button>Open a case · $1</Button>
              </Link>
              <Link href="/battles">
                <Button variant="quiet">
                  Battles{battles.open.length > 0 ? ` · ${battles.open.length} waiting` : ""}
                </Button>
              </Link>
            </div>
            <p className="mt-6 text-[0.9375rem] text-[var(--color-ink-faint)]">
              The dollars are test dollars, minted free from the header. Every ticket is still
              bought against the real Megapot contract.
            </p>
          </div>

          <div className="@container relative grid min-w-0 place-items-center">
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(46% 40% at 50% 64%, color-mix(in oklab, var(--color-accent) 34%, transparent), transparent 72%)",
                filter: "blur(34px)",
              }}
            />
            <Crate rarity="sealed" size={400} drift className="relative" />
          </div>
        </div>
      </section>

      <DeckShelf heading="the cases" />
    </>
  );
}
