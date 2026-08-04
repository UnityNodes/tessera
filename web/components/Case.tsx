"use client";

import { motion, useReducedMotion } from "motion/react";
import { specOf, type DeckShape } from "@/lib/deck";

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
export function Case({ phase, value, deck, size = 300, onClick }: Props) {
  const still = useReducedMotion();
  const spec = phase === "opened" && value != null ? specOf(value, deck) : null;
  const open = phase === "opened";
  const clickable = Boolean(onClick) && phase === "idle";

  const lidTop = size * 0.12;
  const lidHeight = size * 0.46;
  const wellHeight = size * 0.44;

  return (
    <div
      className="relative select-none"
      style={{ width: size, height: size * 0.86, perspective: size * 3 }}
      role="img"
      aria-label={
        spec
          ? `Opened: ${spec.name}, ${spec.note}`
          : phase === "waiting"
            ? "Sealed case, being decrypted"
            : "A sealed case"
      }
    >
      <motion.button
        type="button"
        onClick={clickable ? onClick : undefined}
        disabled={!clickable}
        className="absolute inset-0 disabled:cursor-default"
        style={{ transformStyle: "preserve-3d", transform: "rotateX(15deg)" }}
        whileHover={clickable ? { y: -6 } : undefined}
        whileTap={clickable ? { y: 2 } : undefined}
        transition={{ duration: 0.3, ease: [0.16, 0.84, 0.28, 1] }}
      >
        <div
          className="absolute left-0 right-0 overflow-hidden rounded-[3px]"
          style={{
            top: lidTop,
            height: wellHeight,
            background: spec
              ? `linear-gradient(180deg, color-mix(in oklab, ${spec.ink} 30%, ${spec.tint}), ${spec.tint})`
              : "#070605",
            boxShadow: spec
              ? `inset 0 16px 44px -12px color-mix(in oklab, ${spec.ink} 65%, transparent), inset 0 -10px 26px rgb(0 0 0 / 0.65)`
              : "inset 0 14px 30px rgb(0 0 0 / 0.9)",
          }}
        >
          {spec && (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28, duration: 0.5, ease: [0.16, 0.84, 0.28, 1] }}
              className="absolute inset-0 grid place-items-center text-center"
            >
              <div>
                {spec.tickets > 0 ? (
                  <div
                    className="t-chain font-semibold leading-none"
                    style={{ fontSize: size * 0.18, color: spec.ink }}
                  >
                    +{spec.tickets}
                  </div>
                ) : (
                  <div
                    className="t-inscription leading-none"
                    style={{ fontSize: size * 0.075, color: spec.ink }}
                  >
                    empty
                  </div>
                )}
                <div
                  className="t-inscription mt-3 text-[0.7rem]"
                  style={{ color: spec.ink, opacity: 0.9 }}
                >
                  {spec.tickets > 0
                    ? `${spec.name} · real ticket${spec.tickets > 1 ? "s" : ""}`
                    : spec.name}
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {spec && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute left-1/2 -translate-x-1/2"
            style={{
              top: -size * 0.2,
              width: size * 0.72,
              height: size * 0.5,
              background: `linear-gradient(0deg, color-mix(in oklab, ${spec.ink} 30%, transparent), transparent 80%)`,
              filter: "blur(24px)",
            }}
            initial={{ opacity: 0, scaleY: 0.4 }}
            animate={{ opacity: 1, scaleY: 1 }}
            transition={{ delay: 0.22, duration: 0.6 }}
          />
        )}

        <div
          className="absolute left-0 right-0 overflow-hidden rounded-b-[3px]"
          style={{
            top: lidTop + wellHeight * 0.55,
            height: wellHeight * 0.62,
            background: "linear-gradient(180deg, var(--color-stone-700), var(--color-stone-900))",
            boxShadow:
              "inset 0 1px 0 rgb(255 255 255 / 0.1), 0 14px 30px -12px rgb(0 0 0 / 0.9)",
            transform: "translateZ(1px)",
          }}
        >
          <Grain />
        </div>

        <motion.div
          className="absolute left-0 right-0 origin-top"
          style={{ top: lidTop, height: lidHeight, transformStyle: "preserve-3d" }}
          animate={{ rotateX: open ? -116 : 0 }}
          transition={{ duration: 0.75, ease: [0.3, 1.18, 0.45, 1] }}
        >
          <div
            className="absolute inset-0 overflow-hidden rounded-t-[3px]"
            style={{
              background:
                "linear-gradient(158deg, var(--color-stone-500) 0%, var(--color-stone-600) 40%, var(--color-stone-800) 100%)",
              boxShadow:
                "inset 0 2px 0 rgb(255 255 255 / 0.18), inset 0 -2px 6px rgb(0 0 0 / 0.5), 0 8px 20px -10px rgb(0 0 0 / 0.9)",
              backfaceVisibility: "hidden",
            }}
          >
            <Grain />

            <div className="absolute inset-0 grid place-items-center">
              <span
                className="t-display leading-none"
                style={{
                  fontSize: size * 0.28,
                  color: "color-mix(in oklab, var(--color-stone-900) 62%, transparent)",
                  textShadow:
                    "0 1px 0 color-mix(in oklab, var(--color-travertine) 12%, transparent), 0 -1px 2px rgb(0 0 0 / 0.55)",
                }}
              >
                T
              </span>
            </div>

            {phase === "waiting" && !still && (
              <motion.div
                aria-hidden
                className="absolute inset-y-[-60%] w-[38%]"
                style={{
                  background:
                    "linear-gradient(100deg, transparent, color-mix(in oklab, var(--color-lapis-400) 80%, transparent), transparent)",
                  filter: "blur(16px)",
                  rotate: "10deg",
                }}
                animate={{ x: ["-70%", "330%"] }}
                transition={{ duration: 3.1, repeat: Infinity, ease: "easeInOut" }}
              />
            )}

            {phase === "idle" && !still && (
              <motion.div
                aria-hidden
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(58% 48% at 50% 62%, color-mix(in oklab, var(--color-ochre-400) 24%, transparent), transparent 72%)",
                }}
                animate={{ opacity: [0.3, 0.72, 0.3] }}
                transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
          </div>
        </motion.div>

        {!open && (
          <motion.div
            aria-hidden
            className="absolute left-[5%] right-[5%] rounded-full"
            style={{
              top: lidTop + lidHeight - 2,
              height: 3,
              background:
                phase === "waiting"
                  ? "color-mix(in oklab, var(--color-lapis-400) 75%, transparent)"
                  : "color-mix(in oklab, var(--color-ochre-400) 50%, transparent)",
              filter: "blur(2px)",
              transform: "translateZ(2px)",
            }}
            animate={
              still ? {} : { opacity: phase === "waiting" ? [0.4, 1, 0.4] : [0.25, 0.65, 0.25] }
            }
            transition={{ duration: phase === "waiting" ? 1.6 : 4.2, repeat: Infinity }}
          />
        )}
      </motion.button>

      <motion.div
        aria-hidden
        className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-[50%]"
        style={{
          width: size * 0.8,
          height: size * 0.06,
          background: "radial-gradient(closest-side, rgb(0 0 0 / 0.8), transparent)",
        }}
        animate={{ scaleX: open ? 1.12 : 1, opacity: open ? 0.6 : 1 }}
        transition={{ duration: 0.7 }}
      />
    </div>
  );
}

function Grain() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 opacity-40 mix-blend-overlay"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23g)'/%3E%3C/svg%3E\")",
      }}
    />
  );
}
