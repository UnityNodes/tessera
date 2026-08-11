"use client";

import { AnimatePresence, motion } from "motion/react";
import { useAccount } from "wagmi";
import { isVault, ticketsLabel } from "@/lib/deck";
import { Chest } from "./Chest";
import type { FeedItem } from "@/hooks/useFeed";

/**
 *
 *
 *
 */
export function Ticker({ items }: { items: FeedItem[] }) {
  const { address } = useAccount();
  if (items.length === 0) return null;

  const worthy = items.filter(
    (it) => it.value !== undefined && (it.weight > 0 || isVault(it.spec)),
  );
  const reading = items.some((it) => it.value === undefined);

  const firstWorthy = items.findIndex((it) => worthy.includes(it));
  const emptySince = firstWorthy < 0 ? items.length : firstWorthy;
  const riskedSince = items.slice(0, emptySince).filter((it) => it.risk).length;

  return (
    <div className="flex items-center gap-5">
      {worthy.length === 0 ? (
        <p className="min-w-0 flex-1 py-3 text-sm text-slate-400">
          {reading ? "Reading what came out of the pool…" : "Nothing has come out of the pool yet."}
        </p>
      ) : (
        <div className="scrollbar-none flex min-w-0 flex-1 items-center gap-2.5 overflow-x-auto py-1">
          <AnimatePresence initial={false}>
            {worthy.slice(0, 14).map((it) => (
              <motion.div
                key={it.handle}
                layout
                initial={{ opacity: 0, x: -40, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ duration: 0.45, ease: [0.16, 0.84, 0.28, 1] }}
                className="shrink-0"
              >
                <Drop
                  item={it}
                  mine={Boolean(address && it.player.toLowerCase() === address.toLowerCase())}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {emptySince > 0 && (
        <div className="hidden shrink-0 pr-1 text-right sm:block">
          <span className="t-chain block text-xl font-extrabold leading-none text-slate-400">
            {emptySince}
          </span>
          <span className="t-label mt-1 block whitespace-nowrap">
            no bonus in a row{riskedSince > 0 ? ` · ${riskedSince} risked` : ""}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 *
 */
function Drop({ item, mine }: { item: FeedItem; mine: boolean }) {
  const ink = item.spec.ink;
  const paid = item.risk ? item.spec.tickets * 2 : item.spec.tickets;

  return (
    <div
      data-drop
      className="group relative flex h-[6.5rem] w-[6.5rem] shrink-0 flex-col items-center justify-between rounded-[var(--radius-panel)] border p-2 transition-all hover:scale-105 lg:h-28 lg:w-28"
      style={{
        background: "color-mix(in oklab, var(--color-surface) 88%, transparent)",
        borderColor: mine
          ? "rgb(57 255 136 / 0.55)"
          : `color-mix(in oklab, ${ink} 30%, transparent)`,
        boxShadow: `0 0 18px ${mine ? "rgb(57 255 136 / 0.28)" : `color-mix(in oklab, ${ink} 18%, transparent)`}`,
      }}
    >
      <div className="relative flex flex-1 items-center justify-center">
        <Chest
          rarity={item.spec.rarity}
          size={64}
          className="transition-transform duration-300 group-hover:rotate-3"
        />

        {paid > 0 && (
          <span
            className="t-chain absolute -right-1 -top-1 rounded px-1 text-xs font-extrabold leading-none"
            style={{
              color: ink,
              background: "rgb(6 10 6 / 0.85)",
              textShadow: `0 0 8px color-mix(in oklab, ${ink} 60%, transparent)`,
            }}
          >
            +{paid}
          </span>
        )}
      </div>

      <span
        className="t-chain block w-full truncate text-center text-xs font-bold"
        style={{ color: ink }}
      >
        {item.spec.name}
      </span>

      <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 hidden w-40 -translate-x-1/2 flex-col rounded-[var(--radius-control)] border border-slate-700 bg-slate-900 p-2 shadow-2xl group-hover:flex">
        <span className="t-chain text-xs font-bold text-slate-200">
          {mine ? "you" : short(item.player)}
        </span>
        <span className="text-xs text-[var(--color-accent-hover)]">
          {item.risk ? "gave the ticket up" : "case opened"}
        </span>
        <span className="t-chain mt-0.5 text-xs font-bold" style={{ color: ink }}>
          {item.spec.name}
          {paid > 0 ? ` · ${ticketsLabel(paid)}` : ""}
        </span>
      </div>
    </div>
  );
}

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
