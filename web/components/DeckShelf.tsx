"use client";

import Link from "next/link";
import { formatUnits } from "viem";
import { Tilt } from "@/components/ui/Tilt";
import { Crate } from "@/components/Crate";
import { useDeck, type DeckInfo } from "@/hooks/useDeck";
import { slotsPerTier, specFor } from "@/lib/deck";

/**
 *
 */
export function DeckShelf({ heading, note }: { heading?: string; note?: string }) {
  const game = useDeck();

  return (
    <div id="cases">
      {heading && (
        <Heading
          title={heading}
          note={
            note ??
            (game.decks.length > 0
              ? `${game.decks.length} decks, each shuffled once before anyone opened one`
              : "reading the chain…")
          }
        />
      )}
      <div className="grid auto-rows-fr gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {game.decks.map((d) => (
          <DeckCard key={d.id} deck={d} />
        ))}
      </div>
    </div>
  );
}

function Heading({ title, note }: { title: string; note: string }) {
  return (
    <div className="mb-7 mt-12 text-center">
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
              background: "linear-gradient(90deg, transparent, var(--card-ink) 50%, transparent)",
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
                      deck.vaultUpTo > 0
                        ? "0 0 22px color-mix(in oklab, var(--color-tier-vault) 55%, transparent)"
                        : undefined,
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
