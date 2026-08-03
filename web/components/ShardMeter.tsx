"use client";

import { motion } from "motion/react";
import { WEIGHT_PER_TICKET, weightToNextTicket } from "@/lib/deck";

/**
 *
 */
export function ShardMeter({ weight }: { weight: number }) {
  const ready = Math.floor(weight / WEIGHT_PER_TICKET);
  const inProgress = weight % WEIGHT_PER_TICKET;
  const missing = weightToNextTicket(weight);

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <span className="t-label">redeemable weight</span>
        <span className="t-chain text-[0.8125rem] text-[var(--color-travertine-dim)]">
          {weight} held
        </span>
      </div>

      <div className="flex gap-[3px]">
        {Array.from({ length: WEIGHT_PER_TICKET }, (_, i) => {
          const filled = ready > 0 || i < inProgress;
          return (
            <motion.span
              key={i}
              className="h-9 flex-1 rounded-[2px]"
              initial={false}
              animate={{
                background: filled
                  ? "linear-gradient(155deg,var(--color-ochre-400),var(--color-ochre-500))"
                  : "transparent",
                boxShadow: filled
                  ? "inset 0 1px 0 rgb(255 255 255/0.25), 0 2px 8px -3px var(--color-ochre-500)"
                  : "inset 0 0 0 1px var(--edge)",
              }}
              transition={{ duration: 0.4, ease: [0.16, 0.84, 0.28, 1] }}
            />
          );
        })}
      </div>

      <p className="mt-4 text-[0.9375rem] text-[var(--color-travertine-dim)]">
        {ready > 0 ? (
          <>
            <span className="t-chain text-[var(--color-ochre-300)]">
              {ready} real ticket{ready > 1 ? "s" : ""}
            </span>{" "}
            ready to claim
            {inProgress > 0 && <>, and {missing} more weight toward the next</>}.
          </>
        ) : (
          <>
            <span className="t-chain text-[var(--color-travertine)]">{missing}</span> more
            weight and the game buys you a real ticket.
          </>
        )}
      </p>
    </div>
  );
}
