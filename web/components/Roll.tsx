"use client";

import { useEffect, useMemo, useRef } from "react";
import { animate, useMotionValue, motion, useReducedMotion } from "motion/react";
import { slotsPerTier, specFor, VAULT_SPEC, type TierSpec, type DeckShape } from "@/lib/deck";
import { Crate } from "./Crate";
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
 *
 */
export function Roll({
  running,
  landed,
  deck,
  pool,
}: {
  running: boolean;
  /**
   *
   */
  landed?: TierSpec;
  deck: DeckShape;
  pool?: PoolState;
}) {
  const still = useReducedMotion();
  const x = useMotionValue(0);
  const spinning = useRef(false);

  const key = `${deck.tiers.length}|${deck.vaultUpTo}|${pool?.tiers.map((t) => `${t.weight}:${t.left}`).join(",") ?? ""}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const strip = useMemo(() => buildStrip(deck, pool), [key]);

  //
  useEffect(() => {
    if (strip.length) x.set(-STEP * strip.length);
  }, [strip, x]);

  useEffect(() => {
    if (still) return;
    if (running && !spinning.current) {
      spinning.current = true;
      animate(x, x.get() - STEP * strip.length, {
        duration: strip.length * 0.075,
        ease: "linear",
        repeat: Infinity,
        repeatType: "loop",
      });
    }
    if (!running) spinning.current = false;
  }, [running, x, still, strip]);

  useEffect(() => {
    if (!landed || still) return;
    spinning.current = false;

    const items = strip;
    const current = Math.abs(x.get()) / STEP;
    const target = landed.name;
    let idx = Math.ceil(current) + 12;
    for (let i = 0; i < items.length * 2; i++) {
      if (items[(idx + i) % items.length].name === target) {
        idx += i;
        break;
      }
    }
    animate(x, -(idx * STEP), {
      duration: 1.9,
      ease: [0.12, 0.72, 0.12, 1],
    });
  }, [landed, x, still, strip]);

  return (
    <div className="relative w-full overflow-hidden" style={{ height: ITEM + 36 }}>
      <div
        aria-hidden
        className="absolute left-1/2 top-0 z-20 h-full w-px -translate-x-1/2"
        style={{ background: "var(--color-accent-bright)" }}
      />
      <svg
        aria-hidden
        viewBox="0 0 16 10"
        className="absolute left-1/2 top-0 z-20 -translate-x-1/2"
        style={{ width: 16, height: 10 }}
      >
        <path d="M0 0 H16 L8 10 Z" fill="var(--color-accent-bright)" />
      </svg>
      <svg
        aria-hidden
        viewBox="0 0 16 10"
        className="absolute bottom-0 left-1/2 z-20 -translate-x-1/2"
        style={{ width: 16, height: 10 }}
      >
        <path d="M0 10 H16 L8 0 Z" fill="var(--color-accent-bright)" />
      </svg>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            "linear-gradient(90deg, var(--color-surface) 0%, transparent 14%, transparent 86%, var(--color-surface) 100%)",
        }}
      />

      <motion.div
        className="absolute top-[18px] flex"
        style={{ x, gap: GAP, left: `calc(50% - ${ITEM / 2}px)` }}
      >
        {[...strip, ...strip, ...strip].map((spec, i) => (
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
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-[var(--radius-panel)]"
      style={{
        width: ITEM,
        height: ITEM,
        background: spec.tint,
        boxShadow:
          spec.tickets > 0 || spec.name === "The Vault"
            ? `inset 0 0 0 1px color-mix(in oklab, ${spec.ink} 42%, transparent), 0 0 34px -6px color-mix(in oklab, ${spec.ink} 60%, transparent), 0 4px 12px rgb(0 0 0/0.5)`
            : `inset 0 0 0 1px color-mix(in oklab, ${spec.ink} 26%, transparent), 0 4px 12px rgb(0 0 0/0.5)`,
      }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-3 grid place-items-center">
        <Crate rarity={spec.rarity} size={ITEM - 62} />
      </div>
      <div className="absolute inset-x-0 bottom-0 px-2 pb-2.5 text-center">
        <div className="t-inscription text-[0.625rem]" style={{ color: spec.ink }}>
          {spec.name}
        </div>
        {spec.tickets > 0 && (
          <div className="t-chain text-[0.8125rem]" style={{ color: spec.ink }}>
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
