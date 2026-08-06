"use client";

import { useEffect, useMemo, useState } from "react";
import { animate, useMotionValue, motion, useReducedMotion } from "motion/react";
import { slotsPerTier, specFor, specOf, VAULT_SPEC, type TierSpec, type DeckShape } from "@/lib/deck";
import { CrateTile } from "./Crate";
import type { PoolState } from "@/hooks/usePool";

/**
 *
 */
const ITEM = 168;
const GAP = 14;
const STEP = ITEM + GAP;

/**
 *
 *
 */
/**
 *
 *
 */
const DRIFT_STEPS = 200;
const DRIFT_S = 40;

/**
 *
 */
const COPIES = 5;

/**
 */
const DECAY = 2;

/**
 *
 */
export const SETTLE_MS = 950;

/**
 *
 *
 *
 */
export function Roll({
  running,
  landedValue,
  deck,
  pool,
}: {
  running: boolean;
  /**
   *
   */
  landedValue?: number;
  deck: DeckShape;
  pool?: PoolState;
}) {
  const still = useReducedMotion();
  const x = useMotionValue(0);

  const key = `${deck.tiers.length}|${deck.vaultUpTo}|${pool?.tiers.map((t) => `${t.weight}:${t.left}`).join(",") ?? ""}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const built = useMemo(() => buildStrip(deck, pool), [key]);

  /**
   *
   *
   *
   */
  const [frozen, setFrozen] = useState<{ value: number; strip: TierSpec[] } | null>(null);

  if (landedValue != null && frozen?.value !== landedValue) {
    setFrozen({ value: landedValue, strip: built });
  } else if (landedValue == null && frozen !== null) {
    setFrozen(null);
  }

  const strip = frozen?.strip ?? built;

  //
  //
  useEffect(() => {
    if (landedValue != null || !strip.length) return;
    const empty = strip.findIndex((s) => s.tickets === 0 && s.name !== VAULT_SPEC.name);
    x.set(-STEP * (strip.length + (empty >= 0 ? empty : 0)));
  }, [strip, landedValue, x]);

  //
  useEffect(() => {
    if (still || !running || landedValue != null) return;
    const drift = animate(x, x.get() - STEP * DRIFT_STEPS, {
      duration: DRIFT_S,
      ease: [0.06, 0.5, 0.28, 1],
    });
    return () => drift.stop();
  }, [running, landedValue, x, still, strip.length]);

  //
  useEffect(() => {
    if (still || landedValue == null) return;
    const items = frozen?.strip ?? built;
    const target = specOf(landedValue, deck).name;
    const len = items.length;

    const norm = (Math.abs(x.get()) / STEP) % len;
    x.set(-norm * STEP);

    //
    const v = Math.abs(x.getVelocity()) / STEP;
    const reach = Math.max(3, (v * (SETTLE_MS / 1000)) / DECAY);

    let idx = Math.ceil(norm + reach);
    for (let i = 0; i < len; i++) {
      if (items[(idx + i) % len].name === target) {
        idx += i;
        break;
      }
    }

    const settle = animate(x, -(idx * STEP), {
      duration: SETTLE_MS / 1000,
      ease: [0.33, 0.66, 0.66, 1],
    });
    return () => settle.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landedValue, still, x]);

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        height: ITEM + 36,
        maskImage:
          "linear-gradient(90deg, transparent 0%, black 11%, black 89%, transparent 100%)",
      }}
    >
      <div
        aria-hidden
        className="absolute left-1/2 top-0 z-20 h-full w-[3px] -translate-x-1/2 transition-opacity duration-300"
        style={{
          background: "var(--color-accent-bright)",
          boxShadow: landedValue != null ? "0 0 14px 1px var(--color-accent)" : "none",
          opacity: landedValue != null ? 1 : running ? 0.7 : 0.28,
        }}
      />

      <motion.div
        className="absolute top-[18px] flex"
        style={{ x, gap: GAP, left: `calc(50% - ${ITEM / 2}px)` }}
      >
        {Array.from({ length: COPIES }, () => strip)
          .flat()
          .map((spec, i) => (
            <Item key={i} spec={spec} />
          ))}
      </motion.div>
    </div>
  );
}

/**
 *
 */
function Item({ spec }: { spec: TierSpec }) {
  const prize = spec.tickets > 0 || spec.name === VAULT_SPEC.name;
  return (
    <div
      className="relative shrink-0 overflow-hidden"
      style={{
        width: ITEM,
        height: ITEM,
        background: prize ? spec.tint : "color-mix(in oklab, var(--color-surface) 55%, transparent)",
        border: `1px solid color-mix(in oklab, ${spec.ink} ${prize ? 70 : 30}%, transparent)`,
        boxShadow: prize
          ? `0 0 30px -8px color-mix(in oklab, ${spec.ink} 70%, transparent)`
          : undefined,
      }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-2 grid place-items-center">
        <CrateTile rarity={spec.rarity} size={ITEM - 62} />
      </div>
      <div className="absolute inset-x-0 bottom-0 px-2 pb-2 text-center">
        <div className="t-inscription text-[0.75rem]" style={{ color: spec.ink }}>
          {spec.name}
        </div>
        {spec.tickets > 0 && (
          <div className="t-chain text-[0.8125rem] font-semibold" style={{ color: spec.ink }}>
            +{spec.tickets}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 *
 *
 *
 */
function buildStrip(deck: DeckShape, pool?: PoolState): TierSpec[] {
  const LENGTH = 72;
  const grout = specFor(0);

  const fromDeck = slotsPerTier(deck).filter((t) => t.weight > 0 || t.spec.name === VAULT_SPEC.name);
  if (fromDeck.length === 0) return Array.from({ length: LENGTH }, () => grout);

  const exhausted = new Set(
    (pool?.tiers ?? []).filter((t) => t.left === 0).map((t) => t.weight),
  );
  const alive = fromDeck
    .filter((t) => !exhausted.has(t.weight))
    .map((t) => ({ spec: t.spec, weight: t.weight }));
  if (alive.length === 0) return Array.from({ length: LENGTH }, () => grout);

  const cycle: TierSpec[] = [];
  const rank = (t: { spec: TierSpec; weight: number }) =>
    t.spec.name === VAULT_SPEC.name ? Infinity : t.weight;
  const sorted = [...alive].sort((a, b) => rank(b) - rank(a));
  const perCycle = sorted.map((t, i) => ({ spec: t.spec, times: i === 0 ? 1 : i === 1 ? 2 : 3 }));

  const CYCLE = 12;
  for (const p of perCycle) for (let i = 0; i < p.times; i++) cycle.push(p.spec);
  while (cycle.length < CYCLE) cycle.push(grout);

  const spread: TierSpec[] = new Array(cycle.length);
  let at = 0;
  for (const item of cycle) {
    while (spread[at] !== undefined) at = (at + 1) % spread.length;
    spread[at] = item;
    at = (at + 5) % spread.length;
  }

  const out: TierSpec[] = [];
  while (out.length < LENGTH) out.push(...spread);
  return out.slice(0, LENGTH);
}
