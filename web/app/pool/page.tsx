"use client";

import { useMemo } from "react";
import { formatUnits } from "viem";
import { useDeck, type DeckInfo } from "@/hooks/useDeck";
import { useOpens, type OpenEvent } from "@/hooks/useOpens";
import { skinOf } from "@/components/Chest";
import { bestTier } from "@/lib/deck";

/**
 *
 *
 */

const W = 560;
const H = 150;

/**
 *
 *
 */
function Curve({ deck, opens, ink }: { deck: DeckInfo; opens: OpenEvent[]; ink: string }) {
  const path = useMemo(() => {
    const mine = opens
      .filter((e) => e.deckId === deck.id)
      .sort((a, b) => (a.block < b.block ? -1 : a.block > b.block ? 1 : 0));
    if (mine.length === 0 || deck.size === 0) return null;

    const b0 = Number(mine[0].block);
    const b1 = Number(mine[mine.length - 1].block);
    const span = Math.max(1, b1 - b0);

    const pts: [number, number][] = [[0, 0]];
    mine.forEach((e, i) => {
      const x = ((Number(e.block) - b0) / span) * W;
      const y = ((i + 1) / deck.size) * H;
      pts.push([x, y]);
    });

    const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    return {
      line,
      area: `0,0 ${line} ${W},${pts[pts.length - 1][1].toFixed(1)} ${W},0`,
      last: pts[pts.length - 1],
      count: mine.length,
    };
  }, [deck.id, deck.size, opens]);

  if (!path) {
    return (
      <div className="grid h-[150px] place-items-center text-sm text-slate-500">
      </div>
    );
  }

  const id = `pool-fade-${deck.id}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" style={{ height: "auto" }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ink} stopOpacity="0.34" />
          <stop offset="100%" stopColor={ink} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="0" y1={H / 2} x2={W} y2={H / 2}
            stroke="var(--color-ink-faint)" strokeOpacity="0.25" strokeWidth="1" strokeDasharray="3 5" />
      <line x1="0" y1={H - 1} x2={W} y2={H - 1}
            stroke="var(--color-ink-faint)" strokeOpacity="0.45" strokeWidth="1" strokeDasharray="3 5" />
      <text x="4" y={H / 2 - 5} fontSize="9" fill="var(--color-ink-faint)" opacity="0.7">half gone</text>
      <text x="4" y={H - 5} fontSize="9" fill="var(--color-ink-faint)" opacity="0.7">empty</text>

      <polygon points={path.area} fill={`url(#${id})`} />
      <polyline
        points={path.line}
        fill="none"
        stroke={ink}
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={path.last[0]} cy={path.last[1]} r="4.5" fill={ink} />
    </svg>
  );
}

