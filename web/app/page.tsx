"use client";

import Link from "next/link";
import { formatUnits } from "viem";
import { Button } from "@/components/ui/Button";
import { Tilt } from "@/components/ui/Tilt";
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

          <div className="@container grid min-w-0 place-items-center">
            <Crate rarity="sealed" size={380} drift />
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
        <div className="grid auto-rows-fr gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
    <div className="mb-7 mt-20 text-center">
      <div className="flex items-center justify-center gap-3">
        <span
          className="h-px w-10"
          style={{ background: "linear-gradient(90deg, transparent, var(--color-accent))" }}
          aria-hidden
        />
        <h2 className="t-inscription text-base">{title}</h2>
        <span
          className="h-px w-10"
          style={{ background: "linear-gradient(90deg, var(--color-accent), transparent)" }}
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
function DeckCard({ deck }: { deck: DeckInfo }) {
  const tiers = slotsPerTier(deck);
  const empty = specFor(0).name;
  const best = tiers.find((t) => t.spec.name !== empty)?.spec;
  const top = tiers.reduce((n, t) => Math.max(n, t.spec.tickets), 0);

  const prizes = tiers.filter((t) => t.weight > 0).reduce((n, t) => n + t.count, 0);
  const vault = Number(formatUnits(deck.vault, 6)).toFixed(2);

  return (
    <Link href={`/case/${deck.id}`} className="group block h-full">
      <Tilt className="h-full">
        <div
          className="surface relative flex h-full flex-col overflow-hidden transition-shadow duration-300"
          style={
            {
              "--card-ink": best?.ink ?? "var(--color-accent)",
            } as React.CSSProperties
          }
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-60 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              background:
                "linear-gradient(90deg, transparent, var(--card-ink) 50%, transparent)",
            }}
          />
          <div className="relative grid flex-1 place-items-center p-10">
            <span
              aria-hidden
              className="glow"
              style={
                {
                  "--glow-color": best?.ink ?? "transparent",
                  "--glow-strength": deck.empty ? 0.12 : deck.vaultUpTo > 0 ? 0.6 : 0.34,
                } as React.CSSProperties
              }
            />
            <Crate
              rarity={deck.empty ? "grout" : (best?.rarity ?? "sealed")}
              size={220}
              className="relative transition-transform duration-500 group-hover:scale-[1.06]"
            />
          </div>

          <div className="border-t border-[var(--edge)] px-6 py-5">
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

            <div className="mt-4 flex items-end justify-between gap-3">
              <span className="t-label pb-1">
                {deck.empty ? "all opened" : `${deck.remaining} of ${deck.size} left`}
              </span>
              <span className="text-right">
                <span className="t-label block">{deck.vaultUpTo > 0 ? "vault" : "no vault"}</span>
                <span
                  className="t-chain block text-2xl leading-none"
                  style={{
                    color:
                      deck.vaultUpTo > 0 ? "var(--color-tier-vault)" : "var(--color-ink-faint)",
                    textShadow:
                      deck.vaultUpTo > 0 ? "0 0 22px color-mix(in oklab, var(--color-tier-vault) 55%, transparent)" : undefined,
                  }}
                >
                  {deck.vaultUpTo > 0 ? `$${vault}` : ", "}
                </span>
              </span>
            </div>

            <div className="mt-3 h-1 overflow-hidden rounded-full bg-[var(--color-raised)]">
              <div
                className="h-full rounded-full transition-[width] duration-700"
                style={{
                  width: `${deck.size > 0 ? (deck.drawn / deck.size) * 100 : 0}%`,
                  background:
                    "linear-gradient(90deg, var(--color-accent-press), var(--color-accent-bright))",
                  boxShadow: "0 0 12px -2px var(--color-accent)",
                }}
              />
            </div>
          </div>
        </div>
      </Tilt>
    </Link>
  );
}
