"use client";

import { motion } from "motion/react";
import { Chest } from "./Chest";
import { slotsPerTier, specFor, VAULT_SPEC, type DeckShape } from "@/lib/deck";
import type { PoolState } from "@/hooks/usePool";

/**
 *
 *
 *
 */
export function Drops({ deck, drawn, pool }: { deck: DeckShape; drawn: number; pool?: PoolState }) {
  const tiers = slotsPerTier(deck);
  if (tiers.length === 0) return null;

  const grout = specFor(0);
  const byWeight = new Map((pool?.tiers ?? []).map((t) => [t.weight, t.left]));

  const vaultLeft = deck.vaultUpTo > 0 && !pool?.vaultTaken ? deck.vaultUpTo : 0;
  const groutLeft = pool ? Math.max(0, pool.remaining - pool.prizesLeft - vaultLeft) : undefined;

  const leftFor = (t: (typeof tiers)[number]) =>
    t.spec.name === VAULT_SPEC.name
      ? vaultLeft
      : t.spec.name === grout.name
        ? groutLeft
        : byWeight.get(t.weight);

  const remaining = pool?.remaining ?? Math.max(0, deck.size - drawn);
  const size = pool?.size ?? deck.size;
  const prizesLeft = (pool?.tiers ?? []).reduce((n, t) => n + t.left, 0) + vaultLeft;
  const odds = remaining > 0 ? prizesLeft / remaining : 0;

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <span className="t-label">what is in this deck</span>
        <span className="t-chain text-sm text-slate-300">
          {remaining} of {size} unopened
        </span>
      </div>

      <ul className="space-y-1.5">
        {tiers.map((t, i) => {
          const left = leftFor(t);
          const gone = left === 0;
          return (
            <li
              key={i}
              className="flex items-center gap-2.5 rounded-[var(--radius-control)] border px-2.5 py-1.5"
              style={{
                background: "var(--color-bg)",
                borderColor: gone
                  ? "var(--edge)"
                  : `color-mix(in oklab, ${t.spec.ink} 32%, transparent)`,
                opacity: gone ? 0.5 : 1,
              }}
            >
              <Chest rarity={t.spec.rarity} size={34} className="shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.9375rem] font-bold leading-tight" style={{ color: t.spec.ink }}>
                  {t.spec.name}
                </span>
                <span className="block truncate text-[0.8125rem] leading-tight text-slate-300">
                  {t.spec.note}
                </span>
              </span>
              <span className="t-chain shrink-0 whitespace-nowrap text-right text-base font-bold">
                <motion.span
                  key={String(left)}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ color: gone ? "var(--color-ink-faint)" : "var(--color-ink)" }}
                >
                  {left === undefined ? "…" : left}
                </motion.span>
                <span className="text-slate-400"> / {t.count}</span>
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 border-t border-slate-800 pt-3 text-sm leading-relaxed text-slate-200">
        {!pool ? (
          <>Counting what is still in the pool, every opened slot is public, so this is arithmetic anyone can repeat.</>
        ) : prizesLeft === 0 ? (
          <>Every prize in this deck has been drawn. What is left pays no bonus.</>
        ) : (
          <>
            <span className="t-chain font-bold text-white">{(odds * 100).toFixed(1)}%</span> of the
            unopened slots still carry a bonus. Nobody set that number, it is what remains after{" "}
            {pool.drawn} opens.
          </>
        )}
      </p>
    </div>
  );
}
