"use client";

import { useState } from "react";
import Link from "next/link";
import { formatUnits } from "viem";
import { Sparkles, Eye, X } from "lucide-react";
import { Chest } from "@/components/Chest";
import { TierPlate } from "@/components/ui/TierPlate";
import { useDeck, type DeckInfo } from "@/hooks/useDeck";
import {
  slotsPerTier,
  bestTier,
  deckFace,
  isShard,
  ticketsLabel,
  type TierSpec,
} from "@/lib/deck";

/**
 *
 *
 */
export default function CasesPage() {
  const game = useDeck();
  const [filter, setFilter] = useState<"all" | "open" | "vault">("all");
  const [inspect, setInspect] = useState<DeckInfo | null>(null);

  const shown = game.decks.filter((d) => {
    if (filter === "open") return !d.empty;
    if (filter === "vault") return d.vaultUpTo > 0;
    return true;
  });

  return (
    <div className="w-full bg-[var(--color-section)] px-4 py-10 lg:px-8 2xl:px-14">
      <div className="mx-auto flex max-w-[1320px] flex-col space-y-8">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-6 md:flex-row md:items-center">
          <div className="min-w-0 max-w-2xl">
            <h1 className="t-page flex flex-wrap items-baseline gap-3 text-white">
              <span>Case deck catalog</span>
              <span className="t-chain text-lg font-bold text-[var(--color-ink-dim)]">
                {game.decks.length} {game.decks.length === 1 ? "deck" : "decks"}
              </span>
            </h1>
            <p className="mt-2 text-[0.9375rem] text-slate-400">
              Every case costs $1 and buys a real lottery ticket, that part never changes. What
              the decks disagree on is the case itself: how often it pays, and how much.
            </p>
          </div>

          <div className="scrollbar-none flex max-w-full shrink-0 items-center gap-2 self-start overflow-x-auto rounded-[var(--radius-control)] border border-slate-800 bg-slate-900 p-1.5 md:self-auto">
            <Pill on={filter === "all"} onClick={() => setFilter("all")}>
              all decks
            </Pill>
            <Pill on={filter === "open"} onClick={() => setFilter("open")}>
              still open
            </Pill>
            <Pill on={filter === "vault"} onClick={() => setFilter("vault")}>
              with a vault
            </Pill>
          </div>
        </div>

        {game.decks.length === 0 ? (
          <p className="py-20 text-center text-slate-400">
            {game.isLoading ? "Reading the chain…" : "No decks in this season yet."}
          </p>
        ) : shown.length === 0 ? (
          <p className="py-20 text-center text-slate-400">Nothing matches that filter.</p>
        ) : (
          <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(17rem,1fr))]">
            {shown.map((d) => (
              <DeckCard key={d.id} deck={d} onInspect={() => setInspect(d)} />
            ))}
          </div>
        )}
      </div>

      {inspect && <Inspector deck={inspect} onClose={() => setInspect(null)} />}
    </div>
  );
}

