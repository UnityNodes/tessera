"use client";

import { forwardRef } from "react";

type Variant = "chisel" | "quiet" | "ghost";
type Size = "sm" | "md";

/** The touch target: a mouse hits thirty pixels, a finger does not. */
const TOUCH = "min-h-11 sm:min-h-0 ";

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** A button across the full width of the block, the main action of the screen. */
  block?: boolean;
  /** A transaction is on its way: show the ring and lock the button. */
  loading?: boolean;
}

/**
 * The skin of the main action, separate from the button itself.
 *
 * Needed by the places where being a button is not allowed: inside a <summary>
 * a nested button is interactive inside interactive, and the keyboard breaks on
 * it. Such places used to just repeat these classes locally, and the skin began
 * to drift apart: in StartHere it already had a different shadow size. One
 * source, one button for the whole site.
 */
export const chiselSkin = (size: Size = "md") =>
  `${size === "sm" ? `${TOUCH}px-4 py-2 text-xs` : "px-6 py-4 text-base"} ` +
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] " +
  "font-extrabold tracking-wide text-[var(--color-on-accent)] " +
  "bg-[linear-gradient(135deg,var(--color-accent),var(--color-accent-press))] " +
  "shadow-[var(--glow-accent)] transition-all duration-200 " +
  "hover:brightness-110 hover:shadow-[var(--glow-accent-lift)]";

/**
 * The button.
 *
 * The main action in this language is solid turquoise with black text and its
 * own light around it: on a dark page it is the only thing that glows, which is
 * why it is seen before anything else. Hover adds light and lifts the button by
 * two percent, a motion small by exactly enough to read as a response rather
 * than a jump.
 *
 * The second action does not argue with the first: a dim slab with a border
 * that takes on turquoise on hover. The third is nothing but a patch under the
 * text.
 *
 * The "loading" state has its own look, because in this game it lasts a long
 * time, six to eight seconds for the decryption. The ring spins evenly and
 * promises no remaining time we do not know.
 */
export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "chisel", size = "md", block, loading, className = "", children, disabled, ...rest },
  ref,
) {
  const base =
    "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] " +
    "transition-all duration-200 cursor-pointer " +
    "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100";

  const pad =
    size === "sm"
      ? `${TOUCH}px-4 py-2 text-xs`
      : "px-6 py-3.5 text-sm";

  const skins: Record<Variant, string> = {
    chisel:
      `${pad} font-extrabold tracking-wide ` +
      "text-[var(--color-on-accent)] " +
      "bg-[linear-gradient(135deg,var(--color-accent),var(--color-accent-press))] " +
      "shadow-[var(--glow-accent)] " +
      "hover:brightness-110 hover:shadow-[var(--glow-accent-lift)] hover:scale-[1.02] " +
      "active:scale-[0.99] " +
      "disabled:bg-[var(--color-raised)] disabled:bg-none disabled:text-[var(--color-ink-faint)] disabled:shadow-none",
    quiet:
      `${pad} font-bold ` +
      "bg-transparent border border-[var(--edge-strong)] text-[#c7d6cd] " +
      "hover:border-[rgb(57_255_136_/_0.5)] hover:text-[var(--color-accent-hover)] " +
      "disabled:border-[var(--edge)] disabled:text-[var(--color-ink-faint)]",
    ghost:
      `${pad} font-bold ` +
      "text-[var(--color-ink-dim)] " +
      "hover:bg-[var(--color-raised)] hover:text-[var(--color-ink)] " +
      "disabled:text-[var(--color-ink-faint)]",
  };

  return (
    <button
      ref={ref}
      // Without this the browser sets type="submit": inside any form the "open a
      // case" button would submit it instead of doing its own action.
      type="button"
      disabled={disabled || loading}
      style={loading ? { cursor: "progress" } : undefined}
      className={`${base} ${skins[variant]} ${block ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden
          className="relative h-3.5 w-3.5 shrink-0 rounded-full border-2 border-current border-t-transparent"
          style={{ animation: "spin-loading 0.75s linear infinite", opacity: 0.7 }}
        />
      )}
      {children}
    </button>
  );
});
