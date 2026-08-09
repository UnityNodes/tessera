import type { Rarity } from "@/lib/deck";
import { Shards } from "./Shards";

/**
 *
 *
 *
 *
 *
 *
 *
 */

/**
 *
 */
const ART: Record<Rarity, { src: string; open: string; filter?: string; bare?: boolean }> = {
  //
  sealed: {
    bare: true,
    src: "/chests/sealed-bare.webp",
    open: "/chests/sealed-open.webp",
    filter: "saturate(0.14) brightness(0.95)",
  },
  grout: {
    bare: true,
    src: "/chests/sealed-bare.webp",
    open: "/chests/sealed-open.webp",
    filter: "saturate(0.1) brightness(0.72)",
  },
  //
  shard: {
    bare: true,
    src: "/chests/sealed-bare.webp",
    open: "/chests/sealed-open.webp",
  },
  denarius: {
    bare: true,
    src: "/chests/sealed-bare.webp",
    open: "/chests/sealed-open.webp",
    filter: "hue-rotate(-66deg) saturate(1.15)",
  },
  aureus: { bare: true, src: "/chests/sealed-bare.webp", open: "/chests/sealed-open.webp" },
  porphyry: {
    bare: true,
    src: "/chests/sealed-bare.webp",
    open: "/chests/sealed-open.webp",
    filter: "hue-rotate(72deg) saturate(1.3)",
  },
  //
  vault: {
    bare: true,
    src: "/chests/sealed-bare.webp",
    open: "/chests/sealed-open.webp",
    filter: "hue-rotate(-160deg) saturate(1.6) brightness(1.12)",
  },
};

/**
 *
 *
 */
const BASE_HUE = 194;

/**
 *
 *
 *
 */
const NAMED: Record<string, { hue: number; src?: string }> = {
  kungfumode: { hue: 333, src: "/chests/kungfumode.webp" },
};

/**
 *
 *
 *
 */
export function skinOf(meta: string | undefined) {
  if (!meta) return undefined;
  const [name, raw] = meta.split(":");
  const own = NAMED[name];
  const hue = raw !== undefined ? Number(raw) : own?.hue;
  if (!name || !Number.isFinite(hue as number)) return undefined;

  const turn = (((Number(hue) - BASE_HUE) % 360) + 360) % 360;
  return {
    name,
    hue: Number(hue),
    src: own?.src,
    filter: own?.src ? undefined : `hue-rotate(${turn}deg) saturate(1.35) brightness(1.06)`,
    ink: `hsl(${hue} 100% 59%)`,
  };
}

const MASK = "radial-gradient(closest-side, #000 56%, transparent 92%)";

/**
 *
 *
 */
function sized(src: string, size: number) {
  if (size <= 80) return src.replace(".webp", "-sm.webp");
  if (size <= 192) return src.replace(".webp", "-md.webp");
  return src;
}

export function Chest({
  rarity = "sealed",
  size = 160,
  drift = false,
  open = false,
  skin,
  art,
  className,
}: {
  rarity?: Rarity;
  size?: number;
  drift?: boolean;
  open?: boolean;
  skin?: string;
  art?: string;
  className?: string;
}) {
  if (rarity === "shard") {
    return (
      <span data-tier="shard" className={className} style={{ display: "block" }}>
        <Shards size={size} style={{ animation: drift ? "crate-hover 4.4s ease-in-out infinite" : undefined }} />
      </span>
    );
  }

  const tier = ART[rarity];
  const dress = skinOf(skin);
  const glow = "drop-shadow(0 0 calc(var(--glow, 0) * 26px) var(--metal))";
  const masked = !(tier.bare && !open) && !art;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={
        art && !open
          ? art
          : sized(dress?.src && !open ? dress.src : open ? ART[rarity].open : ART[rarity].src, size)
      }
      alt=""
      aria-hidden
      data-tier={rarity}
      data-skin={skin || undefined}
      width={size}
      height={size}
      loading={size <= 192 ? "lazy" : "eager"}
      decoding="async"
      className={className}
      style={{
        display: "block",
        width: size,
        maxWidth: "100%",
        height: "auto",
        filter:
          art || dress?.src
            ? glow
            : dress?.filter
              ? `${dress.filter} ${glow}`
              : tier.filter
                ? `${tier.filter} ${glow}`
                : glow,
        maskImage: masked ? MASK : undefined,
        WebkitMaskImage: masked ? MASK : undefined,
        animation: drift ? "crate-hover 4.4s ease-in-out infinite" : undefined,
      }}
    />
  );
}

/**
 *
 */
export function ChestWaiting({ size = 260 }: { size?: number }) {
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
      <Chest rarity="sealed" size={size * 0.62} drift />
    </div>
  );
}
