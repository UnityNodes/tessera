"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/Button";
import { useDeck } from "@/hooks/useDeck";
import { useBattleList, type Battle } from "@/hooks/useBattles";
import { Crate } from "@/components/Crate";

/**
 *
 */
export default function BattlesPage() {
  const { address } = useAccount();
  const game = useDeck();
  const battles = useBattleList();
  const [pick, setPick] = useState(0);

  const me = address?.toLowerCase();
  const mine = useMemo(
    () =>
      battles.all.find(
        (b) => !b.resolved && (b.a.toLowerCase() === me || b.b.toLowerCase() === me),
      ),
    [battles.all, me],
  );

  const playable = game.decks.filter((d) => !d.empty);
  const chosen = playable.find((d) => d.id === pick) ?? playable[0];
  const canPlay = Boolean(address) && game.canAfford && Boolean(chosen);

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="t-inscription text-xl">battles</h1>
          <p className="mt-2 text-[1.0625rem] text-[var(--color-ink-dim)]">
            Two cases open at once and the better card takes both prizes. Neither card can be
            read until both players have paid, not even by the one who opened the battle.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <Counter label="waiting" value={battles.open.length} />
          <Counter label="live" value={battles.live.length} />
          <Counter label="all time" value={battles.total} />

          <div className="flex items-center gap-2">
            <div className="raised inline-flex gap-1 rounded-[var(--radius-chip)] p-1">
              {playable.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setPick(d.id)}
                  className="t-label rounded-[var(--radius-chip)] px-3 py-1.5 hover:text-[var(--color-ink)]"
                  style={
                    chosen?.id === d.id
                      ? { background: "var(--color-accent)", color: "oklch(97% 0.004 90)" }
                      : undefined
                  }
                >
                  case #{d.id}
                </button>
              ))}
            </div>
            <Button
              disabled={!canPlay || battles.busy || Boolean(mine)}
              loading={battles.busy}
              onClick={() => chosen && void battles.create(chosen.id, game.needsApproval)}
            >
              Create a battle · $1
            </Button>
          </div>
        </div>
      </div>

      {battles.state.error && (
        <p className="mb-4 text-[0.9375rem] text-[var(--color-danger)]">
          {battles.state.error.title}
          {battles.state.error.next && (
            <span className="block text-[var(--color-ink-faint)]">
              {battles.state.error.next}
            </span>
          )}
        </p>
      )}

      {mine && (
        <Link href={`/battles/${mine.id}`} className="block">
          <div className="surface mb-4 flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-panel)] border-l-2 border-l-[var(--color-accent-bright)] p-5">
            <div>
              <p className="t-label">your battle</p>
              <p className="mt-1 text-[1.0625rem]">
                {mine.waiting
                  ? "Waiting for an opponent. Your card is sealed until someone pays."
                  : "Your opponent is in, go turn the cards over."}
              </p>
            </div>
            <Button variant="quiet">Open it</Button>
          </div>
        </Link>
      )}

      <section className="surface overflow-hidden rounded-[var(--radius-panel)]">
        {battles.all.length === 0 ? (
          <p className="p-10 text-center text-[1.0625rem] text-[var(--color-ink-dim)]">
            {battles.loading ? "Reading the chain…" : "No battles yet, open the first one."}
          </p>
        ) : (
          <ul className="divide-y divide-[var(--edge)]">
            {battles.all.map((b) => (
              <Row
                key={String(b.id)}
                battle={b}
                me={me}
                canPlay={canPlay && !mine}
                busy={battles.busy}
                onJoin={() => void battles.join(b.id, game.needsApproval)}
              />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function Row({
  battle,
  me,
  canPlay,
  busy,
  onJoin,
}: {
  battle: Battle;
  me?: string;
  canPlay: boolean;
  busy: boolean;
  onJoin: () => void;
}) {
  const isMine = battle.a.toLowerCase() === me || battle.b.toLowerCase() === me;

  return (
    <li className="flex flex-wrap items-center gap-4 px-5 py-4">
      <Status battle={battle} />

      <div className="flex items-center gap-2">
        <Seat address={battle.a} />
        <span className="t-label px-1">vs</span>
        {battle.joined ? (
          <Seat address={battle.b} />
        ) : (
          <div
            className="grid h-14 w-14 shrink-0 place-items-center rounded-[var(--radius-panel)] border border-dashed border-[var(--edge-strong)]"
            title="open seat"
          >
            <span className="t-label text-[0.5625rem]">open</span>
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="t-chain truncate text-[0.8125rem] text-[var(--color-ink-dim)]">
          {short(battle.a)}
          {battle.joined && <> · {short(battle.b)}</>}
        </p>
        <p className="t-label">
          #{String(battle.id)} · case #{battle.deckId} · <Ago at={battle.openedAt} />
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {battle.waiting && !isMine && (
          <Button variant="quiet" disabled={!canPlay || busy} onClick={onJoin}>
            Join · $1
          </Button>
        )}
        <Link href={`/battles/${battle.id}`}>
          <Button variant="ghost">{battle.resolved ? "Result" : "Watch"}</Button>
        </Link>
      </div>
    </li>
  );
}

function Status({ battle }: { battle: Battle }) {
  const [label, ink] = battle.resolved
    ? ["done", "var(--color-ink-faint)"]
    : battle.joined
      ? ["live", "var(--color-accent-bright)"]
      : ["waiting", "var(--color-ink-dim)"];

  return (
    <div className="w-20 shrink-0">
      <span
        className="t-inscription text-[0.625rem]"
        style={{
          color: ink,
          animation: battle.joined && !battle.resolved ? "marker-live 1.8s ease-in-out infinite" : undefined,
        }}
      >
        {label}
      </span>
    </div>
  );
}

function Seat({ address }: { address: `0x${string}` }) {
  return (
    <div
      className="h-14 w-14 shrink-0 overflow-hidden rounded-[var(--radius-panel)]"
      style={{
        background: "var(--color-raised)",
        boxShadow: "inset 0 0 0 1px var(--edge)",
      }}
      title={address}
    >
      <Crate rarity="sealed" size={44} className="m-auto block" />
    </div>
  );
}

function Counter({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-right">
      <span className="t-label block">{label}</span>
      <span className="t-chain text-lg">{value}</span>
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
  if (mins === 0) return <>just now</>;
  if (mins < 60) return <>{mins} min ago</>;
  return <>{Math.floor(mins / 60)} h ago</>;
}

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
