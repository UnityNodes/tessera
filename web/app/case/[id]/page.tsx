"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, Sparkles, Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TierPlate } from "@/components/ui/TierPlate";
import { Case } from "@/components/Case";
import { Chest, skinOf } from "@/components/Chest";
import { OpenTheatre } from "@/components/OpenTheatre";
import { StartHere } from "@/components/StartHere";
import { useDeck } from "@/hooks/useDeck";
import { useOpenCase } from "@/hooks/useOpenCase";
import { useInventory, useRefreshInventory } from "@/hooks/useInventory";
import { useRefreshOpens } from "@/hooks/useOpens";
import { usePool } from "@/hooks/usePool";
import { useMegapot } from "@/hooks/useMegapot";
import { useSkins } from "@/hooks/useSkins";
import { useVault } from "@/hooks/useVault";
import {
  specOf,
  slotsPerTier,
  bestTier,
  isVault,
  isShard,
  type DeckShape,
} from "@/lib/deck";

/**
 *
 */
export default function CasePage() {
  const params = useParams<{ id: string }>();
  const deckId = Number(params.id);

  const { isConnected } = useAccount();
  const game = useDeck();
  const deck = game.decks.find((d) => d.id === deckId);

  const shape = useMemo(
    () => ({
      size: deck?.size ?? 0,
      tiers: deck?.tiers ?? [],
      vaultUpTo: deck?.vaultUpTo ?? 0,
    }),
    [deck?.size, deck?.tiers, deck?.vaultUpTo],
  );

  const inventory = useInventory(game.decks);
  const refreshInventory = useRefreshInventory();
  const refreshOpens = useRefreshOpens();
  const pool = usePool(shape, deck?.drawn ?? 0, deckId);
  const megapot = useMegapot();
  const skinUrl = useSkins();

  const refresh = useCallback(async () => {
    await Promise.all([
      game.refetch(),
      refreshInventory(),
      refreshOpens(),
      pool.refetch(),
      megapot.refetch(),
    ]);
  }, [game, refreshInventory, refreshOpens, pool, megapot]);

  const open = useOpenCase(refresh);
  const [mult, setMult] = useState(1);

  const affordable = game.ticketPrice > 0n ? Number(game.balance / game.ticketPrice) : 0;

  const take = Math.max(1, Math.min(mult, affordable || 1));

  //
  const stage = useRef<HTMLDivElement>(null);
  const [art, setArt] = useState(170);
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setArt(Math.max(120, Math.floor(Math.min(r.height - 8, r.width * 0.42))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [deck?.id]);
  const vault = useVault(refresh);


  const vaultSlot = inventory.data?.find(
    (s) =>
      s.deckId === deckId &&
      s.value != null &&
      !s.spent &&
      !s.locked &&
      s.signatures?.length &&
      isVault(specOf(s.value, shape)),
  );

  const busy = ["approving", "signing", "confirming", "revealing", "landing"].includes(
    open.state.phase,
  );
  const canOpen = isConnected && Boolean(deck) && !deck!.empty && game.canAfford && !busy;

  if (!deck) {
    return (
      <div className="w-full bg-[var(--color-section)] px-4 py-10 lg:px-8 2xl:px-14">
        <p className="py-20 text-center text-slate-300">
          {game.isLoading || game.decks.length === 0 ? "Reading the chain…" : "No such case."}
        </p>
      </div>
    );
  }

  const tiers = slotsPerTier(deck);
  const best = bestTier(deck);
  const dress = skinOf(deck.cid);
  const ink = deck.empty
    ? "var(--color-tier-grout)"
    : (dress?.ink ?? best?.ink ?? "var(--color-accent)");
  const prizes = tiers.filter((t) => t.weight > 0).reduce((n, t) => n + t.count, 0);
  const paying = prizes + deck.vaultUpTo;
  const oneIn = paying > 0 ? Math.max(1, Math.round(deck.size / paying)) : 0;
  return (
     *
     *
     */
    <div className="flex h-full w-full flex-col overflow-hidden bg-[var(--color-section)] px-4 py-3 lg:px-8 2xl:px-14">
      <OpenTheatre
        open={open.state}
        deck={shape}
        pool={pool.data}
        vault={deck?.vault}
        onClose={open.reset}
      />

      <div className="mx-auto flex h-full w-full max-w-[1320px] min-h-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2">
          <div className="flex min-w-0 items-baseline gap-3">
            <Link
              href="/#decks"
              className="t-label inline-flex shrink-0 items-center gap-1 hover:text-[var(--color-accent-hover)]"
            >
              <ChevronLeft className="h-4 w-4" />
              decks
            </Link>
            <h1 className="t-inscription truncate text-2xl font-extrabold text-white lg:text-3xl">
              {deck.empty ? "Emptied" : (dress?.name ?? best?.name ?? "Sealed")}
            </h1>
            <span className="t-chain shrink-0 text-base font-bold text-[var(--color-ink-dim)]">
              #{deck.id}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Chip label="sealed" value={`${deck.remaining} of ${deck.size}`} />
            <Chip label="drawn" value={String(deck.drawn)} />
            {oneIn > 0 && <Chip label="pays" value={`1 in ${oneIn}`} />}
            {deck.vaultUpTo > 0 && (
              <Chip
                label="vault"
                value={`$${Number(formatUnits(deck.vault, 6)).toFixed(2)}`}
                tone="var(--color-tier-vault)"
              />
            )}
          </div>
        </div>

        <div
          className="frame relative flex min-h-0 flex-1 flex-col items-center px-4 py-3"
          style={{ borderColor: `color-mix(in oklab, ${ink} 20%, transparent)` }}
        >
          <span className="absolute left-4 top-4 z-10">
            <TierPlate
              name={deck.empty ? "emptied" : (dress?.name ?? best?.name ?? "sealed")}
              ink={ink}
            />
          </span>

          <div ref={stage} className="relative grid min-h-0 w-full flex-1 place-items-center py-1">
            <span
              aria-hidden
              className="pointer-events-none absolute h-40 w-64 rounded-full opacity-25 blur-3xl"
              style={{ background: ink }}
            />
            <div className="relative">
              <Case
                phase={open.state.phase === "done" && !open.state.batch ? "opened" : "idle"}
                value={open.state.value}
                deck={shape}
                vault={deck.vault}
                skin={deck.cid}
                art={skinUrl(deckId)}
                size={art}
                onClick={
                  canOpen ? () => open.open({ deckId, needsApproval: game.needsApproval }) : undefined
                }
              />
            </div>
          </div>

          <div className="min-h-[2rem] w-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={open.state.phase + (open.state.value ?? "")}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="text-center"
              >
                {!open.state.batch && <Result open={open.state} deck={shape} />}
              </motion.div>
            </AnimatePresence>
          </div>

          {deck.empty ? (
            <p className="text-base text-slate-200">Every case in this deck has been opened.</p>
          ) : !isConnected || !game.canAfford ? (
            <StartHere what="A case" />
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="flex flex-wrap items-center justify-center gap-3">
                {game.maxBatch > 1 && (
                  <div className="flex items-center gap-1 rounded-[var(--radius-control)] border border-slate-800 bg-slate-950 p-1">
                    {[1, 2, 3, 4, 5, 10]
                      .filter((n) => n <= game.maxBatch)
                      .map((n) => (
                        <button
                          key={n}
                          type="button"
                          disabled={n > deck.remaining || n > affordable}
                          title={n > affordable ? `enough for ${affordable}` : undefined}
                          onClick={() => setMult(n)}
                          className={`min-w-10 cursor-pointer rounded-[var(--radius-chip)] px-3 py-1.5 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-30 ${
                            mult === n ? "text-white" : "text-slate-400 hover:text-slate-200"
                          }`}
                          style={
                            mult === n
                              ? {
                                  background: `color-mix(in oklab, ${ink} 16%, transparent)`,
                                  boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${ink} 45%, transparent)`,
                                }
                              : undefined
                          }
                        >
                          x{n}
                        </button>
                      ))}
                  </div>
                )}

                <Button
                  disabled={busy}
                  className="px-7 py-3 text-base"
                  onClick={() =>
                    open.state.phase === "done" || open.state.phase === "failed"
                      ? open.reset()
                      : take > 1
                        ? open.openBatch({ deckId, needsApproval: game.needsApproval, count: take })
                        : open.open({ deckId, needsApproval: game.needsApproval })
                  }
                >
                  <Sparkles className="h-5 w-5 fill-slate-950" />
                  {busy
                    ? "…"
                    : open.state.phase === "done" || open.state.phase === "failed"
                      ? `Open again • $${take}`
                      : game.needsApproval
                        ? `Approve once • $${take}`
                        : take > 1
                          ? `Open ${take} • $${take}`
                          : "Open a case • $1"}
                </Button>

              </div>

              {vaultSlot && vault.state.phase !== "done" && (
                <Button
                  className="px-6 py-3"
                  disabled={vault.state.phase === "signing" || vault.state.phase === "confirming"}
                  onClick={() => vault.claim(vaultSlot.index, vaultSlot.value!, vaultSlot.signatures!)}
                >
                  <Lock className="h-4 w-4" />
                  {vault.state.phase === "signing" || vault.state.phase === "confirming"
                    ? "Opening the vault…"
                    : `Take the vault • $${Number(formatUnits(deck.vault, 6)).toFixed(2)}`}
                </Button>
              )}
            </div>
          )}

          {open.state.batch && <BatchResult state={open.state} deck={shape} />}
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
            <span className="t-label">what is in this case</span>
            <span className="t-chain text-xs text-slate-400">
              {deck.remaining} of {deck.size} unopened
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
            {tiers
              .filter((t) => t.count > 0)
              .map((t) => (
                <div
                  key={t.spec.name}
                  className="flex flex-col items-center gap-1 rounded-[var(--radius-control)] border px-2 py-2"
                  style={{
                    borderColor: `color-mix(in oklab, ${t.spec.ink} 32%, transparent)`,
                    background: `color-mix(in oklab, ${t.spec.ink} 7%, var(--color-surface))`,
                  }}
                >
                  <span
                    className="t-chain self-start text-xs font-extrabold leading-none"
                    style={{ color: t.spec.ink }}
                  >
                    {isVault(t.spec)
                      ? `$${Number(formatUnits(deck.vault, 6)).toFixed(2)}`
                      : t.spec.tickets > 0
                        ? `+${t.spec.tickets}`
                        : ", "}
                  </span>
                  <Chest rarity={t.spec.rarity} size={46} />
                  <span
                    className="t-chain w-full truncate text-center text-xs font-bold leading-none"
                    style={{ color: t.spec.ink }}
                  >
                    {t.spec.name}
                  </span>
                  <span className="t-chain text-xs leading-none text-slate-400">
                    ×{t.count}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Chip({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <span
      className="flex items-baseline gap-1.5 rounded-[var(--radius-chip)] border px-2.5 py-1"
      style={{
        borderColor: tone
          ? `color-mix(in oklab, ${tone} 30%, transparent)`
          : "var(--edge)",
        background: "var(--color-surface)",
      }}
    >
      <span className="t-chain text-sm font-bold" style={{ color: tone ?? "var(--color-ink)" }}>
        {value}
      </span>
      <span className="t-label">{label}</span>
    </span>
  );
}


/**
 *
 */
function BatchResult({ state, deck }: { state: { batch?: { handle: string; index: number; value?: number }[]; phase: string }; deck: DeckShape }) {
  const items = state.batch ?? [];
  const known = items.filter((b) => b.value != null);
  const worth = known.filter((b) => specOf(b.value!, deck).tickets > 0 || isVault(specOf(b.value!, deck)));

  return (
    <div className="mt-5 w-full">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <span className="t-label">
          {state.phase === "done" ? "what you opened" : "opening…"}
        </span>
        {state.phase === "done" && (
          <span className="t-chain text-xs text-slate-400">
            {worth.length} of {items.length} carried a bonus
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-10">
        {items.map((b) => {
          const spec = b.value != null ? specOf(b.value, deck) : undefined;
          return (
            <div
              key={b.handle}
              className="flex flex-col items-center gap-1 rounded-[var(--radius-control)] border p-2"
              style={{
                borderColor: spec
                  ? `color-mix(in oklab, ${spec.ink} 35%, transparent)`
                  : "var(--edge)",
                background: spec
                  ? `color-mix(in oklab, ${spec.ink} 7%, var(--color-surface))`
                  : "var(--color-surface)",
              }}
            >
              <Chest rarity={spec?.rarity ?? "sealed"} size={44} />
              <span
                className="t-chain truncate text-xs font-bold leading-none"
                style={{ color: spec?.ink ?? "var(--color-ink-dim)" }}
              >
                {spec ? spec.name : "…"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}



/**
 *
 */
function Result({
  open,
  deck,
}: {
  open: ReturnType<typeof useOpenCase>["state"];
  deck: DeckShape;
}) {
  const dim = "text-base leading-relaxed text-slate-200";

  switch (open.phase) {
    case "approving":
      return <p className={dim}>Approving once. After this it is a single click, forever.</p>;
    case "signing":
      return <p className={dim}>Confirm in your wallet.</p>;
    case "confirming":
      return <p className={dim}>Buying your ticket…</p>;
    case "landing":
      return <p className={dim}>&nbsp;</p>;
    case "revealing":
      return open.resumed ? (
        <p className={dim}>Welcome back, this case was already paid for. Fetching it.</p>
      ) : (
        <p className={dim}>
          Ticket bought. Now the covalidators decrypt your case, a few seconds we do not control.
        </p>
      );
    case "done": {
      const spec = specOf(open.value!, deck);
      if (isVault(spec)) {
        return (
          <div>
            <p className="t-inscription text-2xl" style={{ color: "var(--color-tier-vault)" }}>
              you found the vault
            </p>
            <p className="mt-3 text-slate-300">Everything it holds is yours. Claim it below.</p>
          </div>
        );
      }
      return (
        <div>
          <p className="text-xl text-slate-100">
            You own{" "}
            <span className="text-[var(--color-accent-hover)]">1 more real ticket</span>.
          </p>
          {spec.tickets > 0 ? (
            <p className="t-inscription mt-3 text-2xl" style={{ color: spec.ink }}>
              and the case paid {spec.tickets} more
            </p>
          ) : isShard(spec) ? (
            <p className="t-inscription mt-3 text-2xl" style={{ color: spec.ink }}>
              and the case paid 1 TESA, five make a ticket
            </p>
          ) : (
            <p className="mt-3 text-slate-400">
              The case added nothing on top. Most do not, the ticket is the part that always
              arrives.
            </p>
          )}
        </div>
      );
    }
    case "failed":
      return (
        <div>
          <p className="text-[var(--color-danger)]">{open.error?.title}</p>
          {open.error?.next && <p className="mt-1 text-sm text-slate-400">{open.error.next}</p>}
        </div>
      );
    default:
      return (
        <p className={dim}>
          The same ticket sold on megapot.io, bought for you in the same transaction that opens
          the case.
        </p>
      );
  }
}
