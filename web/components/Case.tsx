"use client";

import { motion, useReducedMotion } from "motion/react";
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
 *
 */
export function Case({ phase, value, deck, size = 340, onClick }: Props) {
  const still = useReducedMotion();
  const spec = phase === "opened" && value != null ? specOf(value, deck) : null;
  const open = phase === "opened";
  const clickable = Boolean(onClick) && phase === "idle";

  const glow = spec ? spec.ink : phase === "waiting" ? "var(--color-lapis-400)" : "var(--color-ochre-400)";

  return (
    <div
      className="relative select-none"
      style={{ width: size, height: size }}
      role="img"
      aria-label={
        spec
          ? `Opened: ${spec.name}, ${spec.note}`
          : phase === "waiting"
            ? "Sealed case, being decrypted"
            : "A sealed case"
      }
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: size * 0.92,
          height: size * 0.92,
          background: `radial-gradient(closest-side, color-mix(in oklab, ${glow} 38%, transparent), transparent 72%)`,
          filter: "blur(18px)",
        }}
        animate={
          still
            ? {}
            : open
              ? { opacity: [0, 1], scale: [0.6, 1.15, 1] }
              : { opacity: phase === "waiting" ? [0.35, 0.9, 0.35] : [0.3, 0.6, 0.3] }
        }
        transition={
          open
            ? { duration: 0.7, ease: [0.16, 0.84, 0.28, 1] }
            : { duration: phase === "waiting" ? 1.8 : 4.2, repeat: Infinity, ease: "easeInOut" }
        }
      />

      {open && !still && (
        <motion.img
          aria-hidden
          src={spec && spec.tickets > 0 ? "/cases/burst-warm.png" : "/cases/burst-cool.png"}
          alt=""
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ width: size * 1.3, mixBlendMode: "screen" }}
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: [0, 0.95, 0], scale: [0.4, 1.1, 1.35] }}
          transition={{ duration: 1.1, ease: "easeOut" }}
        />
      )}

      <motion.button
        type="button"
        onClick={clickable ? onClick : undefined}
        disabled={!clickable}
        className="absolute inset-0 grid place-items-center disabled:cursor-default"
        whileHover={clickable ? { y: -8, scale: 1.02 } : undefined}
        whileTap={clickable ? { y: 2, scale: 0.99 } : undefined}
        transition={{ duration: 0.3, ease: [0.16, 0.84, 0.28, 1] }}
      >
        <motion.img
          key={spec?.name ?? "sealed"}
          src={spec ? spec.art : "/cases/hero.png"}
          alt=""
          className="pointer-events-none h-full w-full object-contain"
          draggable={false}
          initial={open ? { scale: 0.82, opacity: 0 } : false}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.55, ease: [0.34, 1.3, 0.5, 1] }}
        />
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
              style={{ fontSize: size * 0.14, color: spec.ink, textShadow: "0 2px 12px rgb(0 0 0/0.9)" }}
            >
              +{spec.tickets}
            </div>
          )}
          <div
            className="t-inscription mt-1 text-[0.75rem]"
            style={{ color: spec.ink, textShadow: "0 1px 6px rgb(0 0 0/0.9)" }}
          >
            {isVault(spec) ? spec.name : spec.tickets > 0 ? `${spec.name} · real tickets` : spec.name}
          </div>
        </motion.div>
      )}
    </div>
  );
}
