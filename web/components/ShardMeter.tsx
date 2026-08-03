"use client";

import { motion } from "motion/react";
import { SHARDS_PER_TICKET, shardsToNextTicket } from "@/lib/deck";

/**
 *
 */
export function ShardMeter({ held }: { held: number }) {
  const inProgress = held % SHARDS_PER_TICKET;
  const readyTickets = Math.floor(held / SHARDS_PER_TICKET);
  const missing = shardsToNextTicket(held);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4 mb-4">
        <span className="t-label">Shards</span>
        <span className="t-chain text-[0.8125rem] text-[var(--color-travertine-dim)]">
          {held} held
        </span>
      </div>

      <div className="flex gap-[3px]">
        {Array.from({ length: SHARDS_PER_TICKET }, (_, i) => {
          const filled = i < inProgress;
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
        {readyTickets > 0 ? (
          <>
            <span className="t-chain text-[var(--color-ochre-300)]">
              {readyTickets} ticket{readyTickets > 1 ? "s" : ""}
            </span>{" "}
            ready to redeem
            {missing > 0 && <>, {missing} more shards for the next</>}.
          </>
        ) : (
          <>
            <span className="t-chain text-[var(--color-travertine)]">{missing}</span>{" "}
            more shards and the game buys you another real ticket.
          </>
        )}
      </p>
    </div>
  );
}
