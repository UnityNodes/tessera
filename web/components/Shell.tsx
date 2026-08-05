"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { formatUnits } from "viem";
import { ConnectBar } from "./ConnectBar";
import { Ticker } from "./Ticker";
import { useDeck } from "@/hooks/useDeck";
import { useFeed } from "@/hooks/useFeed";
import { useOpens } from "@/hooks/useOpens";
import { useMegapot } from "@/hooks/useMegapot";
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

  const playerCount = new Set((opens.data ?? []).map((o) => o.player.toLowerCase())).size;

  return (
    <div className="relative z-[1] flex min-h-screen flex-col">
      <header className="sticky top-0 z-[var(--z-sticky)] border-b border-[var(--edge)] bg-[color-mix(in_oklab,var(--color-bg)_82%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex h-[4.5rem] max-w-[1800px] items-center gap-3 px-4 sm:gap-5 sm:px-8 2xl:px-12">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <Mark />
            <span className="t-inscription hidden text-[0.9375rem] leading-none sm:block">
              Tessera
            </span>
          </Link>

          <nav className="flex min-w-0 items-center gap-0.5 sm:gap-1.5">
            <Tab href="/" icon={<IconHome />}>
              home
            </Tab>
            <Tab href="/case" icon={<IconCase />}>
              cases
            </Tab>
            <Tab href="/battles" icon={<IconSwords />}>
              battles
            </Tab>
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden items-center gap-2 rounded-[var(--radius-panel)] border border-[var(--edge)] px-3 py-1.5 lg:flex">
              <IconVault />
              <span
                className="t-chain text-[0.8125rem]"
                style={{ color: "var(--color-tier-vault)" }}
              >
                ${Number(formatUnits(game.vault, 6)).toFixed(2)}
              </span>
            </span>
            <ConnectBar />
          </div>
        </div>
      </header>

      <div className="border-b border-[var(--edge)] bg-[color-mix(in_oklab,var(--color-surface)_70%,transparent)] backdrop-blur-md">
        <div className="mx-auto grid max-w-[1800px] grid-cols-2 divide-x divide-[var(--edge)] px-5 sm:px-8 2xl:px-12 md:grid-cols-4">
          <Stat icon={<IconCase />} label="cases opened" value={String(game.drawn)} />
          <Stat icon={<IconUsers />} label="players" value={String(playerCount)} />
          <Stat
            icon={<IconLayers />}
            label="cases left"
            value={`${game.remaining} in ${game.decks.length}`}
          />
          <Stat
            icon={<IconTicket />}
            label="your tickets"
            value={megapot.tickets.toFixed(0)}
            ink="var(--color-accent-bright)"
          />
        </div>
      </div>

      <div className="border-b border-[var(--edge)] bg-[color-mix(in_oklab,var(--color-surface)_38%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex max-w-[1800px] items-stretch px-5 sm:px-8 2xl:px-12">
          <div className="flex w-14 shrink-0 flex-col items-center justify-center gap-1 border-r border-[var(--edge)] pr-3">
            <IconCrown />
            <span className="t-label flex items-center gap-1 text-[0.5625rem]">
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  background: "var(--color-tier-denarius)",
                  boxShadow: "0 0 8px var(--color-tier-denarius)",
                  animation: "marker-live 1.8s ease-in-out infinite",
                }}
              />
              live
            </span>
          </div>
          <div className="min-w-0 flex-1 pl-3">
            <Ticker items={feed} />
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-[1800px] flex-1 px-5 pb-28 pt-8 sm:px-8 2xl:px-12">
        {children}
      </main>

      <footer className="border-t border-[var(--edge)]">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-3 px-5 py-7 sm:px-8 2xl:px-12">
          <span className="t-label">Tessera · Base Sepolia · Inco Lightning · Megapot</span>
          <a
            href={addressUrl(DECK_ADDRESS)}
            target="_blank"
            rel="noreferrer"
            className="t-chain text-[0.75rem] text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]"
          >
            {DECK_ADDRESS}
          </a>
        </div>
      </footer>
    </div>
  );
}

