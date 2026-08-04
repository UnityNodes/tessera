"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { motion } from "motion/react";
import { Button } from "./ui/Button";
import { Case } from "./Case";
import { specOf, isVault, type DeckShape, type TierSpec } from "@/lib/deck";
import type { useBattles } from "@/hooks/useBattles";

const TIMEOUT_MS = 15 * 60 * 1000;

/**
 *
 *
 */
export function Battles({
  battles,
  deck,
  needsApproval,
  canAfford,
  deckEmpty,
}: {
  battles: ReturnType<typeof useBattles>;
  deck: DeckShape;
  needsApproval: boolean;
  canAfford: boolean;
  deckEmpty: boolean;
}) {
  const { address } = useAccount();
  const { mine, cards, state } = battles;
  const busy = state.phase === "approving" || state.phase === "signing" || state.phase === "confirming";

  const me = address?.toLowerCase();
  const iAmCreator = mine && mine.a.toLowerCase() === me;

  return (
    <section className="mt-16">
      <div className="mb-6 text-center">
        <p className="t-label">battles</p>
        <p className="mt-2 text-[1.0625rem] text-[var(--color-travertine-dim)]">
          Two cases open at once. The better card takes both prizes, <br className="hidden sm:block" /> and both of you still keep the real ticket you paid for.
        </p>
      </div>

      {mine ? (
        <Arena battles={battles} deck={deck} iAmCreator={Boolean(iAmCreator)} />
      ) : (
        <div className="mx-auto max-w-md">
          <Button
            block
            disabled={busy || !canAfford || deckEmpty || !address}
            onClick={() => void battles.open(needsApproval)}
          >
            {busy ? "…" : "Open a battle · $1"}
          </Button>
          <p className="mt-3 text-center text-[0.9375rem] text-[var(--color-travertine-faint)]">
            Your card stays sealed until someone pays to face it. Nobody can
            peek and pick an easy fight, not even you.
          </p>

          {battles.waiting.length > 0 && (
            <div className="mt-8">
              <p className="t-label mb-3">waiting for an opponent</p>
              <ul className="divide-y divide-[var(--edge)] overflow-hidden rounded-[3px] border border-[var(--edge)]">
                {battles.waiting.map((b) => (
                  <li
                    key={String(b.id)}
                    className="flex items-center justify-between gap-4 bg-[var(--color-stone-900)] px-4 py-3"
                  >
                    <span className="t-chain text-[0.8125rem] text-[var(--color-travertine-dim)]">
                      {short(b.a)}
                      <span className="ml-3 text-[var(--color-travertine-faint)]">
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
          )}
        </div>
      )}

      {state.error && (
        <p className="mt-4 text-center text-[0.9375rem] text-[var(--color-sinopia-400)]">
          {state.error.title}
          {state.error.next && (
            <span className="block text-[var(--color-travertine-faint)]">{state.error.next}</span>
          )}
        </p>
      )}

      {cards && mine?.joined && <Verdict cards={cards} deck={deck} iAmCreator={Boolean(iAmCreator)} />}
    </section>
  );
}

function Arena({
  battles,
  deck,
  iAmCreator,
}: {
  battles: ReturnType<typeof useBattles>;
  deck: DeckShape;
  iAmCreator: boolean;
}) {
  const { mine, cards, state } = battles;

  const [wait, setWait] = useState(false);
  const joined = Boolean(mine?.joined);
  useEffect(() => {
    if (!joined) return;
    const t = setTimeout(() => setWait(true), 400);
    return () => clearTimeout(t);
  }, [joined]);

  if (!mine) return null;

  const busy = state.phase === "signing" || state.phase === "confirming";
  const ready = Boolean(cards);

  const mineValue = cards ? (iAmCreator ? cards.a.value : cards.b.value) : undefined;
  const theirValue = cards ? (iAmCreator ? cards.b.value : cards.a.value) : undefined;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="grid grid-cols-2 gap-4">
        <Corner label="you" value={mineValue} deck={deck} waiting={mine.joined && !ready && wait} />
        <Corner
          label={mine.joined ? "your opponent" : "nobody yet"}
          value={theirValue}
          deck={deck}
          waiting={mine.joined && !ready && wait}
          empty={!mine.joined}
        />
      </div>

      <div className="mt-6">
        {!mine.joined ? (
          <>
            <p className="text-center text-[1.0625rem] text-[var(--color-travertine-dim)]">
              Waiting for an opponent. Your card is sealed, even you cannot
              read it until someone pays to face it.
            </p>
            <Abandon battles={battles} openedAt={mine.openedAt} id={mine.id} />
          </>
        ) : !ready ? (
          <p className="text-center text-[1.0625rem] text-[var(--color-travertine-dim)]">
            Both cards are on the table. The covalidators are turning them
            over, a few seconds we do not control.
          </p>
        ) : (
          <Button block disabled={busy} onClick={() => void battles.resolve(mine.id)}>
            {busy ? "Settling…" : "Turn the cards over"}
          </Button>
        )}
      </div>
    </div>
  );
}

function Corner({
  label,
  value,
  deck,
  waiting,
  empty,
}: {
  label: string;
  value?: number;
  deck: DeckShape;
  waiting: boolean;
  empty?: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <span className="t-label mb-2">{label}</span>
      {empty ? (
        <div
          className="grid w-full place-items-center rounded-[3px] border border-dashed border-[var(--edge)]"
          style={{ height: 190 }}
        >
          <span className="t-inscription text-[0.8125rem] text-[var(--color-travertine-faint)]">
            open seat
          </span>
        </div>
      ) : (
        <Case
          phase={value != null ? "opened" : waiting ? "waiting" : "idle"}
          value={value}
          deck={deck}
          size={220}
        />
      )}
    </div>
  );
}

/**
 *
 */
function Verdict({
  cards,
  deck,
  iAmCreator,
}: {
  cards: { a: { value: number }; b: { value: number } };
  deck: DeckShape;
  iAmCreator: boolean;
}) {
  const specA = specOf(cards.a.value, deck);
  const specB = specOf(cards.b.value, deck);
  const powerA = power(specA);
  const powerB = power(specB);

  const draw = powerA === powerB;
  const iWon = iAmCreator ? powerA > powerB : powerB > powerA;
  const pot = specA.tickets + specB.tickets;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-6 text-center"
    >
      {draw ? (
        <p className="text-[1.0625rem] text-[var(--color-travertine-dim)]">
          {pot === 0
            ? "Both empty. Nobody owes anybody, and you both still hold the ticket."
            : "The same card. A draw, and you each keep your own."}
        </p>
      ) : iWon ? (
        <p className="t-inscription text-2xl" style={{ color: "var(--color-patina-400)" }}>
          {pot > 0 ? `you take all ${pot} tickets` : "you win, but the pot was empty"}
        </p>
      ) : (
        <p className="text-[1.0625rem] text-[var(--color-travertine-dim)]">
          {pot > 0 ? `Lost the ${pot}.` : "Lost, though there was nothing in the pot."}{" "}
          The ticket you paid for is still yours.
        </p>
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

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
