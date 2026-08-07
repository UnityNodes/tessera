"use client";

import { forwardRef } from "react";

type Variant = "chisel" | "battle" | "quiet" | "ghost";
type Size = "sm" | "md";

const TOUCH = "min-h-11 sm:min-h-0 ";

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  loading?: boolean;
}

/**
 *
 */
export const chiselSkin = (size: Size = "md") =>
  `${size === "sm" ? `${TOUCH}px-4 py-2 text-xs` : "px-6 py-4 text-base"} ` +
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] " +
  "font-extrabold tracking-wide text-[var(--color-on-accent)] " +
  "bg-[linear-gradient(135deg,var(--color-accent),var(--color-accent-press))] " +
  "shadow-[var(--glow-accent)] transition-all duration-200 " +
  "hover:brightness-110 hover:shadow-[var(--glow-accent-lift)]";

/**
 *
 *
 *
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
      : "px-6 py-3.5 text-[0.9375rem]";

  const skins: Record<Variant, string> = {
    chisel:
      `${pad} font-extrabold tracking-wide ` +
      "text-[var(--color-on-accent)] " +
      "bg-[linear-gradient(135deg,var(--color-accent),var(--color-accent-press))] " +
      "shadow-[var(--glow-accent)] " +
      "hover:brightness-110 hover:shadow-[var(--glow-accent-lift)] hover:scale-[1.02] " +
      "active:scale-[0.99] " +
      "disabled:bg-[var(--color-raised)] disabled:bg-none disabled:text-[var(--color-ink-faint)] disabled:shadow-none",
    battle:
      `${pad} font-extrabold tracking-wide ` +
      "text-white bg-[linear-gradient(135deg,#ff2d55,#c81f42)] " +
      "shadow-[var(--glow-danger)] " +
      "hover:brightness-110 hover:scale-[1.02] active:scale-[0.99] " +
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
