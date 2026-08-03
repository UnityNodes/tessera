"use client";

import { forwardRef } from "react";

type Variant = "chisel" | "quiet" | "ghost";

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  block?: boolean;
}

/**
 */
export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "chisel", block, className = "", children, ...rest },
  ref,
) {
  const base =
    "group relative inline-flex items-center justify-center gap-3 " +
    "px-7 py-3.5 rounded-[3px] t-inscription text-[0.8125rem] " +
    "transition-[transform,box-shadow,background-color] duration-200 " +
    "[transition-timing-function:var(--ease-stone)] " +
    "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0";

  const skins: Record<Variant, string> = {
    chisel:
      "text-[var(--color-travertine)] " +
      "bg-[linear-gradient(160deg,var(--color-sinopia-500),var(--color-sinopia-600))] " +
      "shadow-[inset_0_1px_0_rgb(255_255_255/0.22),0_3px_0_var(--color-sinopia-900),0_10px_24px_-8px_rgb(0_0_0/0.9)] " +
      "hover:translate-y-[2px] " +
      "hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_1px_0_var(--color-sinopia-900),0_6px_14px_-8px_rgb(0_0_0/0.9)] " +
      "active:translate-y-[3px] active:shadow-[inset_0_2px_4px_rgb(0_0_0/0.45)]",
    quiet:
      "text-[var(--color-travertine)] bg-[var(--color-stone-700)] " +
      "shadow-[inset_0_1px_0_rgb(255_255_255/0.1),0_2px_0_rgb(0_0_0/0.6)] " +
      "hover:translate-y-[1px] hover:bg-[var(--color-stone-600)] " +
      "hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_1px_0_rgb(0_0_0/0.6)]",
    ghost:
      "text-[var(--color-travertine-dim)] border border-[var(--edge)] " +
      "hover:text-[var(--color-travertine)] hover:border-[var(--edge-strong)] " +
      "hover:bg-[color-mix(in_oklab,var(--color-travertine)_4%,transparent)]",
  };

  return (
    <button
      ref={ref}
      className={`${base} ${skins[variant]} ${block ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});
