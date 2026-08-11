"use client";

import { motion, useReducedMotion } from "motion/react";
import { Chest, ChestWaiting } from "./Chest";
import { DeckHero } from "./DeckHero";
import { Prize } from "./Prize";
import { specOf, isVault, ticketsLabel, type DeckShape } from "@/lib/deck";

export type CasePhase = "idle" | "waiting" | "opened";

interface Props {
  phase: CasePhase;
  value?: number;
  deck: DeckShape;
  size?: number;
  onClick?: () => void;
  risk?: boolean;
  vault?: bigint;
  /**
   *
   */
  skin?: string;
  art?: string;
}

/**
 *
 */
const SHARDS = [
  { dx: "-120px", dy: "-96px", d: "0ms", s: 7 },
  { dx: "104px", dy: "-116px", d: "40ms", s: 5 },
  { dx: "-146px", dy: "-24px", d: "80ms", s: 6 },
  { dx: "152px", dy: "-40px", d: "20ms", s: 8 },
  { dx: "-72px", dy: "-150px", d: "110ms", s: 5 },
  { dx: "66px", dy: "-158px", d: "70ms", s: 6 },
  { dx: "-168px", dy: "58px", d: "140ms", s: 4 },
  { dx: "176px", dy: "44px", d: "100ms", s: 5 },
  { dx: "-30px", dy: "-186px", d: "160ms", s: 4 },
  { dx: "36px", dy: "-176px", d: "130ms", s: 6 },
];

/**
 *
 *
 *
 */
export function Case({ phase, value, deck, size = 340, onClick, risk = false, vault, skin, art }: Props) {
  const still = useReducedMotion();
  const spec = phase === "opened" && value != null ? specOf(value, deck) : null;
  const clickable = Boolean(onClick) && phase === "idle";
  const won = Boolean(spec && (spec.tickets > 0 || isVault(spec)));
  const paid = spec ? (risk ? spec.tickets * 2 : spec.tickets) : 0;

  if (phase === "waiting") {
    return (
      <div
        className="grid w-full place-items-center"
        style={{ maxWidth: size, aspectRatio: "1 / 1" }}
      >
        <ChestWaiting size={size * 0.82} />
      </div>
    );
  }

  return (
    <div
      className="relative grid w-full place-items-center"
      style={{ maxWidth: size, aspectRatio: "1 / 1" }}
    >
      {spec && !still && (
        <motion.div
          aria-hidden
          key={spec.name}
          className="pointer-events-none absolute rounded-full"
          style={{
            width: size,
            height: size,
            background: `radial-gradient(closest-side, ${spec.ink}, transparent 66%)`,
            filter: "blur(28px)",
            animation: `${won ? "burst-win" : "burst-empty"} 1.1s ease-out both`,
          }}
        />
      )}

      {won &&
        !still &&
        SHARDS.map((s, i) => (
          <span
            key={i}
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 rounded-[2px]"
            style={
              {
                "--dx": s.dx,
                "--dy": s.dy,
                width: s.s,
                height: s.s,
                background: spec!.ink,
                boxShadow: `0 0 12px ${spec!.ink}`,
                animation: `shard-pop 1.15s var(--ease-out-expo) ${s.d} both`,
              } as React.CSSProperties
            }
          />
        ))}

      <motion.button
        type="button"
        onClick={clickable ? onClick : undefined}
        disabled={!clickable}
        aria-label={
          spec
            ? `Opened: ${spec.name}${spec.tickets > 0 ? `, ${ticketsLabel(paid)}` : ""}`
            : clickable
              ? "Open this case"
              : "A sealed case"
        }
        className="relative grid place-items-center disabled:cursor-default"
        style={{ marginBottom: spec ? size * 0.18 : 0 }}
        whileHover={clickable ? { y: -10, scale: 1.05 } : undefined}
        whileTap={clickable ? { y: 3, scale: 0.98 } : undefined}
        transition={{ duration: 0.3, ease: [0.16, 0.84, 0.28, 1] }}
      >
        <motion.div
          className="relative"
          key={spec?.name ?? "sealed"}
          initial={spec ? { scale: 0.8, opacity: 0 } : false}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.55, ease: [0.34, 1.3, 0.5, 1] }}
        >
          {spec ? (
            <Chest rarity={spec.rarity} size={size * 0.86} open />
          ) : (
             *
             *
            <DeckHero deck={deck} size={size * 0.8} skin={skin} art={art} />
          )}



          {spec && won && !still && (
            <Prize
              spec={spec}
              paid={paid}
              vault={vault}
              size={size * 0.62}
              className="absolute left-1/2 top-1/2"
              style={{ animation: "prize-rise 1.1s var(--ease-out-expo) 380ms both" }}
            />
          )}
        </motion.div>
      </motion.button>

      {spec && (
        <motion.div
          className="absolute inset-x-0 bottom-0 text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
        >
          <div className="t-inscription text-xs" style={{ color: spec.ink }}>
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
