"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";

/**
 * A number that travels to a new value rather than jumping to it.
 *
 * The counters in the header are the scoreboard of the game: how many cases are
 * open, how many players there are, how many are left. When someone opens a
 * case the number changes on its own, and a jump by one without motion is not
 * noticed at all. Here it travels and flashes for a moment, so the change is
 * visible even in peripheral vision, and that is the only signal that anyone is
 * in the game besides you.
 *
 * The first value is not animated. The data arrives from the chain after the
 * mount, and a count from zero on every page load would be a splash screen
 * rather than an event.
 */
export function Counter({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  className,
  style,
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const still = useReducedMotion();
  const [shown, setShown] = useState(value);
  const prev = useRef(value);
  const seeded = useRef(false);

  useEffect(() => {
    const from = seeded.current ? prev.current : value;
    prev.current = value;
    seeded.current = true;

    // Animate always, even when there is nowhere to travel: a branch with a
    // direct setShown() here would be a state call right inside an effect,
    // which react-hooks/set-state-in-effect rightly complains about.
    const controls = animate(from, value, {
      duration: still || from === value ? 0 : 0.7,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setShown(v),
    });
    return () => controls.stop();
  }, [value, still]);

  const text = shown.toFixed(decimals);

  return (
    <span className={className} style={style}>
      {prefix}
      {/* Keyed by the target value: React remounts the node on every change, and
          the css flash animation plays again with no extra state at all. */}
      <span
        key={value}
        style={
          still
            ? undefined
            : { display: "inline-block", animation: "count-bump 620ms var(--ease-out-expo)" }
        }
      >
        {text}
      </span>
      {suffix}
    </span>
  );
}
