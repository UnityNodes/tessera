import { formatUnits } from "viem";
import { isVault, type TierSpec } from "@/lib/deck";

/**
 * What comes out of the chest.
 *
 * For a long time this spot held a glowing orb with a number. It worked,
 * but it named nothing: the player saw "something round and +5". Now the
 * item itself comes out of the chest, and it is the same one lying inside
 * it in the picture: a lottery ticket. The number stands on its blank
 * field, which is exactly why that field is kept blank in the render.
 *
 * The vault pays not in tickets but in all the money it has accumulated,
 * so it has its own item, a bag of gold, with the amount below it. The
 * number there is real, from the chain: there are no painted amounts
 * anywhere in this game.
 *
 * Both pictures have their own dark background matched to the page colour,
 * and on top of that a radial mask; without it the glow outlines the
 * rectangle of the picture instead of the item.
 */

const MASK = "radial-gradient(closest-side, #000 52%, transparent 96%)";

/** The same split into steps as in the chest. */
const sized = (src: string, size: number) =>
  size <= 192 ? src.replace(".webp", "-md.webp") : src;

export function Prize({
  spec,
  /** How many tickets the player took, doubling already accounted for. */
  paid,
  /** How much is in the vault. Needed only when the vault is what dropped. */
  vault,
  /** Item width in pixels. */
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
      // The bag rides higher than the ticket: the amount stands below it,
      // and at a shared height it would land on the chest lid.
      style={vaultWon ? { ...style, marginTop: -size * 0.2 } : style}
    >
      {/* Not next/image: the size is set by whoever places the prize, and the
          item appears both full screen in the scene and at half that on the case
          page itself. The two pictures together weigh 190 KB. */}
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
        // The amount goes under the bag, not on it: white text is lost on
        // gold, and dark text merges with the shadows between the coins.
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
        // The number lies ON the ticket, so it is rotated with it: a straight
        // number on tilted paper reads as a sticker over the picture.
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
