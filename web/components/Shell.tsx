"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { formatUnits } from "viem";
import { Lock, PlusCircle, ChevronDown } from "lucide-react";
import { ConnectBar } from "./ConnectBar";
import { Ticker } from "./Ticker";
import { Counter } from "./ui/Counter";
import { useDeck } from "@/hooks/useDeck";
import { useFeed } from "@/hooks/useFeed";
import { useOpens } from "@/hooks/useOpens";
import { useMegapot } from "@/hooks/useMegapot";
import { useMint } from "@/hooks/useMint";
import { addressUrl, DECK_ADDRESS } from "@/lib/chain";

/**
 *
 *
 */
export function Shell({ children }: { children: React.ReactNode }) {
  const game = useDeck();
  const shapes = useMemo(() => game.decks.map((d) => d), [game.decks]);
  const feed = useFeed(shapes);
  const opens = useOpens();
  const megapot = useMegapot();
  const { mint, minting, canMint } = useMint(game.refetch);

  const playerCount = new Set((opens.data ?? []).map((o) => o.player.toLowerCase())).size;
  const firstOpen = game.decks.find((d) => !d.empty)?.id ?? 0;

  return (
    <div className="relative z-[1] flex min-h-screen flex-col">
      <header className="sticky top-0 z-[var(--z-sticky)] border-b border-slate-800/80 bg-[rgb(10_14_23_/_0.9)] px-4 py-3 backdrop-blur-md lg:px-8 2xl:px-14">
        <div className="mx-auto flex flex-col items-center justify-between gap-3 md:flex-row">
          <div className="flex w-full min-w-0 items-center justify-between gap-3 md:w-auto md:gap-8">
            <Link href="/" className="group flex shrink-0 items-center gap-2">
              <Mark />
              <span className="t-black text-xl tracking-wide text-white sm:text-2xl">Tessera</span>
            </Link>

            <nav className="scrollbar-none flex min-w-0 items-center gap-1 overflow-x-auto rounded-[var(--radius-control)] border border-slate-800 bg-slate-900/60 p-1">
              <Tab href="/">home</Tab>
              <Tab href="/case">cases</Tab>
              <Tab href="/battles">battles</Tab>
              <Tab href="/leaderboard">standings</Tab>
              <Tab href="/profile">shelf</Tab>
            </nav>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 lg:gap-3">
            <span className="flex items-center gap-2 rounded-[var(--radius-chip)] border border-slate-800 bg-slate-900/90 px-3 py-1.5">
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-slate-400">
                TEST
              </span>
              <Counter
                value={Number(formatUnits(game.balance, 6))}
                decimals={2}
                prefix="$ "
                className="t-chain text-xs font-bold leading-none text-slate-100"
              />
              {canMint && (
                <button
                  type="button"
                  onClick={() => void mint()}
                  disabled={minting}
                  title="Get $20 in test dollars"
                  className="text-[var(--color-accent-hover)] transition-colors hover:text-[var(--color-accent-bright)] disabled:opacity-40"
                >
                  <PlusCircle
                    className="h-4 w-4"
                    style={minting ? { animation: "spin-loading 1s linear infinite" } : undefined}
                  />
                </button>
              )}
            </span>

            <span
              className="flex items-center gap-2 rounded-[var(--radius-chip)] border px-3 py-1.5"
              style={{
                borderColor: "rgb(236 72 153 / 0.3)",
                background: "rgb(15 23 42 / 0.9)",
                boxShadow: "0 0 12px rgb(236 72 153 / 0.12)",
              }}
            >
              <Lock className="h-3.5 w-3.5" style={{ color: "var(--color-tier-vault)" }} />
              <Counter
                value={Number(formatUnits(game.vault, 6))}
                decimals={2}
                prefix="$ "
                className="t-chain text-xs font-bold leading-none"
                style={{ color: "var(--color-tier-vault)" }}
              />
            </span>

            <ConnectBar onMinted={game.refetch} />
          </div>
        </div>
      </header>

      <div className="relative z-[var(--z-stats)] w-full border-b border-slate-800/60 bg-[var(--color-stats)] px-4 py-4 lg:px-8 2xl:px-14">
        <div className="mx-auto grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="cases opened" value={game.drawn} />
          <Stat label="players" value={playerCount} />
          <Stat label="cases left" value={game.remaining} suffix={` in ${game.decks.length}`} />
          <TicketsStat
            tickets={Math.round(megapot.tickets)}
            caseHref={`/case/${firstOpen}#megapot`}
          />
        </div>
      </div>

      <div className="relative z-[var(--z-feed)] w-full border-b border-slate-800/80 bg-[var(--color-bg)] px-4 py-3 lg:px-8 2xl:px-14">
        <div className="mx-auto flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className="h-2 w-2 rounded-full"
                style={{
                  background: "var(--color-accent-hover)",
                  boxShadow: "0 0 8px var(--color-accent-hover)",
                  animation: "marker-live 1.8s ease-in-out infinite",
                }}
              />
              <span className="t-label">live drops</span>
            </span>
            <span className="t-chain text-[11px] text-slate-500">
              straight off Base Sepolia
            </span>
          </div>

          <Ticker items={feed} />
        </div>
      </div>


      <main className="w-full flex-1 bg-[var(--color-section)]">{children}</main>

      <footer className="w-full border-t border-slate-800/80 bg-[var(--color-sunk)] px-4 py-8 lg:px-8 2xl:px-14">
        <div className="mx-auto flex flex-col items-center justify-between gap-4 text-xs text-slate-500 sm:flex-row">
          <span className="flex flex-wrap items-center justify-center gap-2">
            <span className="font-bold text-slate-300">Tessera Protocol</span>
            <span>•</span>
            <span className="t-chain">a finite pool, drawn without replacement</span>
          </span>
          <a
            href={addressUrl(DECK_ADDRESS)}
            target="_blank"
            rel="noreferrer"
            className="t-addr transition-colors hover:text-[var(--color-accent-hover)]"
          >
            {DECK_ADDRESS}
          </a>
        </div>
      </footer>
    </div>
  );
}

