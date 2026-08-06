"use client";

import { AnimatePresence, motion } from "motion/react";
import { useAccount } from "wagmi";
import { isVault } from "@/lib/deck";
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
        <p className="min-w-0 flex-1 py-3 text-sm text-slate-500">
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
        <div className="shrink-0 pr-1 text-right">
          <span className="t-chain block text-xl font-extrabold leading-none text-slate-400">
            {emptySince}
          </span>
          <span className="t-label mt-1 block whitespace-nowrap text-[10px]">
            empty since{riskedSince > 0 ? ` · ${riskedSince} risked` : ""}
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
      className="group relative flex h-16 w-16 flex-col items-center justify-between rounded-[var(--radius-control)] border bg-slate-900/80 p-1.5 transition-all hover:scale-105 lg:h-20 lg:w-20"
      style={{
        borderColor: mine ? "var(--color-accent-hover)" : ink,
        boxShadow: `0 0 12px ${mine ? "rgb(34 211 238 / 0.4)" : "color-mix(in oklab, " + ink + " 26%, transparent)"}`,
      }}
    >
      <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[var(--radius-chip)]">
        <Chest
          rarity={item.spec.rarity}
          size={72}
          className="transition-transform duration-300 group-hover:rotate-3"
        />

        {paid > 0 && (
          <span
            className="t-chain absolute right-0 top-0 text-[11px] font-extrabold leading-none"
            style={{ color: ink, textShadow: "0 1px 6px rgb(2 6 23 / 0.95)" }}
          >
            +{paid}
          </span>
        )}

        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 to-transparent p-0.5 text-center">
          <span className="t-chain block truncate text-[9px] font-bold text-white">
            {item.spec.name}
          </span>
        </span>
      </div>

      <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 hidden w-40 -translate-x-1/2 flex-col rounded-[var(--radius-control)] border border-slate-700 bg-slate-900 p-2 shadow-2xl group-hover:flex">
        <span className="t-chain text-xs font-bold text-slate-200">
          {mine ? "you" : short(item.player)}
        </span>
        <span className="text-[10px] text-[var(--color-accent-hover)]">
          {item.risk ? "gave the ticket up" : "case opened"}
        </span>
        <span className="t-chain mt-0.5 text-[11px] font-bold" style={{ color: ink }}>
          {item.spec.name}
          {paid > 0 ? ` · +${paid} tickets` : ""}
        </span>
      </div>
    </div>
  );
}

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
