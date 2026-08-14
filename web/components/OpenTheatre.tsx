"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Chest } from "./Chest";
import { Prize } from "./Prize";
import { Roll } from "./Roll";
import { specOf, isVault, isPrize, isShard, type DeckShape } from "@/lib/deck";
import type { OpenState } from "@/hooks/useOpenCase";
import type { PoolState } from "@/hooks/usePool";

/**
 * Opening, full screen.
 *
 * The main moment of the game used to happen inside a panel: the chest stood in
 * a frame, a strip spun beside it, a paragraph of text changed on the left.
 * Everything worked and nothing carried weight, because the frame was the same
 * one as a second earlier, and there was nowhere to take a pause for those six
 * to eight seconds.
 *
 * Here the frame changes completely. The page dims, the strip runs full screen,
 * and when the value arrives it brakes on the slot that dropped. Then comes the
 * chest of that rung, a column of light, and the prize rising through it.
 *
 * Three things deliberately NOT done here:
 *
 * There is no progress bar. The decryption happens in somebody else's service,
 * we do not know how long it will take, and any bar would be a lie about time.
 * Instead the marker's light grows: it reports "something is happening" and
 * promises nothing.
 *
 * The theatre does not trap you. Escape and a click on the backdrop close it at
 * any time; the slot is already drawn and paid for, so leaving the scene does
 * not mean losing the prize.
 *
 * The chest in the result frame is the same one that spun in the strip, only
 * open: the same angle, the lid thrown back, a column of light and tickets
 * inside. Which is why the transition reads as "it was opened" rather than as a
 * swapped picture.
 */

/** The natural height of one strip: ITEM plus the caption under it. */
const ROLL_H = 204;

/**
 * How much to shrink a strip when there are several.
 *
 * Computed from the window's REAL height rather than in steps by count. I did
 * try steps: 0.4 for a ten looked equally fine on a laptop and left half the
 * screen empty on a monitor, because ten strips is two thousand pixels, and how
 * many of them fit depends on the window rather than on the ten.
 *
 * Scaling hides nothing: the objects are the same and in the same proportion,
 * only smaller.
 */
function rollScale(n: number, viewport: number) {
  const room = viewport * 0.82 - 90; // minus the caption above and below
  return Math.max(0.26, Math.min(1, room / (n * (ROLL_H + 8))));
}

/** The phases in which the scene stands on screen. */
const LIVE = new Set(["confirming", "revealing", "landing", "done"]);

