"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { Swords, Plus, Play, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { Tally } from "@/components/ui/Tally";
import { Chest } from "@/components/Chest";
import { StartHere } from "@/components/StartHere";
import { useDeck, type DeckInfo } from "@/hooks/useDeck";
import { useBattleList, type Battle } from "@/hooks/useBattles";
import { bestTier } from "@/lib/deck";

/**
 *
 *
 */
export default function BattlesPage() {
  const { address } = useAccount();
  const router = useRouter();
  const game = useDeck();
  const battles = useBattleList();
  const [pick, setPick] = useState(0);

  /**
   *
   *
   */
  const enter = async (open: Promise<bigint | undefined>) => {
    const id = await open;
    if (id !== undefined) router.push(`/battles/${id}`);
  };

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
    <div className="w-full bg-[var(--color-section)] px-4 py-10 lg:px-8 2xl:px-14">
      <div className="mx-auto flex max-w-[1320px] flex-col space-y-8">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-6 md:flex-row md:items-center">
          <div className="max-w-2xl">
            <h1 className="t-page text-white">Case battles arena</h1>
            <p className="mt-2 text-base leading-relaxed text-slate-300">
              Two cases open at once and the better card takes both prizes. Neither card can be
              read until both players have paid, not even by the one who opened the battle.
            </p>
          </div>

          <div className="flex items-center gap-6">
            <Tally label="waiting" value={battles.open.length} />
            <Tally label="live" value={battles.live.length} />
            <Tally label="all time" value={battles.total} />
          </div>
        </div>

        {battles.state.error && (
          <p className="text-sm text-[var(--color-danger)]">
            {battles.state.error.title}
            {battles.state.error.next && (
              <span className="block text-slate-400">{battles.state.error.next}</span>
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
          <div
            className="space-y-6 rounded-[var(--radius-window)] border p-6 lg:col-span-5"
            style={{
              background: "var(--color-surface)",
              borderColor: "color-mix(in oklab, var(--color-accent) 22%, transparent)",
            }}
          >
            <h2 className="t-display flex items-center gap-2 text-2xl text-white">
              <Plus className="h-6 w-6" style={{ color: "var(--color-accent)" }} />
              <span>Create a battle</span>
            </h2>

            <div>
              <label className="t-label mb-2 block">1. pick the deck you both draw from</label>
              {playable.length === 0 ? (
                <p className="text-sm text-slate-400">
                  {game.isLoading ? "Reading the chain…" : "Every deck in this season is empty."}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
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
                            ? "border-[rgb(57_255_136_/_0.4)] bg-[rgb(57_255_136_/_0.08)] text-white"
                            : "border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        <Chest rarity={best?.rarity ?? "sealed"} size={62} />
                        <span className="truncate text-sm font-bold">
                          {best?.name ?? "Sealed"}
                        </span>
                        <span className="t-chain text-sm text-slate-400">
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
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Fact icon={<Users className="h-5 w-5" />} value="2 players" note="you and one" />
                <Fact icon={<Swords className="h-5 w-5" />} value="1 card each" note="higher takes both" />
              </div>
            </div>

            <div className="border-t border-slate-800 pt-4">
              <div className="mb-4 flex items-baseline justify-between gap-4">
                <span className="t-label">your entry</span>
                <span className="text-right">
                  <span className="t-chain text-2xl font-extrabold text-white">$1.00</span>
                  <span className="t-chain block text-sm text-slate-400">
                    and it still buys your ticket
                  </span>
                </span>
              </div>

              {!address || !game.canAfford ? (
                <StartHere what="A battle" />
              ) : mine ? (
                <p className="text-sm text-slate-300">
                  You already have a battle on the table. Settle it before opening another.
                </p>
              ) : (
                <Button
                  block
                  className="py-4"
                  disabled={!canPlay || battles.busy}
                  loading={battles.busy}
                  onClick={() => chosen && void enter(battles.create(chosen.id, game.needsApproval))}
                >
                  <Play className="h-4 w-4 fill-current" />
                  Start battle
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-4 lg:col-span-7">
            <h2 className="flex flex-wrap items-baseline justify-between gap-2 text-2xl font-bold text-white">
              <span>Active public battles</span>
              <span className="t-label">live from the chain</span>
            </h2>

            {battles.all.length === 0 ? (
              <p className="rounded-[var(--radius-panel)] border border-slate-800 bg-slate-900/60 p-10 text-center text-slate-300">
                {battles.loading ? "Reading the chain…" : "No battles yet, open the first one."}
              </p>
            ) : (
              battles.all.map((b) => (
                <Row
                  key={String(b.id)}
                  battle={b}
                  deck={game.decks[b.deckId]}
                  me={me}
                  ready={Boolean(address) && game.canAfford}
                  canPlay={canPlay && !mine}
                  busy={battles.busy}
                  onJoin={() => void enter(battles.join(b.id, game.needsApproval))}
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
  deck,
  me,
  ready,
  canPlay,
  busy,
  onJoin,
}: {
  battle: Battle;
  deck?: DeckInfo;
  me?: string;
  ready: boolean;
  canPlay: boolean;
  busy: boolean;
  onJoin: () => void;
}) {
  const isMine = battle.a.toLowerCase() === me || battle.b.toLowerCase() === me;

  const status = battle.resolved ? "done" : battle.joined ? "live" : "waiting";
  const deckBest = deck ? bestTier(deck) : undefined;
  const deckInk = deckBest?.ink ?? "var(--color-tier-sealed)";

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-panel)] border p-4 transition-colors sm:p-5"
      style={{ background: "var(--color-surface)", borderColor: "var(--edge)" }}
    >
      <div className="flex min-w-0 items-center gap-4">
        <span
          className="grid h-14 w-14 shrink-0 place-items-center rounded-[var(--radius-control)] border"
          style={{
            borderColor: `color-mix(in oklab, ${deckInk} 24%, transparent)`,
            background: `color-mix(in oklab, ${deckInk} 7%, transparent)`,
          }}
        >
          <Chest rarity={deckBest?.rarity ?? "sealed"} size={44} />
        </span>

        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-white">
            Battle #{String(battle.id)} · deck #{battle.deckId} ({battle.joined ? "2/2" : "1/2"})
          </h3>
          <span className="t-chain mt-0.5 block truncate text-sm text-slate-400">
            {short(battle.a)}
            {battle.joined ? ` vs ${short(battle.b)}` : " · waiting for a challenger"} ·{" "}
            <Ago at={battle.openedAt} />
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <StatusPill status={status} />

        {battle.waiting && !isMine && (ready ? (
          <Button size="sm" disabled={!canPlay || busy} onClick={onJoin}>
            Join • $1
          </Button>
        ) : (
          <StartHere what="A seat" compact />
        ))}
        <Link href={`/battles/${battle.id}`}>
          <Button size="sm" variant="ghost">
            {battle.resolved ? "Result" : "Watch"}
          </Button>
        </Link>
      </div>
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
      <span className="text-slate-400">{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-slate-200">{value}</span>
        <span className="t-chain block truncate text-xs text-slate-400">{note}</span>
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
