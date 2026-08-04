"use client";

import { AnimatePresence, motion } from "motion/react";
import { useAccount } from "wagmi";
import { isVault } from "@/lib/deck";
import { Crate } from "./Crate";
import type { FeedItem } from "@/hooks/useFeed";

const CARD = 112;

/**
 *
 *
 */
export function Ticker({ items }: { items: FeedItem[] }) {
  const { address } = useAccount();

  if (items.length === 0) return null;

  return (
    <div className="relative overflow-hidden" style={{ height: CARD + 26 }}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            "linear-gradient(90deg, var(--color-bg) 0%, transparent 6%, transparent 88%, var(--color-bg) 100%)",
        }}
      />
      <ul className="flex gap-2 overflow-x-auto pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <AnimatePresence initial={false}>
          {items.map((it) => {
            const mine = address && it.player.toLowerCase() === address.toLowerCase();
            const prize = it.weight > 0 || (it.value != null && isVault(it.spec));
            return (
              <motion.li
                key={it.handle}
                layout
                initial={{ opacity: 0, x: -CARD, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ duration: 0.45, ease: [0.16, 0.84, 0.28, 1] }}
                className="shrink-0"
                style={{ width: CARD }}
              >
                <div
                  className="relative overflow-hidden rounded-[var(--radius-panel)]"
                  style={{
                    height: CARD,
                    background: prize
                      ? `linear-gradient(158deg, color-mix(in oklab, ${it.spec.ink} 24%, ${it.spec.tint}), ${it.spec.tint})`
                      : "linear-gradient(158deg, var(--color-raised), var(--color-raised))",
                    boxShadow: prize
                      ? `inset 0 2px 0 ${it.spec.ink}, inset 0 0 0 1px color-mix(in oklab, ${it.spec.ink} 30%, transparent), 0 0 22px -4px color-mix(in oklab, ${it.spec.ink} 55%, transparent)`
                      : "inset 0 2px 0 var(--edge-strong), inset 0 0 0 1px var(--edge)",
                  }}
                >
                  {it.value === undefined ? (
                    <span className="t-inscription grid h-full place-items-center text-[0.625rem] text-[var(--color-ink-faint)]">
                      sealed
                    </span>
                  ) : (
                    <>
                      <div className="pointer-events-none absolute inset-0 grid place-items-center">
                        <Crate rarity={it.spec.rarity} size={CARD - 34} />
                      </div>
                      {it.spec.tickets > 0 && (
                        <div
                          className="t-chain absolute right-1.5 top-1 text-base leading-none"
                          style={{ color: it.spec.ink, textShadow: "0 1px 4px rgb(0 0 0/0.9)" }}
                        >
                          +{it.spec.tickets}
                        </div>
                      )}
                      <div
                        className="t-inscription absolute inset-x-0 bottom-1 text-center text-[0.5rem]"
                        style={{
                          color: prize ? it.spec.ink : "var(--color-ink-faint)",
                          textShadow: "0 1px 3px rgb(0 0 0/0.9)",
                        }}
                      >
                        {it.spec.name}
                      </div>
                    </>
                  )}
                </div>
                <div
                  className="t-chain mt-1 truncate text-center text-[0.625rem]"
                  style={{
                    color: mine ? "var(--color-accent-bright)" : "var(--color-ink-faint)",
                  }}
                >
                  {mine ? "you" : short(it.player)}
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </div>
  );
}

const short = (a: string) => `${a.slice(2, 6)}…${a.slice(-4)}`;
