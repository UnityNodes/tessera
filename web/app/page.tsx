"use client";

import { useMemo } from "react";
import Link from "next/link";
import { formatUnits } from "viem";
import { Sparkles, Swords, Award } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Chest } from "@/components/Chest";
import { useDeck, type DeckInfo } from "@/hooks/useDeck";
import { useBattleList } from "@/hooks/useBattles";
import { useFeed } from "@/hooks/useFeed";
import { slotsPerTier, bestTier, isVault } from "@/lib/deck";

/**
 *
 *
 */
export default function Home() {
  const game = useDeck();
  const battles = useBattleList();
  const shapes = useMemo(() => game.decks.map((d) => d), [game.decks]);
  const feed = useFeed(shapes);
  const first = game.decks.find((d) => !d.empty) ?? game.decks[0];
  const total = game.decks.reduce((n, d) => n + d.size, 0);

  return (
    <div className="flex w-full flex-col">
      <section className="relative w-full overflow-hidden border-b border-slate-800/60 bg-gradient-to-b from-[#0c130e] via-[#0a0f0a] to-[#070b07] px-4 py-12 lg:px-8 lg:py-20 2xl:px-14">
        <div className="pointer-events-none absolute right-1/4 top-0 h-96 w-96 rounded-full bg-[rgb(57_255_136_/_0.07)] blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/4 h-96 w-96 rounded-full bg-[rgb(31_207_108_/_0.06)] blur-3xl" />

        <div className="relative z-10 mx-auto grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
          <div className="flex flex-col items-start space-y-6 lg:col-span-7">
            <h1 className="t-black text-4xl text-white sm:text-5xl lg:text-6xl 2xl:text-7xl">
              A finite pool, drawn
              <br />
              without{" "}
              <span className="text-[var(--color-accent-hover)] drop-shadow-[0_0_20px_rgba(57,255,136,0.35)]">
                replacement.
              </span>
            </h1>

            <p className="max-w-2xl text-lg leading-relaxed text-slate-400 lg:text-xl">
              A case costs $1 and buys you a real Megapot lottery ticket, the same one sold on
              megapot.io, bought in the transaction that opens the case. What is inside was
              shuffled once, before anyone opened one, and is drawn in order. A prize someone else
              takes is gone for everybody.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link href={`/case/${first?.id ?? 0}`}>
                <Button className="px-8 py-4 text-base">
                  <Sparkles className="h-5 w-5 fill-slate-950" />
                  Open a case • $1
                </Button>
              </Link>
              <Link href="/battles">
                <Button variant="quiet" className="px-8 py-4 text-base">
                  <Swords className="h-5 w-5 text-[var(--color-accent-hover)]" />
                  Battles
                  {battles.open.length > 0 ? ` • ${battles.open.length} waiting` : ""}
                </Button>
              </Link>
            </div>

            <p className="t-chain pt-2 text-sm text-slate-500">
              {game.remaining} of {total || ", "} slots still sealed, across every deck
            </p>
          </div>

          <div className="relative flex items-center justify-center lg:col-span-5">
            <div className="pointer-events-none absolute -top-20 left-1/2 h-[350px] w-72 -translate-x-1/2 -skew-x-12 bg-gradient-to-b from-[rgb(57_255_136_/_0.22)] via-[rgb(57_255_136_/_0.05)] to-transparent blur-xl" />

            <Link
              href={`/case/${first?.id ?? 0}`}
              aria-label="Open a case"
              className="group relative"
            >
              <div className="absolute bottom-6 left-1/2 h-16 w-64 -translate-x-1/2 rounded-full bg-[rgb(57_255_136_/_0.26)] blur-2xl transition-all group-hover:bg-[rgb(57_255_136_/_0.42)]" />
              <Chest
                rarity="sealed"
                size={384}
                className="relative z-10 max-w-[min(100%,24rem)] transition-transform duration-500 group-hover:scale-105"
              />
            </Link>
          </div>
        </div>
      </section>

      <section className="w-full border-b border-slate-800/60 bg-[var(--color-section)] px-4 py-16 lg:px-8 2xl:px-14">
        <div className="mx-auto flex flex-col items-center">
          <h2 className="t-inscription mb-10 text-center text-2xl font-extrabold text-white lg:text-3xl">
            deck progress
          </h2>

          {game.decks.length === 0 ? (
            <p className="py-10 text-center text-slate-400">Reading the chain…</p>
          ) : (
            <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-3">
              {game.decks.map((d) => (
                <DeckCard key={d.id} deck={d} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="w-full border-b border-slate-800/60 bg-[var(--color-section-alt)] px-4 py-16 lg:px-8 2xl:px-14">
        <div className="mx-auto flex flex-col items-center">
          <div className="mb-12 max-w-2xl text-center">
            <h2 className="t-display text-3xl text-white">
              How the ticket, the pool and the vault fit together
            </h2>
          </div>

          <div className="grid w-full grid-cols-1 gap-8 md:grid-cols-3">
            <Step
              ink="var(--color-accent)"
              title="1. Every case buys a real ticket"
            >
              The $1 does not go into a house balance. It buys a Megapot lottery ticket in the same
              transaction that opens the case, recorded against your wallet in Megapot&apos;s own
              contract. The case comes on top.
            </Step>

            <Step
              ink="var(--color-tier-vault)"
              title="2. The vault grows until someone draws it"
            >
              One slot in the deck opens the vault and takes everything in it. Until it is drawn,
              every case that gives its ticket up feeds it. Nobody can pick which slot that is, the deck was shuffled before anyone opened anything.
            </Step>

            <Step
              ink="var(--color-tier-denarius)"
              title="3. Drawn without replacement, in public"
            >
              Contents are encrypted on Inco Lightning and committed before the first open. Every
              opened slot is publicly revealed after the fact, so the count of what is left is
              arithmetic anyone can repeat, not a percentage we assert.
            </Step>
          </div>
        </div>
      </section>

      <section className="w-full bg-[var(--color-section-deep)] px-4 py-14 lg:px-8 2xl:px-14">
        <div className="mx-auto flex flex-col items-center">
          <div className="mb-8 flex items-center gap-2">
            <Award className="h-6 w-6" style={{ color: "var(--color-tier-aureus)" }} />
            <h3 className="t-inscription text-xl font-extrabold text-white">
              latest out of the pool
            </h3>
          </div>

          <Latest feed={feed} />
        </div>
      </section>
    </div>
  );
}

/**
 *
 */
function DeckCard({ deck }: { deck: DeckInfo }) {
  const tiers = slotsPerTier(deck);
  const best = bestTier(deck);

  const top = tiers.reduce((n, t) => Math.max(n, t.spec.tickets), 0);
  const prizes = tiers.filter((t) => t.weight > 0).reduce((n, t) => n + t.count, 0);
  const paying = prizes + deck.vaultUpTo;
  const oneIn = paying > 0 ? Math.max(1, Math.round(deck.size / paying)) : 0;

  const ink = deck.empty ? "var(--color-tier-grout)" : (best?.ink ?? "var(--color-accent)");
  const sealedPercent = deck.size > 0 ? Math.max(1, (deck.remaining / deck.size) * 100) : 0;

  return (
    <Link
      href={`/case/${deck.id}`}
      className="group relative flex flex-col justify-between rounded-[var(--radius-panel)] border bg-slate-900/60 p-6 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:bg-slate-900/90"
      style={{
        borderColor: `color-mix(in oklab, ${ink} 40%, transparent)`,
        boxShadow: `0 0 25px color-mix(in oklab, ${ink} 22%, transparent)`,
      }}
    >
      <div className="flex flex-col items-center space-y-4 text-center">
        <div className="relative flex h-48 w-48 items-center justify-center">
          <span
            aria-hidden
            className="absolute inset-0 rounded-full opacity-30 blur-xl transition-opacity group-hover:opacity-60"
            style={{ background: ink }}
          />
          <Chest
            rarity={deck.empty ? "grout" : (best?.rarity ?? "sealed")}
            size={184}
            className="relative z-10 transition-transform duration-300 group-hover:scale-110"
          />
        </div>

        <h3 className="t-black text-2xl tracking-wide" style={{ color: ink }}>
          {deck.empty ? "Emptied" : (best?.name ?? "Sealed")}
        </h3>

        <p className="min-h-[72px] px-2 text-sm leading-relaxed text-slate-400">
          {deck.empty ? (
            "Every case in this deck has been opened."
          ) : (
            <>
              {oneIn > 0 ? `1 in ${oneIn} cases pay something. ` : ""}
              Best case{" "}
              <span style={{ color: ink }}>{top > 0 ? `+${top} tickets` : "the vault"}</span>.{" "}
              {deck.vaultUpTo > 0
                ? "One case in the deck opens the vault and takes all of it."
                : "No vault here, this deck pays in tickets only."}
            </>
          )}
        </p>
      </div>

      <div className="mt-6 flex flex-col space-y-2 border-t border-slate-800/80 pt-4">
        <div className="t-chain flex items-center justify-between text-xs font-semibold text-slate-300">
          <span>
            Still sealed: <strong className="text-white">{deck.remaining}</strong>
          </span>
          <span>
            {deck.vaultUpTo > 0 ? (
              <>
                Vault:{" "}
                <strong style={{ color: "var(--color-tier-vault)" }}>
                  ${Number(formatUnits(deck.vault, 6)).toFixed(2)}
                </strong>
              </>
            ) : (
              "No vault"
            )}
          </span>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${sealedPercent}%`,
              backgroundColor: ink,
              boxShadow: `0 0 10px ${ink}`,
            }}
          />
        </div>

        <div className="pt-2 text-center opacity-0 transition-opacity group-hover:opacity-100">
          <span
            className="t-label inline-block rounded-[var(--radius-chip)] px-3 py-1"
            style={{ background: `color-mix(in oklab, ${ink} 18%, transparent)`, color: ink }}
          >
            {deck.empty ? "nothing left" : "open for $1"}
          </span>
        </div>
      </div>
    </Link>
  );
}

/**
 *
 */
function Step({
  ink,
  title,
  children,
}: {
  ink: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t pt-5" style={{ borderColor: `color-mix(in oklab, ${ink} 40%, transparent)` }}>
      <h3 className="text-lg font-bold text-white">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-slate-400">{children}</p>
    </div>
  );
}

/**
 *
 */
function Latest({ feed }: { feed: ReturnType<typeof useFeed> }) {
  const worthy = feed
    .filter((it) => it.value !== undefined && (it.weight > 0 || isVault(it.spec)))
    .slice(0, 3);

  if (worthy.length === 0) {
    return (
      <p className="text-center text-slate-400">
        Nothing has come out of the pool yet, every slot is still sealed.
      </p>
    );
  }

  return (
    <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-3">
      {worthy.map((it) => {
        const paid = it.risk ? it.spec.tickets * 2 : it.spec.tickets;
        return (
          <div
            key={it.handle}
            className="flex items-center justify-between rounded-[var(--radius-control)] border border-slate-800 bg-slate-900/60 p-4"
          >
            <div className="flex min-w-0 items-center gap-3">
              <Chest rarity={it.spec.rarity} size={40} className="shrink-0" />
              <div className="min-w-0">
                <span className="t-chain block truncate text-xs text-slate-400">
                  {short(it.player)}
                </span>
                <span className="t-chain block text-sm font-bold" style={{ color: it.spec.ink }}>
                  {it.spec.name}
                </span>
              </div>
            </div>
            <span className="t-chain shrink-0 text-xs font-bold text-slate-300">
              {isVault(it.spec) ? "the vault" : `+${paid} tickets`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
