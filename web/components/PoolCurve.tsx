"use client";

import { useMemo } from "react";
import type { OpenEvent } from "@/hooks/useOpens";

/**
 *
 *
 *
 */
export function PoolCurve({
  deckId,
  cut = 0,
  size,
  opens,
  ink,
  height = 22,
  guides = false,
  className,
}: {
  deckId: number;
  /**
   *
   */
  cut?: number;
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

    const pts: [number, number][] = [[0, 0]];
    mine.forEach((e, i) => {
      pts.push([((Number(e.block) - b0) / span) * W, ((i + 1) / size) * H]);
    });

    const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    const endY = pts[pts.length - 1][1].toFixed(1);
    return { line, area: `0,0 ${line} ${W},${endY} ${W},0`, end: pts[pts.length - 1] };
  }, [deckId, cut, size, opens, H]);

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


      {guides && (
        <>
          <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="currentColor" strokeOpacity="0.18"
                strokeWidth="1" strokeDasharray="3 5" />
          <line x1="0" y1={H - 1} x2={W} y2={H - 1} stroke="currentColor" strokeOpacity="0.32"
                strokeWidth="1" strokeDasharray="3 5" />
        </>
      )}

      <polygon points={path.area} fill={`url(#${id})`} />
      <polyline points={path.line} fill="none" stroke={ink} strokeWidth={guides ? 2 : 1.6}
                strokeLinejoin="round" strokeLinecap="round" />
      {guides && <circle cx={path.end[0]} cy={path.end[1]} r="3.5" fill={ink} />}
    </svg>
  );
}
