"use client";

/**
 *
 *
 */

export type Rarity = "vault" | "porphyry" | "aureus" | "denarius" | "grout" | "sealed";

interface Look {
  base: string;
  band: string;
  shade: string;
  plate: string;
  mark: string;
  stroke: string;
  aura: string;
  auraR: number;
  auraOpacity: number;
  glyph: "1" | "2" | "5" | "diamond" | "lock" | "none";
}

const LOOKS: Record<Rarity, Look> = {
  vault: {
    base: "oklch(85% 0.19 85)",
    band: "oklch(93% 0.13 88)",
    shade: "oklch(62% 0.18 82)",
    plate: "oklch(29% 0.06 82)",
    mark: "oklch(97% 0.05 88)",
    stroke: "oklch(91% 0.12 86 / 0.75)",
    aura: "oklch(85% 0.19 85)",
    auraR: 46,
    auraOpacity: 0.6,
    glyph: "diamond",
  },
  porphyry: {
    base: "oklch(76% 0.16 80)",
    band: "oklch(85% 0.12 81)",
    shade: "oklch(54% 0.14 78)",
    plate: "oklch(26% 0.04 79)",
    mark: "oklch(95% 0.03 86)",
    stroke: "oklch(84% 0.10 81 / 0.65)",
    aura: "oklch(76% 0.16 80)",
    auraR: 40,
    auraOpacity: 0.42,
    glyph: "5",
  },
  aureus: {
    base: "oklch(68% 0.13 76)",
    band: "oklch(77% 0.10 77)",
    shade: "oklch(48% 0.11 74)",
    plate: "oklch(24% 0.03 76)",
    mark: "oklch(94% 0.03 86)",
    stroke: "oklch(76% 0.09 77 / 0.6)",
    aura: "oklch(68% 0.13 76)",
    auraR: 34,
    auraOpacity: 0.3,
    glyph: "2",
  },
  denarius: {
    base: "oklch(56% 0.08 70)",
    band: "oklch(64% 0.07 70)",
    shade: "oklch(40% 0.07 68)",
    plate: "oklch(22% 0.02 70)",
    mark: "oklch(92% 0.02 86)",
    stroke: "oklch(64% 0.06 70 / 0.55)",
    aura: "oklch(56% 0.08 70)",
    auraR: 28,
    auraOpacity: 0.18,
    glyph: "1",
  },
  grout: {
    base: "oklch(42% 0.03 68)",
    band: "oklch(48% 0.025 68)",
    shade: "oklch(33% 0.022 66)",
    plate: "oklch(26% 0.018 68)",
    mark: "oklch(58% 0.025 68)",
    stroke: "oklch(50% 0.02 68 / 0.5)",
    aura: "transparent",
    auraR: 0,
    auraOpacity: 0,
    glyph: "none",
  },
  sealed: {
    base: "oklch(33% 0.012 250)",
    band: "oklch(40% 0.014 250)",
    shade: "oklch(24% 0.010 250)",
    plate: "oklch(20% 0.008 250)",
    mark: "oklch(60% 0.010 250)",
    stroke: "oklch(48% 0.014 250 / 0.65)",
    aura: "transparent",
    auraR: 0,
    auraOpacity: 0,
    glyph: "lock",
  },
};

export function Crate({
  rarity,
  size = 160,
  drift = false,
  className,
}: {
  rarity: Rarity;
  size?: number;
  drift?: boolean;
  className?: string;
}) {
  const look = LOOKS[rarity];
  const auraId = `crate-aura-${rarity}`;
  const bodyId = `crate-body-${rarity}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      style={{ overflow: "visible", animation: drift ? "crate-drift 3.6s ease-in-out infinite" : undefined }}
      aria-hidden
    >
      <defs>
        <radialGradient id={auraId} cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor={look.aura} stopOpacity={look.auraOpacity} />
          <stop offset="100%" stopColor={look.aura} stopOpacity={0} />
        </radialGradient>
        <linearGradient id={bodyId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={look.band} />
          <stop offset="55%" stopColor={look.base} />
          <stop offset="100%" stopColor={look.shade} />
        </linearGradient>
      </defs>

      {look.auraR > 0 && (
        <circle
          cx="50"
          cy="44"
          r={look.auraR}
          fill={`url(#${auraId})`}
          style={{ animation: "crate-breathe 3.2s ease-in-out infinite" }}
        />
      )}

      <ellipse cx="50" cy="90" rx="34" ry="5.5" fill="#000" opacity="0.45" />
      <rect x="9" y="15" width="82" height="74" rx="11" fill="#000" opacity="0.35" />
      <rect
        x="10"
        y="14"
        width="80"
        height="72"
        rx="10"
        fill={`url(#${bodyId})`}
        stroke={look.stroke}
        strokeWidth="1.4"
      />
      <rect x="10" y="33.2" width="80" height="2.6" fill={look.stroke} opacity="0.55" />

      {[
        [17, 20.5],
        [83, 20.5],
        [17, 79.5],
        [83, 79.5],
      ].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.5" fill={look.stroke} opacity="0.6" />
      ))}

      <circle cx="50" cy="58" r="17" fill={look.plate} stroke={look.stroke} strokeWidth="1.2" />

      {(look.glyph === "1" || look.glyph === "2" || look.glyph === "5") && (
        <text
          x="50"
          y="64.5"
          textAnchor="middle"
          fontFamily="var(--font-mono)"
          fontSize="17"
          fontWeight="700"
          fill={look.mark}
        >
          {look.glyph}
        </text>
      )}

      {look.glyph === "diamond" && (
        <path d="M50 47 L61.5 58 L50 69 L38.5 58 Z" fill={look.mark} />
      )}

      {look.glyph === "lock" && (
        <>
          <path d="M43 57 h14 v12.5 h-14 z" fill="none" stroke={look.mark} strokeWidth="2" />
          <path
            d="M45.5 57 v-4 a4.5 4.5 0 0 1 9 0 v4"
            fill="none"
            stroke={look.mark}
            strokeWidth="2"
          />
        </>
      )}
    </svg>
  );
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
          width: size * 0.86,
          height: size * 0.86,
          border: "1.5px dashed oklch(50% 0.01 260 / 0.55)",
          animation: "wait-rotate 7s linear infinite",
        }}
      />
      <div
        aria-hidden
        className="absolute rounded-full"
        style={{
          width: size * 0.68,
          height: size * 0.68,
          border: "1px dashed oklch(50% 0.01 260 / 0.35)",
          animation: "wait-rotate 11s linear infinite reverse",
        }}
      />
      <Crate rarity="sealed" size={size * 0.5} drift />
    </div>
  );
}
