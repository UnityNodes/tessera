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

/**
 *
 */
function Heading({ title, note }: { title: string; note: string }) {
  return (
    <div className="mb-9 mt-12 text-center">
      <div className="mb-4 flex items-center justify-center gap-3">
        <span
          className="h-px w-10"
          style={{ background: "linear-gradient(90deg, transparent, var(--color-accent))" }}
          aria-hidden
        />
        <span className="t-inscription text-[0.6875rem]">{note}</span>
        <span
          className="h-px w-10"
          style={{ background: "linear-gradient(90deg, var(--color-accent), transparent)" }}
          aria-hidden
        />
      </div>
      <h2 className="t-display text-[clamp(1.75rem,3.2vw,2.5rem)]">{title}</h2>
      <p className="mx-auto mt-4 max-w-[62ch] text-[1.0625rem] text-[var(--color-ink-dim)]">
        Every case costs $1 and buys you a real lottery ticket, that part never changes. What
        the decks disagree on is the case itself: how often it pays, and how much. Each one was
        shuffled once and is drawn without replacement, so a prize someone else takes is gone for
        everybody.
      </p>
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

  const paying = prizes + deck.vaultUpTo;
  const oneIn = paying > 0 ? Math.max(1, Math.round(deck.size / paying)) : 0;

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

          <div className="border-t border-[var(--edge)] px-6 py-6">
            <div className="flex items-end justify-between gap-3">
              <span>
                <span className="t-display block text-[1.75rem] leading-none">
                  {oneIn > 0 ? (
                    <>
                      1 in <span style={{ color: best?.ink }}>{oneIn}</span>
                    </>
                  ) : (
                    ", "
                  )}
                </span>
                <span className="t-label mt-2 block">cases pay something</span>
              </span>
              <span className="chip">$1 a case</span>
            </div>

            <p className="mt-4 min-h-[3.25rem] text-[0.9375rem] text-[var(--color-ink-dim)]">
              {deck.empty ? (
                "Every case in this deck has been opened."
              ) : (
                <>
                  Best case{" "}
                  <span style={{ color: best?.ink }}>
                    {top > 0 ? `+${top} tickets` : "the vault"}
                  </span>
                  .{" "}
                  {deck.vaultUpTo > 0
                    ? "One case in the deck opens the vault and takes all of it."
                    : "No vault here, this deck pays in tickets only."}
                </>
              )}
            </p>

            <div className="mt-5 flex items-end justify-between gap-3">
              <span>
                <span className="t-label block">still sealed</span>
                <span className="t-chain mt-1.5 block text-[1.0625rem] leading-none">
                  {deck.remaining}
                  <span className="text-[var(--color-ink-faint)]"> of {deck.size}</span>
                </span>
              </span>
              <span className="text-right">
                <span className="t-label block">{deck.vaultUpTo > 0 ? "vault" : "no vault"}</span>
                <span
                  className="t-chain mt-1.5 block text-[1.5rem] leading-none"
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
