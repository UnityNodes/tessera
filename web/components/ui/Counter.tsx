"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";

/**
 *
 *
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
