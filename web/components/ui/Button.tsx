"use client";

import { forwardRef } from "react";

type Variant = "chisel" | "quiet" | "ghost";
type Size = "sm" | "md";

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  loading?: boolean;
}

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

  const pad = size === "sm" ? "px-4 py-2 text-xs" : "px-6 py-3.5 text-[0.9375rem]";

  const skins: Record<Variant, string> = {
    chisel:
      `${pad} font-extrabold tracking-wide ` +
      "bg-[var(--color-accent)] text-slate-950 " +
      "shadow-[0_0_25px_rgba(6,182,212,0.45)] " +
      "hover:bg-[var(--color-accent-hover)] hover:shadow-[0_0_35px_rgba(6,182,212,0.65)] hover:scale-[1.02] " +
      "active:scale-[0.99] " +
      "disabled:bg-slate-800 disabled:text-slate-500 disabled:shadow-none",
    quiet:
      `${pad} font-bold ` +
      "bg-slate-900/90 border border-slate-700 text-slate-200 " +
      "hover:bg-slate-800 hover:border-[rgb(6_182_212_/_0.5)] hover:text-[var(--color-accent-hover)] " +
      "disabled:bg-slate-900/60 disabled:border-slate-800 disabled:text-slate-600",
    ghost:
      `${pad} font-bold ` +
      "text-[var(--color-ink-dim)] " +
      "hover:bg-slate-800/70 hover:text-[var(--color-ink)] " +
      "disabled:text-slate-700",
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
