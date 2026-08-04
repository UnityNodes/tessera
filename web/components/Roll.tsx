"use client";

import { useEffect, useMemo, useRef } from "react";
import { animate, useMotionValue, motion, useReducedMotion } from "motion/react";
import { slotsPerTier, specFor, VAULT_SPEC, type TierSpec, type DeckShape } from "@/lib/deck";
import type { PoolState } from "@/hooks/usePool";

const ITEM = 104;
const GAP = 8;
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
  width = 520,
}: {
  running: boolean;
  /**
   *
   */
  landed?: TierSpec;
  deck: DeckShape;
  pool?: PoolState;
  width?: number;
}) {
  const still = useReducedMotion();
  const x = useMotionValue(0);
  const spinning = useRef(false);

  const key = `${deck.tiers.length}|${deck.vaultUpTo}|${pool?.tiers.map((t) => `${t.weight}:${t.left}`).join(",") ?? ""}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const strip = useMemo(() => buildStrip(deck, pool), [key]);

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
    <div className="relative overflow-hidden" style={{ width, height: ITEM + 24 }}>
      <div
        aria-hidden
        className="absolute left-1/2 top-0 z-20 h-full w-px -translate-x-1/2"
        style={{ background: "var(--color-sinopia-400)" }}
      />
      <div
        aria-hidden
        className="absolute left-1/2 top-0 z-20 -translate-x-1/2"
        style={{
          width: 0,
          height: 0,
          borderLeft: "6px solid transparent",
          borderRight: "6px solid transparent",
          borderTop: "8px solid var(--color-sinopia-400)",
        }}
      />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            "linear-gradient(90deg, var(--color-stone-900) 0%, transparent 18%, transparent 82%, var(--color-stone-900) 100%)",
        }}
      />

      <motion.div
        className="absolute top-3 flex"
        style={{ x, gap: GAP, left: `calc(50% - ${ITEM / 2}px)` }}
      >
        {[...strip, ...strip].map((spec, i) => (
          <Item key={i} spec={spec} />
        ))}
      </motion.div>
    </div>
  );
}

function Item({ spec }: { spec: TierSpec }) {
  return (
    <div
      className="grid shrink-0 place-items-center rounded-[3px]"
      style={{
        width: ITEM,
        height: ITEM,
        background: `linear-gradient(158deg, color-mix(in oklab, ${spec.ink} 22%, ${spec.tint}), ${spec.tint})`,
        boxShadow: `inset 0 1px 0 rgb(255 255 255/0.16), inset 0 0 0 1px color-mix(in oklab, ${spec.ink} 30%, transparent), 0 3px 6px rgb(0 0 0/0.55)`,
        borderBottom: `3px solid ${spec.ink}`,
      }}
    >
      <span className="t-inscription text-[0.625rem]" style={{ color: spec.ink }}>
        {spec.name}
      </span>
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
