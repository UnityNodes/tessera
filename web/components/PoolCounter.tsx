"use client";

import { motion } from "motion/react";
import type { PoolState } from "@/hooks/usePool";

/**
 *
 *
 */
export function PoolCounter({ pool }: { pool?: PoolState }) {
  if (!pool) {
    return <p className="t-label">counting the pool…</p>;
  }

  return (
    <div>
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <span className="t-label">still in the pool</span>
        <span className="t-chain text-[0.8125rem] text-[var(--color-travertine-dim)]">
          {pool.remaining} of {pool.size} unopened
        </span>
      </div>

      <div className="space-y-3">
        {pool.tiers.map((t) => (
          <div key={t.weight} className="flex items-center gap-3">
            <span
              className="h-7 w-1.5 shrink-0 rounded-full"
              style={{ background: t.spec.ink, opacity: t.left > 0 ? 1 : 0.2 }}
            />
            <span className="min-w-0 flex-1">
              <span
                className="t-inscription block text-[0.6875rem]"
                style={{ color: t.left > 0 ? t.spec.ink : "var(--color-travertine-faint)" }}
              >
                {t.spec.name}
              </span>
              <span className="block text-[0.8125rem] text-[var(--color-travertine-faint)]">
                {t.spec.note}
              </span>
            </span>
            <span className="t-chain shrink-0 text-right text-[1.0625rem]">
              <motion.span
                key={t.left}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ color: t.left > 0 ? "var(--color-travertine)" : "var(--color-travertine-faint)" }}
              >
                {t.left}
              </motion.span>
              <span className="text-[var(--color-travertine-faint)]"> / {t.total}</span>
            </span>
          </div>
        ))}
      </div>

      <p className="mt-5 border-t border-[var(--edge)] pt-4 text-[0.9375rem] text-[var(--color-travertine-dim)]">
        {pool.prizesLeft === 0 ? (
          <>Every prize in this season has been drawn. What is left is grout.</>
        ) : (
          <>
            <span className="t-chain text-[var(--color-travertine)]">
              {(pool.oddsNext * 100).toFixed(1)}%
            </span>{" "}
            of the unopened slots still carry something. Nobody set that number, it
            is what remains after {pool.drawn} opens.
          </>
        )}
        {pool.unknown > 0 && (
          <span className="block mt-1 text-[var(--color-travertine-faint)]">
            {pool.unknown} opened slots not yet decrypted, so the count may still move.
          </span>
        )}
      </p>
    </div>
  );
}
