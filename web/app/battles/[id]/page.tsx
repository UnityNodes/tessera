"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAccount } from "wagmi";
import { motion } from "motion/react";
import { ChevronLeft, Trophy, Swords } from "lucide-react";
import { Button } from "@/components/ui/Button";
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

  const settledA = specA && specB ? power(specA) > power(specB) : undefined;
  const settledB = specA && specB ? power(specB) > power(specA) : undefined;

  if (!battle) {
    return (
      <div className="w-full bg-[var(--color-section)] px-4 py-10 lg:px-8 2xl:px-14">
        <p className="py-20 text-center text-slate-400">
          {id === undefined ? "No such battle." : "Reading the chain…"}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full bg-[var(--color-section)] px-4 py-10 lg:px-8 2xl:px-14">
      <div className="mx-auto flex max-w-[1100px] flex-col space-y-6">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-5 md:flex-row md:items-end">
          <div>
            <Link
              href="/battles"
              className="t-label inline-flex items-center gap-1 hover:text-[var(--color-accent-hover)]"
            >
              <ChevronLeft className="h-3 w-3" />
              all battles
            </Link>
            <h1 className="t-black mt-1 flex flex-wrap items-center gap-3 text-2xl text-white">
              <Swords className="h-6 w-6 text-[var(--color-accent-hover)]" />
              Battle #{String(battle.id)}
              <span className="t-chain rounded-[var(--radius-chip)] border border-[rgb(57_255_136_/_0.3)] bg-[rgb(57_255_136_/_0.1)] px-2.5 py-1 text-xs font-normal text-[var(--color-accent-hover)]">
                deck #{battle.deckId}
              </span>
            </h1>
          </div>

          <p className="t-label max-w-md md:text-right">
            {battle.resolved
              ? "settled on chain"
              : battle.joined
                ? "both cards are on the table"
                : "the creator's card is sealed until someone pays to face it"}
          </p>
        </div>

        <section className="grid gap-6 lg:grid-cols-2">
          <Side
            title={who(battle.a)}
            spec={specA}
            value={cards?.a.value}
            running={battle.joined}
            sealed={!battle.joined}
            won={settledA}
            deck={shape}
            pool={pool.data}
          />
          {battle.joined ? (
            <Side
              title={who(battle.b)}
              spec={specB}
              value={cards?.b.value}
              running
              won={settledB}
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
              <span className="block text-slate-500">{fight.state.error.next}</span>
            )}
          </p>
        )}

        <section className="slab p-6 sm:p-8">
          {specA && specB ? (
            <Verdict
              specA={specA}
              specB={specB}
              iAmCreator={iAmCreator}
              watching={!iAmIn}
              settled={battle.resolved}
            />
          ) : battle.joined ? (
            <p className="text-center text-slate-400">
              The covalidators are turning both cards over, a few seconds we do not control.
            </p>
          ) : (
            <p className="text-center text-slate-400">
              Nobody can read either card yet. That is the point: there is no easy fight to pick.
            </p>
          )}

          {battle.joined && !battle.resolved && cards && (
            <div className="mx-auto mt-5 max-w-md">
              <Button block className="py-4" disabled={fight.busy} onClick={() => void fight.resolve()}>
                {fight.busy ? "Settling…" : "Settle the battle"}
              </Button>
              <p className="mt-2 text-center text-sm text-slate-500">
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

/**
 *
 */
function Side({
  title,
  spec,
  value,
  running,
  sealed,
  won,
  deck,
  pool,
}: {
  title: string;
  spec?: TierSpec;
  value?: number;
  running: boolean;
  sealed?: boolean;
  won?: boolean;
  deck: DeckShape;
  pool?: ReturnType<typeof usePool>["data"];
}) {
  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded-[var(--radius-window)] border transition-all ${
        won
          ? "border-amber-500 bg-gradient-to-b from-amber-950/60 to-slate-900 shadow-[0_0_30px_rgba(245,158,11,0.3)]"
          : "border-slate-800 bg-slate-950/80"
      }`}
    >
      {won && (
        <span className="t-label absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full bg-amber-500 px-3 py-1 text-slate-950 shadow-lg">
          <Trophy className="h-3.5 w-3.5" />
          takes both
        </span>
      )}

      <div className="relative flex items-center justify-between border-b border-slate-800 px-5 py-3">
        <span className="t-chain text-sm text-slate-300">{title}</span>
        <span className="t-label" style={{ color: spec ? spec.ink : "var(--color-ink-faint)" }}>
          {spec ? (spec.tickets > 0 ? `+${spec.tickets} · ${spec.name}` : spec.name) : "sealed"}
        </span>
      </div>

      <div className="relative flex min-h-[13rem] items-center justify-center px-4 py-6">
        {sealed ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <Chest rarity="sealed" size={150} />
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
    <div className="grid place-items-center rounded-[var(--radius-window)] border border-dashed border-slate-700 bg-slate-900/40 p-8">
      <div className="w-full max-w-xs text-center">
        <p className="t-label">open seat</p>
        <p className="mt-2 text-slate-400">
          Your dollar buys you a real ticket either way. Only the bonus is on the table.
        </p>
        <div className="mt-5 text-left">
          {ready ? (
            <Button block className="py-4" disabled={!canJoin || busy} onClick={onJoin}>
              {busy ? "…" : "Take the seat • $1"}
            </Button>
          ) : (
            <StartHere what="A seat" />
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
  iAmCreator,
  watching,
  settled,
}: {
  specA: TierSpec;
  specB: TierSpec;
  iAmCreator: boolean;
  watching: boolean;
  settled: boolean;
}) {
  const powerA = power(specA);
  const powerB = power(specB);
  const pot = specA.tickets + specB.tickets;
  const draw = powerA === powerB;
  const creatorWon = powerA > powerB;
  const iWon = iAmCreator ? creatorWon : !creatorWon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center"
    >
      {draw ? (
        <p className="text-slate-400">
          {pot === 0
            ? "Both empty. Nobody owes anybody, and both players still hold the ticket."
            : "The same card. A draw, and each keeps their own."}
        </p>
      ) : watching ? (
        <p className="t-inscription text-2xl" style={{ color: "var(--color-accent-hover)" }}>
          {pot > 0
            ? `${creatorWon ? "the creator" : "the challenger"} takes all ${pot}`
            : "won on the card, but the pot was empty"}
        </p>
      ) : iWon ? (
        <p className="t-inscription text-2xl" style={{ color: "var(--color-accent-hover)" }}>
          {pot > 0
            ? `you take all ${pot} ticket${pot > 1 ? "s" : ""}`
            : "you win, but the pot was empty"}
        </p>
      ) : (
        <p className="text-slate-400">
          {pot > 0 ? `Lost the ${pot}.` : "Lost, though there was nothing in the pot."} The ticket
          you paid for is still yours.
        </p>
      )}
      {!settled && <p className="t-label mt-2">the cards are turned · settle to bank it</p>}
    </motion.div>
  );
}

function power(spec: TierSpec): number {
  return isVault(spec) ? Number.MAX_SAFE_INTEGER : spec.tickets;
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
      <p className="mt-4 text-center text-sm text-slate-500">
        If nobody comes, you can take the card back in {Math.ceil(left / 60_000)} min. Nothing to
        refund, the ticket was bought the moment you opened the battle.
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