function Tab({ href, children }: { href: string; children: React.ReactNode }) {
  const path = usePathname();
  const active = href === "/" ? path === "/" : path.startsWith(href);
  return (
    <Link
      href={href}
      className={`flex shrink-0 items-center rounded-[var(--radius-chip)] px-2.5 py-1.5 text-xs font-semibold capitalize transition-all min-h-11 sm:min-h-0 sm:px-4 sm:text-sm ${
        active
          ? "border border-[rgb(57_255_136_/_0.3)] bg-[rgb(57_255_136_/_0.2)] text-[var(--color-accent-hover)] shadow-[var(--glow-accent-soft)]"
          : "border border-transparent text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
      }`}
    >
      {children}
    </Link>
  );
}

/**
 *
 *
 */
function TicketsStat({ tickets, caseHref }: { tickets: number; caseHref: string }) {
  return (
    <details className="group/t relative flex flex-col">
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <span className="t-label flex items-center gap-1.5">
          your tickets
          <ChevronDown className="h-3 w-3 transition-transform duration-200 group-open/t:rotate-180" />
        </span>
        <span className="mt-0.5 flex items-center gap-2">
          <Counter
            value={tickets}
            className="t-chain text-2xl font-extrabold leading-tight tracking-tight lg:text-3xl"
            style={{
              color: "var(--color-accent-hover)",
              textShadow: "0 0 24px rgb(34 211 238 / 0.5)",
            }}
          />
          <span className="rounded border border-[rgb(57_255_136_/_0.3)] bg-[rgb(57_255_136_/_0.1)] px-1.5 py-0.5 text-[10px] uppercase text-[var(--color-accent-hover)]">
            vault chance
          </span>
        </span>
      </summary>

      <div className="slab absolute right-0 top-full z-[var(--z-sticky)] mt-2 w-[min(22rem,calc(100vw-2rem))] bg-[var(--color-modal)] p-5">
        <p className="text-sm text-slate-400">
          Every case you open buys you one real{" "}
          <span className="font-bold text-slate-100">Megapot</span> lottery ticket. The ticket is
          recorded in Megapot&apos;s own contract against{" "}
          <span className="font-bold text-slate-100">your wallet</span>, Tessera never holds it
          and cannot touch it.
        </p>
        <p className="mt-3 text-sm text-slate-500">
          On this testnet the draw is frozen, so nothing is picked here. On Base mainnet the same
          contract draws every day, and the same wallet plays.
        </p>
        <Link
          href={caseHref}
          className="t-label mt-4 inline-flex min-h-11 items-center gap-1.5 text-[var(--color-accent-hover)] hover:text-[var(--color-accent-bright)]"
        >
          see the jackpot and claim winnings →
        </Link>
      </div>
    </details>
  );
}

/**
 *
 */
function Stat({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="flex flex-col border-r border-slate-800/80 pr-4 last:border-r-0">
      <span className="t-label">{label}</span>
      <Counter
        value={value}
        suffix={suffix}
        className="t-chain mt-0.5 text-2xl font-extrabold leading-tight tracking-tight text-slate-100 lg:text-3xl"
      />
    </div>
  );
}

const Mark = () => (
  <span
    className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--radius-chip)] transition-transform group-hover:scale-105"
    style={{
      background: "linear-gradient(135deg, var(--color-accent), var(--color-accent-press))",
      boxShadow: "0 0 15px rgb(57 255 136 / 0.4)",
    }}
  >
    <span className="t-black text-lg leading-none tracking-tighter text-white">T</span>
  </span>
);
