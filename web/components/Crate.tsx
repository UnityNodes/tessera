"use client";

import { useId } from "react";

export type Rarity = "vault" | "porphyry" | "aureus" | "denarius" | "grout" | "sealed";

/**
 *
 *
 *
 *
 */

const RATIO = 204 / 208;

/**
 *
 *
 *
 */
const ART: Partial<Record<Rarity, string>> = {
  sealed: "/chests/sealed.webp",
  denarius: "/chests/denarius.webp",
  aureus: "/chests/aureus.webp",
};

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
  const g = (name: string) => `${uid}-${name}`;

  const art = open ? undefined : ART[rarity];
  if (art) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={art}
        alt=""
        width={size}
        height={size}
        className={className}
        style={{
          display: "block",
          width: size,
          maxWidth: "100%",
          height: "auto",
          animation: drift ? "crate-hover 4.4s ease-in-out infinite" : undefined,
        }}
        aria-hidden
      />
    );
  }

  return (
    <svg
      data-tier={rarity}
      viewBox="-8 -34 208 204"
      width={size}
      height={Math.round(size * RATIO)}
      className={className}
      style={{
        display: "block",
        maxWidth: "100%",
        height: "auto",
        filter: "drop-shadow(0 0 calc(var(--glow, 0) * 16px) var(--metal))",
        animation: drift ? "crate-hover 4.4s ease-in-out infinite" : undefined,
      }}
      aria-hidden
    >
      <defs>
        <linearGradient id={g("top")} x1="0" y1="1" x2="0.3" y2="0">
          <stop offset="0" stopColor="color-mix(in oklch, var(--shell-top) 55%, var(--metal) 45%)" />
          <stop offset="0.55" stopColor="color-mix(in oklch, var(--shell-top) 25%, var(--metal-l) 75%)" />
          <stop offset="1" stopColor="color-mix(in oklch, var(--shell-top) 60%, var(--metal-l) 40%)" />
        </linearGradient>
        <linearGradient id={g("fu")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="color-mix(in oklch, var(--shell-front) 55%, var(--metal-l) 45%)" />
          <stop offset="1" stopColor="color-mix(in oklch, var(--shell-front) 80%, var(--metal) 20%)" />
        </linearGradient>
        <linearGradient id={g("fl")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="color-mix(in oklch, var(--shell-front) 82%, var(--metal) 18%)" />
          <stop offset="1" stopColor="color-mix(in oklch, var(--shell-front) 96%, var(--metal) 4%)" />
        </linearGradient>
        <linearGradient id={g("side")} x1="0" y1="0" x2="1" y2="0.15">
          <stop offset="0" stopColor="color-mix(in oklch, var(--shell-side) 75%, var(--metal) 25%)" />
          <stop offset="1" stopColor="color-mix(in oklch, var(--shell-side) 97%, var(--metal) 3%)" />
        </linearGradient>
        <linearGradient id={g("metal")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--metal-l)" />
          <stop offset="0.4" stopColor="var(--metal)" />
          <stop offset="1" stopColor="var(--metal-d)" />
        </linearGradient>
        <radialGradient id={g("cav")} cx="0.35" cy="0.15" r="0.9">
          <stop offset="0" stopColor="color-mix(in oklch, var(--shell-side) 45%, black 55%)" />
          <stop offset="1" stopColor="black" />
        </radialGradient>
        <radialGradient id={g("spec")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="var(--metal-l)" stopOpacity="0.95" />
          <stop offset="1" stopColor="var(--metal-l)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="100" cy="153" rx="60" ry="6" fill="black" opacity="0.7" style={{ filter: "blur(3px)" }} />

      {open ? (
        <>
          <polygon
            points="54,26 174,26 163,3 65,3"
            fill={`url(#${g("top")})`}
            stroke="color-mix(in oklch, var(--shell-top) 30%, black 70%)"
            strokeWidth="1"
          />
          <rect x="54" y="23.5" width="120" height="2.5" fill="var(--metal-l)" opacity="0.6" />
          <rect x="50" y="21.5" width="128" height="5" rx="2" fill={`url(#${g("metal")})`} />
          <polygon points="54,26 174,26 174,64 54,64" fill={`url(#${g("cav")})`} />

          <polygon
            points="150,78 174,64 174,136 150,150"
            fill={`url(#${g("side")})`}
            stroke="color-mix(in oklch, var(--shell-side) 20%, black 80%)"
            strokeWidth="1"
          />
          <rect x="30" y="78" width="120" height="36" fill={`url(#${g("fu")})`} />
          <rect x="30" y="114" width="120" height="36" fill={`url(#${g("fl")})`} />

          <polygon points="30,78 150,78 174,64 54,64" fill={`url(#${g("cav")})`} />
          <polygon points="46,84 134,84 152,74 64,74" fill="black" opacity="0.85" />

          <rect x="30" y="150" width="8" height="6" rx="1" fill={`url(#${g("metal")})`} />
          <rect x="142" y="150" width="8" height="6" rx="1" fill={`url(#${g("metal")})`} />
          <rect x="26" y="139" width="128" height="9" rx="2" fill={`url(#${g("metal")})`} />
          <rect x="22" y="142" width="17" height="17" rx="3" fill={`url(#${g("metal")})`} stroke="var(--metal-d)" strokeWidth="1" />
          <rect x="138" y="142" width="17" height="17" rx="3" fill={`url(#${g("metal")})`} stroke="var(--metal-d)" strokeWidth="1" />
        </>
      ) : (
        <>
          <rect x="30" y="150" width="8" height="6" rx="1" fill={`url(#${g("metal")})`} />
          <rect x="142" y="150" width="8" height="6" rx="1" fill={`url(#${g("metal")})`} />

          <polygon
            points="150,78 174,64 174,136 150,150"
            fill={`url(#${g("side")})`}
            stroke="color-mix(in oklch, var(--shell-side) 20%, black 80%)"
            strokeWidth="1"
          />
          <rect x="30" y="78" width="120" height="36" fill={`url(#${g("fu")})`} />
          <rect x="30" y="114" width="120" height="36" fill={`url(#${g("fl")})`} />

          <polygon
            points="150,40 174,26 174,64 150,78"
            fill={`url(#${g("side")})`}
            stroke="color-mix(in oklch, var(--shell-side) 20%, black 80%)"
            strokeWidth="1"
          />
          <rect x="30" y="40" width="120" height="38" fill={`url(#${g("fu")})`} />
          <polygon
            points="30,40 150,40 174,26 54,26"
            fill={`url(#${g("top")})`}
            stroke="color-mix(in oklch, var(--shell-top) 30%, black 70%)"
            strokeWidth="1"
          />

          <ellipse
            cx="80"
            cy="33"
            rx="55"
            ry="15"
            fill={`url(#${g("spec")})`}
            opacity="0.8"
            transform="rotate(-8 80 33)"
            style={{ mixBlendMode: "screen", filter: "blur(2px)" }}
          />

          <rect x="30" y="39" width="120" height="1.5" fill="var(--metal-l)" opacity="0.8" />
          <rect x="26" y="42" width="128" height="9" rx="2" fill={`url(#${g("metal")})`} />
          <rect x="26" y="73" width="128" height="13" rx="2" fill={`url(#${g("metal")})`} />
          <ellipse
            cx="65"
            cy="77"
            rx="34"
            ry="7"
            fill={`url(#${g("spec")})`}
            opacity="0.7"
            style={{ mixBlendMode: "screen" }}
          />
          <rect x="26" y="139" width="128" height="9" rx="2" fill={`url(#${g("metal")})`} />

          <rect x="22" y="32" width="17" height="17" rx="3" fill={`url(#${g("metal")})`} stroke="var(--metal-d)" strokeWidth="1" />
          <rect x="138" y="32" width="17" height="17" rx="3" fill={`url(#${g("metal")})`} stroke="var(--metal-d)" strokeWidth="1" />
          <rect x="22" y="142" width="17" height="17" rx="3" fill={`url(#${g("metal")})`} stroke="var(--metal-d)" strokeWidth="1" />
          <rect x="138" y="142" width="17" height="17" rx="3" fill={`url(#${g("metal")})`} stroke="var(--metal-d)" strokeWidth="1" />

          <rect x="79" y="65" width="42" height="26" rx="5" fill={`url(#${g("metal")})`} stroke="var(--metal-d)" strokeWidth="1" />
          <circle cx="100" cy="79" r="4.5" fill="var(--metal-d)" />
          <circle cx="99" cy="77" r="1.4" fill="var(--metal-l)" opacity="0.8" />
        </>
      )}
    </svg>
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
