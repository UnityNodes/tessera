import type { Rarity } from "@/lib/deck";

/**
 *
 *
 *
 *
 */

const ART: Record<Rarity, { src: string; filter?: string }> = {
  sealed: { src: "/chests/sealed.webp" },
  denarius: { src: "/chests/denarius.webp" },
  aureus: { src: "/chests/aureus.webp" },
  porphyry: { src: "/chests/aureus.webp", filter: "hue-rotate(258deg) saturate(1.45)" },
  vault: { src: "/chests/aureus.webp", filter: "hue-rotate(292deg) saturate(1.35) brightness(1.05)" },
  grout: { src: "/chests/sealed.webp", filter: "saturate(0.12) brightness(0.82)" },
};

const MASK = "radial-gradient(closest-side, #000 56%, transparent 92%)";

export function Chest({
  rarity = "sealed",
  size = 160,
  drift = false,
  className,
}: {
  rarity?: Rarity;
  size?: number;
  drift?: boolean;
  className?: string;
}) {
  const art = ART[rarity];
  const glow = "drop-shadow(0 0 calc(var(--glow, 0) * 26px) var(--metal))";

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={art.src}
      alt=""
      aria-hidden
      data-tier={rarity}
      width={size}
      height={size}
      className={className}
      style={{
        display: "block",
        width: size,
        maxWidth: "100%",
        height: "auto",
        filter: art.filter ? `${art.filter} ${glow}` : glow,
        maskImage: MASK,
        WebkitMaskImage: MASK,
        animation: drift ? "crate-hover 4.4s ease-in-out infinite" : undefined,
      }}
    />
  );
}