export default function PoolPage() {
  const game = useDeck();
  const opens = useOpens();
  const events = opens.data ?? [];

  return (
    <div className="w-full bg-[var(--color-section)] px-4 py-10 lg:px-8 2xl:px-14">
      <div className="mx-auto flex max-w-[1320px] flex-col gap-6">
        <div className="border-b border-slate-800 pb-6">
          <h1 className="t-page text-white">How the pools emptied</h1>
          <p className="mt-2 max-w-3xl text-base leading-relaxed text-slate-300">
            One line per deck. Down is sealed slots being drawn, it can only fall, because the
            pool is drawn without replacement. Horizontal is real time, taken from block numbers:
            a flat stretch means nobody played, a cliff means somebody opened a batch.
          </p>
          <p className="mt-2 text-sm text-slate-400">
            , . {" "}
            {events.length} , <code>/api/opens</code>, .
            .
          </p>
        </div>

        {game.decks.length > 0 && (
          <div className="rounded-[var(--radius-panel)] border border-slate-800 bg-[var(--color-surface)] p-6">
            <p className="t-label mb-1"></p>
            <p className="mb-5 max-w-2xl text-sm text-slate-300">
              ,
              . : , ,
              . , .
            </p>
            <div className="grid gap-6 sm:grid-cols-2">
              {game.decks.slice(0, 3).map((d) => {
                const dress = skinOf(d.cid);
                const best = bestTier(d);
                const ink = dress?.ink ?? best?.ink ?? "var(--color-accent)";
                const pct = d.size > 0 ? Math.max(1, (d.remaining / d.size) * 100) : 0;
                return (
                  <div key={`strip-${d.id}`} className="contents">
                    <StripBox label={`· #${d.id}`}>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: ink, boxShadow: `0 0 10px ${ink}` }}
                        />
                      </div>
                    </StripBox>
                    <StripBox label={`· #${d.id}`}>
                      <Spark deck={d} opens={events} ink={ink} />
                    </StripBox>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {game.decks.length === 0 ? (
          <p className="py-10 text-center text-slate-300">Reading the chain…</p>
        ) : (
          <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(24rem,1fr))]">
            {game.decks.map((d) => {
              const dress = skinOf(d.cid);
              const best = bestTier(d);
              const ink = d.empty
                ? "var(--color-tier-grout)"
                : (dress?.ink ?? best?.ink ?? "var(--color-accent)");
              const drawnHere = events.filter((e) => e.deckId === d.id).length;
              return (
                <div
                  key={d.id}
                  className="rounded-[var(--radius-panel)] border p-5"
                  style={{
                    background: "var(--color-surface)",
                    borderColor: `color-mix(in oklab, ${ink} 24%, transparent)`,
                  }}
                >
                  <div className="mb-1 flex items-baseline justify-between gap-3">
                    <span className="t-label">how this deck emptied</span>
                    <span className="t-chain text-sm font-bold" style={{ color: ink }}>
                      {dress?.name ?? best?.name ?? "Sealed"} #{d.id}
                    </span>
                  </div>

                  <div className="t-chain mb-3 text-2xl font-extrabold text-white">
                    {d.remaining}{" "}
                    <span className="text-sm font-semibold text-slate-400">
                      of {d.size} still sealed
                    </span>
                  </div>

                  <Curve deck={d} opens={events} ink={ink} />

                  <div className="mt-2 flex justify-between text-xs text-slate-500">
                    <span>first open</span>
                    <span>now</span>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-800 pt-3">
                    <Fact label="opens in feed" value={String(drawnHere)} />
                    <Fact label="drawn on chain" value={String(d.drawn)} />
                    <Fact
                      label="vault"
                      value={
                        d.vaultUpTo > 0 ? `$${Number(formatUnits(d.vault, 6)).toFixed(2)}` : ", "
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StripBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-control)] border border-slate-800 bg-[var(--color-bg)] p-4">
      <p className="t-label mb-3">{label}</p>
      {children}
    </div>
  );
}

/**
 *
 */
function Spark({ deck, opens, ink }: { deck: DeckInfo; opens: OpenEvent[]; ink: string }) {
  const w = 240;
  const h = 22;
  const d = useMemo(() => {
    const mine = opens
      .filter((e) => e.deckId === deck.id)
      .sort((a, b) => (a.block < b.block ? -1 : a.block > b.block ? 1 : 0));
    if (mine.length === 0 || deck.size === 0) return null;
    const b0 = Number(mine[0].block);
    const span = Math.max(1, Number(mine[mine.length - 1].block) - b0);
    const pts: [number, number][] = [[0, 0]];
    mine.forEach((e, i) => {
      pts.push([((Number(e.block) - b0) / span) * w, ((i + 1) / deck.size) * h]);
    });
    const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    return { line, area: `0,0 ${line} ${w},${pts[pts.length - 1][1].toFixed(1)} ${w},0` };
  }, [deck.id, deck.size, opens]);

  if (!d) return <div className="h-2 w-full rounded-full bg-slate-800" />;

  const id = `spark-${deck.id}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="block w-full" style={{ height: "auto" }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ink} stopOpacity="0.45" />
          <stop offset="100%" stopColor={ink} stopOpacity="0.04" />
        </linearGradient>
      </defs>
      <polygon points={d.area} fill={`url(#${id})`} />
      <polyline points={d.line} fill="none" stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="t-chain text-base font-bold text-white">{value}</div>
      <div className="t-label mt-0.5">{label}</div>
    </div>
  );
}
