"use client";

import { useCallback, useMemo } from "react";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { ConnectBar } from "@/components/ConnectBar";
import { Button } from "@/components/ui/Button";
import { Panel, DataRow } from "@/components/ui/Panel";
import { Tessera } from "@/components/Tessera";
import { Case } from "@/components/Case";
import { PoolCounter } from "@/components/PoolCounter";
import { ShardMeter } from "@/components/ShardMeter";
import { useDeck } from "@/hooks/useDeck";
import { useOpenCase } from "@/hooks/useOpenCase";
import { useInventory, useRefreshInventory, heldWeight, pickForRedeem } from "@/hooks/useInventory";
import { useRedeem } from "@/hooks/useRedeem";
import { usePool } from "@/hooks/usePool";
import { specOf, slotsPerTier } from "@/lib/deck";
import { addressUrl, DECK_ADDRESS } from "@/lib/chain";

export default function Home() {
  const { isConnected } = useAccount();
  const deck = useDeck();

  const shape = useMemo(() => ({ size: deck.size, tiers: deck.tiers }), [deck.size, deck.tiers]);

  const inventory = useInventory(shape);
  const refreshInventory = useRefreshInventory();
  const pool = usePool(shape, deck.drawn);

  const refresh = useCallback(async () => {
    await Promise.all([deck.refetch(), refreshInventory(), pool.refetch()]);
  }, [deck, refreshInventory, pool]);

  const open = useOpenCase(refresh);
  const redeem = useRedeem(refresh);

  const weight = heldWeight(inventory.data);
  const toRedeem = pickForRedeem(inventory.data);

  const casePhase =
    open.state.phase === "done"
      ? "opened"
      : open.state.phase === "revealing" || open.state.phase === "confirming"
        ? "waiting"
        : "idle";

  const busy = ["approving", "signing", "confirming", "revealing"].includes(open.state.phase);
  const canOpen = isConnected && !deck.deckEmpty && deck.canAfford && !busy;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12 md:py-20">
      <header className="mb-10 flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="t-label mb-4">Tessera · Base Sepolia · season {deck.season}</p>
          <h1 className="t-display text-[clamp(2rem,5.5vw,3.5rem)]">
            One dollar buys a real
            <br />
            lottery ticket.{" "}
            <span className="text-[var(--color-sinopia-400)]">The case is on top.</span>
          </h1>
        </div>
        <ConnectBar onMinted={refresh} />
      </header>

      <div className="mb-8 flex flex-wrap gap-3">
        {slotsPerTier(shape).map((t) => (
          <div key={t.weight} className="surface flex items-center gap-3 rounded-[3px] px-4 py-3">
            <span
              className="h-8 w-8 shrink-0 rounded-[2px]"
              style={{
                background: t.spec.tint,
                boxShadow: "inset 0 0 0 1px var(--edge-strong), inset 0 1px 0 rgb(255 255 255/0.1)",
              }}
            />
            <span>
              <span className="t-inscription block text-[0.6875rem]" style={{ color: t.spec.ink }}>
                {t.count}× {t.spec.name}
              </span>
              <span className="block text-[0.8125rem] text-[var(--color-travertine-faint)]">
                {t.spec.note}
              </span>
            </span>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <Panel label="Open">
          <div className="flex flex-col items-center gap-7 py-4">
            <Case
              phase={casePhase}
              value={open.state.value}
              deck={shape}
              size={300}
              onClick={canOpen ? () => open.open({ needsApproval: deck.needsApproval }) : undefined}
            />

            <div className="min-h-[4.5rem] text-center">
              <Status open={open.state} deck={shape} />
            </div>

            {!isConnected ? (
              <p className="text-[0.9375rem] text-[var(--color-travertine-dim)]">
                Connect a wallet to open a case.
              </p>
            ) : deck.deckEmpty ? (
              <p className="text-[0.9375rem] text-[var(--color-travertine-dim)]">
                Every slot of this season has been drawn.
              </p>
            ) : !deck.canAfford ? (
              <p className="text-[0.9375rem] text-[var(--color-travertine-dim)]">
                You need $1 in test dollars. Mint some above, they are free.
              </p>
            ) : open.state.phase === "done" || open.state.phase === "failed" ? (
              <Button onClick={open.reset}>Open another · $1</Button>
            ) : (
              <Button
                block
                disabled={busy}
                onClick={() => open.open({ needsApproval: deck.needsApproval })}
              >
                {deck.needsApproval ? "Approve once, then open · $1" : "Open a case · $1"}
              </Button>
            )}

            {open.state.txUrl && (
              <a
                href={open.state.txUrl}
                target="_blank"
                rel="noreferrer"
                className="t-label hover:text-[var(--color-travertine)]"
              >
                view transaction
              </a>
            )}
          </div>
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel label="Verifiable, not promised">
            <PoolCounter pool={pool.data} />
          </Panel>

          <Panel label="Your inventory">
            <ShardMeter weight={weight} />

            {toRedeem.length > 0 && (
              <Button
                block
                className="mt-6"
                variant="quiet"
                disabled={redeem.state.phase === "signing" || redeem.state.phase === "confirming"}
                onClick={() => redeem.redeem(toRedeem)}
              >
                {redeem.state.phase === "signing"
                  ? "Confirm in wallet…"
                  : redeem.state.phase === "confirming"
                    ? "Claiming…"
                    : "Claim real tickets"}
              </Button>
            )}

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

            <div className="mt-6">
              <DataRow name="tickets held" value={deck.tickets.toFixed(2)} />
              <DataRow name="test dollars" value={`$${formatUnits(deck.balance, 6)}`} />
              <DataRow
                name="game treasury"
                value={`$${formatUnits(deck.treasury + deck.feesClaimable, 6)}`}
                ink="var(--color-ochre-300)"
              />
            </div>
          </Panel>
        </div>
      </div>

      {(inventory.data?.length ?? 0) > 0 && (
        <Panel label="Slots you hold" className="mt-6">
          <div className="flex flex-wrap gap-2">
            {inventory.data!.map((s) => (
              <div key={s.index} className={s.spent ? "opacity-30" : ""}>
                <Tessera
                  state={s.value == null ? "waiting" : "revealed"}
                  value={s.value}
                  deck={shape}
                  size={44}
                />
              </div>
            ))}
          </div>
          <p className="mt-5 text-[0.9375rem] text-[var(--color-travertine-dim)]">
            Dimmed tiles are already claimed.
          </p>
        </Panel>
      )}

      <footer className="mt-14 border-t border-[var(--edge)] pt-8">
        <a
          href={addressUrl(DECK_ADDRESS)}
          target="_blank"
          rel="noreferrer"
          className="t-chain text-[0.8125rem] text-[var(--color-travertine-faint)] hover:text-[var(--color-travertine)]"
        >
          {DECK_ADDRESS}
        </a>
      </footer>
    </main>
  );
}

/**
 */
function Status({
  open,
  deck,
}: {
  open: ReturnType<typeof useOpenCase>["state"];
  deck: { size: number; tiers: { upTo: number; weight: number }[] };
}) {
  const dim = "text-[0.9375rem] text-[var(--color-travertine-dim)]";

  switch (open.phase) {
    case "approving":
      return <p className={dim}>Approving once, after this, opening is a single click.</p>;
    case "signing":
      return <p className={dim}>Confirm in your wallet.</p>;
    case "confirming":
      return <p className={dim}>Buying your ticket and drawing a slot…</p>;
    case "revealing":
      return open.resumed ? (
        <p className={dim}>
          Welcome back. You opened this case before you left, it was drawn and paid for
          then, and it is still yours. Fetching what is inside.
        </p>
      ) : (
        <p className={dim}>
          Your slot is drawn and paid for. The covalidators are decrypting it, this takes
          a few seconds and we do not control it.
        </p>
      );
    case "done": {
      const spec = specOf(open.value!, deck);
      return (
        <div>
          <p className="t-inscription text-lg" style={{ color: spec.ink }}>
            {spec.name}
          </p>
          <p className="mt-2 text-[0.9375rem] text-[var(--color-travertine-dim)]">
            {spec.note} · slot {open.value} of {deck.size}
          </p>
        </div>
      );
    }
    case "failed":
      return (
        <div>
          <p className="text-[0.9375rem] text-[var(--color-sinopia-400)]">{open.error?.title}</p>
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
          A real Megapot ticket, and one slot from an encrypted pool that was sealed before
          anyone opened anything.
        </p>
      );
  }
}