function Tab({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const active = href === "/" ? path === "/" : path.startsWith(href);
  return (
    <Link
      href={href}
      className="t-label flex items-center gap-2 whitespace-nowrap rounded-[var(--radius-panel)] px-2 py-2 transition-colors hover:text-[var(--color-ink)] sm:px-3"
      style={
        active
          ? {
              background: "color-mix(in oklab, var(--color-accent) 18%, var(--color-surface))",
              color: "var(--color-accent-bright)",
              boxShadow: "inset 0 0 0 1px color-mix(in oklab, var(--color-accent-bright) 30%, transparent)",
            }
          : undefined
      }
    >
      <span>{icon}</span>
      <span className="hidden sm:block">{children}</span>
    </Link>
  );
}

function Stat({
  icon,
  label,
  value,
  ink,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  ink?: string;
}) {
  const lit = Boolean(ink);
  return (
    <div className="relative flex items-center gap-3.5 px-5 py-4">
      {lit && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${ink}, transparent)` }}
        />
      )}
      <span style={{ color: lit ? ink : "var(--color-ink-faint)" }}>{icon}</span>
      <span>
        <span className="t-label block">{label}</span>
        <span
          className="t-chain mt-1.5 block text-[1.375rem] font-medium leading-none"
          style={{
            color: ink ?? "var(--color-ink)",
            textShadow: lit ? `0 0 24px color-mix(in oklab, ${ink} 55%, transparent)` : undefined,
          }}
        >
          {value}
        </span>
      </span>
    </div>
  );
}


const S = { width: 15, height: 15, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const IconHome = () => (
  <svg {...S}>
    <path d="M2 6.5 8 2l6 4.5V14H2z" />
    <path d="M6.5 14V9.5h3V14" />
  </svg>
);

const IconCase = () => (
  <svg {...S}>
    <rect x="1.5" y="4.5" width="13" height="8.5" rx="1.2" />
    <path d="M5.5 4.5V3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.5M1.5 8.5h13" />
  </svg>
);

const IconSwords = () => (
  <svg {...S}>
    <path d="M2 2h3l8 8-3 3-8-8z" />
    <path d="M14 2h-3l-3.2 3.2M2.5 13.5 5 11" />
  </svg>
);

const IconUsers = () => (
  <svg {...S}>
    <circle cx="6" cy="5.5" r="2.5" />
    <path d="M1.5 14c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4M11 3.2a2.5 2.5 0 0 1 0 4.6M12.5 10.4c1.3.6 2 1.8 2 3.6" />
  </svg>
);

const IconLayers = () => (
  <svg {...S}>
    <path d="M8 1.5 14.5 5 8 8.5 1.5 5z" />
    <path d="M1.5 8 8 11.5 14.5 8M1.5 11 8 14.5 14.5 11" />
  </svg>
);

const IconTicket = () => (
  <svg {...S}>
    <path d="M1.5 5.5V4a.5.5 0 0 1 .5-.5h12a.5.5 0 0 1 .5.5v1.5a2 2 0 0 0 0 5V12a.5.5 0 0 1-.5.5H2a.5.5 0 0 1-.5-.5v-1.5a2 2 0 0 0 0-5z" />
    <path d="M9.5 3.5v9" strokeDasharray="1.6 1.6" />
  </svg>
);

const IconVault = () => (
  <svg {...S} width={14} height={14}>
    <rect x="1.5" y="2" width="13" height="12" rx="1.2" />
    <circle cx="8" cy="8" r="2.8" />
    <path d="M8 5.2v5.6M5.2 8h5.6" />
  </svg>
);

const IconCrown = () => (
  <svg {...S} width={16} height={16} style={{ color: "var(--color-tier-aureus)" }}>
    <path d="M2 12h12M2.5 11 1.5 4.5l3.5 2.5L8 3l3 4 3.5-2.5L13.5 11z" />
  </svg>
);

const Mark = () => (
  <span
    className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px]"
    style={{
      background:
        "linear-gradient(150deg, var(--color-accent-bright), var(--color-accent) 55%, oklch(38% 0.14 262))",
      boxShadow:
        "inset 0 1px 0 oklch(100% 0 0/0.4), inset 0 -2px 0 oklch(0% 0 0/0.25), 0 0 18px -6px var(--color-accent)",
    }}
  >
    <span className="t-display text-[1rem] leading-none text-[oklch(99%_0.005_250)]">T</span>
  </span>
);
