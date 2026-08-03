"use client";

import { motion } from "motion/react";

interface Props {
  size: number;
  drawn: number;
  shardSlots: number;
}

/**
 *
 */
export function PoolCounter({ size, drawn, shardSlots }: Props) {
  const remaining = size - drawn;
  const marks = Math.min(size, 100);
  const scale = size / marks;
  const drawnMarks = Math.round(drawn / scale);
  const shardMarks = Math.round(shardSlots / scale);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4 mb-4">
        <span className="t-label">Season pool</span>
        <span className="t-chain text-[0.8125rem] text-[var(--color-travertine-dim)]">
          {remaining} of {size} unopened
        </span>
      </div>

      <div
        className="flex gap-[2px] items-end h-12"
        role="img"
        aria-label={`${remaining} of ${size} slots still sealed, ${shardSlots} of them shards`}
      >
        {Array.from({ length: marks }, (_, i) => {
          const isDrawn = i < drawnMarks;
          const isShardBand = i % Math.max(1, Math.round(marks / shardMarks)) === 0;
          return (
            <motion.span
              key={i}
              initial={{ scaleY: 0.2, opacity: 0 }}
              animate={{ scaleY: 1, opacity: 1 }}
              transition={{ delay: i * 0.004, duration: 0.4 }}
              className="flex-1 origin-bottom rounded-[1px]"
              style={{
                height: isShardBand ? "100%" : "62%",
                background: isDrawn
                  ? "var(--color-stone-700)"
                  : isShardBand
                    ? "var(--color-ochre-500)"
                    : "var(--color-stone-500)",
                opacity: isDrawn ? 0.45 : 1,
              }}
            />
          );
        })}
      </div>

      <div className="flex gap-6 mt-4">
        <Legend tint="var(--color-ochre-500)" text={`${shardSlots} shard slots`} />
        <Legend tint="var(--color-stone-500)" text="cosmetic" />
        <Legend tint="var(--color-stone-700)" text={`${drawn} opened`} />
      </div>
    </div>
  );
}

function Legend({ tint, text }: { tint: string; text: string }) {
  return (
    <span className="flex items-center gap-2">
      <span
        className="h-2.5 w-2.5 rounded-[1px] shrink-0"
        style={{ background: tint }}
      />
      <span className="t-label">{text}</span>
    </span>
  );
}
