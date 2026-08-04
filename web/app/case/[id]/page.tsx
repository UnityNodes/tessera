"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/Button";
import { Case } from "@/components/Case";
import { Roll } from "@/components/Roll";
import { Contents } from "@/components/Contents";
import { PoolCounter } from "@/components/PoolCounter";
import { MegapotPanel } from "@/components/MegapotPanel";
import { StakePanel } from "@/components/StakePanel";
import { useDeck } from "@/hooks/useDeck";
import { useOpenCase } from "@/hooks/useOpenCase";
import { useInventory, useRefreshInventory, heldWeight, pickForRedeem } from "@/hooks/useInventory";
import { useRedeem } from "@/hooks/useRedeem";
import { useStake } from "@/hooks/useStake";
import { usePool } from "@/hooks/usePool";
import { useMegapot } from "@/hooks/useMegapot";
import { useVault } from "@/hooks/useVault";
import { specOf, ticketsFromWeight, isVault, type DeckShape } from "@/lib/deck";

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
  const pool = usePool(shape, deck?.drawn ?? 0, deckId);
  const megapot = useMegapot();

  const refresh = useCallback(async () => {
    await Promise.all([game.refetch(), refreshInventory(), pool.refetch(), megapot.refetch()]);
  }, [game, refreshInventory, pool, megapot]);

  const open = useOpenCase(refresh);
  const redeem = useRedeem(refresh);
  const stake = useStake(refresh);
  const vault = useVault(refresh);

  const weight = heldWeight(inventory.data);
  const toRedeem = pickForRedeem(inventory.data);
  const bonusTickets = ticketsFromWeight(weight);

  const vaultSlot = inventory.data?.find(
    (s) =>
      s.deckId === deckId &&
      s.value != null &&
      !s.spent &&
      s.signatures?.length &&
      isVault(specOf(s.value, shape)),
  );

  const decidingSlot = stake.open
    ? inventory.data?.find((s) => s.index === stake.decidingSlot)
    : undefined;

  const rolling = open.state.phase === "revealing" || open.state.phase === "landing";
  const busy = ["approving", "signing", "confirming", "revealing", "landing"].includes(
    open.state.phase,
  );
  const canOpen = isConnected && Boolean(deck) && !deck!.empty && game.canAfford && !busy;

  if (!deck) {
    return (
      <p className="py-20 text-center text-[1.0625rem] text-[var(--color-ink-dim)]">
        {game.isLoading ? "Reading the chain…" : "No such case."}
      </p>
    );
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <Link href="/" className="t-label hover:text-[var(--color-ink)]">
            ← all cases
          </Link>
          <h1 className="t-inscription mt-2 text-xl">case #{deck.id}</h1>
        </div>
        <p className="t-label">
          {deck.remaining} of {deck.size} unopened
        </p>
      </div>

      <section className="grid items-stretch gap-5 lg:grid-cols-2">
        <div className="surface flex min-h-[28rem] items-center justify-center overflow-hidden rounded-[var(--radius-panel)] p-6">
          {rolling ? (
            <Roll
              running
              landed={open.state.value != null ? specOf(open.state.value, shape) : undefined}
              deck={shape}
              pool={pool.data}
            />
          ) : (
            <Case
              phase={open.state.phase === "done" ? "opened" : "idle"}
              value={open.state.value}
              deck={shape}
              size={360}
              onClick={canOpen ? () => open.open({ deckId, needsApproval: game.needsApproval }) : undefined}
            />
          )}
        </div>

        <div className="surface flex flex-col justify-center rounded-[var(--radius-panel)] p-6 sm:p-8">
          {deck.vaultUpTo > 0 && (
            <div className="flex items-baseline gap-4 border-b border-[var(--edge)] pb-4">
              <div>
                <span className="t-label block">the vault</span>
                <span
                  className="t-chain block text-[clamp(1.75rem,4vw,2.5rem)] leading-none"
                  style={{ color: "var(--color-tier-vault)" }}
                >
                  ${Number(formatUnits(deck.vault, 6)).toFixed(2)}
                </span>
              </div>
              <span className="text-[0.9375rem] text-[var(--color-ink-dim)]">
                {!pool.data?.vaultTaken ? (
                  <>one case in {deck.remaining} opens it, and takes all of it</>
                ) : vaultSlot ? (
                  <span style={{ color: "var(--color-tier-vault)" }}>
                    you drew it, take it below
                  </span>
                ) : (
                  <>
                    the vault case has been drawn already · it pays out the moment its holder
                    claims it
                  </>
                )}
              </span>
            </div>
          )}

          <div className="mt-5 min-h-[6rem]">
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

          <div className="mt-2">
            {!isConnected ? (
              <p className="text-[1.0625rem] text-[var(--color-ink-dim)]">
                Connect a wallet to open a case.
              </p>
            ) : deck.empty ? (
              <p className="text-[1.0625rem] text-[var(--color-ink-dim)]">
                Every case in this season has been opened.
              </p>
            ) : !game.canAfford ? (
              <p className="text-[1.0625rem] text-[var(--color-ink-dim)]">
                You need $1 in test dollars, mint some from the header, they are free.
              </p>
            ) : (
              <Button
                block
                disabled={busy}
                onClick={() =>
                  open.state.phase === "done" || open.state.phase === "failed"
                    ? open.reset()
                    : open.open({ deckId, needsApproval: game.needsApproval })
                }
              >
                {busy
                  ? "…"
                  : open.state.phase === "done" || open.state.phase === "failed"
                    ? "Open another · $1"
                    : game.needsApproval
                      ? "Approve once, then open · $1"
                      : "Open a case · $1"}
              </Button>
            )}

            {open.state.txUrl && !busy && (
              <a
                href={open.state.txUrl}
                target="_blank"
                rel="noreferrer"
                className="t-label mt-3 block hover:text-[var(--color-ink)]"
              >
                view transaction
              </a>
            )}
          </div>

          {vaultSlot && vault.state.phase !== "done" && (
            <div className="mt-4">
              <Button
                block
                disabled={vault.state.phase === "signing" || vault.state.phase === "confirming"}
                onClick={() =>
                  vault.claim(vaultSlot.index, vaultSlot.value!, vaultSlot.signatures!)
                }
              >
                {vault.state.phase === "signing" || vault.state.phase === "confirming"
                  ? "Opening the vault…"
                  : `Take the vault · $${Number(formatUnits(deck.vault, 6)).toFixed(2)}`}
              </Button>
              {vault.state.error && (
                <p className="mt-3 text-[0.9375rem] text-[var(--color-danger)]">
                  {vault.state.error.title}
                </p>
              )}
            </div>
          )}

          {vault.state.phase === "done" && (
            <p className="mt-4 text-[1.0625rem]" style={{ color: "var(--color-tier-vault)" }}>
              The vault paid you ${Number(formatUnits(vault.state.paid ?? 0n, 6)).toFixed(2)}.
            </p>
          )}
        </div>
      </section>

      {(bonusTickets > 0 || stake.open || stake.bankedWeight > 0) && (
        <section className="surface mt-5 rounded-[var(--radius-panel)] p-6 sm:p-8">
          <p className="t-label">your bonus</p>
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
            redeeming={redeem.state.phase === "signing" || redeem.state.phase === "confirming"}
            treasury={game.treasury}
            ticketPrice={game.ticketPrice}
          />

          {redeem.state.phase === "done" && (
            <p className="mt-4 text-[0.9375rem] text-[var(--color-accent-bright)]">
              Claimed. The game bought you {redeem.state.tickets ?? 1} more real ticket
              {(redeem.state.tickets ?? 1) > 1 ? "s" : ""}.
            </p>
          )}
          {redeem.state.error && (
            <p className="mt-4 text-[0.9375rem] text-[var(--color-danger)]">
              {redeem.state.error.title}
            </p>
          )}
        </section>
      )}

      <section className="surface mt-5 rounded-[var(--radius-panel)] p-6 sm:p-8">
        <p className="t-label mb-5">what is in this case</p>
        <Contents deck={shape} pool={pool.data} />
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="surface rounded-[var(--radius-panel)] p-6 sm:p-8">
          <p className="t-label mb-4">what is still in the pool</p>
          <PoolCounter deck={shape} drawn={deck.drawn} pool={pool.data} />
        </div>
        <div className="surface rounded-[var(--radius-panel)] p-6 sm:p-8">
          <p className="t-label mb-4">your Megapot, from here</p>
          <MegapotPanel mp={megapot} />
        </div>
      </section>
    </>
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
  const dim = "text-[1.0625rem] text-[var(--color-ink-dim)]";

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
          Ticket bought. Now the covalidators decrypt your case, a few seconds we do not
          control.
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
            <p className="mt-3 text-[1.0625rem] text-[var(--color-ink-dim)]">
              Everything it holds is yours. Claim it below.
            </p>
          </div>
        );
      }
      return (
        <div>
          <p className="text-[1.25rem] text-[var(--color-ink)]">
            You own <span className="text-[var(--color-accent-bright)]">1 more real ticket</span>.
          </p>
          {spec.tickets > 0 ? (
            <p className="t-inscription mt-3 text-2xl" style={{ color: spec.ink }}>
              and the case paid {spec.tickets} more
            </p>
          ) : (
            <p className="mt-3 text-[1.0625rem] text-[var(--color-ink-faint)]">
              The case was empty. Most of them are.
            </p>
          )}
        </div>
      );
    }
    case "failed":
      return (
        <div>
          <p className="text-[1.0625rem] text-[var(--color-danger)]">{open.error?.title}</p>
          {open.error?.next && (
            <p className="mt-1 text-[0.9375rem] text-[var(--color-ink-faint)]">
              {open.error.next}
            </p>
          )}
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
