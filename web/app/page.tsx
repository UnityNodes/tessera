"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Crate } from "@/components/Crate";
import { DeckShelf } from "@/components/DeckShelf";
import { useDeck } from "@/hooks/useDeck";
import { useBattleList } from "@/hooks/useBattles";

/**
 *
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

        <div className="relative mx-auto flex max-w-[1800px] flex-col items-center px-5 pb-14 pt-10 sm:px-8 sm:pt-12 2xl:px-12">
          <div className="@container relative w-full max-w-[34rem]">
            <Crate rarity="sealed" size={460} drift className="mx-auto" />
          </div>

          <h1 className="t-display mt-2 max-w-[20ch] text-balance text-center text-[clamp(2.4rem,6vw,4.2rem)] leading-[0.98]">
            $1 buys a real lottery ticket.{" "}
            <span className="text-[var(--color-accent-bright)]">The case is free.</span>
          </h1>

          <p className="mt-6 max-w-[56ch] text-balance text-center text-[1.0625rem] text-[var(--color-ink-dim)]">
            The same ticket sold on megapot.io, bought for you in the transaction that opens the
            case. What is inside sits in an encrypted, finite pool, shuffled once, drawn without
            replacement, countable by anyone.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href={`/case/${first?.id ?? 0}`}>
              <Button>Open a case · $1</Button>
            </Link>
            <Link href="/battles">
              <Button variant="quiet">
                Battles{battles.open.length > 0 ? ` · ${battles.open.length} waiting` : ""}
              </Button>
            </Link>
          </div>

          <p className="mt-6 text-center text-[0.9375rem] text-[var(--color-ink-faint)]">
            Test dollars, minted free from the header. Every ticket is still bought against the
            real Megapot contract.
          </p>
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
    { left: "38%", w: "9%", rotate: "-12deg", dur: "9s", delay: "0s", blur: 20 },
    { left: "50%", w: "6%", rotate: "3deg", dur: "13s", delay: "2.4s", blur: 14 },
    { left: "60%", w: "8%", rotate: "14deg", dur: "11s", delay: "5s", blur: 22 },
  ];

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(46% 52% at 50% 18%, color-mix(in oklab, var(--color-accent) 26%, transparent), transparent 70%)",
        }}
      />
      <span
        className="absolute left-1/2 top-0 h-[62%] w-[46%] -translate-x-1/2"
        style={{
          clipPath: "polygon(43% 0%, 57% 0%, 100% 100%, 0% 100%)",
          background:
            "linear-gradient(to bottom, color-mix(in oklab, var(--color-accent-bright) 26%, transparent), transparent 82%)",
          filter: "blur(14px)",
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
              "linear-gradient(to bottom, color-mix(in oklab, var(--color-accent-bright) 52%, transparent), transparent 62%)",
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
