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
 */
export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "chisel", block, loading, className = "", children, disabled, ...rest },
  ref,
) {
  const base =
    "relative overflow-hidden inline-flex items-center justify-center gap-2.5 whitespace-nowrap " +
    "transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out " +
    "cursor-pointer active:translate-y-px disabled:cursor-not-allowed disabled:active:translate-y-0";

  const skins: Record<Variant, string> = {
    chisel:
      "px-6 py-3.5 rounded-[var(--radius-control)] text-[0.9375rem] font-[650] tracking-[0.005em] " +
      "bg-[var(--color-accent)] text-[oklch(99%_0.005_250)] " +
      "shadow-[inset_0_1px_0_oklch(100%_0_0/0.35),inset_0_-2px_0_oklch(0%_0_0/0.22),0_6px_20px_-8px_var(--color-accent)] " +
      "hover:bg-[var(--color-accent-hover)] " +
      "hover:shadow-[inset_0_1px_0_oklch(100%_0_0/0.4),inset_0_-2px_0_oklch(0%_0_0/0.22),0_10px_30px_-8px_var(--color-accent)] " +
      "active:bg-[var(--color-accent-press)] " +
      "disabled:bg-[oklch(28%_0.014_262)] disabled:text-[oklch(54%_0.02_260)] disabled:shadow-none",
    quiet:
      "px-[1.4375rem] py-[0.8125rem] rounded-[var(--radius-control)] text-[0.9375rem] font-[600] " +
      "border-[1.5px] border-[color-mix(in_oklab,var(--color-accent)_55%,transparent)] " +
      "text-[var(--color-ink)] " +
      "hover:border-[var(--color-accent-hover)] hover:bg-[color-mix(in_oklab,var(--color-accent)_12%,transparent)] " +
      "active:bg-[color-mix(in_oklab,var(--color-accent)_20%,transparent)] " +
      "disabled:border-[oklch(30%_0.014_262)] disabled:text-[oklch(46%_0.018_260)] disabled:bg-transparent",
    ghost:
      "px-4 py-3 rounded-[2px] text-[0.875rem] " +
      "text-[var(--color-ink-dim)] " +
      "hover:text-[var(--color-ink)] hover:bg-[color-mix(in_oklab,var(--color-accent)_10%,transparent)] " +
      "disabled:text-[oklch(42%_0.016_260)]",
  };

  const sweep = variant === "chisel" && !disabled && !loading;

  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled || loading}
      style={loading ? { cursor: "progress" } : undefined}
      className={`group/btn ${base} ${skins[variant]} ${block ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {sweep && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/btn:opacity-100"
          style={{
            background:
              "linear-gradient(105deg, transparent 35%, oklch(100% 0 0 / 0.28) 50%, transparent 65%)",
            backgroundSize: "220% 100%",
            animation: "rim-sweep 1.5s var(--ease-out-expo) infinite",
          }}
        />
      )}
      {loading && (
        <span
          aria-hidden
          className="relative h-3.5 w-3.5 shrink-0 rounded-full border-2 border-current border-t-transparent"
          style={{ animation: "spin-loading 0.75s linear infinite", opacity: 0.7 }}
        />
      )}
      <span className="relative">{children}</span>
    </button>
  );
});
