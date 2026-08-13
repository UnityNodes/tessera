"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Play, Pause } from "lucide-react";

/**
 *
 *
 */
export interface Chapter {
  at: number;
  title: string;
  note: string;
}

const clock = (s: number) => {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
};

export function DemoPlayer({
  chapters,
  src,
  poster,
}: {
  chapters: Chapter[];
  src: string;
  poster: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [at, setAt] = useState(0);
  const [total, setTotal] = useState(0);

  const active = chapters.reduce((best, c, i) => (at + 0.25 >= c.at ? i : best), 0);

  const toggle = useCallback(() => {
    const el = video.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  }, []);

  const seek = useCallback((to: number) => {
    const el = video.current;
    if (!el) return;
    el.currentTime = to;
    setStarted(true);
    void el.play();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const el = document.activeElement;
      if (el && (el.tagName === "BUTTON" || el.tagName === "A" || el.tagName === "INPUT")) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  const pct = total > 0 ? (at / total) * 100 : 0;

  return (
    <div className="mt-9 grid gap-5 lg:grid-cols-[1.62fr_1fr]">
      <div>
        <div
          className="relative overflow-hidden rounded-[var(--radius-panel)] border bg-black"
          style={{ borderColor: "color-mix(in oklab, var(--color-accent) 26%, transparent)" }}
        >
          <video
            ref={video}
            className="block w-full"
            src={src}
            poster={poster}
            playsInline
            preload="metadata"
            onLoadedMetadata={(e) => setTotal(e.currentTarget.duration)}
            onTimeUpdate={(e) => setAt(e.currentTarget.currentTime)}
            onPlay={() => {
              setPlaying(true);
              setStarted(true);
            }}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onClick={toggle}
          />

          {!started && (
            <button
              type="button"
              onClick={toggle}
              aria-label="Play the demo"
              className="absolute inset-0 grid cursor-pointer place-items-center bg-black/25 transition-colors hover:bg-black/10"
            >
              <span
                className="grid h-20 w-20 place-items-center rounded-full transition-transform hover:scale-105 motion-reduce:transition-none"
                style={{
                  background: "var(--color-accent)",
                  boxShadow: "0 0 60px -8px var(--color-accent)",
                }}
              >
                <Play
                  className="ml-1 h-8 w-8"
                  style={{ color: "var(--color-on-accent)" }}
                  fill="currentColor"
                />
              </span>
            </button>
          )}

          <span className="pointer-events-none absolute bottom-3 left-3 rounded-[var(--radius-chip)] bg-black/70 px-3 py-1.5">
            <span className="t-chain text-xs font-bold text-white">
              {clock(total || 110)} · sound on
            </span>
          </span>

          <span className="absolute inset-x-0 bottom-0 h-[3px] bg-white/10">
            <span
              className="block h-full transition-[width] duration-200 motion-reduce:transition-none"
              style={{ width: `${pct}%`, background: "var(--color-accent)" }}
            />
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={toggle}
            className="t-label inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius-control)] px-4 py-3 font-bold"
            style={{ background: "var(--color-accent)", color: "var(--color-on-accent)" }}
          >
            {playing ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="h-4 w-4" fill="currentColor" />}
            {playing ? "Pause" : started ? "Resume" : "Play the demo"}
          </button>
          <a
            href={src}
            download
            className="t-label inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-slate-800 bg-slate-950 px-4 py-3 text-[var(--color-ink-dim)] transition-colors hover:border-slate-700 hover:text-white"
          >
            <Download className="h-4 w-4" />
            Download the mp4
          </a>
          <a
            href="/case/4"
            className="t-label inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-slate-800 bg-slate-950 px-4 py-3 text-[var(--color-ink-dim)] transition-colors hover:border-slate-700 hover:text-white"
          >
            Play it instead
          </a>
          <span className="t-chain ml-auto text-sm text-[var(--color-ink-dim)]">
            {clock(at)} / {clock(total || 110)}
          </span>
        </div>
      </div>

      <div className="rounded-[var(--radius-panel)] border border-slate-800 bg-slate-950/40 p-3">
        <div className="flex items-baseline justify-between px-3 pb-2 pt-1">
          <span className="t-label text-[var(--color-ink-dim)]">chapters</span>
          <span className="t-chain text-xs text-[var(--color-ink-dim)]">
            {chapters.length} · {clock(total || 110)}
          </span>
        </div>
        <ol className="flex flex-col gap-1">
          {chapters.map((c, i) => {
            const on = i === active && started;
            return (
              <li key={c.at}>
                <button
                  type="button"
                  onClick={() => seek(c.at)}
                  className="grid w-full cursor-pointer grid-cols-[46px_1fr] gap-3 rounded-[var(--radius-control)] px-3 py-2.5 text-left transition-colors hover:bg-slate-900/60"
                  style={on ? { background: "color-mix(in oklab, var(--color-accent) 11%, transparent)" } : undefined}
                  aria-current={on ? "true" : undefined}
                >
                  <span
                    className="t-chain pt-0.5 text-xs font-bold"
                    style={{ color: on ? "var(--color-accent)" : "var(--color-ink-faint)" }}
                  >
                    {clock(c.at)}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-white">{c.title}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-[var(--color-ink-dim)]">
                      {c.note}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
