"use client";

import { useRef } from "react";
import { useReducedMotion } from "motion/react";

/**
 *
 */
export function Tilt({
  children,
  max = 9,
  className = "",
  sheen = true,
}: {
  children: React.ReactNode;
  max?: number;
  className?: string;
  sheen?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const light = useRef<HTMLSpanElement>(null);
  const still = useReducedMotion();

  const move = (e: React.MouseEvent) => {
    if (still || !box.current || !inner.current) return;
    const r = box.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    inner.current.style.transform = `rotateY(${(px - 0.5) * max * 2}deg) rotateX(${(0.5 - py) * max * 2}deg)`;
    if (light.current) {
      light.current.style.opacity = "1";
      light.current.style.background = `radial-gradient(38% 55% at ${px * 100}% ${py * 100}%, oklch(100% 0 0 / 0.16), transparent 70%)`;
    }
  };

  const leave = () => {
    if (!inner.current) return;
    inner.current.style.transform = "";
    if (light.current) light.current.style.opacity = "0";
  };

  return (
    <div
      ref={box}
      onMouseMove={move}
      onMouseLeave={leave}
      className={`scene ${className}`}
      style={{ perspective: 1100 }}
    >
      <div
        ref={inner}
        className="relative h-full transition-transform duration-500 ease-[var(--ease-out-expo)]"
        style={{ transformStyle: "preserve-3d" }}
      >
        {children}
        {sheen && (
          <span
            ref={light}
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[var(--radius-panel)] opacity-0 transition-opacity duration-300"
          />
        )}
      </div>
    </div>
  );
}
