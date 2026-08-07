"use client";

import { motion } from "motion/react";
import { slotsPerTier, type DeckShape } from "@/lib/deck";
import type { PoolState } from "@/hooks/usePool";

/**
 *
 *
 */
export function PoolCounter({ deck, drawn, pool }: { deck: DeckShape; drawn: number; pool?: PoolState }) {
  const counting = !pool;
  const tiers =
    pool?.tiers ??
    slotsPerTier(deck)
      .filter((t) => t.weight > 0)
      .map((t) => ({ spec: t.spec, weight: t.weight, total: t.count, left: t.count }));
  const remaining = pool?.remaining ?? Math.max(0, deck.size - drawn);
  const size = pool?.size ?? deck.size;
  const prizesLeft = tiers.reduce((n, t) => n + t.left, 0);
  const oddsNext = remaining > 0 ? prizesLeft / remaining : 0;

  return (
    <div>
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <span className="t-label">still in the pool</span>
        <span className="t-chain text-xs text-slate-400">
          {remaining} of {size} unopened
        </span>
      </div>

      <div className="space-y-2">
        {tiers.map((t) => (
          <div
            key={t.weight}
            className="flex items-center gap-3 rounded-[var(--radius-control)] border border-slate-800 bg-slate-950 p-2.5"
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: t.spec.ink, opacity: t.left > 0 ? 1 : 0.25 }}
            />
            <span className="min-w-0 flex-1">
              <span
                className="block text-sm font-bold"
                style={{ color: t.left > 0 ? t.spec.ink : "var(--color-ink-faint)" }}
              >
                {t.spec.name}
              </span>
              <span className="t-chain block text-[11px] text-slate-500">
                {t.spec.note}
              </span>
            </span>
            <span className="t-chain shrink-0 text-right text-base font-bold">
              <motion.span
                key={t.left}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ color: t.left > 0 ? "var(--color-ink)" : "var(--color-ink-faint)" }}
              >
                {t.left}
              </motion.span>
              <span className="text-slate-500"> / {t.total}</span>
            </span>
          </div>
        ))}
      </div>

      <p className="mt-5 border-t border-slate-800 pt-4 text-sm text-slate-400">
        {counting ? (
          <>
            Counting what is still in the pool. Every opened slot is publicly
            revealed, so this is arithmetic anyone can repeat, it just takes a
            moment to fetch.
          </>
        ) : prizesLeft === 0 ? (
          <>Every prize in this season has been drawn. What is left is grout.</>
        ) : (
          <>
            <span className="t-chain font-bold text-slate-100">
              {(oddsNext * 100).toFixed(1)}%
            </span>{" "}
            of the unopened slots still carry something. Nobody set that number, it
            is what remains after {pool!.drawn} opens.
          </>
        )}
        {!counting && pool!.unknown > 0 && (
          <span className="mt-1 block text-slate-500">
            {pool!.unknown} opened slots not yet decrypted, so the count may still move.
          </span>
        )}
      </p>
    </div>
  );
}
