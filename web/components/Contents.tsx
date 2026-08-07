"use client";

import { useState } from "react";
import { Chest } from "./Chest";
import { slotsPerTier, specFor, VAULT_SPEC, type DeckShape } from "@/lib/deck";
import type { PoolState } from "@/hooks/usePool";

/**
 *
 *
 */
export function Contents({ deck, pool }: { deck: DeckShape; pool?: PoolState }) {
  const [only, setOnly] = useState<"all" | "prizes">("all");
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

  const shown = tiers.filter((t) => only === "all" || t.spec.name !== grout.name);

  return (
    <>
      <div className="mb-5 flex justify-center">
        <div className="flex items-center gap-1 rounded-[var(--radius-control)] border border-slate-800 bg-slate-950 p-1.5">
          {(["all", "prizes"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setOnly(k)}
              className={`t-label flex min-h-11 cursor-pointer items-center rounded-[var(--radius-chip)] px-4 py-1.5 transition-all sm:min-h-0 ${
                only === k
                  ? "bg-[var(--color-accent)] text-slate-950 shadow-[0_0_10px_rgba(6,182,212,0.4)]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {k === "all" ? "everything" : "prizes only"}
            </button>
          ))}
        </div>
      </div>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((t, i) => {
          const left = leftFor(t);
          const gone = left === 0;
          const lit = t.spec.tickets > 0 || t.spec.name === VAULT_SPEC.name;

          return (
            <li
              key={i}
              className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border bg-slate-950 p-3 transition-all hover:-translate-y-0.5"
              style={{
                borderColor: gone
                  ? "var(--edge)"
                  : `color-mix(in oklab, ${t.spec.ink} 35%, transparent)`,
                boxShadow: gone || !lit ? undefined : `0 0 18px color-mix(in oklab, ${t.spec.ink} 14%, transparent)`,
                opacity: gone ? 0.45 : 1,
              }}
            >
              <span className="flex min-w-0 items-center gap-3">
                <Chest rarity={t.spec.rarity} size={44} className="shrink-0" />
                <span className="min-w-0">
                  <span
                    className="block truncate text-sm font-bold"
                    style={{ color: t.spec.ink }}
                  >
                    {t.spec.name}
                  </span>
                  <span className="t-chain block truncate text-[11px] text-slate-500">
                    {t.spec.note}
                  </span>
                </span>
              </span>

              <span className="flex shrink-0 flex-col items-end gap-1.5">
                {t.spec.tickets > 0 && (
                  <span
                    className="chip chip--tier py-0.5"
                    style={{ "--tier-ink": t.spec.ink } as React.CSSProperties}
                  >
                    +{t.spec.tickets}
                  </span>
                )}
                <span className="t-chain whitespace-nowrap text-[11px] font-bold text-slate-400">
                  {left === undefined ? "counting…" : gone ? "all drawn" : `${left} left`}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}
