"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { Swords, Plus, Play, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { Tally } from "@/components/ui/Tally";
import { Chest, skinOf } from "@/components/Chest";
import { StartHere } from "@/components/StartHere";
import { useDeck, type DeckInfo } from "@/hooks/useDeck";
import { useBattleList, type Battle } from "@/hooks/useBattles";
import { bestTier } from "@/lib/deck";

/**
 * The battle arena.
 *
 * On the left, creating a battle; on the right, all the rooms, as in the
 * reference. In the reference the number of players and rounds is chosen in the
 * same place; for us both are set by the contract: two at the table, one card
 * each. Showing a choice that does not exist would mean selling a promise the
 * game does not keep, so what stands in that place is what really is there,
 * which deck both of them draw from.
 *
 * There is no price in the row either: it is always the same, a dollar from
 * each, and that dollar has already come back as a real ticket. Only the bonus
 * is split, and how much of it there is nobody knows before the reveal,
 * ourselves included.
 */
export default function BattlesPage() {
  const { address } = useAccount();
  const router = useRouter();
  const game = useDeck();
  const battles = useBattleList();
  const [pick, setPick] = useState(0);

  /**
   * You paid, so you are already at the table.
   *
   * Until now a person stayed on the list after "Start battle". The dollar was
   * charged, the card drawn and sealed, and on screen was the same catalogue of
   * rooms in which one more row appeared somewhere near the top. Finding YOUR
   * battle in it is a job of its own, and it was done by whoever had just paid.
   *
   * The same on "Join": you enter somebody's room, both cards become public at
   * that very moment, and there is nobody to show that moment to, because you
   * stayed on the list.
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
        {/* -- the header ---------------------------------------------------- */}
        <div className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-6 md:flex-row md:items-center">
          <div className="max-w-2xl">
            {/* There is no icon here any more. The pulsing one reported nothing,
                it simply moved; and the one that stayed was green, that is, the
                colour of an action on something that cannot be pressed. In the
                system page headings stand without icons, all six of them. */}
            <h1 className="t-page text-white">Case battles arena</h1>
            <p className="mt-2 text-base leading-relaxed text-slate-300">
              Two cases open at once and the better card takes both prizes. Neither card can be
              read until both players have paid, not even by the one who opened the battle.
            </p>
          </div>

          <div className="flex items-center gap-6">
            <Tally label="waiting" value={battles.open.length} />
            {/* A red one stood here, and it said the same thing as the error
                messages on this same page. This number no longer owns a colour:
                it is the largest in the row as it is, and "running now" is shown
                by the pill inside the battle itself, with a pulse rather than a
                shade. */}
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
                    : "Your opponent is in. Go turn the cards over."}
                </p>
              </div>
              <Button variant="quiet">Open it</Button>
            </div>
          </Link>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* -- create a battle ----------------------------------------------- */}
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
                  {game.isLoading || game.decks.length === 0
                    ? "Reading the chain…"
                    : "Every deck in this season is empty."}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {playable.map((d) => {
                    const best = bestTier(d);
                    // A deck with its own skin is called by its own name, just
                    // as in the catalogue and on the case page. Without this,
                    // four seasons with porphyry at the top stood here as four
                    // identical "Porphyry" buttons, and there was nothing to
                    // choose between them.
                    const dress = skinOf(d.cid);
                    const on = chosen?.id === d.id;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setPick(d.id)}
                        // The chosen one in green, like everything chosen in
                        // this language: the active header tab, the active
                        // filter, a hovered button. It was red while the whole
                        // panel was red; now red is left to errors.
                        className={`flex cursor-pointer flex-col items-center gap-1 rounded-[var(--radius-control)] border p-3 transition-all ${
                          on
                            ? "border-[rgb(57_255_136_/_0.4)] bg-[rgb(57_255_136_/_0.08)] text-white"
                            : "border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        <Chest rarity={best?.rarity ?? "sealed"} size={62} skin={d.cid} />
                        <span className="flex w-full items-baseline justify-center gap-1 truncate text-sm font-bold">
                          <span className="truncate">{dress?.name ?? best?.name ?? "Sealed"}</span>
                          <span className="t-chain text-xs text-[var(--color-ink-dim)]">
                            #{d.id}
                          </span>
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
                <Fact icon={<Swords className="h-5 w-5" />} value="1 card each" note="rarer takes both" />
              </div>
            </div>

            <div className="border-t border-slate-800 pt-4">
              <div className="mb-4 flex items-baseline justify-between gap-4">
                <span className="t-label">your entry</span>
                {/* Here the player stakes a dollar rather than buying a ticket,
                    and this is the only place on the site where the promise "$1 =
                    a ticket" sounds different. It has to be written before
                    payment and plainly: otherwise a person learns about the stake
                    once they have already lost. */}
                <span className="text-right">
                  <span className="t-chain text-2xl font-extrabold text-white">$1.00</span>
                  <span className="t-chain block text-sm text-slate-400">
                    staked, the winner takes both tickets
                  </span>
                </span>
              </div>

              {/* StartHere without `what`: its usual explanation says "$1 buys
                  you a real ticket", and in a battle the dollar precisely does
                  NOT buy a ticket, the contract puts it in escrow and buys one
                  for the winner at settlement. That this is a stake was just said
                  by the line above the button. */}
              {!address || !game.canAfford ? (
                <StartHere />
              ) : mine ? (
                <p className="text-sm text-slate-300">
                  You already have a battle on the table. Settle it before opening another.
                </p>
              ) : (
                // The main action of this page, and it is green, like
                // everything that can be pressed. It was red while red meant
                // "battle"; now it means an error only, and "what game you are
                // playing" is said by the page heading, the tab and the caption
                // on the button itself.
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

          {/* -- the rooms ------------------------------------------------- */}
          <div className="space-y-4 lg:col-span-7">
            <h2 className="flex flex-wrap items-baseline justify-between gap-2 text-2xl font-bold text-white">
              <span>Active public battles</span>
              <span className="t-label">live from the chain</span>
            </h2>

            {battles.all.length === 0 ? (
              <p className="rounded-[var(--radius-panel)] border border-slate-800 bg-slate-900/60 p-10 text-center text-slate-300">
                {battles.loading ? "Reading the chain…" : "No battles yet. Open the first one."}
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
  /** The deck both of them draw from. Needed only to show its chest. */
  deck?: DeckInfo;
  me?: string;
  /** The wallet is connected and there is money. */
  ready: boolean;
  canPlay: boolean;
  busy: boolean;
  onJoin: () => void;
}) {
  const isMine = battle.a.toLowerCase() === me || battle.b.toLowerCase() === me;

  // The state as a design system pill, in the same three words that later
  // stand in the header of the battle itself.
  const status = battle.resolved ? "done" : battle.joined ? "live" : "waiting";
  const deckBest = deck ? bestTier(deck) : undefined;
  const deckInk = deckBest?.ink ?? "var(--color-tier-sealed)";

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-panel)] border p-4 transition-colors sm:p-5"
      style={{ background: "var(--color-surface)", borderColor: "var(--edge)" }}
    >
      <div className="flex min-w-0 items-center gap-4">
        {/* The chest of the deck being played for, rather than a swords icon.
            The swords stood identical in every row and were coloured by state,
            that is, they drew the same thing as the pill on the right, only
            without words. The deck, by contrast, differs in every battle, and it
            is the deck that decides what can be won at all; until now only the
            number in the heading spoke of it. */}
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

      {/* The right hand group wraps its rows. It was shrink-0 and at 360 it
          pushed the page 11 pixels off screen: the state pill, "Connect to join"
          and "Watch" are together wider than a phone, and they were explicitly
          not allowed to shrink. */}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <StatusPill status={status} />

        {/* A guest is offered a step here too rather than a grey button: the
            reason "Join" is inactive is not the state of the battle but the state
            of the wallet. */}
        {battle.waiting && !isMine && (ready ? (
          // "$1" alone is not enough here: in a battle that dollar is a stake,
          // not the purchase of a ticket. That is written on the creation panel,
          // but a person enters FROM HERE, and they should learn about the stake
          // before paying rather than from the wording of a loss.
          <span className="flex flex-col items-end gap-1">
            <Button size="sm" disabled={!canPlay || busy} onClick={onJoin}>
              Join • stake $1
            </Button>
            <span className="t-label">winner takes both tickets</span>
          </span>
        ) : (
          <StartHere compact />
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
