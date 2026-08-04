"use client";

import { slotsPerTier, specFor, VAULT_SPEC, type DeckShape } from "@/lib/deck";
import type { PoolState } from "@/hooks/usePool";

/**
 *
 *
 */
export function Contents({ deck, pool }: { deck: DeckShape; pool?: PoolState }) {
  const tiers = slotsPerTier(deck);
  if (tiers.length === 0) return null;

  const byWeight = new Map((pool?.tiers ?? []).map((t) => [t.weight, t.left]));
  const grout = specFor(0);

  const vaultLeft = deck.vaultUpTo > 0 && !pool?.vaultTaken ? deck.vaultUpTo : 0;
  const groutLeft = pool
    ? Math.max(0, pool.remaining - pool.prizesLeft - vaultLeft)
    : undefined;

  const leftFor = (t: (typeof tiers)[number]) => {
    if (t.spec.name === VAULT_SPEC.name) return vaultLeft;
    if (t.spec.name === grout.name) return groutLeft;
    return byWeight.get(t.weight);
  };

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {tiers.map((t, i) => {
        const isGrout = t.spec.name === grout.name;
        const remaining = leftFor(t);
        return (
          <li
            key={i}
            className="relative overflow-hidden rounded-[3px]"
            style={{
              background: isGrout
                ? "linear-gradient(158deg, var(--color-stone-700), var(--color-stone-900))"
                : `linear-gradient(158deg, color-mix(in oklab, ${t.spec.ink} 20%, ${t.spec.tint}), ${t.spec.tint})`,
              boxShadow: `inset 0 2px 0 ${isGrout ? "var(--edge-strong)" : t.spec.ink}, inset 0 0 0 1px color-mix(in oklab, ${t.spec.ink} 24%, transparent)`,
            }}
          >
            <div className="grid aspect-square place-items-center p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={t.spec.art}
                alt=""
                className="pointer-events-none h-full w-full object-contain"
                draggable={false}
              />
            </div>
            <div className="px-3 pb-3 text-center">
              <div
                className="t-inscription text-[0.625rem]"
                style={{ color: isGrout ? "var(--color-travertine-faint)" : t.spec.ink }}
              >
                {t.spec.name}
              </div>
              <div className="t-chain mt-1 text-[0.75rem] text-[var(--color-travertine-dim)]">
                {t.spec.tickets > 0 ? `+${t.spec.tickets} · ` : ""}
                {remaining === undefined ? `${t.count} of ${t.count}` : `${remaining} left`}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