export function OpenTheatre({
  open,
  deck,
  pool,
  vault,
  onClose,
}: {
  open: OpenState;
  deck: DeckShape;
  /** How much is in the deck's vault. Needed only when the vault is what dropped. */
  vault?: bigint;
  /** How much of what is still in the pool: the strip is assembled from this. */
  pool?: PoolState;
  onClose: () => void;
}) {
  const still = useReducedMotion();
  const on = LIVE.has(open.phase);

  // The window height the strip scale is computed from. We listen for resize,
  // because the scene outlives one frame: a player may maximise the window
  // mid roll.
  // Which strips have ALREADY stopped, as a set of handles rather than a counter.
  //
  // Showing the result by phase is not allowed: the phase becomes "done" the
  // moment the chain returns a value, and the strips keep braking for almost a
  // second after that, so the cards landed on top of strips still moving.
  //
  // A set precisely because a counter would have to be reset between batches,
  // and a reset is a setState in an effect, that is, an extra cascade of
  // renders. A new batch brings new handles and the condition becomes false by
  // itself.
  const [landed, setLanded] = useState<Set<string>>(new Set());
  const allLanded = Boolean(open.batch?.every((b) => landed.has(b.handle)));
  /**
   * Whether the strip has stopped, in a single open too.
   *
   * The single theatre used to change the frame on a TIMER: the phase became
   * "done" SETTLE_MS after the value arrived. That worked exactly as long as
   * braking lasted a fixed 950 ms. Its duration is now computed from the
   * distance to the right card, from 0.6 to 2.3 seconds, and a timer would
   * disagree with the strip by a second and a half: the chest would open on top
   * of a strip still moving.
   *
   * So here and in a batch alike the frame is changed by the STRIP itself, when
   * it has really stopped.
   */
  const rollDone = open.batch ? allLanded : landed.has(open.handle ?? "single");

  const [vh, setVh] = useState(() => (typeof window === "undefined" ? 900 : window.innerHeight));
  useEffect(() => {
    const onResize = () => setVh(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const opened = open.phase === "done" && rollDone;

  /**
   * While the strip is moving the scene cannot be closed.
   *
   * The temptation to allow an exit at any time is understandable, since the
   * slot is paid for and cannot be lost. But the full screen roll is what the
   * player came for; leaving halfway means missing the one event of the game and
   * seeing the result as a line in a panel. So closing unlocks exactly when the
   * strip has stopped.
   */
  useEffect(() => {
    if (!on || !opened) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [on, opened, onClose]);

  const spec = opened && open.value != null ? specOf(open.value, deck) : null;
  const won = Boolean(spec && isPrize(spec));
  const paid = spec ? spec.tickets : 0;

  // The tension grows in steps rather than smoothly: three distinct levels read
  // as "it started / it is running / here it comes", while a smooth ramp over
  // eight seconds simply goes unnoticed.
  //
  // These steps used to shake the strip itself. Shaking something already moving
  // horizontally is not allowed: two motions in one element add up, and instead
  // of "here it comes" you see a rendering glitch. So the steps moved to the
  // marker, which stays put, and on it the growth reads.
  const tier =
    open.phase !== "revealing" || still ? 0 : open.waitedMs > 5200 ? 3 : open.waitedMs > 2400 ? 2 : 1;

  return (
    <AnimatePresence>
      {on && (
        <motion.div
          className="fixed inset-0 z-[var(--z-overlay)] grid place-items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.32, ease: [0.16, 0.84, 0.28, 1] }}
          onClick={opened ? onClose : undefined}
          style={{ cursor: opened ? "pointer" : "default" }}
          role="dialog"
          aria-modal="true"
          aria-label="Opening a case"
        >
          {/* The backdrop is not merely dark, it also blurs the page beneath it,
              otherwise the headings read through it and the scene stays an
              overlay rather than a frame of its own. */}
          <div
            className="absolute inset-0"
            style={{
              background: "color-mix(in oklab, var(--color-bg) 88%, transparent)",
              backdropFilter: "blur(18px) saturate(0.7)",
            }}
          />

          {/* The pillar of light from under the lid. Before the opening it does
              not exist at all.

              The gradient fades vertically, but horizontally it faded with
              nothing: twenty six pixels of blur on a strip thirty rem wide is
              not a fade but a slightly softer corner. On screen stood a green
              rectangle with visible sides. Now a mask eats the sides, and the
              strip really does read as a beam. */}
          <AnimatePresence>
            {opened && won && (
              <motion.div
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-0 h-full -translate-x-1/2"
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "min(30rem, 62vw)" }}
                transition={{ duration: 0.9, ease: [0.16, 0.84, 0.28, 1] }}
                style={{
                  background: `linear-gradient(to top, transparent, color-mix(in oklab, ${spec!.ink} 42%, transparent) 34%, transparent 92%)`,
                  filter: "blur(26px)",
                  maskImage:
                    "linear-gradient(to right, transparent, #000 32%, #000 68%, transparent)",
                  WebkitMaskImage:
                    "linear-gradient(to right, transparent, #000 32%, #000 68%, transparent)",
                }}
              />
            )}
          </AnimatePresence>

          {/* A batch is its own genre, not the same frame n times.
              A single open rests on the chest opening full screen once the strip
              has stopped: one thing, one moment. Ten such moments in a row are
              impossible, so what stays in a batch is the main thing, the roll,
              and it runs one strip per case. They brake together: the
              covalidators hand over every value in a single answer, and
              pretending they arrive one by one would add a lie to the one place
              in the game that fakes nothing. */}
          {open.batch ? (
            <div className="relative flex max-h-[80vh] w-full flex-col items-center gap-2 px-6 pb-8">
              <p className="t-label mb-1">
                {opened && allLanded
                  ? `${open.batch.length} cases opened`
                  : `opening ${open.batch.length} cases`}
              </p>
              {/* We do not rebuild the strip for a batch, we SCALE it.
                  All of its geometry, the step, the stop, the marker position,
                  is computed from the ITEM constant; touching that arithmetic
                  so that ten strips fit the window means risking the one
                  animation in the game that proves something. A CSS scale
                  changes nothing inside it. */}
              {opened && allLanded ? (
                /* The reveal moment for a batch.
                 *
                 * A single open has one: the strip stops and the chest opens
                 * full screen. A batch had nothing, the strips simply stopped
                 * and that was that. So it gets its own frame: the cards fly out
                 * in steps, each in its own colour, the empty ones dimmed. Not
                 * decoration: without that pause ten opens are
                 * indistinguishable from a failed click. */
                <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-4 px-2">
                  {open.batch.map((b, i) => {
                    const sp = b.value != null ? specOf(b.value, deck) : null;
                    const prize = Boolean(sp && isPrize(sp));
                    // The size comes from the count: two chests may be almost
                    // as large as in a single open, ten have to fit in a row.
                    // There are deliberately no frames around them: in x1 the
                    // object stands alone, and a square around it turned the
                    // event into a table.
                    const chest = Math.max(84, Math.min(260, Math.round(1180 / open.batch!.length)));
                    return (
                      <motion.div
                        key={i}
                        // A hook for the audit: the rung shown to the player.
                        // The grid computes it from `b.value` and animates
                        // nothing, so there is nothing here to drift.
                        data-opened={sp ? sp.name : ""}
                        initial={{ scale: 0.5, opacity: 0, y: 26 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        transition={{
                          delay: still ? 0 : i * 0.1,
                          duration: 0.55,
                          ease: [0.34, 1.3, 0.5, 1],
                        }}
                        className="flex flex-col items-center"
                      >
                        <span
                          className="relative grid place-items-center"
                          style={{ width: chest, height: chest }}
                        >
                          {prize && !still && (
                            <span
                              aria-hidden
                              className="pointer-events-none absolute rounded-full"
                              style={{
                                width: chest,
                                height: chest,
                                background: `radial-gradient(closest-side, ${sp!.ink}, transparent 66%)`,
                                filter: "blur(26px)",
                                opacity: 0.5,
                              }}
                            />
                          )}
                          <Chest
                            rarity={sp?.rarity ?? "sealed"}
                            size={chest}
                            open={Boolean(sp)}
                            className="relative z-10"
                          />
                        </span>
                        <span
                          className="t-chain -mt-1 text-sm font-bold leading-none"
                          style={{ color: sp?.ink ?? "var(--color-ink-dim)" }}
                        >
                          {sp ? sp.name : "…"}
                        </span>
                        {sp && sp.tickets > 0 && (
                          <span
                            className="t-chain mt-1 text-sm font-extrabold leading-none"
                            style={{ color: sp.ink }}
                          >
                            +{sp.tickets}
                          </span>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
              <div className="flex w-full flex-col items-center gap-2 overflow-y-auto">
                {open.batch.map((b, i) => (
                  <div
                    key={i}
                    className="w-full shrink-0"
                    style={{ height: ROLL_H * rollScale(open.batch!.length, vh) }}
                  >
                    <div
                      className="w-full origin-top"
                      style={{ transform: `scale(${rollScale(open.batch!.length, vh)})` }}
                    >
                      <Roll
                        running={open.phase !== "confirming"}
                        id={b.handle}
                        landedValue={b.value}
                        deck={deck}
                        pool={pool}
                        urgency={tier}
                        variant={i}
                        // A shorter strip in batches, and much shorter than it
                        // seems it should be.
                        //
                        // The strip is drawn COPIES times, so the tile count is
                        // five times its length. Measured: three strips of 40
                        // gave 780 tiles and 600 images on screen, and the frame
                        // rate fell to SEVEN. That is what looks like "jumping":
                        // not a logic failure but a shortage of frames.
                        //
                        // Seven or eight tiles are visible at a time, so a
                        // shorter strip takes nothing away except load.
                        length={open.batch!.length > 5 ? 12 : open.batch!.length > 2 ? 16 : 24}
                        onLanded={() => setLanded((s) => new Set(s).add(b.handle))}
                      />
                    </div>
                  </div>
                ))}
              </div>
              )}
              {opened && allLanded && (
                <button
                  type="button"
                  onClick={onClose}
                  className="t-label mt-2 cursor-pointer hover:text-[var(--color-accent-hover)]"
                >
                  click anywhere to close
                </button>
              )}
            </div>
          ) : (
          <div className="relative flex w-full flex-col items-center px-6 pb-10">
            {/* The strip runs first, and only when it has stopped does the chest
                open. This is a sequence, not two ways of showing one thing: the
                roll holds the six to eight seconds we cannot shorten, and the
                chest shows what came of them.

                That is also why the strip is no longer on the page: there it
                stood as a reference about the contents and took up half the
                screen, while it became an event for exactly two seconds of the
                whole session. */}
            {!opened ? (
              <div className="w-full">
                <Roll
                  running={open.phase !== "confirming"}
                  id={open.handle}
                  landedValue={open.value}
                  deck={deck}
                  pool={pool}
                  urgency={tier}
                  onLanded={() => setLanded((s) => new Set(s).add(open.handle ?? "single"))}
                />
              </div>
            ) : (
              <motion.div
                initial={{ scale: 0.72, y: 20, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                transition={{ duration: 0.65, ease: [0.16, 0.84, 0.28, 1] }}
                // The token lives here, inside the chest, rather than in the
                // scene's column. It used to be measured from the height of the
                // whole column, and that depends on how many lines the caption
                // under the chest takes, so on a long caption the prize started
                // from the front face instead of the interior.
                className="relative"
              >
                <div
                  style={{
                    animation:
                      opened && !won && !still ? "empty-sigh 1.9s ease-in-out 300ms both" : undefined,
                  }}
                >
                  <Chest rarity={spec?.rarity ?? "sealed"} size={520} open />
                </div>

                {/* The prize rises from inside: what the player came to take has
                    to come out of the chest rather than simply appear as a
                    caption under it. It starts where the tickets lie in the
                    picture and goes up along the same pillar of light that is
                    already drawn. The delay waits for the chest to arrive. */}
                {/* A shard carries no item out, and that is not a gap.
                    There is nothing to carry it with: exactly two things are
                    drawn, a ticket and a vault bag. Showing a whole ticket with
                    a zero on it would promise what the player does not have
                    yet; a shard becomes a ticket only as the fifth one. So only
                    the shards fly out of the chest, and the caption says the
                    rest. */}
                {won && !isShard(spec!) && (
                  <Prize
                    spec={spec!}
                    paid={paid}
                    vault={vault}
                    size={340}
                    className="absolute left-1/2 top-1/2"
                    style={{ animation: "prize-rise 1.15s var(--ease-out-expo) 620ms both" }}
                  />
                )}
              </motion.div>
            )}

            {/* The shards fly only when there is something to fly: an empty case
                does not explode, it simply opens. */}
            {opened && won && !still && <Shards ink={spec!.ink} />}

            <div className="relative mt-10 min-h-[9rem] text-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={open.phase}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.3 }}
                >
                  {opened && spec ? (
                    <>
                      {/* The number has already been lifted out of the chest on
                          the token, so what stands here is what the token does
                          not carry: the tier name. The same number twice side by
                          side adds nothing but noise. */}
                      {/* An empty case DOES NOT EXIST in an ordinary open.
                          The dollar bought a real Megapot ticket in that same
                          transaction, and it is already yours; the case comes on
                          top. So "empty" across the whole screen was simply
                          untrue: it said "you got nothing" to someone who had
                          just got a ticket.
                          "Empty" stays where it is honest: in a risk there is no
                          ticket, and there an empty slot really does mean
                          zero. */}
                      <p
                        className="t-display text-[clamp(2.4rem,6.5vw,4rem)] leading-none"
                        style={{
                          color: won ? spec.ink : "var(--color-accent)",
                          textShadow: `0 0 70px color-mix(in oklab, ${
                            won ? spec.ink : "var(--color-accent)"
                          } 65%, transparent)`,
                        }}
                      >
                        {won ? spec.name : "+1 real ticket"}
                      </p>
                      <p className="t-inscription mt-3 text-sm text-[var(--color-ink-dim)]">
                        {isVault(spec)
                          ? "everything the vault holds"
                          : isShard(spec)
                            ? "five make a real ticket"
                            : won
                              ? `${paid} real ticket${paid > 1 ? "s" : ""}`
                              : "the case added nothing on top · most do not"}
                      </p>
                      <p className="mt-5 text-sm text-[var(--color-ink-dim)]">
                        click anywhere to continue
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="t-inscription text-lg text-[var(--color-ink-dim)]">
                        {open.phase === "confirming"
                          ? "buying your ticket"
                          : "the covalidators are decrypting"}
                      </p>
                      {/* Three breathing dots instead of a progress bar:
                          exactly as much truth as we have about this time. */}
                      <span className="mt-4 flex justify-center gap-2">
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className="h-1.5 w-1.5 rounded-full"
                            style={{
                              background: "var(--color-accent-bright)",
                              animation: still
                                ? undefined
                                : `sealed-pulse 1.4s ease-in-out ${i * 0.18}s infinite`,
                            }}
                          />
                        ))}
                      </span>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Shards out of an opened chest.
 *
 * The angles and distances come from a table rather than Math.random:
 * random numbers at render time would give a different layout on the
 * server and in the browser, and React would throw a hydration error at
 * exactly the moment of the prize.
 */
const SHARDS = [
  { dx: -210, dy: -150, d: 0, s: 9 },
  { dx: 186, dy: -186, d: 40, s: 7 },
  { dx: -260, dy: -40, d: 80, s: 8 },
  { dx: 268, dy: -66, d: 20, s: 10 },
  { dx: -120, dy: -244, d: 110, s: 6 },
  { dx: 112, dy: -256, d: 70, s: 8 },
  { dx: -292, dy: 92, d: 140, s: 5 },
  { dx: 300, dy: 74, d: 100, s: 7 },
  { dx: -52, dy: -300, d: 160, s: 6 },
  { dx: 64, dy: -286, d: 130, s: 8 },
  { dx: -168, dy: 128, d: 180, s: 5 },
  { dx: 152, dy: 140, d: 120, s: 6 },
] as const;

function Shards({ ink }: { ink: string }) {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0">
      {SHARDS.map((s, i) => (
        <span
          key={i}
          className="absolute left-1/2 top-1/2 block"
          style={
            {
              width: s.s,
              height: s.s,
              background: ink,
              boxShadow: `0 0 ${s.s * 3}px ${ink}`,
              "--dx": `${s.dx}px`,
              "--dy": `${s.dy}px`,
              animation: `shard-pop 1.05s var(--ease-out-expo) ${s.d}ms both`,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}
