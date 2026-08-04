"use client";

import { useCallback, useMemo } from "react";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { motion, AnimatePresence } from "motion/react";
import { ConnectBar } from "@/components/ConnectBar";
import { Button } from "@/components/ui/Button";
import { Case } from "@/components/Case";
import { Roll } from "@/components/Roll";
import { Ticker } from "@/components/Ticker";
import { PoolCounter } from "@/components/PoolCounter";
import { MegapotPanel } from "@/components/MegapotPanel";
import { StakePanel } from "@/components/StakePanel";
import { Battles } from "@/components/Battles";
import { useDeck } from "@/hooks/useDeck";
import { useOpenCase } from "@/hooks/useOpenCase";
import { useInventory, useRefreshInventory, heldWeight, pickForRedeem } from "@/hooks/useInventory";
import { useRedeem } from "@/hooks/useRedeem";
import { useStake } from "@/hooks/useStake";
import { usePool } from "@/hooks/usePool";
import { useFeed } from "@/hooks/useFeed";
import { useOpens } from "@/hooks/useOpens";
import { useMegapot } from "@/hooks/useMegapot";
import { useVault } from "@/hooks/useVault";
import { useBattles } from "@/hooks/useBattles";
import { specOf, slotsPerTier, ticketsFromWeight, isVault, type DeckShape } from "@/lib/deck";
import { addressUrl, DECK_ADDRESS } from "@/lib/chain";

/**
 *
 *
 */
