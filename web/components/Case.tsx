"use client";

import { motion, useReducedMotion } from "motion/react";
import { Crate, CrateWaiting } from "./Crate";
import { specOf, isVault, type DeckShape } from "@/lib/deck";

export type CasePhase = "idle" | "waiting" | "opened";

interface Props {
  phase: CasePhase;
  value?: number;
  deck: DeckShape;
  size?: number;
  onClick?: () => void;
}

/**
 *
 *
 *
 */
export function Case({ phase, value, deck, size = 340, onClick }: Props) {
  const still = useReducedMotion();
  const spec = phase === "opened" && value != null ? specOf(value, deck) : null;
  const clickable = Boolean(onClick) && phase === "idle";

  if (phase === "waiting") {
    return (
      <div className="grid place-items-center" style={{ width: size, height: size }}>
        <CrateWaiting size={size * 0.78} />
      </div>
    );
  }

  return (
    <div
      className="relative grid place-items-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={spec ? `Opened: ${spec.name}, ${spec.note}` : "A sealed case"}
    >
      {spec && !still && (
        <motion.div
          aria-hidden
          key={spec.name}
          className="pointer-events-none absolute rounded-full"
          style={{
            width: size * 0.9,
            height: size * 0.9,
            background: `radial-gradient(closest-side, ${spec.ink}, transparent 68%)`,
            filter: "blur(26px)",
            animation: `${spec.tickets > 0 || isVault(spec) ? "burst-win" : "burst-empty"} 1.1s ease-out both`,
          }}
        />
      )}

      <motion.button
        type="button"
        onClick={clickable ? onClick : undefined}
        disabled={!clickable}
        className="relative grid place-items-center disabled:cursor-default"
        whileHover={clickable ? { y: -8, scale: 1.03 } : undefined}
        whileTap={clickable ? { y: 2, scale: 0.99 } : undefined}
        transition={{ duration: 0.3, ease: [0.16, 0.84, 0.28, 1] }}
      >
        <motion.div
          key={spec?.name ?? "sealed"}
          initial={spec ? { scale: 0.82, opacity: 0 } : false}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.55, ease: [0.34, 1.3, 0.5, 1] }}
        >
          <Crate rarity={spec ? spec.rarity : "sealed"} size={size * 0.72} drift={!spec} />
        </motion.div>
      </motion.button>

      {spec && (
        <motion.div
          className="absolute inset-x-0 bottom-0 text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
        >
          {spec.tickets > 0 && (
            <div
              className="t-chain font-semibold leading-none"
              style={{ fontSize: size * 0.14, color: spec.ink }}
            >
              +{spec.tickets}
            </div>
          )}
          <div className="t-inscription mt-1 text-[0.75rem]" style={{ color: spec.ink }}>
            {isVault(spec)
              ? spec.name
              : spec.tickets > 0
                ? `${spec.name} · real tickets`
                : spec.name}
          </div>
        </motion.div>
      )}
    </div>
  );
}
