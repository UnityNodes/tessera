import { formatUnits } from "viem";
import { isVault, type TierSpec } from "@/lib/deck";

/**
 *
 *
 *
 */

const MASK = "radial-gradient(closest-side, #000 52%, transparent 96%)";

const sized = (src: string, size: number) =>
  size <= 192 ? src.replace(".webp", "-md.webp") : src;

export function Prize({
  spec,
  paid,
  vault,
  size = 330,
  className = "",
  style,
}: {
  spec: TierSpec;
  paid: number;
  vault?: bigint;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const vaultWon = isVault(spec);

  return (
    <span
      aria-hidden
      className={`pointer-events-none grid place-items-center ${className}`}
      style={vaultWon ? { ...style, marginTop: -size * 0.2 } : style}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={sized(vaultWon ? "/prizes/vault.webp" : "/prizes/ticket.webp", size)}
        alt=""
        width={size}
        className="block"
        style={{
          width: size,
          height: "auto",
          maskImage: MASK,
          WebkitMaskImage: MASK,
          filter: `drop-shadow(0 0 ${size * 0.1}px color-mix(in oklab, ${spec.ink} 65%, transparent))`,
        }}
      />

      {vaultWon ? (
        <span
          className="t-chain absolute bottom-[-2%] font-extrabold leading-none text-white"
          style={{
            fontSize: size * 0.13,
            textShadow: `0 0 ${size * 0.08}px ${spec.ink}, 0 2px 10px #000`,
          }}
        >
          ${Number(formatUnits(vault ?? 0n, 6)).toFixed(2)}
        </span>
      ) : (
        <span
          className="absolute font-extrabold leading-none"
          style={{
            fontSize: size * 0.165,
            color: "#17241d",
            transform: "rotate(-19deg) skewX(-6deg)",
            textShadow: "0 2px 12px rgb(255 255 255 / 0.55)",
          }}
        >
          +{paid}
        </span>
      )}
    </span>
  );
}
