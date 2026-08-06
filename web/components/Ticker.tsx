"use client";

import { AnimatePresence, motion } from "motion/react";
import { useAccount } from "wagmi";
import { isVault } from "@/lib/deck";
import { CrateTile } from "./Crate";
import type { FeedItem } from "@/hooks/useFeed";

const CARD = 150;

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
    <div className="flex items-center gap-6">
      {worthy.length === 0 ? (
        <p className="py-6 text-[0.9375rem] text-[var(--color-ink-faint)]">
          {reading ? "Reading what came out of the pool…" : "Nothing has come out of the pool yet."}
        </p>
      ) : (
        <div className="min-w-0 flex-1 overflow-hidden">
          <ul className="flex gap-3 overflow-x-auto py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <AnimatePresence initial={false}>
              {worthy.slice(0, 8).map((it, i) => (
                <motion.li
                  key={it.handle}
                  layout
                  initial={{ opacity: 0, x: -CARD, scale: 0.92 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  transition={{ duration: 0.45, ease: [0.16, 0.84, 0.28, 1] }}
                  className="shrink-0"
                  style={{ width: CARD }}
                >
                  <Prize
                    item={it}
                    index={i}
                    mine={Boolean(
                      address && it.player.toLowerCase() === address.toLowerCase(),
                    )}
                  />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
      )}

      {emptySince > 0 && (
        <div className="shrink-0 pr-1 text-right">
          <span className="t-chain block text-[1.5rem] leading-none text-[var(--color-ink-dim)]">
            {emptySince}
          </span>
          <span className="t-label mt-1 block whitespace-nowrap text-[0.75rem]">
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
function Prize({ item, index, mine }: { item: FeedItem; index: number; mine: boolean }) {
  const ink = item.spec.ink;
  const paid = item.risk ? item.spec.tickets * 2 : item.spec.tickets;

  return (
    <div
      className="relative overflow-hidden rounded-[3px]"
      style={{
        height: CARD * 0.82,
        background: `linear-gradient(158deg, color-mix(in oklab, ${ink} 20%, var(--color-surface)), var(--color-surface))`,
        boxShadow: mine
          ? `inset 0 0 0 1.5px var(--color-accent-bright), 0 0 30px -8px ${ink}`
          : `inset 0 0 0 1px color-mix(in oklab, ${ink} 50%, transparent), 0 0 30px -10px color-mix(in oklab, ${ink} 70%, transparent)`,
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `linear-gradient(105deg, transparent 38%, color-mix(in oklab, ${ink} 40%, transparent) 50%, transparent 62%)`,
          backgroundSize: "220% 100%",
          animation: `prize-sheen 5.5s linear ${(index % 5) * 0.9}s infinite`,
        }}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0.5 grid place-items-center">
        <CrateTile rarity={item.spec.rarity} size={CARD * 0.48} />
      </div>

      {paid > 0 && (
        <div
          className="t-chain absolute right-2.5 top-2 text-[1.375rem] font-bold leading-none"
          style={{ color: ink, textShadow: "0 1px 6px oklch(0% 0 0 / 0.95)" }}
        >
          +{paid}
        </div>
      )}

      {item.risk && (
        <div
          className="t-inscription absolute left-2.5 top-2.5 text-[0.75rem] leading-none"
          style={{ color: "var(--color-tier-vault)" }}
        >
          risked
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 px-2.5 pb-2">
        <div className="t-inscription text-center text-[0.8125rem]" style={{ color: ink }}>
          {item.spec.name}
        </div>
        <div
          className="t-chain mt-0.5 truncate text-center text-[0.75rem]"
          style={{ color: mine ? "var(--color-accent-bright)" : "var(--color-ink-faint)" }}
        >
          {mine ? "you" : short(item.player)}
        </div>
      </div>
    </div>
  );
}

const short = (a: string) => `${a.slice(2, 6)}…${a.slice(-4)}`;
