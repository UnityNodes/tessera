"use client";

export type Rarity = "vault" | "porphyry" | "aureus" | "denarius" | "grout" | "sealed";

interface Look {
  base: string;
  band: string;
  shade: string;
  lit: string;
  rim: string;
  plate: string;
  plateLit: string;
  mark: string;
  aura: string;
  auraStrength: number;
  glyph: "1" | "2" | "5" | "diamond" | "lock" | "none";
}

const LOOKS: Record<Rarity, Look> = {
  vault: {
    base: "oklch(94% 0.105 98)",
    band: "oklch(99% 0.045 102)",
    shade: "oklch(74% 0.145 92)",
    lit: "oklch(100% 0.015 100)",
    rim: "oklch(100% 0.02 100 / 0.95)",
    plate: "oklch(38% 0.08 92)",
    plateLit: "oklch(58% 0.12 95)",
    mark: "oklch(100% 0.01 100)",
    aura: "oklch(95% 0.12 97)",
    auraStrength: 1,
    glyph: "diamond",
  },
  porphyry: {
    base: "oklch(64% 0.25 340)",
    band: "oklch(76% 0.21 342)",
    shade: "oklch(42% 0.19 338)",
    lit: "oklch(88% 0.14 344)",
    rim: "oklch(86% 0.16 344 / 0.8)",
    plate: "oklch(28% 0.10 338)",
    plateLit: "oklch(44% 0.16 340)",
    mark: "oklch(96% 0.05 344)",
    aura: "oklch(64% 0.25 340)",
    auraStrength: 0.6,
    glyph: "5",
  },
  aureus: {
    base: "oklch(78% 0.165 70)",
    band: "oklch(88% 0.13 74)",
    shade: "oklch(54% 0.13 66)",
    lit: "oklch(95% 0.08 80)",
    rim: "oklch(92% 0.11 76 / 0.75)",
    plate: "oklch(30% 0.06 68)",
    plateLit: "oklch(46% 0.10 70)",
    mark: "oklch(97% 0.04 82)",
    aura: "oklch(78% 0.165 70)",
    auraStrength: 0.45,
    glyph: "2",
  },
  denarius: {
    base: "oklch(73% 0.16 158)",
    band: "oklch(84% 0.13 160)",
    shade: "oklch(48% 0.12 156)",
    lit: "oklch(93% 0.09 164)",
    rim: "oklch(88% 0.12 162 / 0.7)",
    plate: "oklch(26% 0.05 156)",
    plateLit: "oklch(42% 0.09 158)",
    mark: "oklch(96% 0.04 166)",
    aura: "oklch(73% 0.16 158)",
    auraStrength: 0.34,
    glyph: "1",
  },
  grout: {
    base: "oklch(46% 0.022 252)",
    band: "oklch(54% 0.024 252)",
    shade: "oklch(31% 0.018 250)",
    lit: "oklch(62% 0.026 254)",
    rim: "oklch(58% 0.025 254 / 0.5)",
    plate: "oklch(26% 0.016 250)",
    plateLit: "oklch(36% 0.020 252)",
    mark: "oklch(62% 0.024 254)",
    aura: "transparent",
    auraStrength: 0,
    glyph: "none",
  },
  sealed: {
    base: "oklch(40% 0.075 260)",
    band: "oklch(50% 0.095 258)",
    shade: "oklch(26% 0.055 262)",
    lit: "oklch(62% 0.115 256)",
    rim: "oklch(66% 0.13 254 / 0.72)",
    plate: "oklch(22% 0.045 262)",
    plateLit: "oklch(34% 0.075 258)",
    mark: "oklch(80% 0.13 252)",
    aura: "oklch(62% 0.19 255)",
    auraStrength: 0.4,
    glyph: "lock",
  },
};

const LID_STUDS = [
  { left: "6%", top: "50%" },
  { left: "19%", top: "50%" },
  { left: "32%", top: "50%" },
  { right: "32%", top: "50%" },
  { right: "19%", top: "50%" },
  { right: "6%", top: "50%" },
] as const;

const BODY_STUDS = [
  { left: "6%", bottom: "14%" },
  { left: "19%", bottom: "14%" },
  { right: "19%", bottom: "14%" },
  { right: "6%", bottom: "14%" },
] as const;

