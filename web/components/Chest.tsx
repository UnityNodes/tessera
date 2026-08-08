import type { Rarity } from "@/lib/deck";

/**
 *
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
    filter: "hue-rotate(-56deg) saturate(0.85) brightness(0.82)",
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
  vault: { src: "/chests/aureus.webp", open: "/chests/aureus-open.webp" },
};

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
  className,
}: {
  rarity?: Rarity;
  size?: number;
  drift?: boolean;
  open?: boolean;
  className?: string;
}) {
  const art = ART[rarity];
  const glow = "drop-shadow(0 0 calc(var(--glow, 0) * 26px) var(--metal))";
  const masked = !(art.bare && !open);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={sized(open ? art.open : art.src, size)}
      alt=""
      aria-hidden
      data-tier={rarity}
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
        filter: art.filter ? `${art.filter} ${glow}` : glow,
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
