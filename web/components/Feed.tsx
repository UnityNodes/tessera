"use client";

import { AnimatePresence, motion } from "motion/react";
import { useAccount } from "wagmi";
import type { FeedItem } from "@/hooks/useFeed";

const short = (a: string) => `${a.slice(2, 6)}…${a.slice(-4)}`;

/**
 *
 *
 */
export function Feed({ items }: { items: FeedItem[] }) {
  const { address } = useAccount();

  if (items.length === 0) {
    return <p className="t-label">nobody has opened anything yet</p>;
  }

  return (
    <ul className="space-y-1">
      <AnimatePresence initial={false}>
        {items.map((it) => {
          const mine = address && it.player.toLowerCase() === address.toLowerCase();
          const prize = it.weight > 0;
          return (
            <motion.li
              key={it.handle}
              layout
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 0.84, 0.28, 1] }}
              className="flex items-center gap-3 rounded-[var(--radius-control)] px-2 py-1.5"
              style={{
                background: prize
                  ? `color-mix(in oklab, ${it.spec.tint} 70%, transparent)`
                  : "transparent",
                boxShadow: prize
                  ? `inset 0 0 0 1px color-mix(in oklab, ${it.spec.ink} 28%, transparent)`
                  : "none",
              }}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-[1px]"
                style={{ background: it.spec.ink, opacity: prize ? 1 : 0.35 }}
              />
              <span className="t-chain min-w-0 flex-1 truncate text-[0.8125rem]">
                <span style={{ color: mine ? "var(--color-accent-bright)" : "var(--color-ink-faint)" }}>
                  {mine ? "you" : short(it.player)}
                </span>
              </span>
              <span
                className="t-inscription shrink-0 text-[0.75rem]"
                style={{ color: prize ? it.spec.ink : "var(--color-ink-faint)" }}
              >
                {it.value === undefined ? "…" : it.spec.name}
              </span>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}
