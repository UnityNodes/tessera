"use client";

import Link from "next/link";
import { formatUnits } from "viem";
import { Sparkles, Swords } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Chest } from "@/components/Chest";
import { DeckHero } from "@/components/DeckHero";
import { useDeck, type DeckInfo } from "@/hooks/useDeck";
import { useBattleList } from "@/hooks/useBattles";
import { slotsPerTier, bestTier, isShard, ticketsLabel } from "@/lib/deck";

/**
 *
 *
 *
 */
export default function Home() {
  const game = useDeck();
  const battles = useBattleList();
  const first = game.decks.find((d) => !d.empty) ?? game.decks[0];
  const total = game.decks.reduce((n, d) => n + d.size, 0);

  return (
    <div className="flex w-full flex-col">
      <section className="relative w-full overflow-hidden px-4 pb-14 pt-12 text-center lg:px-8 lg:pt-16">
        <div className="pointer-events-none absolute right-1/4 top-0 h-96 w-96 rounded-full bg-[rgb(57_255_136_/_0.07)] blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/4 h-96 w-96 rounded-full bg-[rgb(31_207_108_/_0.06)] blur-3xl" />

        <div className="relative z-10 mx-auto flex max-w-[1320px] flex-col items-center gap-6">
          <p
            className="t-label rounded-full border px-4 py-1.5"
            style={{
              borderColor: "color-mix(in oklab, var(--color-tier-vault) 35%, transparent)",
              background: "color-mix(in oklab, var(--color-tier-vault) 6%, transparent)",
              color: "var(--color-tier-vault)",
            }}
          >
            every case = 1 real Megapot ticket
          </p>

          <h1 className="t-black text-4xl text-white sm:text-5xl lg:text-6xl 2xl:text-7xl">
            A finite pool, drawn
            <br />
            without{" "}
            <span className="text-[var(--color-accent-hover)] drop-shadow-[0_0_20px_rgba(57,255,136,0.35)]">
              replacement.
            </span>
          </h1>

          <p className="max-w-2xl text-lg leading-relaxed text-slate-300">
            A case costs $1 and buys you a real Megapot lottery ticket, the same one sold on
            megapot.io, bought in the transaction that opens the case. What is inside was
            shuffled once, before anyone opened one, and is drawn in order. A prize someone else
            takes is gone for everybody.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Link href={`/case/${first?.id ?? 0}`}>
              <Button className="px-8 py-4 text-base">
                <Sparkles className="h-5 w-5 fill-[var(--color-on-accent)]" />
                Open a case • $1
              </Button>
            </Link>
            <Link href="/battles">
              <Button variant="battle" className="px-8 py-4 text-base">
                <Swords className="h-5 w-5" />
                Battles
                {battles.open.length > 0 ? ` • ${battles.open.length} waiting` : ""}
              </Button>
            </Link>
          </div>


          <div className="mt-8 grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              value={String(game.drawn)}
              label="opened so far"
              tone="var(--color-accent)"
            />
            <StatCard
              value={`${game.remaining} of ${total || ", "}`}
              label="still sealed, across every deck"
            />
            <StatCard
              value={`$${Number(formatUnits(game.vault, 6)).toFixed(2)}`}
              label="waiting in the vaults"
              tone="var(--color-tier-vault)"
            />
          </div>
        </div>
      </section>



      <section
        id="decks"
        className="w-full scroll-mt-32 border-b border-slate-800/60 bg-[var(--color-section)] px-4 py-16 lg:px-8 2xl:px-14"
      >
        <div className="mx-auto flex max-w-[1320px] flex-col items-center">
          <h2 className="t-inscription mb-10 flex flex-wrap items-baseline justify-center gap-3 text-center text-2xl font-extrabold text-white lg:text-3xl">
            <span>the decks</span>
            <span className="t-chain text-base font-bold normal-case tracking-normal text-[var(--color-ink-dim)]">
              {game.decks.length} {game.decks.length === 1 ? "deck" : "decks"}
            </span>
          </h2>

          {game.decks.length === 0 ? (
            <p className="py-10 text-center text-slate-300">Reading the chain…</p>
          ) : (
            <div className="grid w-full gap-6 [grid-template-columns:repeat(auto-fit,minmax(17rem,1fr))]">
              {game.decks.map((d) => (
                <DeckCard key={d.id} deck={d} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="w-full border-b border-slate-800/60 bg-[var(--color-section-alt)] px-4 py-16 lg:px-8 2xl:px-14">
        <div className="mx-auto flex max-w-[1320px] flex-col items-center">
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


    </div>
  );
}

/**
 *
 */
/**
 *
 */
function StatCard({ value, label, tone }: { value: string; label: string; tone?: string }) {
  return (
    <div
      className="rounded-[14px] border px-6 py-5 text-center"
      style={{
        background: "var(--color-surface)",
        borderColor: tone
          ? `color-mix(in oklab, ${tone} 16%, transparent)`
          : "rgb(255 255 255 / 0.08)",
      }}
    >
      <div
        className="t-chain text-2xl font-extrabold leading-none sm:text-3xl"
        style={{ color: tone ?? "var(--color-ink)" }}
      >
        {value}
      </div>
      <div className="t-label mt-2">{label}</div>
    </div>
  );
}

function DeckCard({ deck }: { deck: DeckInfo }) {
  const tiers = slotsPerTier(deck);
  const best = bestTier(deck);

  const top = tiers.reduce((n, t) => Math.max(n, t.spec.tickets), 0);
  const prizes = tiers.filter((t) => t.weight > 0).reduce((n, t) => n + t.count, 0);
  const paying = prizes + deck.vaultUpTo;
  const oneIn = paying > 0 ? Math.max(1, Math.round(deck.size / paying)) : 0;

  const tesa = tiers.filter((t) => isShard(t.spec)).reduce((n, t) => n + t.count, 0);

  const ink = deck.empty ? "var(--color-tier-grout)" : (best?.ink ?? "var(--color-accent)");
  const sealedPercent = deck.size > 0 ? Math.max(1, (deck.remaining / deck.size) * 100) : 0;

  return (
    <Link
      data-deck={deck.id}
      href={`/case/${deck.id}`}
      className="group relative flex flex-col justify-between rounded-[var(--radius-panel)] border bg-slate-900/60 p-6 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:bg-slate-900/90"
      style={{
        borderColor: `color-mix(in oklab, ${ink} 40%, transparent)`,
        boxShadow: `0 0 25px color-mix(in oklab, ${ink} 22%, transparent)`,
      }}
    >
      <div className="flex flex-col items-center space-y-4 text-center">
        <div className="relative flex h-40 w-full items-center justify-center">
          <span
            aria-hidden
            className="absolute inset-x-6 inset-y-2 rounded-full opacity-30 blur-xl transition-opacity group-hover:opacity-60"
            style={{ background: ink }}
          />
          {deck.empty ? (
            <Chest rarity="grout" size={140} className="relative z-10" />
          ) : (
            <DeckHero
              deck={deck}
              size={150}
              className="relative z-10 transition-transform duration-300 group-hover:scale-105"
            />
          )}
        </div>

        <h3
          className="t-black flex flex-wrap items-baseline justify-center gap-2 text-2xl tracking-wide"
          style={{ color: ink }}
        >
          <span>{deck.empty ? "Emptied" : (best?.name ?? "Sealed")}</span>
          <span className="t-chain text-sm font-bold text-[var(--color-ink-dim)]">
            #{deck.id}
          </span>
        </h3>

        {!deck.empty && oneIn > 0 && (
          <p
            className="t-chain rounded-full border px-3 py-1 text-sm font-extrabold"
            style={{
              borderColor: `color-mix(in oklab, ${ink} 30%, transparent)`,
              background: `color-mix(in oklab, ${ink} 8%, transparent)`,
              color: ink,
            }}
          >
            1 in {oneIn} pays
          </p>
        )}


        <p className="min-h-[72px] px-2 text-sm leading-relaxed text-slate-300">
          {deck.empty ? (
            "Every case in this deck has been opened."
          ) : (
            <>
              Best case{" "}
              <span style={{ color: ink }}>{top > 0 ? ticketsLabel(top) : "the vault"}</span>.{" "}
              {deck.vaultUpTo > 0
                ? "One case in the deck opens the vault and takes all of it."
                : "No vault here, this deck pays in tickets only."}
            </>
          )}
        </p>

        {!deck.empty && (
          <p className="t-chain text-xs font-bold">
            {tesa > 0 ? (
              <span style={{ color: "var(--color-tier-shard)" }}>
                {tesa} TESA still in the deck · five make a ticket
              </span>
            ) : (
              <span className="text-slate-400">no TESA in this deck</span>
            )}
          </p>
        )}
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
      <p className="mt-3 text-sm leading-relaxed text-slate-300">{children}</p>
    </div>
  );
}
