"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * A disclosure that actually closes.
 *
 * The header held its menus on a bare <details>, and next to it stood a comment:
 * "closes on Escape and needs no click outside handler". Both statements are
 * false. A native <details> closes NEITHER on Escape nor on a click outside:
 * <dialog> and popover can do that, and disclosure cannot. Because of it an open
 * wallet or Megapot menu stayed hanging over the page until you poked it a
 * second time.
 *
 * What is missing is added here, and exactly that: a click outside, Escape, and
 * a route change. Everything else, the keyboard, the screen reader, the open
 * state, is still done by <details> itself, which is why this is a wrapper and
 * not a popup of our own.
 */
export function Disclosure({
  summary,
  children,
  className = "",
  align = "right",
}: {
  /** The thing that gets pressed. Rendered inside <summary>. */
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

    // pointerdown rather than click: the menu should disappear at the moment of
    // the touch, not after the finger is lifted somewhere on the page.
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

  // Following a link from the menu itself should also close it: otherwise it
  // travels to the new page along with the user.
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
