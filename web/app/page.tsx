"use client";

import { useCallback, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { motion, AnimatePresence } from "motion/react";
import { ConnectBar } from "@/components/ConnectBar";
import { Button } from "@/components/ui/Button";
import { Case } from "@/components/Case";
import { Roll } from "@/components/Roll";
import { Feed } from "@/components/Feed";
import { PoolCounter } from "@/components/PoolCounter";
import { MegapotPanel } from "@/components/MegapotPanel";
import { StakePanel } from "@/components/StakePanel";
import { useDeck } from "@/hooks/useDeck";
import { useOpenCase } from "@/hooks/useOpenCase";
import { useInventory, useRefreshInventory, heldWeight, pickForRedeem } from "@/hooks/useInventory";
import { useRedeem } from "@/hooks/useRedeem";
import { useStake } from "@/hooks/useStake";
import { usePool } from "@/hooks/usePool";
import { useFeed } from "@/hooks/useFeed";
import { useMegapot } from "@/hooks/useMegapot";
import { specOf, slotsPerTier, weightOf, ticketsFromWeight } from "@/lib/deck";
import { addressUrl, DECK_ADDRESS } from "@/lib/chain";

/**
 *
 */
export default function Home() {
  const { isConnected } = useAccount();
  const deck = useDeck();
  const [showProof, setShowProof] = useState(false);

  const shape = useMemo(() => ({ size: deck.size, tiers: deck.tiers }), [deck.size, deck.tiers]);

  const inventory = useInventory(shape);
  const refreshInventory = useRefreshInventory();
  const pool = usePool(shape, deck.drawn);
  const feed = useFeed(shape);
  const megapot = useMegapot();

  const refresh = useCallback(async () => {
    await Promise.all([deck.refetch(), refreshInventory(), pool.refetch(), megapot.refetch()]);
  }, [deck, refreshInventory, pool, megapot]);

  const open = useOpenCase(refresh);
  const redeem = useRedeem(refresh);
  const stake = useStake(refresh);

  const weight = heldWeight(inventory.data);
  const toRedeem = pickForRedeem(inventory.data);
  const bonusTickets = ticketsFromWeight(weight);

  const decidingSlot = stake.open
    ? inventory.data?.find((s) => s.index === stake.decidingSlot)
    : undefined;

  const rolling = open.state.phase === "revealing" || open.state.phase === "landing";
  const busy = ["approving", "signing", "confirming", "revealing", "landing"].includes(
    open.state.phase,
  );
  const canOpen = isConnected && !deck.deckEmpty && deck.canAfford && !busy;
  const prizesLeft = pool.data?.prizesLeft ?? slotsPerTier(shape).filter((t) => t.weight > 0).reduce((n, t) => n + t.count, 0);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 pb-20 pt-8">
      <header className="mb-14 flex items-center justify-between gap-4">
        <span className="t-label">Tessera · season {deck.season}</span>
        <ConnectBar onMinted={refresh} />
      </header>

      <div className="flex flex-col items-center text-center">
        <h1 className="t-display text-[clamp(2rem,6vw,3.25rem)]">
          $1 buys a real lottery ticket.
          <br />
          <span className="text-[var(--color-sinopia-400)]">The case is free.</span>
        </h1>

        <div className="mt-8 flex items-center justify-center">
          {rolling ? (
            <Roll
              running
              landedWeight={open.state.value != null ? weightOf(open.state.value, shape) : undefined}
              deck={shape}
              pool={pool.data}
            />
          ) : (
            <Case
              phase={open.state.phase === "done" ? "opened" : "idle"}
              value={open.state.value}
              deck={shape}
              size={340}
              onClick={canOpen ? () => open.open({ needsApproval: deck.needsApproval }) : undefined}
            />
          )}
        </div>

        <div className="mt-6 min-h-[5.5rem] w-full max-w-md">
          <AnimatePresence mode="wait">
            <motion.div
              key={open.state.phase + (open.state.value ?? "")}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Result open={open.state} deck={shape} />
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-2 w-full max-w-md">
          {!isConnected ? (
            <p className="text-[1.0625rem] text-[var(--color-travertine-dim)]">
              Connect a wallet to open a case.
            </p>
          ) : deck.deckEmpty ? (
            <p className="text-[1.0625rem] text-[var(--color-travertine-dim)]">
              Every case in this season has been opened.
            </p>
          ) : !deck.canAfford ? (
            <p className="text-[1.0625rem] text-[var(--color-travertine-dim)]">
              You need $1 in test dollars, mint some above, they are free.
            </p>
          ) : (
            <Button
              block
              disabled={busy}
              onClick={() =>
                open.state.phase === "done" || open.state.phase === "failed"
                  ? open.reset()
                  : open.open({ needsApproval: deck.needsApproval })
              }
            >
              {busy
                ? "…"
                : open.state.phase === "done" || open.state.phase === "failed"
                  ? "Open another · $1"
                  : deck.needsApproval
                    ? "Approve once, then open · $1"
                    : "Open a case · $1"}
            </Button>
          )}

          {open.state.txUrl && !busy && (
            <a
              href={open.state.txUrl}
              target="_blank"
              rel="noreferrer"
              className="t-label mt-4 block hover:text-[var(--color-travertine)]"
            >
              view transaction
            </a>
          )}
        </div>

        {(bonusTickets > 0 || stake.open || stake.bankedWeight > 0) && (
          <div className="surface mt-10 w-full max-w-md rounded-[3px] p-6 text-left">
            <StakePanel
              stake={stake}
              toRedeem={toRedeem}
              weight={weight}
              decided={
                decidingSlot?.value != null && decidingSlot.signatures
                  ? { value: decidingSlot.value, signatures: decidingSlot.signatures }
                  : undefined
              }
              onRedeem={() => redeem.redeem(toRedeem)}
              redeeming={
                redeem.state.phase === "signing" || redeem.state.phase === "confirming"
              }
            />
          </div>
        )}
      </div>

      <div className="mt-16 grid grid-cols-3 gap-px overflow-hidden rounded-[3px] border border-[var(--edge)] bg-[var(--edge)]">
        <Stat
          label="jackpot"
          value={`$${Number(formatUnits(megapot.prizePool, 6)).toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
          ink="var(--color-ochre-300)"
        />
        <Stat label="prizes left" value={`${prizesLeft} of ${deck.remaining}`} />
        <Stat
          label="your tickets"
          value={megapot.tickets.toFixed(0)}
          ink="var(--color-patina-400)"
        />
      </div>

      <button
        onClick={() => setShowProof((v) => !v)}
        className="t-label mt-6 w-full py-2 text-center hover:text-[var(--color-travertine)]"
      >
        {showProof ? "hide the proof" : "how do I know this is fair?"}
      </button>

      <AnimatePresence>
        {showProof && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 0.84, 0.28, 1] }}
            className="overflow-hidden"
          >
            <div className="grid gap-6 pt-4 md:grid-cols-2">
              <section className="surface rounded-[3px] p-6">
                <p className="t-label mb-4">what is still in the pool</p>
                <PoolCounter deck={shape} drawn={deck.drawn} pool={pool.data} />
              </section>

              <section className="surface rounded-[3px] p-6">
                <p className="t-label mb-4">your Megapot, from here</p>
                <MegapotPanel mp={megapot} />
              </section>

              <section className="surface rounded-[3px] p-6 md:col-span-2">
                <p className="t-label mb-4">live from the same deck</p>
                <Feed items={feed} />
              </section>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="mt-12 text-center">
        <a
          href={addressUrl(DECK_ADDRESS)}
          target="_blank"
          rel="noreferrer"
          className="t-chain text-[0.75rem] text-[var(--color-travertine-faint)] hover:text-[var(--color-travertine)]"
        >
          {DECK_ADDRESS}
        </a>
      </footer>
    </main>
  );
}

function Stat({ label, value, ink }: { label: string; value: string; ink?: string }) {
  return (
    <div className="bg-[var(--color-stone-900)] px-4 py-5 text-center">
      <span className="t-label block">{label}</span>
      <span
        className="t-chain mt-2 block text-xl"
        style={{ color: ink ?? "var(--color-travertine)" }}
      >
        {value}
      </span>
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
  deck: { size: number; tiers: { upTo: number; weight: number }[] };
}) {
  const dim = "text-[1.0625rem] text-[var(--color-travertine-dim)]";

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
          Ticket bought. Now the covalidators decrypt your case, a few seconds we do
          not control.
        </p>
      );
    case "done": {
      const spec = specOf(open.value!, deck);
      return (
        <div>
          <p className="text-[1.25rem] text-[var(--color-travertine)]">
            You own <span className="text-[var(--color-patina-400)]">1 more real ticket</span>.
          </p>
          {spec.tickets > 0 ? (
            <p className="t-inscription mt-3 text-2xl" style={{ color: spec.ink }}>
              and the case paid {spec.tickets} more
            </p>
          ) : (
            <p className="mt-3 text-[1.0625rem] text-[var(--color-travertine-faint)]">
              The case was empty. Most of them are.
            </p>
          )}
        </div>
      );
    }
    case "failed":
      return (
        <div>
          <p className="text-[1.0625rem] text-[var(--color-sinopia-400)]">{open.error?.title}</p>
          {open.error?.next && (
            <p className="mt-1 text-[0.9375rem] text-[var(--color-travertine-faint)]">
              {open.error.next}
            </p>
          )}
        </div>
      );
    default:
      return (
        <p className={dim}>
          The same ticket sold on megapot.io, bought for you in the same transaction
          that opens the case.
        </p>
      );
  }
}
