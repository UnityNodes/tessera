"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { animate, useMotionValue, useTransform, motion, useReducedMotion } from "motion/react";
import {
  slotsPerTier,
  specFor,
  specOf,
  isPrize,
  VAULT_SPEC,
  type TierSpec,
  type DeckShape,
} from "@/lib/deck";
import { Chest } from "./Chest";

/**
 * How many times a roll with this handle has mounted.
 *
 * The counter is MODULE level on purpose: a ref inside the component dies
 * with it, that is, the very thing to be proven is what it would not see.
 * The traces said "stalls 1" on every strip and not a single "landed on",
 * with zero aborted, which is either a remount or an effect that never
 * fired. Only this number tells one from the other.
 */
const mounts = new Map<string, number>();
import type { PoolState } from "@/hooks/usePool";

/**
 * Card size.
 *
 * It was 104 at a strip width of 420: three cards across a seven hundred
 * pixel panel, that is, an item half the size of the emptiness around it.
 * The strip IS the event of this screen, so it now spans the full width of
 * the panel, and the card is sized so that both the crate and its tier can
 * be read on it.
 */
const ITEM = 168;
const GAP = 14;
const STEP = ITEM + GAP;

/**
 * How the strip runs: a short throw, then STEADY, without decay.
 *
 * Until now it went along a single long curve that decayed from the first
 * second. The intent was honest, not to promise a time we do not know. On
 * screen the opposite happened. Counted off the curve itself: 41 cards per
 * second at the start, 10 at the sixth second, 7 at the ninth. That is,
 * exactly when the covalidators hand the value over, the strip is already
 * barely crawling, and braking takes its distance from speed, so out of
 * seven cards per second it comes out three cards long and reads not as a
 * stop but as a twitch.
 *
 * A steady run promises nothing: it is the same at the sixth second and at
 * the thirtieth. The only promise is the START of braking, and it arrives
 * exactly when the value really did, not a moment sooner.
 *
 * The throw brings the strip out of rest and ends exactly at the cruise
 * speed: the curve is chosen so that its derivative at the end equals one
 * (y2 = x2), which is why the switch to the steady run cannot be seen.
 */
const CRUISE = 13;
const RAMP_S = 0.8;
/** How long the steady run lasts. Longer than any wait. */
const RUN_S = 240;

/**
 * How many copies of the strip we draw.
 *
 * Three, not five. What goes to the screen is not x but x modulo the length
 * of one copy, so however far the strip travels the visible part stays
 * within two copies; the third is slack for what shows to the left of the
 * marker. The other two were insurance against running past its own tail,
 * and there is no longer any way to run past it.
 */
const COPIES = 3;

/**
 * How many times the initial braking speed exceeds the average one.
 * For a quadratic ease out, exactly twice: motion that starts at V and
 * decays to zero covers half of what it would at a constant V in the same
 * time.
 */
const DECAY = 2;

/**
 * The minimum number of cards braking skips before it starts looking for
 * the one it needs.
 *
 * It cannot be fewer: the target card must be OUTSIDE the visible window at
 * the moment the answer arrives, otherwise the player sees the strip taking
 * aim. Seven or eight tiles are visible, that is, four to the right of the
 * marker.
 */
const MIN_REACH = 5;

/**
 * The minimum time the theatre holds the roll frame.
 *
 * This used to be the braking DURATION, which is exactly why it was fixed.
 * The duration is now computed from the distance, and this number stayed on
 * as a lower bound for the theatre, so that the result does not flash before
 * the eye has caught the stop.
 */
export const SETTLE_MS = 950;

/**
 * The roll.
 *
 * The covalidators hand over a value in 5.9 to 8.6 seconds, and those
 * seconds have to be waited out either way. That is exactly how long a roll
 * lasts in a case opener, so the dead wait becomes the film.
 *
 * Nothing here is faked. The result arrives from the chain and only then
 * does the strip brake onto it, not the other way round. And the contents
 * of the strip are not invented: the items appear in the proportion they
 * ACTUALLY still hold in the pool, so porphyry flies past you exactly as
 * rarely as there is porphyry left.
 *
 * While there is no result the strip runs evenly and endlessly. That is the
 * honesty of it: it promises nothing about the time, because we do not know it.
 */
