"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { Lock, PlusCircle, ChevronDown, Ticket } from "lucide-react";
import { ConnectBar } from "./ConnectBar";
import { Ticker } from "./Ticker";
import { Counter } from "./ui/Counter";
import { Disclosure } from "./ui/Disclosure";
import { useDeck } from "@/hooks/useDeck";
import { useFeed } from "@/hooks/useFeed";
import { useMegapot } from "@/hooks/useMegapot";
import { useInventory } from "@/hooks/useInventory";
import { Chest } from "./Chest";
import { specOf, isShard, WEIGHT_PER_TICKET } from "@/lib/deck";
import { useMint } from "@/hooks/useMint";
import { addressUrl, DECK_ADDRESS } from "@/lib/chain";

/**
 *
 *
 *
 */
export function Shell({ children }: { children: React.ReactNode }) {
  const { isConnected } = useAccount();
  const game = useDeck();
  const shapes = useMemo(() => game.decks.map((d) => d), [game.decks]);
  const feed = useFeed(shapes);
  const megapot = useMegapot();
  const { mint, minting, canMint } = useMint(game.refetch);

  const inventory = useInventory(game.decks);
  const tesa = (inventory.data ?? []).filter(
    (s) =>
      s.value != null &&
      !s.spent &&
      !s.locked &&
      isShard(
        specOf(s.value, {
          size: game.decks[s.deckId]?.size ?? 0,
          tiers: game.decks[s.deckId]?.tiers ?? [],
          vaultUpTo: game.decks[s.deckId]?.vaultUpTo ?? 0,
        }),
      ),
  ).length;

  const firstOpen = game.decks.find((d) => !d.empty)?.id ?? 0;

  return (
    <div className="relative z-[1] flex min-h-screen flex-col">
      <header className="sticky top-0 z-[var(--z-sticky)] border-b border-slate-800/80 bg-[color-mix(in_oklab,var(--color-header)_92%,transparent)] px-4 py-3 backdrop-blur-md lg:px-8 2xl:px-14">
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

          <div className="flex flex-wrap items-center justify-end gap-2">
            {isConnected && (
              <span className="flex items-center gap-2 rounded-[var(--radius-chip)] border border-slate-800 bg-slate-900/90 px-3 py-2">
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[0.625rem] font-bold tracking-wider text-slate-400">
                  TEST
                </span>
                <Counter
                  value={Number(formatUnits(game.balance, 6))}
                  decimals={2}
                  prefix="$ "
                  className="t-chain text-sm font-bold leading-none text-slate-100"
                />
              </span>
            )}

            {isConnected && canMint && (
              <button
                type="button"
                onClick={() => void mint()}
                disabled={minting}
                className="flex items-center gap-1.5 rounded-[var(--radius-chip)] border px-3 py-2 text-sm font-bold transition-all hover:brightness-115 disabled:opacity-50"
                style={{
                  borderColor: "color-mix(in oklab, var(--color-accent) 45%, transparent)",
                  background: "color-mix(in oklab, var(--color-accent) 10%, transparent)",
                  color: "var(--color-accent-hover)",
                }}
              >
                <PlusCircle
                  className="h-4 w-4"
                  style={minting ? { animation: "spin-loading 1s linear infinite" } : undefined}
                />
                {minting ? "Minting…" : "Get $20"}
              </button>
            )}

            <span
              className="flex items-center gap-2 rounded-[var(--radius-chip)] border px-3 py-2"
              style={{
                borderColor: "color-mix(in oklab, var(--color-tier-vault) 30%, transparent)",
                background: "var(--color-surface)",
                boxShadow: "0 0 12px color-mix(in oklab, var(--color-tier-vault) 12%, transparent)",
              }}
            >
              <Lock className="h-3.5 w-3.5" style={{ color: "var(--color-tier-vault)" }} />
              <Counter
                value={Number(formatUnits(game.vault, 6))}
                decimals={2}
                prefix="$ "
                className="t-chain text-sm font-bold leading-none"
                style={{ color: "var(--color-tier-vault)" }}
              />
            </span>

            {isConnected && (
              <Link
                href="/profile"
                title="Your TESA, five make one real Megapot ticket"
                className="flex items-center gap-1.5 rounded-[var(--radius-chip)] border px-3 py-2 transition-all hover:brightness-125"
                style={{
                  borderColor: "color-mix(in oklab, var(--color-tier-shard) 40%, transparent)",
                  background: "color-mix(in oklab, var(--color-tier-shard) 10%, transparent)",
                }}
              >
                <Chest rarity="shard" size={20} />
                <span
                  className="t-chain text-sm font-bold leading-none"
                  style={{ color: "var(--color-tier-shard)" }}
                >
                  {tesa}
                </span>
                <span className="t-label text-[0.625rem]">TESA</span>
              </Link>
            )}

            {isConnected && (
              <TicketsChip
                tickets={Math.round(megapot.tickets)}
                caseHref={`/case/${firstOpen}#megapot`}
              />
            )}

            <ConnectBar
              onMinted={game.refetch}
              balance={game.balance}
              vault={game.vault}
              tesa={tesa}
              tickets={Math.round(megapot.tickets)}
            />
          </div>
        </div>
      </header>

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
 *
 */
function TicketsChip({ tickets, caseHref }: { tickets: number; caseHref: string }) {
  return (
    <Disclosure
      summary={
        <span className="flex items-center gap-2 rounded-[var(--radius-chip)] border border-slate-800 bg-slate-900/90 px-3 py-2">
          <Ticket className="h-4 w-4 text-[var(--color-accent-hover)]" />
          <Counter
            value={tickets}
            className="t-chain text-sm font-bold leading-none text-[var(--color-accent-hover)]"
          />
          <span className="t-label text-[0.625rem]">megapot</span>
          <ChevronDown className="h-3.5 w-3.5 text-slate-500 transition-transform duration-200 group-open/d:rotate-180" />
        </span>
      }
    >
      <div className="slab w-[min(22rem,calc(100vw-2rem))] bg-[var(--color-modal)] p-5">
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
    </Disclosure>
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
