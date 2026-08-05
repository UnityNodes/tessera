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
  { left: "9%", top: "26%" },
  { right: "9%", top: "26%" },
] as const;

const BODY_STUDS = [
  { left: "9%", bottom: "13%" },
  { right: "9%", bottom: "13%" },
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
      {sides.map((side) => (
        <div key={side} className={`crate__f crate__f--${side}`}>
          {studs.map((s, i) => (
            <span key={i} className="crate__stud" style={s} />
          ))}
          {plated && (side === "front" || side === "back") && (
            <span className="crate__plate">
              <Glyph kind={look.glyph} />
            </span>
          )}
        </div>
      ))}
      {part === "lid" && <div className="crate__f crate__f--top" />}
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
      style={{ width: `min(${size}px, 100%)`, aspectRatio: "1 / 1" }}
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
          height: fluid,
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
              "--lid-h": `calc(${fluid} * 0.34)`,
              "--body-h": `calc(${fluid} * 0.66)`,
              "--base": look.base,
              "--band": look.band,
              "--shade": look.shade,
              "--lit": look.lit,
              "--rim": look.rim,
              "--plate": look.plate,
              "--plate-lit": look.plateLit,
              "--mark": look.mark,
              "--aura": look.aura === "transparent" ? "oklch(60% 0.02 260)" : look.aura,
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
        <linearGradient id={`${id}-top`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={look.lit} />
          <stop offset="100%" stopColor={look.band} />
        </linearGradient>
        <linearGradient id={`${id}-left`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={look.base} />
          <stop offset="100%" stopColor={look.shade} />
        </linearGradient>
        <linearGradient id={`${id}-right`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={look.shade} />
          <stop offset="100%" stopColor={look.shade} stopOpacity="0.72" />
        </linearGradient>
      </defs>

      <ellipse cx="50" cy="95" rx="30" ry="5" fill="#000" opacity="0.5" />

      <path d="M50 10 88 32 50 54 12 32Z" fill={`url(#${id}-top)`} />
      <path d="M12 32 50 54v38L12 70Z" fill={`url(#${id}-left)`} />
      <path d="M88 32 50 54v38l38-22Z" fill={`url(#${id}-right)`} />

      <path
        d="M50 10 88 32 50 54 12 32Z M12 32v38l38 22 38-22V32"
        fill="none"
        stroke={look.rim}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M50 54v38" stroke={look.rim} strokeWidth="1" opacity="0.5" />
      <path d="M12 45 50 67l38-22" stroke={look.rim} strokeWidth="1.2" opacity="0.55" fill="none" />

      <ellipse
        cx="69"
        cy="65"
        rx="8"
        ry="11"
        fill={look.plate}
        stroke={look.rim}
        strokeWidth="1"
        opacity="0.95"
      />
      {look.glyph !== "none" && look.glyph !== "lock" && look.glyph !== "diamond" && (
        <text
          x="69"
          y="70"
          textAnchor="middle"
          fontFamily="var(--font-mono)"
          fontSize="11"
          fontWeight="700"
          fill={look.mark}
        >
          {look.glyph}
        </text>
      )}
      {look.glyph === "diamond" && <path d="M69 58 75 65 69 72 63 65Z" fill={look.mark} />}
      {look.glyph === "lock" && (
        <g stroke={look.mark} strokeWidth="1.6" fill="none" strokeLinecap="round">
          <rect x="65" y="63" width="8" height="7" rx="1.2" />
          <path d="M66.6 63v-2a2.4 2.4 0 0 1 4.8 0v2" />
        </g>
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
