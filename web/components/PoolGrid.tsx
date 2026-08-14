"use client";

import { useMemo } from "react";

/**
 * A deck shown as a deck.
 *
 * The main difference between Tessera and any other case opener is that
 * the pool is finite: there are exactly as many slots as were cut at
 * creation, they were shuffled once and are drawn in order, without
 * return. Somebody else's win disappears for you too.
 *
 * Until now this was said in a line of fine print, "Still sealed: 66".
 * True, but a truth you have to read. Here is the same truth you can see:
 * every slot of the deck is its own cell, drawn ones are dark, sealed ones
 * glow. The deck melts in front of you, and no explanation is needed.
 *
 * The cells run in the same order they are drawn in: the contract hands
 * out slots consecutively by index, so the left part of the grid is
 * literally what has already been revealed, not decoration. What is inside
 * the sealed ones nobody knows, so they are all identical: the grid shows
 * exhaustion, not contents.
 */
export function PoolGrid({
  size,
  drawn,
  ink,
  className,
}: {
  size: number;
  drawn: number;
  /** The deck tier colour. The sealed cells glow with it. */
  ink: string;
  className?: string;
}) {
  // Exactly as many cells as slots, but no more than two hundred and forty:
  // above that limit a single cell becomes smaller than a pixel on a phone
  // and the grid turns into a solid fill, that is, stops being a grid. Then
  // one cell starts to stand for several slots, and that is more honest
  // than drawing four hundred strokes none of which can be seen.
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
        // The last drawn cell glows brighter than the rest of the dark ones:
        // this is where the deck stands right now, and it should be visible.
        const edge = i === gone - 1;
        return (
          <span
            key={i}
            className="block h-[10px] rounded-[1px]"
            style={{
              background: open
                ? edge
                  ? ink
                  : // A drawn cell has to be visible as drawn rather than as
                    // empty space: at fourteen percent it blended into the
                    // background, and the grid read as a short bar starting
                    // from the middle instead of a deck whose left third has
                    // been eaten.
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
