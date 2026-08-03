"use client";

import { motion } from "motion/react";
import { tierOf, type DeckShape } from "@/lib/deck";

export type TileState = "sealed" | "waiting" | "revealed";

interface Props {
  state: TileState;
  value?: number;
  deck: DeckShape;
  size?: number;
  delay?: number;
  onClick?: () => void;
}

/**
 *
 *
 *
 */
export function Tessera({ state, value, deck, size = 72, delay = 0, onClick }: Props) {
  const spec = state === "revealed" && value != null ? tierOf(value, deck) : null;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45, ease: [0.16, 0.84, 0.28, 1] }}
      className="relative block shrink-0 rounded-[2px] disabled:cursor-default"
      style={{ width: size, height: size, perspective: 600 }}
      aria-label={
        spec ? `${spec.name}, slot value ${value}` : "Sealed slot, contents not yet revealed"
      }
    >
      <motion.div
        className="relative h-full w-full"
        style={{ transformStyle: "preserve-3d" }}
        initial={false}
        animate={{ rotateY: state === "revealed" ? 180 : 0 }}
        transition={{ duration: 0.75, ease: [0.34, 1.3, 0.5, 1] }}
      >
        <div
          className={`tessera absolute inset-0 ${state === "waiting" ? "" : "tessera--sealed"}`}
          style={{ backfaceVisibility: "hidden" }}
        >
          {state === "waiting" && <Sweep />}
        </div>

        <div
          className="tessera absolute inset-0 grid place-items-center"
          style={
            {
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              "--tile-tint": spec?.tint,
            } as React.CSSProperties
          }
        >
          <span
            className="t-chain text-[0.9375rem] font-semibold"
            style={{ color: spec?.ink }}
          >
            {value}
          </span>
        </div>
      </motion.div>
    </motion.button>
  );
}

function Sweep() {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-[2px]">
      <motion.div
        className="absolute inset-y-[-60%] w-[45%]"
        style={{
          background:
            "linear-gradient(105deg,transparent,color-mix(in oklab,var(--color-lapis-400) 45%,transparent),transparent)",
          rotate: "18deg",
        }}
        animate={{ x: ["-140%", "260%"] }}
        transition={{ duration: 2.1, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
