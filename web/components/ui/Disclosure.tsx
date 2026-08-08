"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 *
 *
 */
export function Disclosure({
  summary,
  children,
  className = "",
  align = "right",
}: {
  summary: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  align?: "left" | "right";
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const path = usePathname();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const close = () => {
      if (el.open) el.open = false;
    };

    const onDown = (e: PointerEvent) => {
      if (el.open && e.target instanceof Node && !el.contains(e.target)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };

    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (ref.current?.open) ref.current.open = false;
  }, [path]);

  return (
    <details ref={ref} className={`group/d relative ${className}`}>
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        {summary}
      </summary>
      <div
        className={`absolute top-full z-[var(--z-sticky)] mt-2 ${
          align === "right" ? "right-0" : "left-0"
        }`}
      >
        {children}
      </div>
    </details>
  );
}