function Pill({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`t-label flex min-h-11 cursor-pointer items-center whitespace-nowrap rounded-[var(--radius-chip)] px-3.5 py-1.5 transition-all sm:min-h-0 ${
        on
          ? "bg-[var(--color-accent)] text-slate-950 shadow-[var(--glow-accent-soft)]"
          : "text-slate-400 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function DeckCard({ deck, onInspect }: { deck: DeckInfo; onInspect: () => void }) {
  const { best, top, oneIn, tesa } = read(deck);
  const face = deckFace(deck);
  const ink = deck.empty ? "var(--color-tier-grout)" : face.ink;

  return (
    <div
      data-deck={deck.id}
      className="relative flex flex-col justify-between rounded-[20px] border px-6 pb-6 pt-8 transition-all hover:scale-[1.02]"
      style={{
        background: "var(--color-surface)",
        borderColor: `color-mix(in oklab, ${ink} 27%, transparent)`,
        boxShadow: `0 0 25px color-mix(in oklab, ${ink} 14%, transparent)`,
      }}
    >
      <span className="absolute left-5 top-4">
        <TierPlate name={deck.empty ? "emptied" : face.name} ink={ink} />
      </span>
      <span className="t-chain absolute right-5 top-5 text-xs text-slate-400">
        {deck.remaining} sealed
      </span>

      <div>
        <div className="relative my-4 flex justify-center">
          <span
            aria-hidden
            className="absolute inset-x-10 inset-y-2 rounded-full opacity-25 blur-2xl"
            style={{ background: ink }}
          />
          <Chest
            rarity={deck.empty ? "grout" : face.rarity}
            size={188}
            className="relative z-10"
          />
          <span
            className="t-chain absolute bottom-1 left-1/2 -translate-x-1/2 rounded border px-3 py-1 text-xs font-extrabold"
            style={{
              background: "rgb(0 0 0 / 0.45)",
              borderColor: `color-mix(in oklab, ${ink} 30%, transparent)`,
              color: ink,
            }}
          >
            $1.00
          </span>
        </div>

        <h2 className="t-black flex items-baseline justify-center gap-2 text-center text-2xl" style={{ color: ink }}>
          <span>{deck.empty ? "Emptied" : face.name}</span>
          <span className="t-chain text-sm font-bold text-[var(--color-ink-dim)]">#{deck.id}</span>
        </h2>

        {!deck.empty && oneIn > 0 && (
          <p className="mt-2 flex justify-center">
            <span
              className="t-chain rounded-full border px-3 py-1 text-sm font-extrabold"
              style={{
                borderColor: `color-mix(in oklab, ${ink} 30%, transparent)`,
                background: `color-mix(in oklab, ${ink} 8%, transparent)`,
                color: ink,
              }}
            >
              1 in {oneIn} pays
            </span>
          </p>
        )}

        <p className="mt-3 min-h-[48px] text-center text-xs leading-relaxed text-slate-400">
          {deck.empty ? (
            "Every case in this deck has been opened."
          ) : (
            <>
              Best case {top > 0 ? ticketsLabel(top) : "the vault"}.{" "}
              {deck.vaultUpTo > 0
                ? "One case in the deck opens the vault and takes all of it."
                : "No vault here, tickets only."}
            </>
          )}
        </p>

        {!deck.empty && (
          <p className="mt-2 text-center text-xs">
            {tesa > 0 ? (
              <span style={{ color: "var(--color-tier-shard)" }}>
                {tesa} TESA still in the deck · five make a ticket
              </span>
            ) : (
              <span className="text-slate-500">no TESA in this deck</span>
            )}
          </p>
        )}

        {deck.vaultUpTo > 0 && (
          <p className="t-chain mt-2 text-center text-xs" style={{ color: "var(--color-tier-vault)" }}>
            vault ${Number(formatUnits(deck.vault, 6)).toFixed(2)}
          </p>
        )}
      </div>

      <div className="mt-6 flex items-center gap-2 border-t border-slate-800 pt-4">
        <button
          type="button"
          onClick={onInspect}
          title="Inspect what is in this deck"
          className="grid min-h-11 min-w-11 cursor-pointer place-items-center rounded-[var(--radius-control)] border border-slate-800 bg-slate-950 p-3 text-slate-400 transition-colors hover:text-white"
        >
          <Eye className="h-4 w-4" />
        </button>

        <Link
          href={`/case/${deck.id}`}
          className="t-label flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-control)] py-3 shadow-lg transition-all hover:brightness-110"
          //
          style={{
            background: deck.empty
              ? "var(--color-raised)"
              : "linear-gradient(135deg, var(--color-accent), var(--color-accent-press))",
            color: deck.empty ? "var(--color-ink-faint)" : "var(--color-on-accent)",
            boxShadow: deck.empty ? undefined : "var(--glow-accent)",
          }}
        >
          <Sparkles className="h-4 w-4 fill-current" />
          {deck.empty ? "look inside" : "open • $1"}
        </Link>
      </div>
    </div>
  );
}

/**
 *
 */
function Inspector({ deck, onClose }: { deck: DeckInfo; onClose: () => void }) {
  const tiers = slotsPerTier(deck);
  const { best } = read(deck);
  const ink = best?.ink ?? "var(--color-accent)";

  return (
    <div
      className="fixed inset-0 z-[var(--z-overlay)] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="animate-fade-in w-full max-w-lg space-y-4 rounded-[var(--radius-window)] border border-slate-800 bg-slate-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="flex flex-wrap items-center gap-2 text-lg font-bold text-white">
            <span style={{ color: ink }}>{best?.name ?? "Sealed"}</span>
            <span>deck · what is in it</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-[var(--radius-control)] border border-slate-800 bg-slate-950 p-2 text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {tiers.map((t, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-[var(--radius-control)] border border-slate-800 bg-slate-950 p-3 text-sm"
            >
              <span className="flex items-center gap-3">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: t.spec.ink }}
                />
                <span className="font-medium text-slate-200">{t.spec.name}</span>
                <span className="t-chain text-xs text-slate-500">{t.spec.note}</span>
              </span>
              <span className="t-chain shrink-0 font-bold text-[var(--color-accent-hover)]">
                {t.count} of {deck.size}
              </span>
            </div>
          ))}
        </div>

        <Link
          href={`/case/${deck.id}`}
          className="t-label block w-full cursor-pointer rounded-[var(--radius-control)] bg-[var(--color-accent)] py-3 text-center text-slate-950 transition-colors hover:bg-[var(--color-accent-hover)]"
        >
          open this case now
        </Link>
      </div>
    </div>
  );
}

function read(deck: DeckInfo): { best?: TierSpec; top: number; oneIn: number; tesa: number } {
  const tiers = slotsPerTier(deck);
  const best = bestTier(deck);
  const top = tiers.reduce((n, t) => Math.max(n, t.spec.tickets), 0);
  const prizes = tiers.filter((t) => t.weight > 0).reduce((n, t) => n + t.count, 0);
  const paying = prizes + deck.vaultUpTo;
  const tesa = tiers.filter((t) => isShard(t.spec)).reduce((n, t) => n + t.count, 0);
  return {
    best,
    top,
    oneIn: paying > 0 ? Math.max(1, Math.round(deck.size / paying)) : 0,
    tesa,
  };
}