export default function Home() {
  const { isConnected } = useAccount();
  const deck = useDeck();

  const shape = useMemo(
    () => ({ size: deck.size, tiers: deck.tiers, vaultUpTo: deck.vaultUpTo }),
    [deck.size, deck.tiers, deck.vaultUpTo],
  );

  const inventory = useInventory(shape);
  const refreshInventory = useRefreshInventory();
  const pool = usePool(shape, deck.drawn);
  const feed = useFeed(shape);
  const megapot = useMegapot();
  const opens = useOpens();

  const refresh = useCallback(async () => {
    await Promise.all([deck.refetch(), refreshInventory(), pool.refetch(), megapot.refetch()]);
  }, [deck, refreshInventory, pool, megapot]);

  const open = useOpenCase(refresh);
  const redeem = useRedeem(refresh);
  const stake = useStake(refresh);
  const vault = useVault(refresh);
  const battles = useBattles(refresh);

  const weight = heldWeight(inventory.data);
  const toRedeem = pickForRedeem(inventory.data);
  const bonusTickets = ticketsFromWeight(weight);

  //
  const vaultSlot = inventory.data?.find(
    (s) => s.value != null && !s.spent && s.signatures?.length && isVault(specOf(s.value, shape)),
  );

  const decidingSlot = stake.open
    ? inventory.data?.find((s) => s.index === stake.decidingSlot)
    : undefined;

  const rolling = open.state.phase === "revealing" || open.state.phase === "landing";
  const busy = ["approving", "signing", "confirming", "revealing", "landing"].includes(
    open.state.phase,
  );
  const canOpen = isConnected && !deck.deckEmpty && deck.canAfford && !busy;
  const prizesLeft =
    pool.data?.prizesLeft ??
    slotsPerTier(shape)
      .filter((t) => t.weight > 0)
      .reduce((n, t) => n + t.count, 0);
  const playerCount = new Set((opens.data ?? []).map((o) => o.player.toLowerCase())).size;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-[var(--edge)] bg-[color-mix(in_oklab,var(--color-grout)_88%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-6 px-4 sm:px-6">
          <a href="#top" className="t-inscription shrink-0 text-[0.9375rem]">
            Tessera
          </a>
          <span className="t-label hidden shrink-0 sm:block">season {deck.season}</span>

          <nav className="hidden flex-1 items-center gap-6 md:flex">
            <NavLink href="#top">the case</NavLink>
            <NavLink href="#battles">battles</NavLink>
            <NavLink href="#proof">proof</NavLink>
          </nav>

          <div className="ml-auto">
            <ConnectBar onMinted={refresh} />
          </div>
        </div>
      </header>

      <div className="border-b border-[var(--edge)] bg-[var(--color-stone-900)]">
        <div className="mx-auto grid max-w-[1440px] grid-cols-2 divide-x divide-[var(--edge)] px-4 sm:px-6 md:grid-cols-4">
          <Stat label="cases opened" value={String(deck.drawn)} />
          <Stat label="players" value={String(playerCount)} />
          <Stat label="prizes left" value={`${prizesLeft} of ${deck.remaining}`} />
          <Stat
            label="your tickets"
            value={megapot.tickets.toFixed(0)}
            ink="var(--color-patina-400)"
          />
        </div>
      </div>

      <div className="border-b border-[var(--edge)] bg-[color-mix(in_oklab,var(--color-stone-900)_60%,transparent)]">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6">
          <Ticker items={feed} />
        </div>
      </div>

      <main id="top" className="mx-auto max-w-[1440px] px-4 pb-24 pt-8 sm:px-6">
        <section className="grid items-stretch gap-5 lg:grid-cols-2">
          <div className="surface flex min-h-[26rem] items-center justify-center overflow-hidden rounded-[3px] p-6">
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
                size={340}
                onClick={
                  canOpen ? () => open.open({ needsApproval: deck.needsApproval }) : undefined
                }
              />
            )}
          </div>

          <div className="surface flex flex-col justify-center rounded-[3px] p-6 sm:p-8">
            <h1 className="t-display text-[clamp(1.75rem,3.4vw,2.75rem)]">
              $1 buys a real lottery ticket.
              <br />
              <span className="text-[var(--color-sinopia-400)]">The case is free.</span>
            </h1>

            {deck.vaultUpTo > 0 && (
              <div className="mt-6 flex items-baseline gap-4 border-y border-[var(--edge)] py-4">
                <div>
                  <span className="t-label block">the vault</span>
                  <span
                    className="t-chain block text-[clamp(1.75rem,4vw,2.5rem)] leading-none"
                    style={{ color: "var(--color-porphyry-300)" }}
                  >
                    ${Number(formatUnits(deck.vault, 6)).toFixed(2)}
                  </span>
                </div>
                <span className="text-[0.9375rem] text-[var(--color-travertine-dim)]">
                  {!pool.data?.vaultTaken ? (
                    <>one case in {deck.remaining} opens it, and takes all of it</>
                  ) : vaultSlot ? (
                    <span style={{ color: "var(--color-porphyry-300)" }}>
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

            <div className="mt-5 min-h-[5rem]">
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
                  className="t-label mt-3 block hover:text-[var(--color-travertine)]"
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
                  <p className="mt-3 text-[0.9375rem] text-[var(--color-sinopia-400)]">
                    {vault.state.error.title}
                  </p>
                )}
              </div>
            )}

            {vault.state.phase === "done" && (
              <p className="mt-4 text-[1.0625rem]" style={{ color: "var(--color-porphyry-300)" }}>
                The vault paid you ${Number(formatUnits(vault.state.paid ?? 0n, 6)).toFixed(2)}.
              </p>
            )}
          </div>
        </section>

        {(bonusTickets > 0 || stake.open || stake.bankedWeight > 0) && (
          <section className="surface mt-5 rounded-[3px] p-6 sm:p-8">
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
              treasury={deck.treasury}
              ticketPrice={deck.ticketPrice}
            />

            {redeem.state.phase === "done" && (
              <p className="mt-4 text-[0.9375rem] text-[var(--color-patina-400)]">
                Claimed. The game bought you {redeem.state.tickets ?? 1} more real ticket
                {(redeem.state.tickets ?? 1) > 1 ? "s" : ""}.
              </p>
            )}
            {redeem.state.error && (
              <p className="mt-4 text-[0.9375rem] text-[var(--color-sinopia-400)]">
                {redeem.state.error.title}
              </p>
            )}
          </section>
        )}

        <Battles
          battles={battles}
          deck={shape}
          pool={pool.data}
          needsApproval={deck.needsApproval}
          canAfford={deck.canAfford}
          deckEmpty={deck.deckEmpty}
        />

        <section id="proof" className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="surface rounded-[3px] p-6 sm:p-8">
            <p className="t-label mb-4">what is still in the pool</p>
            <PoolCounter deck={shape} drawn={deck.drawn} pool={pool.data} />
          </div>

          <div className="surface rounded-[3px] p-6 sm:p-8">
            <p className="t-label mb-4">your Megapot, from here</p>
            <MegapotPanel mp={megapot} />
          </div>
        </section>

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--edge)] pt-6">
          <span className="t-label">Tessera · Base Sepolia · Inco Lightning</span>
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
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="t-label hover:text-[var(--color-travertine)]">
      {children}
    </a>
  );
}

function Stat({ label, value, ink }: { label: string; value: string; ink?: string }) {
  return (
    <div className="px-4 py-3">
      <span className="t-label block">{label}</span>
      <span
        className="t-chain mt-1 block text-lg"
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
  deck: DeckShape;
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
          Ticket bought. Now the covalidators decrypt your case, a few seconds we do not
          control.
        </p>
      );
    case "done": {
      const spec = specOf(open.value!, deck);
      if (isVault(spec)) {
        return (
          <div>
            <p className="t-inscription text-2xl" style={{ color: "var(--color-porphyry-300)" }}>
              you found the vault
            </p>
            <p className="mt-3 text-[1.0625rem] text-[var(--color-travertine-dim)]">
              Everything it holds is yours. Claim it below.
            </p>
          </div>
        );
      }
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
          The same ticket sold on megapot.io, bought for you in the same transaction that opens
          the case.
        </p>
      );
  }
}
