"use client";

import { motion } from "motion/react";
import { ticketsFromWeight } from "@/lib/deck";

/**
 *
 */
export function ShardMeter({ weight }: { weight: number }) {
  const tickets = ticketsFromWeight(weight);

  if (tickets === 0) {
    return (
      <p className="text-[0.9375rem] text-[var(--color-ink-dim)]">
        No bonus tickets yet. Most cases are empty, that is what makes the full
        ones worth opening for.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <span className="t-label">bonus tickets won</span>
      </div>
      <div className="flex flex-wrap gap-[3px]">
        {Array.from({ length: Math.min(tickets, 12) }, (_, i) => (
          <motion.span
            key={i}
            className="h-9 w-6 rounded-[var(--radius-control)]"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.35 }}
            style={{
              background: "linear-gradient(155deg,var(--color-tier-aureus),var(--color-tier-aureus))",
              boxShadow:
                "inset 0 1px 0 rgb(255 255 255/0.25), 0 2px 8px -3px var(--color-tier-aureus)",
            }}
          />
        ))}
      </div>
      <p className="mt-4 text-[0.9375rem] text-[var(--color-ink-dim)]">
        <span className="t-chain text-[var(--color-tier-aureus)]">
          {tickets} real ticket{tickets > 1 ? "s" : ""}
        </span>{" "}
        the game owes you. Claim them, or risk them for double.
      </p>
    </div>
  );
}
