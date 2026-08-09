"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, Sparkles, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Tally } from "@/components/ui/Tally";
import { TierPlate } from "@/components/ui/TierPlate";
import { Case } from "@/components/Case";
import { OpenTheatre } from "@/components/OpenTheatre";
import { Drops } from "@/components/Drops";
import { PoolGrid } from "@/components/PoolGrid";
import { MegapotPanel } from "@/components/MegapotPanel";
import { StakePanel } from "@/components/StakePanel";
import { StartHere } from "@/components/StartHere";
import { useDeck } from "@/hooks/useDeck";
import { useOpenCase } from "@/hooks/useOpenCase";
import { useInventory, useRefreshInventory, heldWeight, pickForRedeem } from "@/hooks/useInventory";
import { useRefreshOpens } from "@/hooks/useOpens";
import { useRedeem } from "@/hooks/useRedeem";
import { useStake } from "@/hooks/useStake";
import { usePool } from "@/hooks/usePool";
import { useMegapot } from "@/hooks/useMegapot";
import { useVault } from "@/hooks/useVault";
import {
  specOf,
  slotsPerTier,
  bestTier,
  ticketsFromWeight,
  WEIGHT_PER_TICKET,
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
  const redeem = useRedeem(refresh);
  const stake = useStake(refresh);
  const vault = useVault(refresh);

  const weight = heldWeight(inventory.data);
  const tesa = (inventory.data ?? []).filter(
    (sl) => sl.value != null && !sl.spent && !sl.locked && isShard(specOf(sl.value, shape)),
  ).length;
  const toRedeem = pickForRedeem(inventory.data);
  const bonusTickets = ticketsFromWeight(weight);

  const vaultSlot = inventory.data?.find(
    (s) =>
      s.deckId === deckId &&
      s.value != null &&
      !s.spent &&
      !s.locked &&
      s.signatures?.length &&
      isVault(specOf(s.value, shape)),
  );

  const decidingSlot = stake.open
    ? inventory.data?.find((s) => s.index === stake.decidingSlot)
    : undefined;

  const busy = ["approving", "signing", "confirming", "revealing", "landing"].includes(
    open.state.phase,
  );
  const canOpen = isConnected && Boolean(deck) && !deck!.empty && game.canAfford && !busy;

  if (!deck) {
    return (
      <div className="w-full bg-[var(--color-section)] px-4 py-10 lg:px-8 2xl:px-14">
        <p className="py-20 text-center text-slate-300">
          {game.isLoading ? "Reading the chain…" : "No such case."}
        </p>
      </div>
    );
  }

  const tiers = slotsPerTier(deck);
  const best = bestTier(deck);
  const ink = deck.empty ? "var(--color-tier-grout)" : (best?.ink ?? "var(--color-accent)");
  const prizes = tiers.filter((t) => t.weight > 0).reduce((n, t) => n + t.count, 0);
  const paying = prizes + deck.vaultUpTo;
  const oneIn = paying > 0 ? Math.max(1, Math.round(deck.size / paying)) : 0;

  return (
    <div className="w-full bg-[var(--color-section)] px-4 py-6 lg:px-8 2xl:px-14">
      <OpenTheatre
        open={open.state}
        deck={shape}
        pool={pool.data}
        vault={deck?.vault}
        onClose={open.reset}
      />

      <div className="mx-auto flex max-w-[1320px] flex-col gap-5">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-4 md:flex-row md:items-end">
          <div>
            <Link
              href="/#decks"
              className="t-label inline-flex items-center gap-1 hover:text-[var(--color-accent-hover)]"
            >
              <ChevronLeft className="h-4 w-4" />
              all decks
            </Link>
            <h1 className="t-page mt-2 flex flex-wrap items-baseline gap-3 text-white">
              <span>{deck.empty ? "Emptied" : (best?.name ?? "Sealed")} case</span>
              <span className="t-chain text-lg font-bold text-[var(--color-ink-dim)]">
                #{deck.id}
              </span>
            </h1>
            <p className="mt-1.5 max-w-xl text-base leading-snug text-slate-200">
              A dollar buys a real Megapot ticket, the case comes on top. Finite deck, drawn
              without replacement: what someone else took is gone for you too.
            </p>
          </div>

          <div className="flex items-end gap-7">
            <Tally label="still sealed" value={deck.remaining} note={`of ${deck.size}`} />
            <Tally label="drawn" value={deck.drawn} />
            {oneIn > 0 && <Tally label="pays, as cut" value={`1 in ${oneIn}`} />}
          </div>
        </div>

        <section className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex flex-col gap-4">
          <div
            className="frame relative flex w-full flex-col"
            style={{ borderColor: `color-mix(in oklab, ${ink} 20%, transparent)` }}
          >
            <span className="absolute left-5 top-5 z-10">
              <TierPlate name={deck.empty ? "emptied" : (best?.name ?? "sealed")} ink={ink} />
            </span>
            <span className="t-chain absolute right-5 top-5 z-10 text-xs text-slate-400">
              {deck.remaining} sealed
            </span>

            <div className="relative grid place-items-center px-6 pb-1 pt-12 sm:px-8">
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-12 inset-y-6 rounded-full opacity-20 blur-3xl"
                style={{ background: ink }}
              />
              <div className="relative">
                <Case
                  phase={open.state.phase === "done" ? "opened" : "idle"}
                  value={open.state.value}
                  deck={shape}
                  risk={open.state.risk}
                  vault={deck.vault}
                  size={300}
                  onClick={
                    canOpen
                      ? () => open.open({ deckId, needsApproval: game.needsApproval })
                      : undefined
                  }
                />
                {open.state.phase === "idle" && !deck.empty && (
                  <span
                    className="t-chain absolute bottom-1 left-1/2 -translate-x-1/2 rounded border px-3 py-1 text-xs font-extrabold"
                    style={{
                      background: "rgb(0 0 0 / 0.45)",
                      borderColor: `color-mix(in oklab, ${ink} 30%, transparent)`,
                      color: ink,
                    }}
                  >
                    $1.00
                  </span>
                )}
              </div>
            </div>

            <div className="border-t border-slate-800/70 p-5">
              <div className="min-h-[3.5rem]">
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

              <div className="mt-3">
                {deck.empty ? (
                  <p className="text-base text-slate-200">Every case in this deck has been opened.</p>
                ) : !isConnected || !game.canAfford ? (
                  <StartHere what="A case" />
                ) : (
                  <>
                    <Button
                      block
                      disabled={busy}
                      className="py-4 text-base"
                      onClick={() =>
                        open.state.phase === "done" || open.state.phase === "failed"
                          ? open.reset()
                          : open.open({ deckId, needsApproval: game.needsApproval })
                      }
                    >
                      <Sparkles className="h-5 w-5 fill-slate-950" />
                      {busy
                        ? "…"
                        : open.state.phase === "done" || open.state.phase === "failed"
                          ? "Open another • $1"
                          : game.needsApproval
                            ? "Approve once, then open • $1"
                            : "Open a case • $1"}
                    </Button>

                    {deck.vaultUpTo > 0 && open.state.phase !== "done" && (
                      <ForfeitAction
                        disabled={busy}
                        vault={deck.vault}
                        ticketPrice={game.ticketPrice}
                        onClick={() =>
                          open.open({ deckId, needsApproval: game.needsApproval, risk: true })
                        }
                      />
                    )}
                  </>
                )}

                {open.state.txUrl && !busy && (
                  <a
                    href={open.state.txUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="t-label mt-3 block hover:text-[var(--color-accent-hover)]"
                  >
                    view transaction ↗
                  </a>
                )}
              </div>

              {vaultSlot && vault.state.phase !== "done" && (
                <div className="mt-4">
                  <Button
                    block
                    className="py-4"
                    disabled={vault.state.phase === "signing" || vault.state.phase === "confirming"}
                    onClick={() =>
                      vault.claim(vaultSlot.index, vaultSlot.value!, vaultSlot.signatures!)
                    }
                  >
                    <Lock className="h-4 w-4" />
                    {vault.state.phase === "signing" || vault.state.phase === "confirming"
                      ? "Opening the vault…"
                      : `Take the vault • $${Number(formatUnits(deck.vault, 6)).toFixed(2)}`}
                  </Button>
                  {vault.state.error && (
                    <p className="mt-3 text-sm text-[var(--color-danger)]">
                      {vault.state.error.title}
                    </p>
                  )}
                </div>
              )}

              {vault.state.phase === "done" && (
                <p className="mt-4 text-lg" style={{ color: "var(--color-tier-vault)" }}>
                  The vault paid you ${Number(formatUnits(vault.state.paid ?? 0n, 6)).toFixed(2)}.
                </p>
              )}
            </div>
          </div>

          {deck.vaultUpTo > 0 && (
              <div
                className="slab p-5"
                style={{
                  borderColor: "color-mix(in oklab, var(--color-tier-vault) 32%, transparent)",
                  boxShadow: "0 0 25px color-mix(in oklab, var(--color-tier-vault) 12%, transparent)",
                }}
              >
                <span className="t-label flex items-center gap-2" style={{ color: "var(--color-tier-vault)" }}>
                  <Lock className="h-3.5 w-3.5" />
                  the vault
                </span>
                <span
                  className="t-chain mt-2 block text-3xl font-bold leading-none"
                  style={{ color: "var(--color-tier-vault)" }}
                >
                  ${Number(formatUnits(deck.vault, 6)).toFixed(2)}
                </span>
                <VaultStatus
                  taken={Boolean(pool.data?.vaultTaken)}
                  mine={Boolean(vaultSlot)}
                  remaining={deck.remaining}
                />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">

            <div className="slab p-5">
              <Drops deck={shape} drawn={deck.drawn} pool={pool.data} />
            </div>

            <div className="px-1">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
                <span className="t-label">the deck, one cell per case</span>
                <span className="t-chain text-xs text-slate-400">
                  {deck.drawn} drawn · {deck.remaining} sealed
                </span>
              </div>
              <PoolGrid size={deck.size} drawn={deck.drawn} ink={ink} />
            </div>
          </div>
        </section>

        {(bonusTickets > 0 || tesa > 0 || stake.open || stake.bankedWeight > 0) && (
          <section className="slab p-6 sm:p-8">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="t-label">your bonus</p>
              {tesa > 0 && (
                <span
                  className="t-chain flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-extrabold"
                  style={{
                    borderColor: "color-mix(in oklab, var(--color-tier-shard) 35%, transparent)",
                    background: "color-mix(in oklab, var(--color-tier-shard) 8%, transparent)",
                    color: "var(--color-tier-shard)",
                  }}
                >
                  {tesa} TESA
                  <span className="text-[var(--color-ink-dim)]">
                    {tesa % WEIGHT_PER_TICKET === 0
                      ? "· a ticket ready"
                      : `· ${WEIGHT_PER_TICKET - (tesa % WEIGHT_PER_TICKET)} to a ticket`}
                  </span>
                </span>
              )}
            </div>
            <StakePanel
              stake={stake}
              toRedeem={toRedeem}
              decided={
                decidingSlot?.value != null && decidingSlot.signatures && !decidingSlot.locked
                  ? { value: decidingSlot.value, signatures: decidingSlot.signatures }
                  : undefined
              }
              decidingInBattle={Boolean(decidingSlot?.locked)}
              onRedeem={() => redeem.redeem(toRedeem)}
              redeeming={redeem.state.phase === "signing" || redeem.state.phase === "confirming"}
              treasury={game.treasury}
              ticketPrice={game.ticketPrice}
              treasuryPerOpen={game.treasuryPerOpen}
            />

            {redeem.state.phase === "done" && (
              <p className="mt-4 text-sm text-[var(--color-accent-hover)]">
                Claimed. The game bought you {redeem.state.tickets ?? 1} more real ticket
                {(redeem.state.tickets ?? 1) > 1 ? "s" : ""}.
              </p>
            )}
            {redeem.state.error && (
              <p className="mt-4 text-sm text-[var(--color-danger)]">{redeem.state.error.title}</p>
            )}
          </section>
        )}

        <details id="megapot" className="slab scroll-mt-24 p-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
            <span className="t-label flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5" />
              your Megapot, from here
            </span>
            <span className="text-sm text-slate-300">
              the jackpot your tickets are in, open ▾
            </span>
          </summary>
          <div className="mt-5">
            <MegapotPanel mp={megapot} />
          </div>
        </details>
      </div>
    </div>
  );
}

/**
 *
 */
function ForfeitAction({
  disabled,
  vault,
  ticketPrice,
  onClick,
}: {
  disabled: boolean;
  vault: bigint;
  ticketPrice: bigint;
  onClick: () => void;
}) {
  //
  const toVault = ticketPrice - ticketPrice / BigInt(WEIGHT_PER_TICKET);
  const ink = "var(--color-tier-vault)";
  return (
    <div className="mt-3">
      <Button
        block
        variant="quiet"
        disabled={disabled}
        onClick={onClick}
        className="hover:!brightness-110"
        style={{
          color: ink,
          background: "color-mix(in oklab, var(--color-tier-vault) 8%, transparent)",
          borderColor: "color-mix(in oklab, var(--color-tier-vault) 40%, transparent)",
        }}
      >
        Risk it · give the ticket up
      </Button>
      <p className="mt-2.5 text-sm leading-relaxed text-slate-300">
        No Megapot ticket for you this time. Of your $1,{" "}
        <span style={{ color: ink }}>${Number(formatUnits(toVault, 6)).toFixed(2)}</span> goes
        straight into the vault, now at{" "}
        <span style={{ color: ink }}>${Number(formatUnits(vault, 6)).toFixed(2)}</span>, and the
        rest funds the prize budget. In exchange whatever you draw is{" "}
        <span className="text-slate-200">worth double</span>. Most cases carry no bonus, and
        double nothing is nothing.
      </p>
    </div>
  );
}

/**
 *
 */
function VaultStatus({
  taken,
  mine,
  remaining,
}: {
  taken: boolean;
  mine: boolean;
  remaining: number;
}) {
  const [ink, label, note] = mine
    ? ["var(--color-tier-vault)", "yours to take", "you drew it, claim it below"]
    : taken
      ? ["var(--color-ink-dim)", "drawn", "it pays out the moment its holder claims it"]
      : ["var(--color-tier-denarius)", "in pool", `one case in ${remaining} opens it`];

  return (
    <>
      <span className="mt-3 flex items-center gap-2">
        <span
          aria-hidden
          className="h-1.5 w-1.5 rounded-full"
          style={{
            background: ink,
            boxShadow: `0 0 8px ${ink}`,
            animation: taken && !mine ? undefined : "marker-live 2s ease-in-out infinite",
          }}
        />
        <span className="t-label" style={{ color: ink }}>
          {label}
        </span>
      </span>
      <p className="mt-2 text-sm text-slate-300">{note}</p>
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
  const dim = "text-base leading-relaxed text-slate-200";

  switch (open.phase) {
    case "approving":
      return <p className={dim}>Approving once. After this it is a single click, forever.</p>;
    case "signing":
      return <p className={dim}>Confirm in your wallet.</p>;
    case "confirming":
      return (
        <p className={dim}>
          {open.risk ? "Putting your dollar in the vault…" : "Buying your ticket…"}
        </p>
      );
    case "landing":
      return <p className={dim}>&nbsp;</p>;
    case "revealing":
      return open.resumed ? (
        <p className={dim}>Welcome back, this case was already paid for. Fetching it.</p>
      ) : open.risk ? (
        <p className={dim}>
          Ticket given up, dollar in the vault. Now the covalidators decrypt your case, a few
          seconds we do not control.
        </p>
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
      if (open.risk) {
        return (
          <div>
            <p className="text-xl text-slate-100">
              No ticket, your dollar went{" "}
              <span style={{ color: "var(--color-tier-vault)" }}>into the vault</span>.
            </p>
            {spec.tickets > 0 ? (
              <p className="t-inscription mt-3 text-2xl" style={{ color: spec.ink }}>
                and the case paid {spec.tickets * 2}, doubled
              </p>
            ) : isShard(spec) ? (
              <p className="t-inscription mt-3 text-2xl" style={{ color: spec.ink }}>
                and the case paid 1 TESA, worth two, doubled
              </p>
            ) : (
              <p className="mt-3 text-slate-400">
                The case was empty, and double nothing is nothing. That was the bet.
              </p>
            )}
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
