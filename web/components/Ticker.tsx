"use client";

import { AnimatePresence, motion } from "motion/react";
import { useAccount } from "wagmi";
import { isVault } from "@/lib/deck";
import { CrateTile } from "./Crate";
import type { FeedItem } from "@/hooks/useFeed";

const CARD = 84;

/**
 *
 *
 *
 */
export function Ticker({ items }: { items: FeedItem[] }) {
  const { address } = useAccount();

  if (items.length === 0) return null;

  return (
    <div
      className="relative overflow-hidden"
      style={{
        height: CARD + 26,
        maskImage:
          "linear-gradient(90deg, transparent 0%, black 4%, black 92%, transparent 100%)",
      }}
    >
      <ul className="flex gap-2 overflow-x-auto pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <AnimatePresence initial={false}>
          {items.map((it, i) => {
            const mine = Boolean(address && it.player.toLowerCase() === address.toLowerCase());
            const pending = it.value === undefined;
            const prize = !pending && (it.weight > 0 || isVault(it.spec));
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
                <Card item={it} index={i} mine={mine} pending={pending} prize={prize} />
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

function Card({
  item,
  index,
  mine,
  pending,
  prize,
}: {
  item: FeedItem;
  index: number;
  mine: boolean;
  pending: boolean;
  prize: boolean;
}) {
  const ink = item.spec.ink;

  if (pending) {
    return (
      <div
        className="relative grid place-items-center overflow-hidden rounded-[12px]"
        style={{
          height: CARD,
          background: "var(--color-raised)",
          boxShadow: "inset 0 0 0 1px var(--edge)",
        }}
      >
        <span
          className="t-inscription text-[0.5rem] text-[var(--color-ink-faint)]"
          style={{ animation: "sealed-pulse 2.2s ease-in-out infinite" }}
        >
          sealed
        </span>
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden rounded-[12px]"
      style={{
        height: CARD,
        background: prize
          ? `linear-gradient(158deg, color-mix(in oklab, ${ink} 22%, var(--color-surface)), var(--color-surface))`
          : "color-mix(in oklab, var(--color-raised) 55%, transparent)",
        boxShadow: prize
          ? `inset 0 0 0 1px color-mix(in oklab, ${ink} 55%, transparent), 0 0 26px -6px color-mix(in oklab, ${ink} 70%, transparent)`
          : "inset 0 0 0 1px var(--edge)",
      }}
    >
      {prize && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: `linear-gradient(105deg, transparent 38%, color-mix(in oklab, ${ink} 45%, transparent) 50%, transparent 62%)`,
            backgroundSize: "220% 100%",
            animation: `prize-sheen 5.5s linear ${(index % 5) * 0.9}s infinite`,
          }}
        />
      )}

      <div
        className="pointer-events-none absolute inset-0 grid place-items-center"
        style={{ opacity: prize ? 1 : 0.55 }}
      >
        <CrateTile rarity={item.spec.rarity} size={CARD - 26} />
      </div>

      {item.spec.tickets > 0 && (
        <div
          className="t-chain absolute right-1.5 top-1 text-[0.8125rem] font-semibold leading-none"
          style={{ color: ink, textShadow: "0 1px 5px oklch(0% 0 0 / 0.95)" }}
        >
          +{item.spec.tickets}
        </div>
      )}

      {prize && (
        <div
          className="t-inscription absolute inset-x-0 bottom-1 text-center text-[0.5rem]"
          style={{ color: ink, textShadow: "0 1px 4px oklch(0% 0 0 / 0.95)" }}
        >
          {item.spec.name}
        </div>
      )}

      {mine && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[12px]"
          style={{ boxShadow: "inset 0 0 0 1.5px var(--color-accent-bright)" }}
        />
      )}
    </div>
  );
}

const short = (a: string) => `${a.slice(2, 6)}…${a.slice(-4)}`;
