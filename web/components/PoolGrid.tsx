"use client";

import { useMemo } from "react";

/**
 *
 *
 *
 */
export function PoolGrid({
  size,
  drawn,
  ink,
  className,
}: {
  size: number;
  drawn: number;
  ink: string;
  className?: string;
}) {
  const cells = Math.min(size, 240);
  const per = size / cells;
  const gone = Math.floor(drawn / per);

  const list = useMemo(() => Array.from({ length: cells }, (_, i) => i), [cells]);

  return (
    <div
      className={`grid gap-[2px] ${className ?? ""}`}
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(6px, 1fr))` }}
      role="img"
      aria-label={`${size - drawn} of ${size} slots still sealed`}
    >
      {list.map((i) => {
        const open = i < gone;
        const edge = i === gone - 1;
        return (
          <span
            key={i}
            className="block h-[10px] rounded-[1px]"
            style={{
              background: open
                ? edge
                  ? ink
                  : // ,
                    "color-mix(in oklab, var(--color-ink-faint) 30%, transparent)"
                : `color-mix(in oklab, ${ink} 32%, transparent)`,
              boxShadow: edge ? `0 0 12px 0 ${ink}` : undefined,
            }}
          />
        );
      })}
    </div>
  );
}
