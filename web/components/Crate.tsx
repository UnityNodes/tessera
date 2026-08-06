"use client";

import { useId } from "react";
import { Chest } from "./Chest";
import type { Rarity } from "@/lib/deck";

export type { Rarity };

/**
 *
 *
 *
 */

const RATIO = 150 / 220;

export function Crate({
  rarity,
  size = 160,
  drift = false,
  open = false,
  className,
}: {
  rarity: Rarity;
  size?: number;
  drift?: boolean;
  open?: boolean;
  className?: string;
}) {
  //
  const uid = useId().replace(/:/g, "");
  const g = (n: string) => `${uid}-${n}`;

  if (!open) {
    return <Chest rarity={rarity} size={size} drift={drift} className={className} />;
  }

  const face = (l: string) => `oklch(from var(--metal) ${l} c h)`;
  const LINE = "var(--shell-line)";

  return (
    <svg
      data-tier={rarity}
      viewBox="0 0 220 150"
      width={size}
      height={Math.round(size * RATIO)}
      className={className}
      style={{
        display: "block",
        maxWidth: "100%",
        height: "auto",
        filter: "drop-shadow(0 0 calc(var(--glow, 0) * 22px) var(--metal))",
        animation: drift ? "crate-hover 4.4s ease-in-out infinite" : undefined,
      }}
      aria-hidden
    >
      <defs>
        <linearGradient id={g("front")} x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0" stopColor={face("var(--shell-top)")} />
          <stop offset="1" stopColor={face("var(--shell-front)")} />
        </linearGradient>
        <linearGradient id={g("side")} x1="0" y1="0" x2="1" y2="0.4">
          <stop offset="0" stopColor={face("var(--shell-front)")} />
          <stop offset="1" stopColor={face("var(--shell-side)")} />
        </linearGradient>
        <linearGradient id={g("lid")} x1="0.1" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={face("88%")} />
          <stop offset="0.5" stopColor={face("var(--shell-top)")} />
          <stop offset="1" stopColor={face("var(--shell-front)")} />
        </linearGradient>
        <linearGradient id={g("metal")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--metal-l)" />
          <stop offset="0.45" stopColor="var(--metal)" />
          <stop offset="1" stopColor="var(--metal-d)" />
        </linearGradient>
        <radialGradient id={g("cavity")} cx="0.5" cy="0.1" r="0.9">
          <stop offset="0" stopColor={face("28%")} />
          <stop offset="1" stopColor="oklch(12% 0.02 280)" />
        </radialGradient>
        <linearGradient id={g("ticket")} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="oklch(97% 0.012 85)" />
          <stop offset="1" stopColor="oklch(86% 0.03 80)" />
        </linearGradient>
        <radialGradient id={g("inner")} cx="0.5" cy="0.6" r="0.6">
          <stop offset="0" stopColor="var(--metal-l)" stopOpacity="0.85" />
          <stop offset="1" stopColor="var(--metal)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="110" cy="140" rx="76" ry="7" fill="black" opacity="0.55" style={{ filter: "blur(4px)" }} />

      {open ? (
        <>
          <g transform="translate(0 -6)">
            <path
              d="M40 40 A72 28 0 0 1 180 40 L180 28 A72 22 0 0 0 40 28 Z"
              fill={`url(#${g("lid")})`}
              stroke={LINE}
              strokeWidth="4"
              strokeLinejoin="round"
            />
            <path
              d="M70 22 A52 16 0 0 1 150 22"
              fill="none"
              stroke="var(--metal-l)"
              strokeWidth="3"
              opacity="0.7"
            />
          </g>

          <ellipse
            cx="110"
            cy="66"
            rx="82"
            ry="24"
            fill={`url(#${g("inner")})`}
            style={{ mixBlendMode: "screen" }}
          />

          <Tickets id={g("ticket")} line={LINE} />

          <path
            d="M24 78 L196 78 L190 128 A6 6 0 0 1 184 134 L36 134 A6 6 0 0 1 30 128 Z"
            fill={`url(#${g("front")})`}
            stroke={LINE}
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <ellipse
            cx="110"
            cy="78"
            rx="86"
            ry="11"
            fill={`url(#${g("cavity")})`}
            stroke={LINE}
            strokeWidth="4"
          />

          <rect x="26" y="96" width="168" height="10" rx="3" fill={`url(#${g("metal")})`} stroke={LINE} strokeWidth="2.5" />
          <rect x="28" y="116" width="164" height="10" rx="3" fill={`url(#${g("metal")})`} stroke={LINE} strokeWidth="2.5" />

          <Feet id={g("metal")} line={LINE} />
        </>
      ) : (
        <>
          <path
            d="M24 78 L196 78 L190 128 A6 6 0 0 1 184 134 L36 134 A6 6 0 0 1 30 128 Z"
            fill={`url(#${g("front")})`}
            stroke={LINE}
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path d="M196 78 L190 128 A6 6 0 0 1 184 134 L176 134 L182 78 Z" fill={`url(#${g("side")})`} />

          <rect x="26" y="94" width="168" height="11" rx="3" fill={`url(#${g("metal")})`} stroke={LINE} strokeWidth="2.5" />
          <rect x="28" y="116" width="164" height="11" rx="3" fill={`url(#${g("metal")})`} stroke={LINE} strokeWidth="2.5" />

          <path
            d="M24 78 L24 56 A86 34 0 0 1 196 56 L196 78 Z"
            fill={`url(#${g("lid")})`}
            stroke={LINE}
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path
            d="M48 54 A66 24 0 0 1 148 34"
            fill="none"
            stroke="var(--metal-l)"
            strokeWidth="5"
            strokeLinecap="round"
            opacity="0.5"
            style={{ filter: "blur(2px)" }}
          />
          <rect x="24" y="72" width="172" height="11" rx="3" fill={`url(#${g("metal")})`} stroke={LINE} strokeWidth="2.5" />

          <g>
            <rect
              x="94"
              y="82"
              width="32"
              height="30"
              rx="7"
              fill={`url(#${g("metal")})`}
              stroke={LINE}
              strokeWidth="2.5"
            />
            <circle cx="110" cy="93" r="4.5" fill={LINE} />
            <path d="M110 93 L110 104" stroke={LINE} strokeWidth="3.5" strokeLinecap="round" />
          </g>

          <Feet id={g("metal")} line={LINE} />
        </>
      )}
    </svg>
  );
}

