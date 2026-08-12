"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAccount } from "wagmi";
import { motion } from "motion/react";
import { ChevronLeft, Trophy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { TierPlate } from "@/components/ui/TierPlate";
import { Roll } from "@/components/Roll";
import { Chest } from "@/components/Chest";
import { StartHere } from "@/components/StartHere";
import { useDeck } from "@/hooks/useDeck";
import { usePool } from "@/hooks/usePool";
import { useBattle } from "@/hooks/useBattles";
import { specOf, isVault, type DeckShape, type TierSpec } from "@/lib/deck";

const TIMEOUT_MS = 15 * 60 * 1000;

/**
 *
 *
 *
 */
export default function BattlePage() {
  const params = useParams<{ id: string }>();
  const id = useMemo(() => {
    try {
      return BigInt(params.id);
    } catch {
      return undefined;
    }
  }, [params.id]);

  const { address } = useAccount();
  const game = useDeck();
  const fight = useBattle(id);
  const { battle, cards } = fight;

  const deck = game.decks.find((d) => d.id === battle?.deckId);
  const shape = useMemo(
    () => ({
      size: deck?.size ?? 0,
      tiers: deck?.tiers ?? [],
      vaultUpTo: deck?.vaultUpTo ?? 0,
    }),
    [deck?.size, deck?.tiers, deck?.vaultUpTo],
  );
  const pool = usePool(shape, deck?.drawn ?? 0, battle?.deckId ?? 0);

  const me = address?.toLowerCase();
  const iAmCreator = Boolean(battle && battle.a.toLowerCase() === me);
  const iAmIn = Boolean(battle && (iAmCreator || battle.b.toLowerCase() === me));
  const who = (a: `0x${string}`) => (me && a.toLowerCase() === me ? "you" : short(a));

  const specA = cards ? specOf(cards.a.value, shape) : undefined;
  const specB = cards ? specOf(cards.b.value, shape) : undefined;

  //
  const outcomeA =
    specA && specB && cards
      ? wins(power(specA), cards.a.value, power(specB), cards.b.value)
        ? "won"
        : "lost"
      : undefined;
  const outcomeB = outcomeA === "won" ? "lost" : outcomeA === "lost" ? "won" : outcomeA;

  if (!battle) {
    return (
      <div className="w-full bg-[var(--color-section)] px-4 py-10 lg:px-8 2xl:px-14">
        <p className="py-20 text-center text-slate-300">
          {id === undefined ? "No such battle." : "Reading the chain…"}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full bg-[var(--color-section)] px-4 py-10 lg:px-8 2xl:px-14">
      <div className="mx-auto flex max-w-[1320px] flex-col space-y-6">

        <div className="flex flex-col justify-between gap-5 border-b border-slate-800 pb-6 md:flex-row md:items-end">
          <div>
            <Link
              href="/battles"
              className="t-label inline-flex items-center gap-1 hover:text-[var(--color-accent-hover)]"
            >
              <ChevronLeft className="h-4 w-4" />
              all battles
            </Link>
            <h1 className="t-page mt-2 flex flex-wrap items-baseline gap-3 text-white">
              <span>Battle #{String(battle.id)}</span>
              <span className="t-chain text-lg font-bold text-[var(--color-ink-dim)]">
                deck #{battle.deckId}
              </span>
            </h1>
            <p className="mt-2 max-w-2xl text-base leading-relaxed text-slate-300">
              {battle.resolved
                ? "Settled on chain. Both cards are public, and so is the arithmetic that decided them."
                : battle.joined
                  ? "Both cards are on the table. Neither was readable until the second player had paid."
                  : "The creator's card is sealed until someone pays to face it, not even they can read it."}
            </p>
          </div>

          <StatusPill status={battle.resolved ? "done" : battle.joined ? "live" : "waiting"} />
        </div>

        <section className="grid gap-6 lg:grid-cols-2">
          <Side
            title={who(battle.a)}
            spec={specA}
            value={cards?.a.value}
            running={battle.joined}
            sealed={!battle.joined}
            outcome={outcomeA}
            deck={shape}
            pool={pool.data}
          />
          {battle.joined ? (
            <Side
              title={who(battle.b)}
              spec={specB}
              value={cards?.b.value}
              running
              outcome={outcomeB}
              deck={shape}
              pool={pool.data}
            />
          ) : (
            <OpenSeat
              ready={Boolean(address) && game.canAfford}
              canJoin={Boolean(address) && !iAmIn && game.canAfford && Boolean(deck) && !deck!.empty}
              busy={fight.busy}
              onJoin={() => void fight.join(game.needsApproval)}
            />
          )}
        </section>

        {fight.state.error && (
          <p className="text-center text-sm text-[var(--color-danger)]">
            {fight.state.error.title}
            {fight.state.error.next && (
              <span className="block text-slate-400">{fight.state.error.next}</span>
            )}
          </p>
        )}

        <section className="slab p-6 sm:p-8">
          {specA && specB ? (
            <Verdict
              specA={specA}
              specB={specB}
              valueA={cards!.a.value}
              valueB={cards!.b.value}
              iAmCreator={iAmCreator}
              watching={!iAmIn}
              settled={battle.resolved}
            />
          ) : battle.joined ? (
            <p className="text-center text-slate-300">
              The covalidators are turning both cards over, a few seconds we do not control.
            </p>
          ) : (
            <p className="text-center text-slate-300">
              Nobody can read either card yet. That is the point: there is no easy fight to pick.
            </p>
          )}

          {battle.joined && !battle.resolved && cards && (
            <div className="mx-auto mt-5 max-w-md">
              <Button
                block
                className="py-4"
                disabled={fight.busy}
                onClick={() => void fight.resolve()}
              >
                {fight.busy ? "Settling…" : "Settle the battle"}
              </Button>
              <p className="mt-2 text-center text-sm text-slate-400">
                Anyone can settle it, the loser cannot freeze it by staying away.
              </p>
            </div>
          )}

          {battle.waiting && iAmCreator && (
            <Abandon
              openedAt={battle.openedAt}
              busy={fight.busy}
              onAbandon={() => void fight.abandon()}
            />
          )}
        </section>
      </div>
    </div>
  );
}

type Outcome = "won" | "lost";

/**
 *
 *
 */
function Side({
  title,
  spec,
  value,
  running,
  sealed,
  outcome,
  deck,
  pool,
}: {
  title: string;
  spec?: TierSpec;
  value?: number;
  running: boolean;
  sealed?: boolean;
  outcome?: Outcome;
  deck: DeckShape;
  pool?: ReturnType<typeof usePool>["data"];
}) {
  const won = outcome === "won";
  const edge = won
    ? "rgb(57 255 136 / 0.45)"
    : outcome
      ? "var(--edge)"
      : spec
        ? `color-mix(in oklab, ${spec.ink} 25%, transparent)`
        : "var(--edge)";

  return (
    <div
      data-card={spec ? spec.name : sealed ? "sealed" : "pending"}
      className="relative flex flex-col overflow-hidden rounded-[20px] border transition-all"
      style={{
        borderColor: edge,
        background: won
          ? "linear-gradient(180deg, rgb(57 255 136 / 0.09), var(--color-surface) 62%)"
          : "var(--color-surface)",
        boxShadow: won ? "0 0 30px rgb(57 255 136 / 0.18)" : undefined,
        opacity: outcome === "lost" ? 0.7 : 1,
      }}
    >
      {outcome && (
        <span className="absolute left-1/2 top-3 z-20 -translate-x-1/2">
          <StatusPill status={outcome}>
            {outcome === "won" ? (
              <>
                <Trophy className="h-3.5 w-3.5" />
                Takes both
              </>
            ) : undefined}
          </StatusPill>
        </span>
      )}

      <div
        className="relative flex items-center justify-between gap-3 border-b px-5 py-4"
        style={{ borderColor: "var(--edge)" }}
      >
        <span className="t-addr min-w-0 truncate text-base font-bold text-slate-200">{title}</span>
        <TierPlate
          name={spec ? (spec.tickets > 0 ? `+${spec.tickets} · ${spec.name}` : spec.name) : "sealed"}
          ink={spec ? spec.ink : "var(--color-tier-sealed)"}
        />
      </div>

      <div className="relative flex min-h-[19rem] items-center justify-center px-4 py-8">
        {sealed ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <Chest rarity="sealed" size={210} />
            <span className="t-label">sealed until someone pays</span>
          </div>
        ) : (
          <Roll running={running && !spec} landedValue={value} deck={deck} pool={pool} />
        )}
      </div>
    </div>
  );
}

function OpenSeat({
  ready,
  canJoin,
  busy,
  onJoin,
}: {
  ready: boolean;
  canJoin: boolean;
  busy: boolean;
  onJoin: () => void;
}) {
  return (
    <div
      className="grid place-items-center rounded-[20px] border border-dashed p-8"
      style={{
        borderColor: "color-mix(in oklab, var(--color-accent) 28%, transparent)",
        background: "color-mix(in oklab, var(--color-accent) 3%, var(--color-surface))",
      }}
    >
      <div className="w-full max-w-xs text-center">
        <p className="t-label">open seat</p>
        <p className="mt-2 text-slate-300">
          Both dollars are on the table. The winner takes both tickets and the whole bonus.
        </p>
        <div className="mt-5 text-left">
          {ready ? (
            <Button block className="py-4" disabled={!canJoin || busy} onClick={onJoin}>
              {busy ? "…" : "Take the seat • $1"}
            </Button>
          ) : (
            <StartHere />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 *
 */
function Verdict({
  specA,
  specB,
  valueA,
  valueB,
  iAmCreator,
  watching,
  settled,
}: {
  specA: TierSpec;
  specB: TierSpec;
  valueA: number;
  valueB: number;
  iAmCreator: boolean;
  watching: boolean;
  settled: boolean;
}) {
  const pot = specA.tickets + specB.tickets;
  const creatorWon = wins(power(specA), valueA, power(specB), valueB);
  const iWon = iAmCreator ? creatorWon : !creatorWon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center"
    >
      {watching ? (
        <p className="t-inscription text-2xl" style={{ color: "var(--color-accent-hover)" }}>
          {creatorWon ? "the creator" : "the challenger"} takes both tickets
          {pot > 0 ? ` and all ${pot}` : ""}
        </p>
      ) : iWon ? (
        <p className="t-inscription text-2xl" style={{ color: "var(--color-accent-hover)" }}>
          you take both tickets{pot > 0 ? ` and all ${pot}` : ""}
        </p>
      ) : (
        <p className="text-slate-300">
          Lost. Both tickets go to the other seat
          {pot > 0 ? `, and the ${pot} with them.` : "."}
        </p>
      )}
      {!settled && <p className="t-label mt-2">the cards are turned · settle to hand over the pot</p>}
    </motion.div>
  );
}

function power(spec: TierSpec): number {
  return isVault(spec) ? Number.MAX_SAFE_INTEGER : spec.tickets;
}

/**
 *
 */
function wins(powerA: number, valueA: number, powerB: number, valueB: number): boolean {
  return powerA === powerB ? valueA < valueB : powerA > powerB;
}

function Abandon({
  openedAt,
  busy,
  onAbandon,
}: {
  openedAt: number;
  busy: boolean;
  onAbandon: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(t);
  }, []);

  const left = openedAt * 1000 + TIMEOUT_MS - now;
  if (left > 0) {
    return (
      <p className="mt-4 text-center text-sm text-slate-400">
        If nobody comes, you can take the card back in {Math.ceil(left / 60_000)} min, and your
        dollar buys you the real ticket after all. No battle, no stake.
      </p>
    );
  }
  return (
    <div className="mx-auto mt-4 max-w-md">
      <Button block variant="quiet" disabled={busy} onClick={onAbandon}>
        Take the card back
      </Button>
    </div>
  );
}

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
