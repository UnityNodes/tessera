"use client";

import { motion, useReducedMotion } from "motion/react";
import { tierOf, type DeckShape } from "@/lib/deck";

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
export function Case({ phase, value, deck, size = 280, onClick }: Props) {
  const still = useReducedMotion();
  const spec = phase === "opened" && value != null ? tierOf(value, deck) : null;
  const open = phase === "opened";
  const clickable = Boolean(onClick) && phase === "idle";

  return (
    <div
      className="relative select-none"
      style={{ width: size, height: size }}
      role="img"
      aria-label={
        spec
          ? `Opened: ${spec.name}, slot ${value}`
          : phase === "waiting"
            ? "Sealed case, being decrypted"
            : "A sealed case"
      }
    >
      <div
        className="absolute inset-0 grid place-items-center rounded-[2px] overflow-hidden"
        style={{
          background: spec
            ? `radial-gradient(120% 130% at 50% 34%, color-mix(in oklab, ${spec.ink} 34%, ${spec.tint}), ${spec.tint} 70%)`
            : "#000",
          boxShadow: spec
            ? `inset 0 0 70px -12px color-mix(in oklab, ${spec.ink} 55%, transparent)`
            : "none",
        }}
      >
        {spec && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5, ease: [0.16, 0.84, 0.28, 1] }}
            className="text-center"
          >
            <div
              className="t-chain font-semibold leading-none"
              style={{ fontSize: size * 0.19, color: spec.ink }}
            >
              {value}
            </div>
            <div
              className="t-inscription mt-3 text-[0.75rem]"
              style={{ color: spec.ink, opacity: 0.85 }}
            >
              {spec.name}
            </div>
          </motion.div>
        )}
      </div>

      <Half side="left" {...{ phase, size, still, open, clickable, onClick }} />
      <Half side="right" {...{ phase, size, still, open, clickable, onClick }} />

      <motion.div
        aria-hidden
        className="absolute left-1/2 -translate-x-1/2 rounded-[50%]"
        style={{
          bottom: -size * 0.05,
          width: size * 0.86,
          height: size * 0.06,
          background: "radial-gradient(closest-side, rgb(0 0 0 / 0.75), transparent)",
        }}
        animate={{ scaleX: open ? 1.3 : 1, opacity: open ? 0.45 : 1 }}
        transition={{ duration: 0.7, ease: [0.16, 0.84, 0.28, 1] }}
      />
    </div>
  );
}

function Half({
  side,
  phase,
  size,
  still,
  open,
  clickable,
  onClick,
}: {
  side: "left" | "right";
  phase: CasePhase;
  size: number;
  still: boolean | null;
  open: boolean;
  clickable: boolean;
  onClick?: () => void;
}) {
  const isLeft = side === "left";
  const half = size / 2;

  return (
    <motion.button
      type="button"
      onClick={clickable ? onClick : undefined}
      disabled={!clickable}
      aria-hidden
      tabIndex={-1}
      className="absolute top-0 h-full overflow-hidden disabled:cursor-default"
      style={{ width: half, [isLeft ? "left" : "right"]: 0 }}
      animate={
        open
          ? { x: isLeft ? -size * 0.23 : size * 0.23, rotate: isLeft ? -7 : 7 }
          : { x: 0, rotate: 0 }
      }
      transition={{ duration: 0.62, ease: [0.34, 1.24, 0.5, 1] }}
      whileHover={clickable ? { y: -3 } : undefined}
      whileTap={clickable ? { y: 1 } : undefined}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(148deg, var(--color-stone-500) 0%, var(--color-stone-600) 38%, var(--color-stone-800) 100%)",
          backgroundSize: `${size}px ${size}px`,
          backgroundPosition: isLeft ? "left top" : "right top",
          boxShadow: isLeft
            ? "inset 0 2px 0 rgb(255 255 255 / 0.16), inset 0 -3px 10px rgb(0 0 0 / 0.55), inset -1px 0 0 rgb(0 0 0 / 0.45)"
            : "inset 0 2px 0 rgb(255 255 255 / 0.16), inset 0 -3px 10px rgb(0 0 0 / 0.55), inset 1px 0 0 rgb(255 255 255 / 0.05)",
        }}
      />

      <div
        aria-hidden
        className="absolute inset-0 opacity-40 mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23g)'/%3E%3C/svg%3E\")",
        }}
      />

      <motion.div
        aria-hidden
        className="absolute top-0 h-full grid place-items-center"
        style={{ width: size, [isLeft ? "left" : "right"]: 0 }}
        animate={{ opacity: open ? 0 : 1 }}
        transition={{ duration: 0.2 }}
      >
        <span
          className="t-display leading-none"
          style={{
            fontSize: size * 0.42,
            color: "color-mix(in oklab, var(--color-stone-800) 55%, transparent)",
            textShadow:
              "0 1px 0 color-mix(in oklab, var(--color-travertine) 10%, transparent), 0 -1px 2px rgb(0 0 0 / 0.55)",
          }}
        >
          T
        </span>
      </motion.div>

      {phase === "waiting" && !still && (
        <div
          aria-hidden
          className="absolute top-0 h-full overflow-visible"
          style={{ width: size, [isLeft ? "left" : "right"]: 0 }}
        >
          <motion.div
            className="absolute inset-y-[-45%] w-[38%]"
            style={{
              background:
                "linear-gradient(100deg, transparent, color-mix(in oklab, var(--color-lapis-400) 75%, transparent), transparent)",
              filter: "blur(16px)",
              rotate: "12deg",
            }}
            animate={{ x: ["-60%", "320%"] }}
            transition={{ duration: 3.1, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      )}

      {phase === "idle" && !still && (
        <motion.div
          aria-hidden
          className="absolute top-0 h-full"
          style={{
            width: size,
            [isLeft ? "left" : "right"]: 0,
            background:
              "radial-gradient(60% 45% at 50% 46%, color-mix(in oklab, var(--color-ochre-400) 26%, transparent), transparent 70%)",
          }}
          animate={{ opacity: [0.35, 0.75, 0.35] }}
          transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </motion.button>
  );
}