function Feet({ id, line }: { id: string; line: string }) {
  return (
    <>
      <rect x="34" y="132" width="20" height="10" rx="3" fill={`url(#${id})`} stroke={line} strokeWidth="2.5" />
      <rect x="166" y="132" width="20" height="10" rx="3" fill={`url(#${id})`} stroke={line} strokeWidth="2.5" />
    </>
  );
}

/**
 *
 */
const TICKETS = [
  { x: 62, y: 46, r: -14, n: "9 16 19 28", b: "3" },
  { x: 110, y: 38, r: 4, n: "4 11 23 31", b: "7" },
  { x: 158, y: 48, r: 16, n: "2 15 22 29", b: "5" },
] as const;

function Tickets({ id, line }: { id: string; line: string }) {
  return (
    <>
      {TICKETS.map((t, i) => (
        <g key={i} transform={`translate(${t.x} ${t.y}) rotate(${t.r})`}>
          <rect x="-26" y="-13" width="52" height="26" rx="4" fill={`url(#${id})`} stroke={line} strokeWidth="2.5" />
          <path d="M8 -13 L8 13" stroke={line} strokeWidth="1.4" strokeDasharray="3 3" opacity="0.5" />
          <text
            x="-22"
            y="3.5"
            fontFamily="var(--font-mono)"
            fontSize="7.5"
            fontWeight="700"
            fill="oklch(32% 0.03 275)"
          >
            {t.n}
          </text>
          <circle cx="17" cy="0" r="6.5" fill="none" stroke={line} strokeWidth="1.4" />
          <text
            x="17"
            y="3"
            textAnchor="middle"
            fontFamily="var(--font-mono)"
            fontSize="8.5"
            fontWeight="700"
            fill="oklch(32% 0.03 275)"
          >
            {t.b}
          </text>
        </g>
      ))}
    </>
  );
}

/**
 */
export function CrateTile({
  rarity,
  size = 96,
  className,
}: {
  rarity: Rarity;
  size?: number;
  className?: string;
}) {
  return <Crate rarity={rarity} size={size} className={className} />;
}

/**
 *
 */
export function CrateWaiting({ size = 260 }: { size?: number }) {
  return (
    <div
      className="relative grid place-items-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label="Opening, waiting for the covalidators"
    >
      <div
        aria-hidden
        className="absolute rounded-full"
        style={{
          width: size * 0.9,
          height: size * 0.9,
          border: "1.5px dashed color-mix(in oklab, var(--color-accent) 60%, transparent)",
          animation: "wait-rotate 7s linear infinite",
        }}
      />
      <div
        aria-hidden
        className="absolute rounded-full"
        style={{
          width: size * 0.7,
          height: size * 0.7,
          border: "1px dashed color-mix(in oklab, var(--color-accent-bright) 40%, transparent)",
          animation: "wait-rotate 11s linear infinite reverse",
        }}
      />
      <Crate rarity="sealed" size={size * 0.62} drift />
    </div>
  );
}
