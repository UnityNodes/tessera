"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { Chest } from "@/components/Chest";
import { StakePanel } from "@/components/StakePanel";
import { useDeck } from "@/hooks/useDeck";
import { useInventory, useRefreshInventory, heldWeight, pickForRedeem } from "@/hooks/useInventory";
import { useRefreshOpens } from "@/hooks/useOpens";
import { useRedeem } from "@/hooks/useRedeem";
import { useStake } from "@/hooks/useStake";
import { useMegapot } from "@/hooks/useMegapot";
import { useBattleList } from "@/hooks/useBattles";
import { specOf, isShard, isVault, ticketsFromWeight, WEIGHT_PER_TICKET } from "@/lib/deck";
import { addressUrl } from "@/lib/chain";

/**
 * What you have in hand.
 *
 * Everything on this page is read from the chain: the slots from the contract,
 * their values from the covalidators, the tickets from Megapot itself. Nothing is
 * stored on our side, so there is nothing to show here except what has already
 * happened.
 *
 * A slot is judged by the table of ITS OWN deck: seasons have different tables,
 * and the same value number is worth different things in different decks.
 */
export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const game = useDeck();
  const megapot = useMegapot();
  const battles = useBattleList();
  const inventory = useInventory(game.decks);
  const refreshInventory = useRefreshInventory();
  const refreshOpens = useRefreshOpens();

  const refresh = useCallback(async () => {
    await Promise.all([game.refetch(), refreshInventory(), refreshOpens(), megapot.refetch()]);
  }, [game, refreshInventory, refreshOpens, megapot]);

  const redeem = useRedeem(refresh);
  const stake = useStake(refresh);

  const shapeOf = useMemo(
    () => (deckId: number) => {
      const d = game.decks[deckId];
      return { size: d?.size ?? 0, tiers: d?.tiers ?? [], vaultUpTo: d?.vaultUpTo ?? 0 };
    },
    [game.decks],
  );

  const slots = (inventory.data ?? []).filter((s) => s.value != null && !s.spent);
  const weight = heldWeight(inventory.data);
  const toRedeem = pickForRedeem(inventory.data);
  const decidingSlot = stake.open
    ? inventory.data?.find((s) => s.index === stake.decidingSlot)
    : undefined;
  const tesa = slots.filter((s) => !s.locked && isShard(specOf(s.value!, shapeOf(s.deckId)))).length;
  const mine = battles.all.filter(
    (b) =>
      address &&
      (b.a.toLowerCase() === address.toLowerCase() || b.b.toLowerCase() === address.toLowerCase()),
  );

  if (!isConnected) {
    return (
      <div className="w-full bg-[var(--color-section)] px-4 py-20 text-center lg:px-8">
        <p className="text-slate-300">
          Connect a wallet to see what is yours. Nothing here is stored by us; it is read from
          the chain against your address.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full bg-[var(--color-section)] px-4 py-10 lg:px-8 2xl:px-14">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-8">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <h1 className="t-page text-white">Your shelf</h1>
            <a
              href={addressUrl(address!)}
              target="_blank"
              rel="noreferrer"
              className="t-addr mt-2 block text-sm text-slate-400 transition-colors hover:text-[var(--color-accent-hover)]"
            >
              {address}
            </a>
          </div>
        </div>

        {/* -- four numbers ---------------------------------------------- */}
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(12rem,1fr))]">
          <Stat
            value={String(Math.round(megapot.tickets))}
            label="real Megapot tickets"
            tone="var(--color-accent)"
          />
          <Stat
            value={String(tesa)}
            label={
              tesa > 0 && tesa % WEIGHT_PER_TICKET === 0
                ? "TESA · a ticket ready"
                : `TESA · ${(WEIGHT_PER_TICKET - (tesa % WEIGHT_PER_TICKET)) % WEIGHT_PER_TICKET || WEIGHT_PER_TICKET} to a ticket`
            }
            tone="var(--color-tier-shard)"
          />
          <Stat
            value={String(ticketsFromWeight(weight))}
            label="bonus tickets unclaimed"
            tone="var(--color-tier-denarius)"
          />
          <Stat value={String(mine.length)} label="battles fought" />
        </div>

        {/* -- take what you collected ----------------------------------
            The shelf showed TESA and "bonus tickets unclaimed", and had no button
            at all. The exchange lived on the case page, under the heading "your
            bonus", that is, where a player goes to spend a dollar rather than
            where their property lies. Whoever came to look at what they had
            collected saw a number and a dead end.

            The panel is the same one as on the case page: one exchange behaviour
            for the whole site rather than two that will drift apart later. */}
        {(ticketsFromWeight(weight) > 0 || tesa > 0 || stake.open || stake.bankedWeight > 0) && (
          <section className="slab p-6 sm:p-8">
            <p className="t-label mb-1">what you can claim</p>
            <p className="text-sm text-slate-300">
              Five TESA make one real Megapot ticket. A Denarius slot is worth five on its own, a
              top-tier slot twenty-five.
            </p>
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
            {toRedeem.length === 0 && tesa > 0 && !stake.open && (
              <p className="mt-4 text-sm text-slate-400">
                Not a full ticket yet. {WEIGHT_PER_TICKET - (weight % WEIGHT_PER_TICKET)} more TESA
                and this turns into a real ticket:{" "}
                <Link href="/#decks" className="text-[var(--color-accent-hover)] hover:underline">
                  every deck says how many it still holds
                </Link>
                .
              </p>
            )}
          </section>
        )}

        {/* -- the inventory --------------------------------------------- */}
        <section>
          <p className="t-label mb-4">every slot you drew</p>
          {slots.length === 0 ? (
            <p className="rounded-[var(--radius-panel)] border border-dashed border-[var(--edge)] p-10 text-center text-sm text-slate-400">
              {inventory.isLoading
                ? "Reading the chain…"
                : "Nothing yet. Every case you open lands here."}
            </p>
          ) : (
            <ul className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(9rem,1fr))]">
              {slots.map((s) => {
                const spec = specOf(s.value!, shapeOf(s.deckId));
                return (
                  <li
                    key={s.index}
                    className="flex flex-col items-center gap-1 rounded-[var(--radius-control)] border p-3 text-center"
                    style={{
                      background: "var(--color-surface)",
                      borderColor: `color-mix(in oklab, ${spec.ink} 27%, transparent)`,
                    }}
                    data-tier={spec.rarity}
                  >
                    <Chest rarity={spec.rarity} size={72} />
                    <span className="t-chain text-xs font-bold" style={{ color: spec.ink }}>
                      {spec.name}
                    </span>
                    <span className="text-xs text-slate-400">
                      deck #{s.deckId}
                      {s.risk ? " · risked" : ""}
                      {s.locked ? " · in a battle" : ""}
                    </span>
                    {isVault(spec) && (
                      <Link
                        href={`/case/${s.deckId}`}
                        className="t-chain text-xs font-bold text-[var(--color-tier-vault)]"
                      >
                        open the vault →
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <p className="text-xs text-slate-400">
          Slots the covalidators have not returned yet are not shown. They exist on chain and
          appear here as soon as their value is readable. A slot committed to an unsettled battle
          stays on the shelf but cannot be spent until the battle is settled.
        </p>
      </div>
    </div>
  );
}

function Stat({ value, label, tone }: { value: string; label: string; tone?: string }) {
  return (
    <div
      className="rounded-[14px] border px-5 py-4"
      style={{
        background: "var(--color-surface)",
        borderColor: tone ? `color-mix(in oklab, ${tone} 18%, transparent)` : "var(--edge)",
      }}
    >
      <div
        className="t-chain text-2xl font-extrabold leading-none"
        style={{ color: tone ?? "var(--color-ink)" }}
      >
        {value}
      </div>
      <div className="t-label mt-2">{label}</div>
    </div>
  );
}
