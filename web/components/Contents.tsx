"use client";

import { useState } from "react";
import { Crate } from "./Crate";
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
      <div className="mb-4 flex justify-center">
        <div className="raised inline-flex gap-1 rounded-[var(--radius-chip)] p-1">
          {(["all", "prizes"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setOnly(k)}
              className="t-label rounded-[var(--radius-chip)] px-4 py-1.5 transition-colors hover:text-[var(--color-ink)]"
              style={
                only === k
                  ? { background: "var(--color-accent)", color: "oklch(97% 0.004 90)" }
                  : undefined
              }
            >
              {k === "all" ? "everything" : "prizes only"}
            </button>
          ))}
        </div>
      </div>

      <ul className="grid auto-rows-fr grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {shown.map((t, i) => {
          const left = leftFor(t);
          const gone = left === 0;
          return (
            <li
              key={i}
              className="flex flex-col overflow-hidden rounded-[var(--radius-panel)]"
              style={{
                background: t.spec.tint,
                border: `1px solid color-mix(in oklab, ${t.spec.ink} 28%, transparent)`,
                opacity: gone ? 0.45 : 1,
              }}
            >
              <div className="grid flex-1 place-items-center p-4">
                <Crate rarity={t.spec.rarity} size={104} />
              </div>
              <div className="px-3 pb-4 text-center">
                <div className="t-inscription text-[0.625rem]" style={{ color: t.spec.ink }}>
                  {t.spec.name}
                </div>
                <div className="mt-2 flex items-center justify-center gap-2">
                  {t.spec.tickets > 0 && (
                    <span className="chip py-0.5 text-[0.75rem]" style={{ color: t.spec.ink }}>
                      +{t.spec.tickets}
                    </span>
                  )}
                  <span className="t-label">
                    {left === undefined ? "counting…" : gone ? "all drawn" : `${left} left`}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
