"use client";

import { AnimatePresence, motion } from "motion/react";
import { useAccount } from "wagmi";
import { isVault, ticketsLabel } from "@/lib/deck";
import { Chest } from "./Chest";
import type { FeedItem } from "@/hooks/useFeed";

/**
 * What was pulled out of the deck last.
 *
 * A row of square tiles with a chest inside, which is how the strip looks in
 * the reference: the border colour and the glow name the tier, the caption
 * below names the prize itself, and hovering reveals a card with the player.
 *
 * Only what is worth something is shown here, and emptiness is folded into a
 * number at the side. Before this the strip tried to show every open, and every
 * attempt to do that neatly failed the same way: nine out of ten are empty, so
 * the row inevitably consisted of what should not have been in it.
 *
 * The mistake was not in how emptiness was styled but in the fact that it stood
 * in the row at all. The row exists to show what has disappeared from the pool;
 * an empty open takes nothing from the pool but a slot.
 */
export function Ticker({ items }: { items: FeedItem[] }) {
  const { address } = useAccount();
  if (items.length === 0) return null;

  // One criterion: the slot paid something. A surrendered ticket does not count
  // here, that is a choice rather than a payout, and a risk that dropped nothing
  // stays an empty open, however expensive the gesture was.
  const worthy = items.filter(
    (it) => it.value !== undefined && (it.weight > 0 || isVault(it.spec)),
  );
  // The values arrive from the covalidators in a batch and not instantly. While
  // even one is still on its way, "nothing dropped" is a guess, not a fact.
  const reading = items.some((it) => it.value === undefined);

  // How many empties have passed since the last prize. Counted from the head of
  // the strip: items are already sorted newest first.
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

      {/* Empties as a number rather than a row. It stands on the right and does
          not move, so it reads as a state rather than an event. */}
      {emptySince > 0 && (
        // Below sm this block hides. It is `shrink-0` with a non breaking
        // caption, so at 360 pixels it pushed the whole row off screen: Orbitron
        // is wider than the previous font by exactly enough to cross the line.
        // The "how many empties in a row" state explains the strip, but on a
        // narrow screen the strip itself matters more than its caption.
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
 * One prize.
 *
 * The size is the same for all of them: they are all worth showing, and ranking
 * them by dimensions as well would do the same thing the colour already does.
 */
function Drop({ item, mine }: { item: FeedItem; mine: boolean }) {
  const ink = item.spec.ink;
  const paid = item.risk ? item.spec.tickets * 2 : item.spec.tickets;

  return (
    /* The tile no longer crops the item.
       It was: a 64 pixel frame, overflow-hidden inside it and a chest at 72,
       that is, an item deliberately larger than the window it is put into, and
       cropped on every side. Plus a solid tier coloured frame around the
       perimeter: exactly the square that was doing all the cutting. Plus a
       caption over the bottom edge.
       It became: the tile is larger than the item, the frame is quiet, the light
       makes the tier visible, and the name stands UNDER the chest rather than on
       it. */
    <div
      /* A marker for auditing, not for style.
         The check "the strip appeared" looked for a tile with a chest picture
         inside, and it started to lie the moment TESA became a vector in
         <Shards>: six tiles on screen, and the check says there is no strip. The
         tile class will not do for this: it is about appearance and changes along
         with the appearance. */
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

      {/* The disclosure under the tile: who opened it and what exactly they got. */}
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
