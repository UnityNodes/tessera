"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectBar } from "./ConnectBar";
import { Ticker } from "./Ticker";
import { useDeck } from "@/hooks/useDeck";
import { usePool } from "@/hooks/usePool";
import { useFeed } from "@/hooks/useFeed";
import { useOpens } from "@/hooks/useOpens";
import { useMegapot } from "@/hooks/useMegapot";
import { slotsPerTier } from "@/lib/deck";
import { addressUrl, DECK_ADDRESS } from "@/lib/chain";

/**
 *
 *
 */
export function Shell({ children }: { children: React.ReactNode }) {
  const deck = useDeck();
  const shape = useMemo(
    () => ({ size: deck.size, tiers: deck.tiers, vaultUpTo: deck.vaultUpTo }),
    [deck.size, deck.tiers, deck.vaultUpTo],
  );
  const pool = usePool(shape, deck.drawn);
  const feed = useFeed(shape);
  const opens = useOpens();
  const megapot = useMegapot();

  const prizesLeft =
    pool.data?.prizesLeft ??
    slotsPerTier(shape)
      .filter((t) => t.weight > 0)
      .reduce((n, t) => n + t.count, 0);
  const playerCount = new Set((opens.data ?? []).map((o) => o.player.toLowerCase())).size;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-[var(--edge)] bg-[color-mix(in_oklab,var(--color-grout)_88%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-6 px-4 sm:px-6">
          <Link href="/" className="t-inscription shrink-0 text-[0.9375rem]">
            Tessera
          </Link>
          <span className="t-label hidden shrink-0 lg:block">season {deck.season}</span>

          <nav className="flex flex-1 items-center gap-5">
            <NavLink href="/">home</NavLink>
            <NavLink href="/case">open a case</NavLink>
            <NavLink href="/battles">battles</NavLink>
          </nav>

          <div className="ml-auto">
            <ConnectBar />
          </div>
        </div>
      </header>

      <div className="border-b border-[var(--edge)] bg-[var(--color-stone-900)]">
        <div className="mx-auto grid max-w-[1440px] grid-cols-2 divide-x divide-[var(--edge)] px-4 sm:px-6 md:grid-cols-4">
          <Stat label="cases opened" value={String(deck.drawn)} />
          <Stat label="players" value={String(playerCount)} />
          <Stat label="prizes left" value={`${prizesLeft} of ${deck.remaining}`} />
          <Stat
            label="your tickets"
            value={megapot.tickets.toFixed(0)}
            ink="var(--color-patina-400)"
          />
        </div>
      </div>

      <div className="border-b border-[var(--edge)] bg-[color-mix(in_oklab,var(--color-stone-900)_60%,transparent)]">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6">
          <Ticker items={feed} />
        </div>
      </div>

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 pb-24 pt-6 sm:px-6">
        {children}
      </main>

      <footer className="border-t border-[var(--edge)]">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-6 sm:px-6">
          <span className="t-label">Tessera · Base Sepolia · Inco Lightning</span>
          <a
            href={addressUrl(DECK_ADDRESS)}
            target="_blank"
            rel="noreferrer"
            className="t-chain text-[0.75rem] text-[var(--color-travertine-faint)] hover:text-[var(--color-travertine)]"
          >
            {DECK_ADDRESS}
          </a>
        </div>
      </footer>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const path = usePathname();
  const active = href === "/" ? path === "/" : path.startsWith(href);
  return (
    <Link
      href={href}
      className="t-label whitespace-nowrap hover:text-[var(--color-travertine)]"
      style={active ? { color: "var(--color-sinopia-400)" } : undefined}
    >
      {children}
    </Link>
  );
}

function Stat({ label, value, ink }: { label: string; value: string; ink?: string }) {
  return (
    <div className="px-4 py-3">
      <span className="t-label block">{label}</span>
      <span
        className="t-chain mt-1 block text-lg"
        style={{ color: ink ?? "var(--color-travertine)" }}
      >
        {value}
      </span>
    </div>
  );
}