function Glyph({ kind }: { kind: Look["glyph"] }) {
  if (kind === "none") return null;
  if (kind === "diamond") {
    return (
      <svg viewBox="0 0 24 24" width="46%" height="46%" fill="currentColor" aria-hidden>
        <path d="M12 3 21 12 12 21 3 12Z" />
      </svg>
    );
  }
  if (kind === "lock") {
    return (
      <svg
        viewBox="0 0 24 24"
        width="46%"
        height="46%"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        aria-hidden
      >
        <rect x="5" y="10.5" width="14" height="10" rx="2" />
        <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
      </svg>
    );
  }
  return <span>{kind}</span>;
}

type Side = "front" | "back" | "left" | "right";

function Box({
  part,
  look,
  plated,
  studs,
}: {
  part: "lid" | "body";
  look: Look;
  plated: boolean;
  studs: readonly React.CSSProperties[];
}) {
  const sides: Side[] = ["front", "back", "left", "right"];
  return (
    <div className={`crate__part crate__${part}`}>
      {sides.map((side) => {
        const face = side === "front" || side === "back";
        return (
          <div key={side} className={`crate__f crate__f--${side}`}>
            {face && <span className="crate__band" />}
            {face && (
              <>
                <span className="crate__bracket crate__bracket--tl" />
                <span className="crate__bracket crate__bracket--tr" />
                <span className="crate__bracket crate__bracket--bl" />
                <span className="crate__bracket crate__bracket--br" />
              </>
            )}
            {studs.map((s, i) => (
              <span key={i} className="crate__stud" style={s} />
            ))}
            {plated && face && (
              <span className="crate__plate">
                <Glyph kind={look.glyph} />
              </span>
            )}
          </div>
        );
      })}
      {part === "lid" && (
        <div className="crate__f crate__f--top">
          <span className="crate__band crate__band--flat" />
        </div>
      )}
      <div className="crate__f crate__f--bottom" />
      {part === "body" && <div className="crate__inner" />}
    </div>
  );
}

/**
 *
 */
export function Crate({
  rarity,
  size = 160,
  drift = false,
  spin = true,
  open = false,
  className,
}: {
  rarity: Rarity;
  size?: number;
  drift?: boolean;
  spin?: boolean;
  open?: boolean;
  className?: string;
}) {
  const look = LOOKS[rarity];
  const edge = Math.round(size * 0.62);
  const fluid = `min(${edge}px, 62cqw)`;

  return (
    <div
      className={`scene relative grid place-items-center ${className ?? ""}`}
      style={{ width: `min(${size}px, 100%)`, aspectRatio: "1 / 0.78" }}
      aria-hidden
    >
      {look.auraStrength > 0 && (
        <span
          className="crate__halo"
          style={
            {
              "--s": fluid,
              "--aura": look.aura,
              "--aura-strength": look.auraStrength,
              animation: "crate-breathe 4.2s ease-in-out infinite",
            } as React.CSSProperties
          }
        />
      )}

      <div
        className="relative"
        style={{
          width: fluid,
          height: `calc(${fluid} * 0.64)`,
          animation: drift ? "crate-hover 4.4s ease-in-out infinite" : undefined,
          ["--s" as string]: fluid,
        }}
      >
        <span className="crate__shadow" style={{ ["--s" as string]: fluid }} />
        <div
          className={`crate${open ? " crate--open" : ""}`}
          style={
            {
              "--s": fluid,
              "--base": look.base,
              "--band": look.band,
              "--shade": look.shade,
              "--lit": look.lit,
              "--rim": look.rim,
              "--plate": look.plate,
              "--plate-lit": look.plateLit,
              "--mark": look.mark,
              //
              "--aura": look.auraStrength === 0 ? "oklch(0% 0 0 / 0.9)" : look.aura,
              transform: spin && !open ? undefined : "rotateX(-16deg) rotateY(-26deg)",
              animation: spin && !open ? "crate-turn 11s ease-in-out infinite" : undefined,
            } as React.CSSProperties
          }
        >
          <Box part="body" look={look} plated={look.glyph !== "none"} studs={BODY_STUDS} />
          <Box part="lid" look={look} plated={false} studs={LID_STUDS} />
          <span className="crate__beam" />
        </div>
      </div>
    </div>
  );
}

