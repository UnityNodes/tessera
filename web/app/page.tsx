"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatUnits } from "viem";
import { Sparkles, Swords, TrendingDown, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Chest, skinOf } from "@/components/Chest";
import { DeckHero } from "@/components/DeckHero";
import { useDeck, type DeckInfo } from "@/hooks/useDeck";
import { useOpens } from "@/hooks/useOpens";
import { PoolCurve } from "@/components/PoolCurve";
import { useBattleList } from "@/hooks/useBattles";
import { useSkins } from "@/hooks/useSkins";
import { useHidden } from "@/hooks/useHidden";
import { slotsPerTier, bestTier, isShard, ticketsLabel } from "@/lib/deck";

/**
 *
 *
 *
 */
export default function Home() {
  const game = useDeck();
  const skinUrl = useSkins();
  const hidden = useHidden();
  const shown = game.decks.filter((d) => !hidden.has(d.id));
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
            A case costs $1 and buys you a real Megapot lottery ticket, bought by Megapot itself,
            in the transaction that opens the case. What is inside was shuffled before anyone
            opened one, and is drawn in order. A prize someone else takes is gone for everybody, until the deck runs out or its vault is taken, and the contract deals it again.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Link href={`/case/${first?.id ?? 0}`}>
              <Button className="px-8 py-4 text-base">
                <Sparkles className="h-5 w-5 fill-[var(--color-on-accent)]" />
                Open • $1
              </Button>
            </Link>
            <Link href="/battles">
              <Button variant="quiet" className="px-8 py-4 text-base">
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
        <div className="flex w-full flex-col items-center">
          <h2 className="t-inscription mb-10 flex flex-wrap items-baseline justify-center gap-3 text-center text-2xl font-extrabold text-white lg:text-3xl">
            <span>the decks</span>
            <span className="t-chain text-base font-bold normal-case tracking-normal text-[var(--color-ink-dim)]">
              {shown.length} {shown.length === 1 ? "deck" : "decks"}
            </span>
          </h2>

          {shown.length === 0 ? (
            <p className="py-10 text-center text-slate-300">Reading the chain…</p>
          ) : (
            //
            //
            //
            <div className="grid w-full justify-center gap-5 [grid-template-columns:repeat(auto-fit,minmax(15rem,17rem))]">
              {shown.map((d) => (
                <DeckCard key={d.id} deck={d} art={skinUrl(d.id)} />
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
              contract, on Base Sepolia, that is Megapot&apos;s testnet jackpot, the same contract
              they run on mainnet. The case comes on top.
            </Step>

            <Step
              ink="var(--color-tier-vault)"
              title="2. The vault grows until someone draws it"
            >
              One slot in the deck opens the vault and takes everything in it. It fills from the
              commission the openings themselves earn, a fixed slice of every case, shared out
              between the decks by how often each is played. Nobody can pick which slot that is, the deck was shuffled before anyone opened anything.
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

/**
 *
 *
 */
function useHeroSize(min = 56) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(120);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize(Math.max(min, Math.floor(Math.min(r.height - 14, r.width * 0.5))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [min]);

  return [box, size] as const;
}

function DeckCard({ deck, art }: { deck: DeckInfo; art?: string }) {
  const [flipped, setFlipped] = useState(false);
  const opens = useOpens();
  const events = useMemo(() => opens.data ?? [], [opens.data]);
  const drawnHere = useMemo(
    () => events.filter((e) => e.deckId === deck.id).length,
    [events, deck.id],
  );

  const tiers = slotsPerTier(deck);
  const best = bestTier(deck);
  const [heroBox, heroSize] = useHeroSize();

  const top = tiers.reduce((n, t) => Math.max(n, t.spec.tickets), 0);
  const prizes = tiers.filter((t) => t.weight > 0).reduce((n, t) => n + t.count, 0);
  const paying = prizes + deck.vaultUpTo;
  const oneIn = paying > 0 ? Math.max(1, Math.round(deck.size / paying)) : 0;

  const tesa = tiers.filter((t) => isShard(t.spec)).reduce((n, t) => n + t.count, 0);

  const dress = skinOf(deck.cid);
  const ink = deck.empty
    ? "var(--color-tier-grout)"
    : (dress?.ink ?? best?.ink ?? "var(--color-accent)");
  const title = deck.empty ? "Emptied" : (dress?.name ?? best?.name ?? "Sealed");
  const sealedPercent = deck.size > 0 ? Math.max(1, (deck.remaining / deck.size) * 100) : 0;

  return (
     *
     *
     */
    <div
      data-deck={deck.id}
      className="group/card relative aspect-square [perspective:1200px]"
    >
      <div
        className="relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d] motion-reduce:transition-none"
        style={{ transform: flipped ? "rotateY(180deg)" : undefined }}
      >
    <Link
      href={`/case/${deck.id}`}
      tabIndex={flipped ? -1 : undefined}
      aria-hidden={flipped || undefined}
      //
      //
      className="group absolute inset-0 flex flex-col overflow-hidden rounded-[var(--radius-panel)] border bg-slate-900/60 shadow-xl transition-colors duration-300 [backface-visibility:hidden] hover:bg-slate-900/90"
      style={{
        borderColor: `color-mix(in oklab, ${ink} 40%, transparent)`,
        boxShadow: `0 0 25px color-mix(in oklab, ${ink} 22%, transparent)`,
      }}
    >
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-3">
        <span
          aria-hidden
          className="absolute inset-x-6 inset-y-4 rounded-full opacity-30 blur-xl transition-opacity group-hover:opacity-60"
          style={{ background: ink }}
        />
        <div ref={heroBox} className="relative z-10 flex h-full w-full items-center justify-center [&_img]:max-h-full [&_img]:w-auto [&_svg]:max-h-full">
          {deck.empty ? (
            <Chest rarity="grout" size={heroSize} />
          ) : (
            <DeckHero
              deck={deck}
              size={heroSize}
              skin={deck.cid}
              art={art}
              className="transition-transform duration-300 group-hover:scale-105"
            />
          )}
        </div>
      </div>

      <div className="flex flex-col items-center space-y-1 px-3 pb-1.5 text-center">

        <h3
          className="t-black flex w-full items-baseline justify-center gap-1.5 truncate text-xl tracking-wide"
          style={{ color: ink }}
        >
          <span>{title}</span>
          <span className="t-chain text-sm font-bold text-[var(--color-ink-dim)]">
            #{deck.id}
          </span>
        </h3>

        {!deck.empty && oneIn > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            <p
              className="t-chain rounded-full border px-2.5 py-0.5 text-xs font-extrabold"
              style={{
                borderColor: `color-mix(in oklab, ${ink} 30%, transparent)`,
                background: `color-mix(in oklab, ${ink} 8%, transparent)`,
                color: ink,
              }}
            >
              1 in {oneIn} pays
            </p>
            <span className="t-chain text-xs font-bold" style={{ color: ink }}>
              {top > 0 ? ticketsLabel(top) : "the vault"}
            </span>
            {tesa > 0 && (
              <span
                className="t-chain text-xs font-bold"
                style={{ color: "var(--color-tier-shard)" }}
              >
                · {tesa} TESA
              </span>
            )}
          </div>
        )}

      </div>

      <div className="mt-auto flex flex-col space-y-1 border-t border-slate-800/80 px-3 pb-2.5 pt-2">
        <div className="t-chain flex items-center justify-between text-xs font-semibold text-slate-300">
          <span>
            <strong className="text-white">{deck.remaining}</strong> sealed
          </span>
          <span>
            {deck.vaultUpTo > 0 ? (
              <strong style={{ color: "var(--color-tier-vault)" }}>
                ${Number(formatUnits(deck.vault, 6)).toFixed(2)}
              </strong>
            ) : (
              "no vault"
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

      </div>

      <span
        className="t-chain absolute right-2.5 top-2.5 z-20 rounded-[var(--radius-chip)] border px-2 py-0.5 text-xs font-extrabold"
        style={{
          borderColor: `color-mix(in oklab, ${ink} 35%, transparent)`,
          background: "color-mix(in oklab, var(--color-surface) 82%, transparent)",
          color: ink,
        }}
      >
        {deck.empty ? "empty" : "$1"}
      </span>
    </Link>

        <div
          inert={!flipped}
          onClick={() => setFlipped(false)}
          className="absolute inset-0 flex cursor-pointer flex-col rounded-[var(--radius-panel)] border bg-slate-900/90 p-4 [backface-visibility:hidden] [transform:rotateY(180deg)]"
          style={{
            borderColor: `color-mix(in oklab, ${ink} 40%, transparent)`,
            boxShadow: `0 0 25px color-mix(in oklab, ${ink} 22%, transparent)`,
            color: "var(--color-ink-dim)",
          }}
        >
          <p className="t-label pl-10">how it emptied</p>
          <p className="t-chain mt-1 text-2xl font-extrabold text-white">
            {deck.remaining}
            <span className="ml-1.5 text-sm font-semibold text-slate-400">of {deck.size} sealed</span>
          </p>

          <div className="mt-3 mb-1.5 flex min-h-0 flex-1 items-center">
            <PoolCurve deckId={deck.id} cut={deck.cut} size={deck.size} opens={events} ink={ink} height={78} guides />
          </div>

          <div className="t-chain flex justify-between text-xs text-slate-400">
            <span>first open</span>
            <span>now</span>
          </div>

          <div className="mt-3 flex items-end justify-between border-t border-slate-800/80 pt-2.5">
            <span>
              <span className="t-chain block text-base font-bold text-white">{drawnHere}</span>
              <span className="t-label">opened</span>
            </span>
            <span className="text-right">
              <span
                className="t-chain block text-base font-bold"
                style={{ color: deck.vaultUpTo > 0 ? "var(--color-tier-vault)" : "var(--color-ink-dim)" }}
              >
                {deck.vaultUpTo > 0 ? `$${Number(formatUnits(deck.vault, 6)).toFixed(2)}` : ", "}
              </span>
              <span className="t-label">vault</span>
            </span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setFlipped((v) => !v)}
        aria-pressed={flipped}
        aria-label={flipped ? "Show the case" : "Show how this deck emptied"}
        title={flipped ? "back to the case" : "how this deck emptied"}
        className="absolute left-2.5 top-2.5 z-30 grid h-8 w-8 cursor-pointer place-items-center rounded-[var(--radius-chip)] border transition-colors"
        style={{
          borderColor: `color-mix(in oklab, ${ink} 35%, transparent)`,
          background: "color-mix(in oklab, var(--color-surface) 82%, transparent)",
          color: ink,
        }}
      >
        {flipped ? <Undo2 className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
      </button>
    </div>
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
