"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAccount } from "wagmi";
import { motion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { Roll } from "@/components/Roll";
import { Crate } from "@/components/Crate";
import { useDeck } from "@/hooks/useDeck";
import { usePool } from "@/hooks/usePool";
import { useBattle } from "@/hooks/useBattles";
import { specOf, isVault, type DeckShape, type TierSpec } from "@/lib/deck";

const TIMEOUT_MS = 15 * 60 * 1000;

/**
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

  if (!battle) {
    return (
      <p className="py-20 text-center text-[1.0625rem] text-[var(--color-ink-dim)]">
        {id === undefined ? "No such battle." : "Reading the chain…"}
      </p>
    );
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/battles" className="t-label hover:text-[var(--color-ink)]">
            ← all battles
          </Link>
          <h1 className="t-inscription mt-2 text-xl">
            battle #{String(battle.id)} <span className="t-label">· case #{battle.deckId}</span>
          </h1>
        </div>
        <p className="t-label max-w-md text-right">
          {battle.resolved
            ? "settled on chain"
            : battle.joined
              ? "both cards are on the table"
              : "the creator's card is sealed until someone pays to face it"}
        </p>
      </div>

      <section className="grid gap-5 lg:grid-cols-2">
        <Side
          title={who(battle.a)}
          spec={specA}
          value={cards?.a.value}
          running={battle.joined}
          sealed={!battle.joined}
          deck={shape}
          pool={pool.data}
        />
        {battle.joined ? (
          <Side
            title={who(battle.b)}
            spec={specB}
            value={cards?.b.value}
            running
            deck={shape}
            pool={pool.data}
          />
        ) : (
          <OpenSeat
            canJoin={Boolean(address) && !iAmIn && game.canAfford && Boolean(deck) && !deck!.empty}
            busy={fight.busy}
            onJoin={() => void fight.join(game.needsApproval)}
          />
        )}
      </section>

      {fight.state.error && (
        <p className="mt-4 text-center text-[0.9375rem] text-[var(--color-danger)]">
          {fight.state.error.title}
          {fight.state.error.next && (
            <span className="block text-[var(--color-ink-faint)]">
              {fight.state.error.next}
            </span>
          )}
        </p>
      )}

      <section className="slab mt-5 p-6 sm:p-8">
        {specA && specB ? (
          <Verdict
            specA={specA}
            specB={specB}
            iAmCreator={iAmCreator}
            watching={!iAmIn}
            settled={battle.resolved}
          />
        ) : battle.joined ? (
          <p className="text-center text-[1.0625rem] text-[var(--color-ink-dim)]">
            The covalidators are turning both cards over, a few seconds we do not control.
          </p>
        ) : (
          <p className="text-center text-[1.0625rem] text-[var(--color-ink-dim)]">
            Nobody can read either card yet. That is the point: there is no easy fight to pick.
          </p>
        )}

        {battle.joined && !battle.resolved && cards && (
          <div className="mx-auto mt-5 max-w-md">
            <Button block disabled={fight.busy} onClick={() => void fight.resolve()}>
              {fight.busy ? "Settling…" : "Settle the battle"}
            </Button>
            <p className="mt-2 text-center text-[0.9375rem] text-[var(--color-ink-faint)]">
              Anyone can settle it, the loser cannot freeze it by staying away.
            </p>
          </div>
        )}

        {battle.waiting && iAmCreator && (
          <Abandon openedAt={battle.openedAt} busy={fight.busy} onAbandon={() => void fight.abandon()} />
        )}
      </section>
    </>
  );
}

function Side({
  title,
  spec,
  value,
  running,
  sealed,
  deck,
  pool,
}: {
  title: string;
  spec?: TierSpec;
  value?: number;
  running: boolean;
  sealed?: boolean;
  deck: DeckShape;
  pool?: ReturnType<typeof usePool>["data"];
}) {
  return (
    <div className="frame relative overflow-hidden">
      <span className="frame__node left-0 top-0" aria-hidden />
      <span className="frame__node right-0 top-0" aria-hidden />
      <span className="frame__node bottom-0 left-0" aria-hidden />
      <span className="frame__node bottom-0 right-0" aria-hidden />

      <div className="relative flex items-center justify-between border-b border-[var(--edge)] px-5 py-3">
        <span className="t-chain text-[0.8125rem] text-[var(--color-ink-dim)]">{title}</span>
        <span
          className="t-inscription text-[0.8125rem]"
          style={{ color: spec ? spec.ink : "var(--color-ink-faint)" }}
        >
          {spec ? (spec.tickets > 0 ? `+${spec.tickets} · ${spec.name}` : spec.name) : "sealed"}
        </span>
      </div>

      <div className="relative flex min-h-[13rem] items-center justify-center px-4 py-6">
        {sealed ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <Crate rarity="sealed" size={140} drift />
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
  canJoin,
  busy,
  onJoin,
}: {
  canJoin: boolean;
  busy: boolean;
  onJoin: () => void;
}) {
  return (
    <div className="slab grid place-items-center border-dashed p-8">
      <div className="text-center">
        <p className="t-label">open seat</p>
        <p className="mt-2 max-w-xs text-[1.0625rem] text-[var(--color-ink-dim)]">
          Your dollar buys you a real ticket either way. Only the bonus is on the table.
        </p>
        <div className="mt-5">
          <Button disabled={!canJoin || busy} onClick={onJoin}>
            {busy ? "…" : "Take the seat · $1"}
          </Button>
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
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center">
      {draw ? (
        <p className="text-[1.0625rem] text-[var(--color-ink-dim)]">
          {pot === 0
            ? "Both empty. Nobody owes anybody, and both players still hold the ticket."
            : "The same card. A draw, and each keeps their own."}
        </p>
      ) : watching ? (
        <p className="t-inscription text-2xl" style={{ color: "var(--color-accent-bright)" }}>
          {pot > 0
            ? `${creatorWon ? "the creator" : "the challenger"} takes all ${pot}`
            : "won on the card, but the pot was empty"}
        </p>
      ) : iWon ? (
        <p className="t-inscription text-2xl" style={{ color: "var(--color-accent-bright)" }}>
          {pot > 0 ? `you take all ${pot} ticket${pot > 1 ? "s" : ""}` : "you win, but the pot was empty"}
        </p>
      ) : (
        <p className="text-[1.0625rem] text-[var(--color-ink-dim)]">
          {pot > 0 ? `Lost the ${pot}.` : "Lost, though there was nothing in the pot."} The
          ticket you paid for is still yours.
        </p>
      )}
      {!settled && (
        <p className="t-label mt-2">the cards are turned · settle to bank it</p>
      )}
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
      <p className="mt-4 text-center text-[0.9375rem] text-[var(--color-ink-faint)]">
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