/**
 *
 *
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
  const look = LOOKS[rarity];
  const id = `tile-${rarity}`;

  const L = 14, R = 66, DX = 20, DY = 11;
  const LID_T = 30, LID_B = 44, BODY_B = 78;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      style={{ overflow: "visible" }}
      aria-hidden
    >
      <defs>
        <linearGradient id={`${id}-front`} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor={look.band} />
          <stop offset="44%" stopColor={look.base} />
          <stop offset="100%" stopColor={look.shade} />
        </linearGradient>
        <linearGradient id={`${id}-side`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor={look.shade} />
          <stop offset="100%" stopColor={look.plate} />
        </linearGradient>
        <linearGradient id={`${id}-top`} x1="0" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor={look.lit} />
          <stop offset="100%" stopColor={look.band} />
        </linearGradient>
        <linearGradient id={`${id}-band`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={look.shade} />
          <stop offset="34%" stopColor={look.lit} />
          <stop offset="100%" stopColor={look.shade} />
        </linearGradient>
      </defs>

      <ellipse cx="48" cy="82" rx="32" ry="5" fill="#000" opacity="0.5" />

      <path
        d={`M${R} ${LID_B} ${R + DX} ${LID_B - DY} ${R + DX} ${BODY_B - DY} ${R} ${BODY_B}Z`}
        fill={`url(#${id}-side)`}
      />
      <path d={`M${L} ${LID_B}h${R - L}v${BODY_B - LID_B}H${L}Z`} fill={`url(#${id}-front)`} />

      <path
        d={`M${L} ${LID_T} ${L + DX} ${LID_T - DY} ${R + DX} ${LID_T - DY} ${R} ${LID_T}Z`}
        fill={`url(#${id}-top)`}
      />
      <path
        d={`M${R} ${LID_T} ${R + DX} ${LID_T - DY} ${R + DX} ${LID_B - DY} ${R} ${LID_B}Z`}
        fill={`url(#${id}-side)`}
      />
      <path d={`M${L} ${LID_T}h${R - L}v${LID_B - LID_T}H${L}Z`} fill={`url(#${id}-front)`} />

      <path d={`M36 ${LID_T}h8v${BODY_B - LID_T}h-8Z`} fill={`url(#${id}-band)`} />
      <path d={`M36 ${LID_T} 46 ${LID_T - DY}h8l-10 ${DY}Z`} fill={look.lit} opacity="0.85" />

      <path
        d={`M${L} ${LID_B}h${R - L}l${DX} ${-DY}`}
        fill="none"
        stroke={look.rim}
        strokeWidth="1.1"
      />
      <path
        d={`M${L} ${LID_T}h${R - L}l${DX} ${-DY}v${BODY_B - LID_T}l${-DX} ${DY}H${L}Z M${L} ${LID_T}v${BODY_B - LID_T}`}
        fill="none"
        stroke={look.rim}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />

      <circle
        cx="40"
        cy="61"
        r="7.5"
        fill={look.plate}
        stroke={look.rim}
        strokeWidth="1"
      />
      {look.glyph !== "none" && look.glyph !== "lock" && look.glyph !== "diamond" && (
        <text
          x="40"
          y="65"
          textAnchor="middle"
          fontFamily="var(--font-mono)"
          fontSize="10"
          fontWeight="700"
          fill={look.mark}
        >
          {look.glyph}
        </text>
      )}
      {look.glyph === "diamond" && <path d="M40 55.5 45.5 61 40 66.5 34.5 61Z" fill={look.mark} />}
      {look.glyph === "lock" && (
        <g stroke={look.mark} strokeWidth="1.5" fill="none" strokeLinecap="round">
          <rect x="36.5" y="59" width="7" height="6" rx="1.2" />
          <path d="M38 59v-1.8a2.2 2.2 0 0 1 4.4 0V59" />
        </g>
      )}

      {[18, 26, 54, 62].map((x) => (
        <circle key={x} cx={x} cy={37} r="1.5" fill={look.lit} opacity="0.9" />
      ))}
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
