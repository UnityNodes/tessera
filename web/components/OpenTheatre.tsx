"use client";

import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Chest } from "./Chest";
import { Prize } from "./Prize";
import { Roll } from "./Roll";
import { specOf, isVault, type DeckShape } from "@/lib/deck";
import type { OpenState } from "@/hooks/useOpenCase";
import type { PoolState } from "@/hooks/usePool";

/**
 *
 *
 *
 *
 *
 *
 */

const LIVE = new Set(["confirming", "revealing", "landing", "done"]);

export function OpenTheatre({
  open,
  deck,
  pool,
  vault,
  onClose,
}: {
  open: OpenState;
  deck: DeckShape;
  vault?: bigint;
  pool?: PoolState;
  onClose: () => void;
}) {
  const still = useReducedMotion();
  const on = LIVE.has(open.phase);
  const opened = open.phase === "done";

  /**
   *
   */
  useEffect(() => {
    if (!on || !opened) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [on, opened, onClose]);

  const spec = opened && open.value != null ? specOf(open.value, deck) : null;
  const won = Boolean(spec && (spec.tickets > 0 || isVault(spec)));
  const paid = spec ? (open.risk ? spec.tickets * 2 : spec.tickets) : 0;

  //
  const tier =
    open.phase !== "revealing" || still ? 0 : open.waitedMs > 5200 ? 3 : open.waitedMs > 2400 ? 2 : 1;

  return (
    <AnimatePresence>
      {on && (
        <motion.div
          className="fixed inset-0 z-[var(--z-overlay)] grid place-items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.32, ease: [0.16, 0.84, 0.28, 1] }}
          onClick={opened ? onClose : undefined}
          style={{ cursor: opened ? "pointer" : "default" }}
          role="dialog"
          aria-modal="true"
          aria-label="Opening a case"
        >
          <div
            className="absolute inset-0"
            style={{
              background: "color-mix(in oklab, var(--color-bg) 88%, transparent)",
              backdropFilter: "blur(18px) saturate(0.7)",
            }}
          />


          <AnimatePresence>
            {opened && won && (
              <motion.div
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-0 h-full -translate-x-1/2"
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "min(30rem, 62vw)" }}
                transition={{ duration: 0.9, ease: [0.16, 0.84, 0.28, 1] }}
                style={{
                  background: `linear-gradient(to top, transparent, color-mix(in oklab, ${spec!.ink} 42%, transparent) 34%, transparent 92%)`,
                  filter: "blur(26px)",
                  maskImage:
                    "linear-gradient(to right, transparent, #000 32%, #000 68%, transparent)",
                  WebkitMaskImage:
                    "linear-gradient(to right, transparent, #000 32%, #000 68%, transparent)",
                }}
              />
            )}
          </AnimatePresence>

          <div className="relative flex w-full flex-col items-center px-6 pb-10">

            {!opened ? (
              <div className="w-full">
                <Roll
                  running={open.phase !== "confirming"}
                  landedValue={open.value}
                  deck={deck}
                  pool={pool}
                  urgency={tier}
                />
              </div>
            ) : (
              <motion.div
                initial={{ scale: 0.72, y: 20, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                transition={{ duration: 0.65, ease: [0.16, 0.84, 0.28, 1] }}
                className="relative"
              >
                <div
                  style={{
                    animation:
                      opened && !won && !still ? "empty-sigh 1.9s ease-in-out 300ms both" : undefined,
                  }}
                >
                  <Chest rarity={spec?.rarity ?? "sealed"} size={520} open />
                </div>

                {won && (
                  <Prize
                    spec={spec!}
                    paid={paid}
                    vault={vault}
                    size={340}
                    className="absolute left-1/2 top-1/2"
                    style={{ animation: "prize-rise 1.15s var(--ease-out-expo) 620ms both" }}
                  />
                )}
              </motion.div>
            )}

            {opened && won && !still && <Shards ink={spec!.ink} />}

            <div className="relative mt-10 min-h-[9rem] text-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={open.phase}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.3 }}
                >
                  {opened && spec ? (
                    <>
                      <p
                        className="t-display text-[clamp(2.4rem,6.5vw,4rem)] leading-none"
                        style={{
                          color: spec.ink,
                          textShadow: `0 0 70px color-mix(in oklab, ${spec.ink} 65%, transparent)`,
                        }}
                      >
                        {won ? spec.name : "empty"}
                      </p>
                      <p className="t-inscription mt-3 text-[0.875rem] text-[var(--color-ink-dim)]">
                        {isVault(spec)
                          ? "everything the vault holds"
                          : won
                            ? `${paid} real ticket${paid > 1 ? "s" : ""}${open.risk ? " · doubled" : ""}`
                            : open.risk
                              ? "double nothing is nothing, that was the bet"
                              : "most of them are"}
                      </p>
                      <p className="mt-5 text-[0.9375rem] text-[var(--color-ink-faint)]">
                        click anywhere to continue
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="t-inscription text-[1.125rem] text-[var(--color-ink-dim)]">
                        {open.phase === "confirming"
                          ? open.risk
                            ? "putting your dollar in the vault"
                            : "buying your ticket"
                          : "the covalidators are decrypting"}
                      </p>
                      <span className="mt-4 flex justify-center gap-2">
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className="h-1.5 w-1.5 rounded-full"
                            style={{
                              background: "var(--color-accent-bright)",
                              animation: still
                                ? undefined
                                : `sealed-pulse 1.4s ease-in-out ${i * 0.18}s infinite`,
                            }}
                          />
                        ))}
                      </span>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 *
 */
const SHARDS = [
  { dx: -210, dy: -150, d: 0, s: 9 },
  { dx: 186, dy: -186, d: 40, s: 7 },
  { dx: -260, dy: -40, d: 80, s: 8 },
  { dx: 268, dy: -66, d: 20, s: 10 },
  { dx: -120, dy: -244, d: 110, s: 6 },
  { dx: 112, dy: -256, d: 70, s: 8 },
  { dx: -292, dy: 92, d: 140, s: 5 },
  { dx: 300, dy: 74, d: 100, s: 7 },
  { dx: -52, dy: -300, d: 160, s: 6 },
  { dx: 64, dy: -286, d: 130, s: 8 },
  { dx: -168, dy: 128, d: 180, s: 5 },
  { dx: 152, dy: 140, d: 120, s: 6 },
] as const;

function Shards({ ink }: { ink: string }) {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0">
      {SHARDS.map((s, i) => (
        <span
          key={i}
          className="absolute left-1/2 top-1/2 block"
          style={
            {
              width: s.s,
              height: s.s,
              background: ink,
              boxShadow: `0 0 ${s.s * 3}px ${ink}`,
              "--dx": `${s.dx}px`,
              "--dy": `${s.dy}px`,
              animation: `shard-pop 1.05s var(--ease-out-expo) ${s.d}ms both`,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}
