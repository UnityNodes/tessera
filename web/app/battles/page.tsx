"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { Swords, Plus, Play, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Chest } from "@/components/Chest";
import { useDeck } from "@/hooks/useDeck";
import { useBattleList, type Battle } from "@/hooks/useBattles";
import { bestTier } from "@/lib/deck";

/**
 *
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
    <div className="min-h-screen w-full bg-[var(--color-section)] px-4 py-10 lg:px-8 2xl:px-14">
      <div className="mx-auto flex flex-col space-y-8">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-6 md:flex-row md:items-center">
          <div className="max-w-2xl">
            <h1 className="t-display flex items-center gap-3 text-3xl text-white">
              <Swords
                className="h-8 w-8 text-[var(--color-accent-hover)]"
                style={{ animation: "marker-live 2.4s ease-in-out infinite" }}
              />
              <span>Case battles arena</span>
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Two cases open at once and the better card takes both prizes. Neither card can be
              read until both players have paid, not even by the one who opened the battle.
            </p>
          </div>

          <div className="flex items-center gap-6">
            <Tally label="waiting" value={battles.open.length} />
            <Tally label="live" value={battles.live.length} ink="var(--color-accent-hover)" />
            <Tally label="all time" value={battles.total} />
          </div>
        </div>

        {battles.state.error && (
          <p className="text-sm text-[var(--color-danger)]">
            {battles.state.error.title}
            {battles.state.error.next && (
              <span className="block text-slate-500">{battles.state.error.next}</span>
            )}
          </p>
        )}

        {mine && (
          <Link href={`/battles/${mine.id}`} className="block">
            <div className="surface--marked flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-panel)] border p-6 transition-all hover:scale-[1.005]">
              <div>
                <p className="t-label text-[var(--color-accent-hover)]">your battle</p>
                <p className="mt-1 text-slate-200">
                  {mine.waiting
                    ? "Waiting for an opponent. Your card is sealed until someone pays."
                    : "Your opponent is in, go turn the cards over."}
                </p>
              </div>
              <Button variant="quiet">Open it</Button>
            </div>
          </Link>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="space-y-6 rounded-[var(--radius-window)] border border-slate-800 bg-slate-900/70 p-6 lg:col-span-5">
            <h2 className="flex items-center gap-2 text-xl font-bold text-white">
              <Plus className="h-5 w-5 text-[var(--color-accent-hover)]" />
              <span>Create a battle</span>
            </h2>

            <div>
              <label className="t-label mb-2 block">1. pick the deck you both draw from</label>
              {playable.length === 0 ? (
                <p className="text-sm text-slate-500">
                  {game.isLoading ? "Reading the chain…" : "Every deck in this season is empty."}
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {playable.map((d) => {
                    const best = bestTier(d);
                    const on = chosen?.id === d.id;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setPick(d.id)}
                        className={`flex cursor-pointer flex-col items-center gap-1 rounded-[var(--radius-control)] border p-3 transition-all ${
                          on
                            ? "border-[var(--color-accent)] bg-slate-800 text-white shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                            : "border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        <Chest rarity={best?.rarity ?? "sealed"} size={40} />
                        <span className="truncate text-xs font-bold">
                          {best?.name ?? "Sealed"}
                        </span>
                        <span className="t-chain text-[10px] text-[var(--color-accent-hover)]">
                          {d.remaining} left
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <label className="t-label mb-2 block">2. the table</label>
              <div className="grid grid-cols-2 gap-2">
                <Fact icon={<Users className="h-4 w-4" />} value="2 players" note="you and one" />
                <Fact icon={<Swords className="h-4 w-4" />} value="1 card each" note="higher takes both" />
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-800 pt-4">
              <div>
                <span className="t-label block">your entry</span>
                <span className="t-chain text-xl font-extrabold text-[var(--color-accent-hover)]">
                  $1.00
                </span>
                <span className="t-chain block text-[11px] text-slate-500">
                  and it still buys your ticket
                </span>
              </div>

              <Button
                disabled={!canPlay || battles.busy || Boolean(mine)}
                loading={battles.busy}
                onClick={() => chosen && void battles.create(chosen.id, game.needsApproval)}
              >
                <Play className="h-4 w-4 fill-slate-950" />
                Start battle
              </Button>
            </div>

            {!address ? (
              <p className="text-sm text-slate-500">Connect a wallet to open a battle.</p>
            ) : !game.canAfford ? (
              <p className="text-sm text-slate-500">
                You need $1 in test dollars, mint some with the{" "}
                <span className="text-[var(--color-accent-hover)]">+</span> in the header.
              </p>
            ) : mine ? (
              <p className="text-sm text-slate-500">
                You already have a battle on the table. Settle it before opening another.
              </p>
            ) : null}
          </div>

          <div className="space-y-4 lg:col-span-7">
            <h2 className="flex items-center justify-between text-xl font-bold text-white">
              <span>Active public battles</span>
              <span className="t-label">live from the chain</span>
            </h2>

            {battles.all.length === 0 ? (
              <p className="rounded-[var(--radius-panel)] border border-slate-800 bg-slate-900/60 p-10 text-center text-slate-400">
                {battles.loading ? "Reading the chain…" : "No battles yet, open the first one."}
              </p>
            ) : (
              battles.all.map((b) => (
                <Row
                  key={String(b.id)}
                  battle={b}
                  me={me}
                  canPlay={canPlay && !mine}
                  busy={battles.busy}
                  onJoin={() => void battles.join(b.id, game.needsApproval)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
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

  const [label, ink] = battle.resolved
    ? ["done", "var(--color-ink-faint)"]
    : battle.joined
      ? ["live", "var(--color-accent-hover)"]
      : ["waiting", "var(--color-ink-dim)"];

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-panel)] border border-slate-800 bg-slate-900/60 p-4 transition-all hover:border-slate-700">
      <div className="flex min-w-0 items-center gap-4">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] border"
          style={{
            color: ink,
            borderColor: `color-mix(in oklab, ${ink} 30%, transparent)`,
            background: `color-mix(in oklab, ${ink} 10%, transparent)`,
          }}
        >
          <Swords className="h-4 w-4" />
        </span>

        <div className="min-w-0">
          <h4 className="truncate text-sm font-bold text-white">
            Battle #{String(battle.id)} · deck #{battle.deckId} ({battle.joined ? "2/2" : "1/2"})
          </h4>
          <span className="t-chain block truncate text-xs text-slate-400">
            {short(battle.a)}
            {battle.joined ? ` vs ${short(battle.b)}` : " · waiting for a challenger"} ·{" "}
            <Ago at={battle.openedAt} />
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <span
          className="t-label"
          style={{
            color: ink,
            animation:
              battle.joined && !battle.resolved ? "marker-live 1.8s ease-in-out infinite" : undefined,
          }}
        >
          {label}
        </span>

        {battle.waiting && !isMine && (
          <Button size="sm" disabled={!canPlay || busy} onClick={onJoin}>
            Join • $1
          </Button>
        )}
        <Link href={`/battles/${battle.id}`}>
          <Button size="sm" variant="ghost">
            {battle.resolved ? "Result" : "Watch"}
          </Button>
        </Link>
      </div>
    </div>
  );
}

function Tally({ label, value, ink }: { label: string; value: number; ink?: string }) {
  return (
    <div className="text-right">
      <span className="t-label block">{label}</span>
      <span
        className="t-chain text-2xl font-extrabold leading-tight"
        style={{ color: ink ?? "var(--color-ink)" }}
      >
        {value}
      </span>
    </div>
  );
}

function Fact({
  icon,
  value,
  note,
}: {
  icon: React.ReactNode;
  value: string;
  note: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-[var(--radius-control)] border border-slate-800 bg-slate-950 px-3 py-2.5">
      <span className="text-[var(--color-accent-hover)]">{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-bold text-slate-200">{value}</span>
        <span className="t-chain block truncate text-[10px] text-slate-500">{note}</span>
      </span>
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
