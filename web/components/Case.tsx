"use client";

import { motion, useReducedMotion } from "motion/react";
import { Chest, ChestWaiting } from "./Chest";
import { DeckHero } from "./DeckHero";
import { Prize } from "./Prize";
import { specOf, isVault, isPrize, isShard, ticketsLabel, type DeckShape } from "@/lib/deck";

export type CasePhase = "idle" | "waiting" | "opened";

interface Props {
  phase: CasePhase;
  /** The slot's value. Present only when phase === "opened". */
  value?: number;
  deck: DeckShape;
  size?: number;
  onClick?: () => void;
  /** How much is in the deck's vault. Needed only when the vault is what dropped. */
  vault?: bigint;
  /**
   * The deck's skin. Applies to the SEALED chest only.
   *
   * Sealed is the case itself, and it has every right to look its own way. An
   * open one already shows the prize, and a prize is coloured by its rung: a
   * skin over it would misstate the rarity of what the person just drew.
   */
  skin?: string;
  /** The deck's uploaded picture. Applies the same way, to the sealed chest only. */
  art?: string;
}

/**
 * Shards flying out of an opened chest.
 *
 * The angles and distances come from a table rather than Math.random: random
 * numbers during a render would give different markup on the server and in the
 * browser, and React would throw a hydration error at the exact moment the
 * player is looking at their prize.
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
 * The case on the opening screen.
 *
 * Three phases, and the nature of time differs in each:
 *
 *   idle      the chest is locked and cold, its rarity still unknown
 *   waiting   two dashed rings turn towards each other, 5.9 to 8.6 s,
 *             and they can do so indefinitely
 *   opened    a flash, shards, and the chest of whatever rung dropped
 *
 * The ceiling on that time is not ours: there are two covalidators and the
 * quorum is 2 of 2. So the waiting phase has no percentage, no bar and no
 * countdown. The rings turn evenly and hint at nothing about what is left, which
 * is the only honest animation for a wait whose length you do not know.
 */
export function Case({ phase, value, deck, size = 340, onClick, vault, skin, art }: Props) {
  const still = useReducedMotion();
  const spec = phase === "opened" && value != null ? specOf(value, deck) : null;
  const clickable = Boolean(onClick) && phase === "idle";
  // isPrize rather than "tickets or vault". TESA gives zero tickets and is
  // still a prize, since five make a real ticket. As long as that check was
  // written inline here, a shard got the quiet flash of emptiness and not a
  // single shard of its own, which means the scene greeted a prize as a miss.
  // That is exactly why `lib/deck` has a shared `isPrize`.
  const won = Boolean(spec && isPrize(spec));
  const paid = spec ? spec.tickets : 0;

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
        // The main action of the case page is the chest itself. Inside the
        // button there is only an image with aria-hidden, so without a name it
        // was mute. The name changes with the state: before opening it is an
        // action, after it is a result.
        aria-label={
          spec
            ? `Opened: ${spec.name}${spec.tickets > 0 ? `, ${ticketsLabel(paid)}` : ""}`
            : clickable
              ? "Open this case"
              : "A sealed case"
        }
        className="relative grid place-items-center disabled:cursor-default"
        // After opening, the chest rises to make room for the caption:
        // otherwise "+5" lands right on the bottom face of the cube.
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
            /* Until the case is opened, THE SAME as on the catalogue tile.
             *
             * At first there was a single "sealed" chest here, an object the
             * game does not have at all. Then I replaced it with a single chest
             * of the best rung, which was closer and still not right: the tile
             * shows the LADDER, every rung of the deck, and the page showed one.
             * A person saw two chests in the catalogue and arrived at one, that
             * is, at a different thing.
             *
             * DeckHero is the same component as on the tile, and it works this
             * out itself: with its own picture it shows that, without one it
             * draws the ladder. */
            <DeckHero deck={deck} size={size * 0.8} skin={skin} art={art} />
          )}



          {spec && won && !isShard(spec) && !still && (
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
