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
      <section className="relative -mx-5 -mt-8 overflow-hidden sm:-mx-8 2xl:-mx-12">
        <Stage />

        <div className="relative mx-auto grid max-w-[1800px] items-center gap-10 px-5 pb-16 pt-20 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:pb-20 lg:pt-28 2xl:px-12">
          <div className="min-w-0">
            <h1 className="t-display text-[clamp(2.6rem,5.4vw,4.6rem)]">
              $1 buys a real lottery ticket.
              <br />
              <span className="text-[var(--color-accent-bright)]">The case is free.</span>
            </h1>
            <p className="mt-6 max-w-[58ch] text-[1.0625rem] text-[var(--color-ink-dim)]">
              The same ticket sold on megapot.io, bought for you in the same transaction that
              opens the case. What is inside sits in an encrypted, finite pool, shuffled once,
              drawn without replacement, and countable by anyone.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href={`/case/${first?.id ?? 0}`}>
                <Button>Open a case · $1</Button>
              </Link>
              <Link href="/battles">
                <Button variant="quiet">
                  Battles{battles.open.length > 0 ? ` · ${battles.open.length} waiting` : ""}
                </Button>
              </Link>
            </div>
            <p className="mt-7 text-[0.9375rem] text-[var(--color-ink-faint)]">
              The dollars are test dollars, minted free from the header. Every ticket is still
              bought against the real Megapot contract.
            </p>
          </div>

          <div className="frame @container relative grid min-w-0 place-items-center p-6 sm:p-8">
            <span className="frame__node left-0 top-0" aria-hidden />
            <span className="frame__node right-0 top-0" aria-hidden />
            <span className="frame__node bottom-0 left-0" aria-hidden />
            <span className="frame__node bottom-0 right-0" aria-hidden />
            <span
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-0 h-[86%] w-[78%] -translate-x-1/2"
              style={{
                clipPath: "polygon(38% 0%, 62% 0%, 100% 100%, 0% 100%)",
                background:
                  "linear-gradient(to bottom, color-mix(in oklab, var(--color-accent-bright) 30%, transparent), transparent 78%)",
                filter: "blur(12px)",
              }}
            />
            <Crate rarity="sealed" size={380} drift className="relative" />
          </div>
        </div>
      </section>

      <DeckShelf heading="the cases" />
    </>
  );
}

/**
 *
 */
function Stage() {
  const rays = [
    { left: "50%", w: "12%", rotate: "-14deg", dur: "9s", delay: "0s", blur: 20 },
    { left: "63%", w: "7%", rotate: "5deg", dur: "13s", delay: "2.4s", blur: 14 },
    { left: "71%", w: "10%", rotate: "16deg", dur: "11s", delay: "5s", blur: 22 },
    { left: "82%", w: "6%", rotate: "26deg", dur: "15s", delay: "7.5s", blur: 16 },
  ];

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(58% 78% at 72% 30%, color-mix(in oklab, var(--color-accent) 22%, transparent), transparent 68%)",
        }}
      />
      {rays.map((r, i) => (
        <span
          key={i}
          className="absolute -top-[30%] h-[150%] origin-top"
          style={{
            left: r.left,
            width: r.w,
            transform: `rotate(${r.rotate})`,
            background:
              "linear-gradient(to bottom, color-mix(in oklab, var(--color-accent-bright) 62%, transparent), transparent 66%)",
            filter: `blur(${r.blur}px)`,
            animation: `ray-breathe ${r.dur} ease-in-out ${r.delay} infinite`,
          }}
        />
      ))}
      <span
        className="absolute inset-x-0 bottom-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, color-mix(in oklab, var(--color-accent) 60%, transparent) 50%, transparent)",
        }}
      />
    </div>
  );
}
