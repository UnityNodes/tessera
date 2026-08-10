"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { Lock, PlusCircle } from "lucide-react";
import { ConnectBar } from "./ConnectBar";
import { Mark } from "./Mark";
import { Ticker } from "./Ticker";
import { Counter } from "./ui/Counter";
import { useDeck } from "@/hooks/useDeck";
import { useFeed } from "@/hooks/useFeed";
import { useMegapot } from "@/hooks/useMegapot";
import { useInventory } from "@/hooks/useInventory";
import { specOf, isShard } from "@/lib/deck";
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
            <Link
              href="/"
              className="group flex shrink-0 items-center gap-2.5 text-white transition-opacity hover:opacity-90"
            >
              <Mark size={36} className="shrink-0 transition-transform group-hover:scale-105" />
              <span className="t-black text-xl tracking-wide sm:text-2xl">Tessera</span>
            </Link>



            <nav className="scrollbar-none flex min-w-0 items-center gap-1 overflow-x-auto rounded-[var(--radius-control)] border border-slate-800 bg-slate-900/60 p-1">
              <Tab href="/">home</Tab>
              <Tab href="/battles">battles</Tab>
              <Tab href="/leaderboard">standings</Tab>
              <Tab href="/create">create</Tab>
            </nav>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">

            {isConnected && canMint && !game.canAfford && (
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

            <ConnectBar
              onMinted={game.refetch}
              balance={game.balance}
              tesa={tesa}
              tickets={Math.round(megapot.tickets)}
              megapotHref={`/case/${firstOpen}#megapot`}
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
            <span className="t-chain text-xs text-slate-400">
              straight off Base Sepolia
            </span>
          </div>

          <Ticker items={feed} />
        </div>
      </div>


      <main className="w-full flex-1 bg-[var(--color-section)]">{children}</main>

      <footer className="w-full border-t border-slate-800/80 bg-[var(--color-sunk)] px-4 py-8 lg:px-8 2xl:px-14">
        <div className="mx-auto flex flex-col items-center justify-between gap-4 text-xs text-slate-400 sm:flex-row">
          <span className="flex flex-wrap items-center justify-center gap-2">
            <Mark size={24} simple className="shrink-0 text-slate-300" />
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

