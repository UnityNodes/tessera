"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { motion } from "motion/react";
import { Button } from "./ui/Button";
import { Roll } from "./Roll";
import { specOf, isVault, type DeckShape, type TierSpec } from "@/lib/deck";
import type { PoolState } from "@/hooks/usePool";
import type { useBattles } from "@/hooks/useBattles";

const TIMEOUT_MS = 15 * 60 * 1000;

const ZERO = "0x0000000000000000000000000000000000000000";

/**
 *
 *
 */
export function Battles({
  battles,
  deck,
  pool,
  needsApproval,
  canAfford,
  deckEmpty,
}: {
  battles: ReturnType<typeof useBattles>;
  deck: DeckShape;
  pool?: PoolState;
  needsApproval: boolean;
  canAfford: boolean;
  deckEmpty: boolean;
}) {
  const { address } = useAccount();
  const { mine, state } = battles;
  const busy =
    state.phase === "approving" || state.phase === "signing" || state.phase === "confirming";

  return (
    <section id="battles" className="surface mt-5 rounded-[3px] p-6 sm:p-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <p className="t-label">battles</p>
          <p className="mt-1 text-[1.0625rem] text-[var(--color-travertine-dim)]">
            Two cases open at once. The better card takes both prizes, and both of you still
            keep the real ticket you paid for.
          </p>
        </div>
        {!mine && (
          <div className="shrink-0">
            <Button
              disabled={busy || !canAfford || deckEmpty || !address}
              onClick={() => void battles.open(needsApproval)}
            >
              {busy ? "…" : "Open a battle · $1"}
            </Button>
          </div>
        )}
      </header>

      {mine ? (
        <Arena battles={battles} deck={deck} pool={pool} />
      ) : (
        <>
          <p className="text-[0.9375rem] text-[var(--color-travertine-faint)]">
            Your card stays sealed until someone pays to face it. Nobody can peek and pick an
            easy fight, not even you.
          </p>

          {battles.waiting.length > 0 ? (
            <div className="mt-6">
              <p className="t-label mb-3">waiting for an opponent</p>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {battles.waiting.map((b) => (
                  <li
                    key={String(b.id)}
                    className="flex items-center justify-between gap-3 rounded-[3px] border border-[var(--edge)] bg-[var(--color-stone-900)] px-4 py-3"
                  >
                    <span className="min-w-0">
                      <span className="t-chain block truncate text-[0.8125rem] text-[var(--color-travertine-dim)]">
                        {short(b.a)}
                      </span>
                      <span className="t-label">
                        <Ago at={b.openedAt} />
                      </span>
                    </span>
                    <Button
                      variant="quiet"
                      disabled={busy || !canAfford || deckEmpty}
                      onClick={() => void battles.join(b.id, needsApproval)}
                    >
                      Join · $1
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-6 t-label">nobody is waiting right now, open one and be first</p>
          )}
        </>
      )}

      {state.error && (
        <p className="mt-4 text-center text-[0.9375rem] text-[var(--color-sinopia-400)]">
          {state.error.title}
          {state.error.next && (
            <span className="block text-[var(--color-travertine-faint)]">{state.error.next}</span>
          )}
        </p>
      )}
    </section>
  );
}

function Arena({
  battles,
  deck,
  pool,
}: {
  battles: ReturnType<typeof useBattles>;
  deck: DeckShape;
  pool?: PoolState;
}) {
  const { address } = useAccount();
  const { mine, cards, state } = battles;

  const me = address?.toLowerCase();
  const iAmCreator = Boolean(mine && mine.a.toLowerCase() === me);
  const joined = Boolean(mine?.joined);
  const busy = state.phase === "signing" || state.phase === "confirming";

  if (!mine) return null;

  const specA = cards ? specOf(cards.a.value, deck) : undefined;
  const specB = cards ? specOf(cards.b.value, deck) : undefined;
  const mySpec = iAmCreator ? specA : specB;
  const theirSpec = iAmCreator ? specB : specA;

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Side
          label="you"
          name="your case"
          landed={mySpec}
          running={joined}
          sealed={!joined}
          deck={deck}
          pool={pool}
        />
        <Side
          label={mine.joined ? short(iAmCreator ? mine.b : mine.a) : "nobody yet"}
          name={mine.joined ? "their case" : "open seat"}
          landed={theirSpec}
          running={joined}
          empty={!joined}
          deck={deck}
          pool={pool}
        />
      </div>

      <div className="mt-6">
        {mine.resolved ? (
          <Button block onClick={() => battles.dismiss(mine.id)}>
            Open another battle
          </Button>
        ) : !joined ? (
          <>
            <p className="text-center text-[1.0625rem] text-[var(--color-travertine-dim)]">
              Waiting for an opponent. Your card is sealed, even you cannot read it until
              someone pays to face it.
            </p>
            <Abandon battles={battles} openedAt={mine.openedAt} id={mine.id} />
          </>
        ) : !cards ? (
          <p className="text-center text-[1.0625rem] text-[var(--color-travertine-dim)]">
            Both cards are on the table. The covalidators are turning them over, a few
            seconds we do not control.
          </p>
        ) : (
          <Button block disabled={busy} onClick={() => void battles.resolve(mine.id)}>
            {busy ? "Settling…" : "Settle the battle"}
          </Button>
        )}
      </div>

      {cards && specA && specB && (
        <Verdict
          mySpec={mySpec!}
          theirSpec={theirSpec!}
          settled={mine.resolved}
        />
      )}
    </div>
  );
}

function Side({
  label,
  name,
  landed,
  running,
  sealed,
  empty,
  deck,
  pool,
}: {
  label: string;
  name: string;
  landed?: TierSpec;
  running: boolean;
  sealed?: boolean;
  empty?: boolean;
  deck: DeckShape;
  pool?: PoolState;
}) {
  return (
    <div className="surface overflow-hidden rounded-[3px]">
      <div className="flex items-center justify-between px-4 pt-3">
        <span className="t-chain text-[0.8125rem] text-[var(--color-travertine-dim)]">{label}</span>
        <span
          className="t-inscription text-[0.6875rem]"
          style={{ color: landed ? landed.ink : "var(--color-travertine-faint)" }}
        >
          {landed ? (landed.tickets > 0 ? `+${landed.tickets}` : landed.name) : name}
        </span>
      </div>

      {sealed || empty ? (
        <div
          className="m-4 grid place-items-center rounded-[3px] border border-dashed border-[var(--edge)]"
          style={{ height: 104 }}
        >
          <span className="t-inscription text-[0.75rem] text-[var(--color-travertine-faint)]">
            {sealed ? "sealed until someone pays" : "open seat"}
          </span>
        </div>
      ) : (
        <div className="flex justify-center">
          <Roll running={running && !landed} landed={landed} deck={deck} pool={pool} width={340} />
        </div>
      )}
    </div>
  );
}

/**
 *
 */
function Verdict({
  mySpec,
  theirSpec,
  settled,
}: {
  mySpec: TierSpec;
  theirSpec: TierSpec;
  settled: boolean;
}) {
  const mine = power(mySpec);
  const theirs = power(theirSpec);
  const pot = mySpec.tickets + theirSpec.tickets;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 text-center">
      {mine === theirs ? (
        <p className="text-[1.0625rem] text-[var(--color-travertine-dim)]">
          {pot === 0
            ? "Both empty. Nobody owes anybody, and you both still hold the ticket."
            : "The same card. A draw, and you each keep your own."}
        </p>
      ) : mine > theirs ? (
        <p className="t-inscription text-2xl" style={{ color: "var(--color-patina-400)" }}>
          {pot > 0
            ? `you take all ${pot} ticket${pot > 1 ? "s" : ""}`
            : "you win, but the pot was empty"}
        </p>
      ) : (
        <p className="text-[1.0625rem] text-[var(--color-travertine-dim)]">
          {pot > 0 ? `Lost the ${pot}.` : "Lost, though there was nothing in the pot."} The
          ticket you paid for is still yours.
        </p>
      )}
      {!settled && (
        <p className="mt-2 t-label">the cards are turned · settle to bank it</p>
      )}
    </motion.div>
  );
}

function power(spec: TierSpec): number {
  return isVault(spec) ? Number.MAX_SAFE_INTEGER : spec.tickets;
}

function Abandon({
  battles,
  openedAt,
  id,
}: {
  battles: ReturnType<typeof useBattles>;
  openedAt: number;
  id: bigint;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(t);
  }, []);

  const left = openedAt * 1000 + TIMEOUT_MS - now;
  if (left > 0) {
    return (
      <p className="mt-3 text-center text-[0.9375rem] text-[var(--color-travertine-faint)]">
        If nobody comes, you can take the card back in {Math.ceil(left / 60_000)} min.
      </p>
    );
  }
  return (
    <div className="mt-4">
      <Button block variant="quiet" onClick={() => void battles.abandon(id)}>
        Take the card back
      </Button>
    </div>
  );
}

function Ago({ at }: { at: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(t);
  }, []);
  const mins = Math.max(0, Math.floor((now - at * 1000) / 60_000));
  return <>{mins === 0 ? "just now" : `${mins} min ago`}</>;
}

const short = (a: string) => (a === ZERO ? "nobody" : `${a.slice(0, 6)}…${a.slice(-4)}`);
