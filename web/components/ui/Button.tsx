"use client";

import { forwardRef } from "react";

type Variant = "chisel" | "quiet" | "ghost";

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  block?: boolean;
  loading?: boolean;
}

/**
 *
 *
 *
 */
export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "chisel", block, loading, className = "", children, disabled, ...rest },
  ref,
) {
  const base =
    "relative inline-flex items-center justify-center gap-2.5 whitespace-nowrap " +
    "font-[500] transition-colors duration-150 cursor-pointer " +
    "disabled:cursor-not-allowed";

  const skins: Record<Variant, string> = {
    chisel:
      "px-6 py-3.5 rounded-[var(--radius-control)] text-[0.9375rem] font-[600] " +
      "bg-[var(--color-accent)] text-[oklch(97%_0.004_90)] " +
      "hover:bg-[var(--color-accent-hover)] active:bg-[var(--color-accent-press)] " +
      "disabled:bg-[oklch(28%_0.008_260)] disabled:text-[oklch(52%_0.01_260)]",
    quiet:
      "px-[1.4375rem] py-[0.8125rem] rounded-[var(--radius-control)] text-[0.9375rem] font-[600] " +
      "border-[1.5px] border-[color-mix(in_oklab,var(--color-accent)_55%,transparent)] " +
      "text-[oklch(88%_0.008_90)] " +
      "hover:border-[var(--color-accent-hover)] hover:bg-[color-mix(in_oklab,var(--color-accent)_8%,transparent)] " +
      "active:bg-[color-mix(in_oklab,var(--color-accent)_16%,transparent)] " +
      "disabled:border-[oklch(30%_0.01_260)] disabled:text-[oklch(45%_0.01_260)] disabled:bg-transparent",
    ghost:
      "px-4 py-3 rounded-[8px] text-[0.875rem] " +
      "text-[var(--color-ink-dim)] " +
      "hover:text-[var(--color-ink)] active:text-[oklch(55%_0.01_90)] " +
      "disabled:text-[oklch(40%_0.01_260)]",
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
          className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-current border-t-transparent"
          style={{ animation: "spin-loading 0.75s linear infinite", opacity: 0.7 }}
        />
      )}
      {children}
    </button>
  );
});