export function Roll({
  running,
  landedValue,
  deck,
  pool,
  urgency = 0,
  variant = 0,
  length = 72,
  onLanded,
  id,
}: {
  /** The slot handle. Needed to count mounts of this particular roll. */
  id?: string;
  running: boolean;
  /**
   * The slot number that dropped. undefined until the chain answers.
   *
   * The number itself, not a ready TierSpec. The parent used to compute the
   * tier through specOf() right in the render, that is, returned a NEW
   * object every time, and the effect subscribed to it fired on every render
   * of the page. A number stays the same number however many times the page
   * repaints.
   */
  landedValue?: number;
  /**
   * The showcase offset. Needed when there are several strips.
   *
   * Ten identical strips look like one strip copied ten times, and read as a
   * fake even though there is no fake there. So the contents ROTATE rather
   * than being shuffled at random: the proportion of tiers stays exactly the
   * one in the pool, only the point the showcase starts from changes. It is
   * the same showcase from a different place, not a different showcase.
   */
  variant?: number;
  /**
   * How many tiles are in the strip.
   *
   * Ten strips of seventy two tiles each is seven hundred and twenty nodes
   * with glows and shadows all moving at once; the browser noticeably sags
   * on that. A shorter strip looks the same (seven or eight tiles are
   * visible at a time) and costs three times less.
   */
  length?: number;
  /** Called when the strip has REALLY stopped. */
  onLanded?: () => void;
  /** The drop table, known from the contract right away. */
  deck: DeckShape;
  /** What is left of what. May not be counted yet, then it is simply absent. */
  pool?: PoolState;
  /**
   * How long we have been waiting: 0 is not waiting, 3 is a long time.
   *
   * The rise is shown by the marker, not by the strip itself. You cannot
   * shake something that is already travelling horizontally: two motions in
   * one element add up, and instead of tension you see a twitch.
   */
  urgency?: 0 | 1 | 2 | 3;
}) {
  const still = useReducedMotion();
  const x = useMotionValue(0);

  useEffect(() => {
    if (!id) return;
    const n = (mounts.get(id) ?? 0) + 1;
    mounts.set(id, n);
    box.current?.setAttribute("data-mounts", String(n));
  }, [id]);

  const box = useRef<HTMLDivElement>(null);
  // Run counters. Braking must happen EXACTLY ONCE per open; if it is
  // restarted, the previous animation dies without onComplete, and the strip
  // stays where it was cut off.
  const runs = useRef({ drift: 0, settle: 0, cut: 0 });
  /** Whether braking is running. While it runs we do not touch the position. */
  const settling = useRef(false);
  /**
   * The live drift, so that it can be stopped by more than the cleanup.
   *
   * An effect cleanup only fires when React decides to restart the effect. If
   * the subtree was remounted, the old drift stops together with the old
   * component. But within a single component, between "the value arrived" and
   * "the effect restarted", there is a window in which the drift is still
   * writing to x. That is what overrode the position just set: the strip
   * jumped from the correct card to a random one.
   */
  const drifting = useRef<{ stop: () => void } | null>(null);
  /**
   * Where the strip MUST land. Braking writes it, the safety net reads it.
   *
   * One number shared by two, and that is the whole point. Until now the
   * safety net looked for the required tier in the strip AGAIN, and found a
   * different instance of it: there are several of each tier in the strip,
   * findIndex returns the first, and braking travelled to whichever one it
   * met on the way. Both cards are correct, the places differ. Measured on a
   * live batch of ten: the strip landed on the 47th and ONE frame later found
   * itself on the 12th, a jump of 2002 pixels, and that on five strips out of
   * six. This is exactly the "looks like it stopped, then it twitches and
   * shows something else".
   *
   * The check stayed silent because it compares the TIER under the marker,
   * and the jump does not change the tier, only the card it is written on.
   */
  const endAt = useRef<number | null>(null);

  // The strip contents come from what is STILL in the pool. Rebuild only when
  // the pool changed: otherwise the strip would jump on every render.
  const key = `${deck.tiers.length}|${deck.vaultUpTo}|${variant}|${length}|${pool?.tiers.map((t) => `${t.weight}:${t.left}`).join(",") ?? ""}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const built = useMemo(() => buildStrip(deck, pool, variant, length), [key]);

  /**
   * The contents lock, taken at the START of the roll rather than on landing.
   *
   * It used to be set at the end, and while there was no result the strip
   * "showed the current pool". On a single case that is barely visible: the
   * pool changes once, and usually after the stop. In a batch it shows up
   * immediately and ugly.
   *
   * The mechanics of the fault. `built` is rebuilt every time the key
   * changes, and the key contains `pool.tiers` with their `left`. A batch of
   * ten opens decreases the remainders ten times, and every such update
   * rebuilds the contents, in a different order, because the showcase is
   * shuffled. Meanwhile the strip is moving: x is continuous, and the tiles
   * under the marker CHANGE. On screen this is exactly what people complain
   * about: "it looks like it should stop, and it twitches and picks
   * something". The logic is sound all the while: the landing is decided by
   * the chain, and the e2e batch confirmed it every time. It measures WHERE
   * the strip landed, not what it showed along the way.
   *
   * Now the contents are taken once, when the roll began, and live to the
   * end. This is also more honest: the showcase shows the pool as it was at
   * the moment the player pressed, not as their own opens made it while they
   * were in flight.
   *
   * The state is fixed right in the render rather than in an effect: this is
   * exactly the case React keeps that pattern for, derived state that changes
   * along with a prop. In an effect it would cost an extra frame, on which
   * the strip would manage to show the already rebuilt contents.
   */
  const [locked, setLocked] = useState<TierSpec[] | null>(null);

  if (running && locked === null) {
    setLocked(built);
  } else if (!running && landedValue == null && locked !== null) {
    // The roll is over and a new one has not started, so release it, to let
    // the next open take a fresh pool.
    setLocked(null);
  }

  const base = locked ?? built;

  /**
   * The second lock, on landing.
   *
   * It stays separate from the first because it does something else: it adds
   * to the strip exactly the card the chain handed over (`withLanded`) and
   * ties it to the value. Without it braking could look for a tier the
   * showcase does not have.
   */
  const [frozen, setFrozen] = useState<{ value: number; strip: TierSpec[] } | null>(null);

  if (landedValue != null && frozen?.value !== landedValue) {
    setFrozen({ value: landedValue, strip: withLanded(base, specOf(landedValue, deck)) });
  } else if (landedValue == null && frozen !== null) {
    setFrozen(null);
  }

  const strip = frozen?.strip ?? base;

  /**
   * The position folded into the bounds of a single copy.
   *
   * The copies of the strip are identical, so a shift by a whole copy changes
   * nothing on screen, but it is exactly what saves us from a class of bugs
   * that is otherwise impossible to root out. The drift writes to x, braking
   * writes to x, effects restart, and any of those forces can carry the strip
   * past its own tail: measured x = -414,820 at a strip length of 65,506,
   * that is, an empty screen with the marker alone, and then suddenly a chest.
   *
   * Here that becomes impossible by construction: however much accumulates in
   * x, what goes to the drawing is the remainder of the division. The card
   * under the marker is the same one all the while, since the copies are
   * identical.
   */
  const copyW = strip.length * STEP;
  const wrapped = useTransform(x, (v) => (copyW > 0 ? (v % copyW) - copyW : v));

  // Put the strip at the middle of a copy rather than at its start.
  //
  // Position zero meant "the first card under the marker", that is, there was
  // nothing to the left of the marker: half the panel stood empty and the
  // strip read as cropped. There are three copies, so we start from the
  // second; then you see in both directions and the loop closes just as
  // seamlessly.
  //
  // But the second copy exactly is where you must not land. buildStrip lays
  // the tiers out starting from the rarest, and the zeroth in the strip is the
  // vault, that is, at rest the gold crate systematically sat under the bright
  // marker. Nothing had been opened, and the screen showed the biggest prize
  // of the deck "in the crosshairs"; the player read that as a result and did
  // not understand why grey came next. So at rest the empty tier stands under
  // the marker: there really is nothing there, and it should look like it.
  //
  // And only AT REST. This effect depends on the strip contents, and the
  // contents are re-read during the wait itself: the pool updates in the
  // background, `strip` becomes a new object, the effect fires a second time,
  // and it yanks x mid motion. On screen that is exactly what is seen as
  // "jumps and jumps over": the strip drops back into the start position for a
  // moment and flies on from a different place.
  useEffect(() => {
    if (landedValue != null || running || !strip.length) return;
    const empty = strip.findIndex((s) => !isPrize(s));
    x.set(-STEP * (strip.length + (empty >= 0 ? empty : 0)));
  }, [strip, landedValue, running, x]);

  // Evenly and endlessly while the chain is silent: no acceleration and no
  // slowdown, because neither would be the truth about the time remaining.
  //
  // The animation is stopped by the effect cleanup. Before, nobody stopped it:
  // it stayed spinning forever and fought braking over the same value.
  useEffect(() => {
    if (still || !running || landedValue != null) return;

    // Before every drift, fold the position into the bounds of one copy.
    //
    // Without this, an effect that restarted (and it does restart, the pool is
    // re-read during the wait itself) took the already travelled distance as
    // the start and added another two hundred steps to it. Measured: x =
    // -30,689 at the fifth second, -406,107 at the seventh, at a strip length
    // of 65,506. That is, the strip flew past its own tail, and the player saw
    // an empty screen with the marker alone, and then suddenly a chest.
    //
    // The copies are identical, so the folding is invisible: under the marker
    // stays the same card we started from.
    const copy = strip.length * STEP;
    const from = -(Math.abs(x.get()) % copy) - copy;
    x.set(from);

    runs.current.drift++;
    box.current?.setAttribute("data-drifts", String(runs.current.drift));

    // Two segments in one animation: the throw and the steady run.
    //
    // The throw covers exactly the distance the steady run would cover in the
    // same time. It has to start from zero, so inside it the strip moves at
    // about one and a half times the cruise speed, and that is what reads as a
    // throw. At the end of the segment the speed is exactly cruise, so the
    // seam cannot be seen.
    //
    // The distance is not otherwise bounded: what goes to the screen is the
    // remainder of the division by the copy length, not x itself. However much
    // accumulates, the same card is under the marker, because the copies are
    // identical.
    const speed = STEP * CRUISE;
    const drift = animate(
      x,
      [from, from - speed * RAMP_S, from - speed * (RAMP_S + RUN_S)],
      {
        duration: RAMP_S + RUN_S,
        times: [0, RAMP_S / (RAMP_S + RUN_S), 1],
        ease: [[0.55, 0, 0.6, 0.6], "linear"],
      },
    );
    drifting.current = drift;
    return () => {
      drifting.current = null;
      drift.stop();
    };
    // strip.length is deliberately absent from the dependencies: it is
    // constant, and an extra restart of the drift is exactly what broke the
    // strip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, landedValue, x, still]);

  // Braking, exactly once per open.
  //
  // The effect key is the slot number alone. The strip is deliberately absent
  // from the dependencies: by the time the effect runs it is already frozen
  // above, and the effect must NOT fire on its rebuild, which is exactly what
  // pushed the target +12 cards further away every time.
  useEffect(() => {
    if (landedValue == null) return;
    // Kill the drift FIRST: otherwise it keeps writing to the same value and
    // braking competes with it for every frame.
    drifting.current?.stop();
    drifting.current = null;
    const items = frozen?.strip ?? base;
    const target = specOf(landedValue, deck).name;
    const len = items.length;

    // For a player who turned animations off the strip was not moving at all,
    // so there is nothing to brake: put it on the right card and be done.
    // Before, this case fell through to the safety net below, and that is
    // where it computed the target its own way.
    if (still) {
      const at = items.findIndex((it) => it.name === target);
      if (at < 0) return;
      const end = -((at + len) * STEP);
      endAt.current = end;
      x.set(end);
      box.current?.setAttribute("data-endx", String(at + len));
      onLanded?.();
      return;
    }

    // How many cards are left to the one we need, and how much time they take.
    //
    // Here was the last and most stubborn part of "it twitches". The braking
    // duration was FIXED (950 ms) and the distance was not: the strip lays the
    // tiers out in a cycle of a dozen, and the nearest card of the needed tier
    // turns up sometimes six steps away and sometimes seventeen. Same time,
    // three times the path, therefore braking STARTED three times faster than
    // the run. The strip visibly accelerated at exactly the moment it was
    // supposed to start stopping.
    //
    // Worst of all on the rare ones: emptiness turns up four times per dozen
    // and the vault once, so the ugliest jerk went to whoever drew the best.
    //
    // Now it is the other way round: the distance is what it is, and the time
    // is computed from it. Motion that starts at speed v and decays evenly to
    // zero covers v*T/2, hence T = 2*d/v. Together with a curve whose starting
    // derivative is exactly twice the average, this gives a pickup WITHOUT a
    // jump at any distance: braking always begins at exactly the speed the
    // strip was just travelling at.
    //
    // The price is a floating duration, from 0.6 to 2.3 seconds. That is not a
    // fault, it is how inertia behaves: a longer path takes longer to damp.
    // But because of it the theatre NO LONGER moves to the result on a timer,
    // it waits for a signal from the strip itself.
    const from = Math.abs(x.get()) / STEP;
    let idx = Math.ceil(from + MIN_REACH);
    for (let i = 0; i < len; i++) {
      if (items[(idx + i) % len].name === target) {
        idx += i;
        break;
      }
    }
    const dist = idx - from;
    const dur = (DECAY * dist) / CRUISE;

    box.current?.setAttribute("data-reach", String(Math.round(dist)));
    box.current?.setAttribute("data-dur", String(Math.round(dur * 1000)));
    // A trace for checking: what exactly braking ordered. The target in steps,
    // the strip length, and the tier that must end up under the marker.
    // Without those three numbers "it landed on the wrong one" is a guess, not
    // a diagnosis.
    box.current?.setAttribute("data-idx", String(idx));
    box.current?.setAttribute("data-len", String(len));
    box.current?.setAttribute("data-want", String(items[idx % len]?.name ?? "?"));
    runs.current.settle++;
    box.current?.setAttribute("data-settles", String(runs.current.settle));
    const end = -(idx * STEP);
    endAt.current = end;

    /**
     * The end of the roll, once and for certain.
     *
     * The target is computed correctly: in the trace `data-want` always equals
     * what the chain handed over. What did not arrive was the ANIMATION
     * itself: measured on a live batch of ten, `data-endx` appeared on not a
     * single strip with `drifts 1, brakes 1, aborted 0`. That is, nobody
     * restarted it and nobody aborted it, it simply never reported the end.
     *
     * There were two consequences, and both are visible on screen: the strip
     * stayed between cards (hence "it twitches and picks something"), and the
     * theatre did not move to the result, because it was waiting for exactly
     * that signal.
     *
     * So the position is set by number, not by animation alone. The animation
     * stays what it should be, a way to GET there; where exactly to land is
     * decided by the chain, and that number is now written for certain.
     */
    /**
     * Only something that was moving can be braked.
     *
     * If there was no drift on this mount, the strip did not move here at all:
     * either the answer is already known (we came back to an opened theatre)
     * or the component was just remounted. In that case there is nothing to
     * animate, the result is already there, and it is the result that should
     * be shown, not an arrival out of nowhere.
     *
     * This is also the only thing that survives a remount. Measured on a live
     * batch of ten: `data-settles` equalled one on every strip, and `data-endx`
     * did not appear even after sixteen seconds, that is, the effect started
     * over on a new element each time and never reached the end. Setting the
     * position directly does not depend on that: it happens in the same frame.
     */
    let done = false;
    settling.current = true;
    const finish = () => {
      if (done) return;
      done = true;
      settling.current = false;
      x.set(end);
      box.current?.setAttribute("data-endx", String(idx));
      onLanded?.();
    };

    if (runs.current.drift === 0) {
      finish();
      return;
    }

    const settle = animate(x, end, {
      duration: dur,
      ease: [0.33, 0.66, 0.66, 1],
      // Whoever waits for the stop learns of it FROM HERE, not from the open
      // phase. The phase becomes "done" as soon as the chain hands the value
      // over, and the strip brakes for almost another second after that. The
      // batch theatre used to switch the frame by phase and showed the result
      // over strips that were still moving.
      onComplete: finish,
    });

    // Insurance for the case where the animation never reported. It costs no
    // extra frames: if onComplete fired, `done` is already set.
    const guard = setTimeout(() => {
      settle.stop();
      finish();
    }, dur * 1000 + 150);
    return () => {
      runs.current.cut++;
      box.current?.setAttribute("data-cut", String(runs.current.cut));
      clearTimeout(guard);
      settling.current = false;
      settle.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landedValue, still, x]);

  /**
   * The safety net: the strip must STAND where braking put it, and not move
   * from that place afterwards.
   *
   * The effect deliberately has NO dependency list: it runs after every
   * commit. There are plenty of commits after the stop: every strip of the
   * batch reports its landing to the theatre, and the theatre repaints all the
   * others.
   *
   * It NO LONGER computes the target. Computing it a second time was the fault
   * itself: braking travels to the card it met on the way, while the safety
   * net looked for the first instance of the same tier in the strip, a
   * different card, the same tier. Now both take one number from endAt, and
   * after the stop there is nowhere to move from and nowhere to move to.
   */
  useEffect(() => {
    if (landedValue == null) {
      endAt.current = null;
      return;
    }
    if (settling.current) return;
    const end = endAt.current;
    if (end == null) return;
    drifting.current?.stop();
    drifting.current = null;
    if (Math.abs(x.get() - end) > 0.5) {
      x.set(end);
      // A trace for checking: the safety net fired, that is, braking did not
      // arrive by itself. Empty on a healthy run.
      box.current?.setAttribute("data-fix", "1");
    }
  });


  return (
    <div
      ref={box}
      data-roll
      // What the strip MUST land on, according to the chain. The attribute
      // exists for checking: this project has already had the strip brake onto
      // the wrong card with no error surfacing anywhere, neither in the console
      // nor in the tests. Now the expected and the actual can be compared from
      // outside, without looking into React state.
      data-landed={landedValue != null ? specOf(landedValue, deck).name : ""}
      className="relative w-full overflow-hidden"
      style={{
        height: ITEM + 36,
        maskImage:
          "linear-gradient(90deg, transparent 0%, black 11%, black 89%, transparent 100%)",
      }}
    >
      {/* The marker is a glowing full height line with two points, as in the
          reference. The line points at the card itself rather than at the border
          between cards, and it is the card that has to be shown here.

          At rest the marker is dimmed: a bright line reads as a sight trained on
          the result, and while nothing has been opened there is no result, and
          it cannot be feigned. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-1/2 z-20 -translate-x-1/2 transition-opacity duration-300"
        style={{ opacity: landedValue != null ? 1 : running ? 0.75 : 0.3 }}
      >
        <span
          className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 transition-shadow duration-700"
          style={{
            background: "var(--color-accent-hover)",
            boxShadow:
              landedValue != null
                ? "0 0 15px 1px var(--color-accent)"
                : urgency > 0
                  ? `0 0 ${urgency * 9}px ${urgency}px var(--color-accent)`
                  : "none",
            // The pulse only on the last step, where it means "any moment
            // now" rather than just "something is happening".
            animation: urgency >= 3 ? "marker-live 0.8s ease-in-out infinite" : undefined,
          }}
        />
        <span
          className="absolute left-1/2 top-0 -translate-x-1/2 border-x-8 border-t-8 border-x-transparent"
          style={{ borderTopColor: "var(--color-accent-hover)" }}
        />
        <span
          className="absolute bottom-0 left-1/2 -translate-x-1/2 border-x-8 border-b-8 border-x-transparent"
          style={{ borderBottomColor: "var(--color-accent-hover)" }}
        />
      </div>

      {/* The edges fade with a mask rather than an overlay in the panel colour:
          the panel is translucent, so a fill in the same colour would leave two
          matte rectangles at the edges instead of a fade. */}
      <motion.div
        className="absolute top-[18px] flex"
        style={{ x: wrapped, gap: GAP, left: `calc(50% - ${ITEM / 2}px)` }}
      >
        {Array.from({ length: COPIES }, () => strip)
          .flat()
          .map((spec, i) => (
            <Item key={i} spec={spec} />
          ))}
      </motion.div>
    </div>
  );
}

/**
 * A card in the strip, the case render itself rather than a coloured
 * rectangle.
 *
 * The bottom edge of the rarity colour stays: it reads in peripheral vision
 * when the strip moves too fast to make out the picture.
 */
function Item({ spec }: { spec: TierSpec }) {
  const prize = isPrize(spec);
  return (
    <div
      data-roll-item
      data-tier-name={spec.name}
      className="relative shrink-0 overflow-hidden rounded-[var(--radius-control)] bg-slate-900"
      style={{
        width: ITEM,
        height: ITEM,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: `color-mix(in oklab, ${spec.ink} ${prize ? 70 : 30}%, transparent)`,
        boxShadow: prize
          ? `0 0 30px -8px color-mix(in oklab, ${spec.ink} 70%, transparent)`
          : undefined,
      }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-2 grid place-items-center">
        <Chest rarity={spec.rarity} size={ITEM - 62} />
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 to-transparent px-2 pb-2 pt-4 text-center">
        <div className="truncate text-xs font-bold" style={{ color: spec.ink }}>
          {spec.name}
        </div>
        {spec.tickets > 0 && (
          <div className="t-chain text-xs font-bold" style={{ color: spec.ink }}>
            +{spec.tickets}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The strip contents.
 *
 * This is a showcase, not a probability table. In the pool 88 slots out of 100
 * are worth nothing, and if the strip were drawn in that proportion an even
 * grey fence would ride past the player: no "almost got it", no reason to
 * watch. So the rare things are shown here more often than they occur, exactly
 * as in any case opener.
 *
 * That is not a deception as long as two conditions hold, and both hold: the
 * landing is decided by the chain, not by the strip; and the real odds are
 * written next to it in numbers anyone can recompute themselves. The strip
 * adds tension, the counter tells the truth.
 *
 * A tier that is no longer in the pool disappears from the strip, otherwise it
 * would tease with something that no longer exists.
 */
/**
 * A keyed shuffle, so that two strips do not coincide and a run stays
 * reproducible. Math.random will not do here: it would reshuffle the showcase
 * on every repaint of the page.
 */
function shuffle<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function buildStrip(deck: DeckShape, pool?: PoolState, variant = 0, length = 72): TierSpec[] {
  const LENGTH = length;
  const grout = specFor(0);

  // The tiers come from the deck table: it is known from the contract right
  // away. The pool counter is computed in the background and deliberately
  // yields the road during an open, so it cannot be waited for here. That is
  // exactly why the strip once rode past as a solid grey fence.
  // The vault rides past too, even though it weighs zero: it is the deck's
  // main prize, and a strip without it shows the game poorer than it is.
  const fromDeck = slotsPerTier(deck).filter((t) => t.weight > 0 || t.spec.name === VAULT_SPEC.name);
  if (fromDeck.length === 0) return Array.from({ length: LENGTH }, () => grout);

  // If the pool has already been counted, remove what is no longer there:
  // teasing with a prize that has already been drawn would be dishonest.
  const exhausted = new Set(
    (pool?.tiers ?? []).filter((t) => t.left === 0).map((t) => t.weight),
  );
  const alive = fromDeck
    .filter((t) => !exhausted.has(t.weight))
    .map((t) => ({ spec: t.spec, weight: t.weight }));
  if (alive.length === 0) return Array.from({ length: LENGTH }, () => grout);

  // One showcase cycle: the more expensive the tier, the rarer it is in the
  // cycle, but every one of them can be seen.
  const cycle: TierSpec[] = [];
  // The vault goes first even though it weighs zero: it is the rarest, so it
  // must be the rarest in the cycle. By weight alone it would end up at the
  // tail and would flash by more often than anything else.
  const rank = (t: { spec: TierSpec; weight: number }) =>
    t.spec.name === VAULT_SPEC.name ? Infinity : t.weight;
  const sorted = [...alive].sort((a, b) => rank(b) - rank(a));
  const perCycle = sorted.map((t, i) => ({ spec: t.spec, times: i === 0 ? 1 : i === 1 ? 2 : 3 }));

  const CYCLE = 12;
  for (const p of perCycle) for (let i = 0; i < p.times; i++) cycle.push(p.spec);

  // The empty tier is a full member of the cycle, not filler for the tail.
  //
  // It was `while (cycle.length < CYCLE)`, that is, grout got into the strip
  // only when there was room left. In a deck with a full ladder (vault plus
  // four ticket tiers) the sum 1+2+3+3+3 equals exactly twelve, and there was
  // NO room left at all. Measured in the browser on deck #3: the roll strip
  // held five different cards and not one grout among them.
  //
  // The consequence is not cosmetic. Braking looks in the strip for a card of
  // the tier the chain handed over; failing to find one, it left the target
  // wherever inertia had carried it. That is, a player who drew emptiness, and
  // that is three cases out of four, saw "Denarius +1" or "Porphyry +5" under
  // the marker. The strip called a prize something that did not exist.
  const EMPTY_TIMES = 4;
  const empties = Math.max(EMPTY_TIMES, CYCLE - cycle.length);
  for (let i = 0; i < empties; i++) cycle.push(grout);

  // Spread the rare ones evenly so they do not clump together.
  const spread: TierSpec[] = new Array(cycle.length);
  let at = 0;
  for (const item of cycle) {
    while (spread[at] !== undefined) at = (at + 1) % spread.length;
    spread[at] = item;
    at = (at + 5) % spread.length;
  }

  // Rotation will not do, and I have already tried it: a rotated cycle is the
  // same pattern shifted by a few tiles. Ten strips side by side still read as
  // one wallpaper. So every strip is SHUFFLED with its own key.
  //
  // The shuffle is deterministic and does not touch the CONTENTS: the same set
  // of cards, the same proportion of tiers, only a different order. The pool
  // does not lie because of it, whereas "randomness" that is the same every
  // time lies about itself.
  const out: TierSpec[] = [];
  let cycles = 0;
  while (out.length < LENGTH) out.push(...shuffle(spread, variant * 7919 + cycles++ * 104729));
  return out;
}

/**
 * The strip is obliged to be able to stop on what the chain handed over.
 *
 * This is not a just in case guard but coverage of a reachable case: the strip
 * contents are built from WHAT IS STILL LEFT in the pool, and a tier with zero
 * left is removed from the strip on purpose, so as not to tease with a prize
 * that is gone. But whoever has just drawn the last porphyry will see a pool
 * without porphyry already: their own card disappears from the strip exactly
 * before the strip is due to brake onto it.
 *
 * So the invariant is held here, at the boundary: a frozen strip is guaranteed
 * to contain a card of the tier that dropped. We spread it every dozen, as
 * long as the showcase cycle, so braking will find it at the same distance as
 * any other tier.
 */
function withLanded(strip: TierSpec[], landed: TierSpec): TierSpec[] {
  if (strip.some((s) => s.name === landed.name)) return strip;
  const out = [...strip];
  for (let i = 0; i < out.length; i += 12) out[i] = landed;
  return out;
}
