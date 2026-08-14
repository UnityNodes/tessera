"use client";

import { useMemo } from "react";
import type { OpenEvent } from "@/hooks/useOpens";

/**
 * How the deck pool drained.
 *
 * Horizontally, real time in block numbers; vertically, how many slots
 * have been drawn. The line can only fall: the pool is drawn from without
 * return, and the curve draws exactly the rule the game rests on.
 *
 * Time comes from blocks rather than from even steps of "one open, one
 * pixel". Even steps would lie about the thing that matters: a batch of
 * ten opens in a minute would look the same as ten opens over a week. And
 * the difference between those two is the difference between a live deck
 * and an abandoned one.
 *
 * No charting library. There are two tags here, `polygon` and `polyline`;
 * Recharts, which drags Tremor along with it, weighs more than the whole
 * page, for a line that has no axes, no tooltips and no legend.
 */
export function PoolCurve({
  deckId,
  cut = 0,
  size,
  opens,
  ink,
  height = 22,
  /** The "half gone" and "empty" dashes. At the strip height they are dirt. */
  guides = false,
  className,
}: {
  deckId: number;
  /**
   * The cut number. The curve draws THIS pool, not every previous one at once.
   *
   * A deck reshuffles itself when it has been played out or when the vault
   * has been taken from it. Without this the curve would stay lying on the
   * floor after every reshuffle even though the pool is full: the old opens
   * in the history do not go anywhere.
   */
  cut?: number;
  /** How many slots the deck holds. The vertical is measured by it. */
  size: number;
  opens: OpenEvent[];
  ink: string;
  height?: number;
  guides?: boolean;
  className?: string;
}) {
  const W = 240;
  const H = height;

  const path = useMemo(() => {
    const mine = opens
      .filter((e) => e.deckId === deckId && (e.cut ?? 0) === cut)
      .sort((a, b) => (a.block < b.block ? -1 : a.block > b.block ? 1 : 0));
    if (mine.length === 0 || size === 0) return null;

    const b0 = Number(mine[0].block);
    const span = Math.max(1, Number(mine[mine.length - 1].block) - b0);

    // Start from a full pool at zero, otherwise the curve begins already
    // broken and the first open is lost.
    const pts: [number, number][] = [[0, 0]];
    mine.forEach((e, i) => {
      pts.push([((Number(e.block) - b0) / span) * W, ((i + 1) / size) * H]);
    });

    const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    const endY = pts[pts.length - 1][1].toFixed(1);
    return { line, area: `0,0 ${line} ${W},${endY} ${W},0`, end: pts[pts.length - 1] };
  }, [deckId, cut, size, opens, H]);

  // The deck has not been opened yet, so show an empty track of the same
  // height rather than nothing: otherwise the card would jump in layout
  // while the events are on their way.
  if (!path) {
    return (
      <div
        className={className}
        style={{ height: H, borderRadius: 999, background: "rgb(255 255 255 / 0.06)" }}
      />
    );
  }

  const id = `pool-${deckId}-${cut}-${H}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} style={{ display: "block", width: "100%", height: "auto" }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ink} stopOpacity="0.45" />
          <stop offset="100%" stopColor={ink} stopOpacity="0.04" />
        </linearGradient>
      </defs>

      {/* The scale, without which the curve means nothing: a line just under the
          top edge reads as "almost nothing" only when the floor is visible. The
          upper dash is half the deck, the lower one is the end.

          Lines alone, with no captions inside the SVG. A caption there would
          have to be set at eight pixels, and the site has no text smaller than
          twelve: that is a rule of its own, and the audit checks it on EVERY
          text node, including those in SVG. What those two lines mean is said by
          the number above the curve: "100 of 200 sealed". */}
      {guides && (
        <>
          <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="currentColor" strokeOpacity="0.18"
                strokeWidth="1" strokeDasharray="3 5" />
          <line x1="0" y1={H - 1} x2={W} y2={H - 1} stroke="currentColor" strokeOpacity="0.32"
                strokeWidth="1" strokeDasharray="3 5" />
        </>
      )}

      {/* What has been drawn is the area on top: it grows downward, as what is
          already gone should grow. */}
      <polygon points={path.area} fill={`url(#${id})`} />
      <polyline points={path.line} fill="none" stroke={ink} strokeWidth={guides ? 2 : 1.6}
                strokeLinejoin="round" strokeLinecap="round" />
      {guides && <circle cx={path.end[0]} cy={path.end[1]} r="3.5" fill={ink} />}
    </svg>
  );
}
