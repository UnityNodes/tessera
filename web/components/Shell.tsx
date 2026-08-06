"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { formatUnits } from "viem";
import { ConnectBar } from "./ConnectBar";
import { Ticker } from "./Ticker";
import { Counter } from "./ui/Counter";
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

          <nav className="flex shrink-0 items-center gap-0.5 sm:gap-1.5">
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

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <Chip
              label="vault"
              value={Number(formatUnits(game.vault, 6))}
              ink="var(--color-tier-vault)"
              icon={<IconVault />}
            />
            <Chip
              label="yours"
              value={Number(formatUnits(game.balance, 6))}
              ink="var(--color-ink)"
            />
            <ConnectBar />
          </div>
        </div>
      </header>

      <div className="relative z-[var(--z-stats)] border-b border-[var(--edge)] bg-[color-mix(in_oklab,var(--color-surface)_70%,transparent)] backdrop-blur-md">
        <div className="mx-auto grid max-w-[1800px] grid-cols-2 gap-x-8 px-5 sm:px-8 2xl:px-12 md:grid-cols-4">
          <Stat label="cases opened" value={game.drawn} />
          <Stat label="players" value={playerCount} />
          <Stat
            label="cases left"
            value={game.remaining}
            suffix={` in ${game.decks.length}`}
          />
          <TicketsStat
            tickets={Math.round(megapot.tickets)}
            caseHref={`/case/${game.decks.find((d) => !d.empty)?.id ?? 0}#megapot`}
          />
        </div>
      </div>

      <div className="relative z-[var(--z-feed)] border-b border-[var(--edge)] bg-[color-mix(in_oklab,var(--color-surface)_38%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex max-w-[1800px] items-center gap-5 px-5 sm:px-8 2xl:px-12">
          <span className="t-label flex shrink-0 items-center gap-1.5 text-[0.625rem]">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background: "var(--color-tier-denarius)",
                boxShadow: "0 0 8px var(--color-tier-denarius)",
                animation: "marker-live 1.8s ease-in-out infinite",
              }}
            />
            live drops
          </span>
          <Ticker items={feed} />
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

/**
 *
 */
function Chip({
  label,
  value,
  ink,
  icon,
}: {
  label: string;
  value: number;
  ink: string;
  icon?: React.ReactNode;
}) {
  return (
    <span className="hidden items-center gap-2 rounded-[var(--radius-panel)] border border-[var(--edge)] px-3 py-1.5 lg:flex">
      {icon}
      <span className="t-label text-[0.5625rem] leading-none">{label}</span>
      <Counter
        value={value}
        decimals={2}
        prefix="$"
        className="t-chain text-[0.8125rem] leading-none"
        style={{ color: ink }}
      />
    </span>
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

/**
 *
 *
 */
function TicketsStat({ tickets, caseHref }: { tickets: number; caseHref: string }) {
  return (
    <details className="group/t relative">
      <summary className="cursor-pointer list-none py-3 [&::-webkit-details-marker]:hidden">
        <span className="t-label flex items-center gap-1.5 text-[0.625rem]">
          your tickets
          <IconChevron />
        </span>
        <Counter
          value={tickets}
          className="t-chain mt-1 block text-[1.25rem] font-medium leading-none"
          style={{
            color: "var(--color-accent-bright)",
            textShadow: "0 0 24px color-mix(in oklab, var(--color-accent-bright) 55%, transparent)",
          }}
        />
      </summary>

      <div className="surface absolute right-0 top-full z-[var(--z-sticky)] mt-1 w-[min(22rem,calc(100vw-2rem))] p-5">
        <p className="text-[0.9375rem] text-[var(--color-ink-dim)]">
          Every case you open buys you one real{" "}
          <span className="text-[var(--color-ink)]">Megapot</span>{" "}
          lottery ticket. The ticket is recorded in Megapot&apos;s own contract against{" "}
          <span className="text-[var(--color-ink)]">your wallet</span>, Tessera never holds it
          and cannot touch it.
        </p>
        <p className="mt-3 text-[0.9375rem] text-[var(--color-ink-faint)]">
          On this testnet the draw is frozen, so nothing is picked here. On Base mainnet the same
          contract draws every day, and the same wallet plays.
        </p>
        <Link
          href={caseHref}
          className="t-label mt-4 inline-flex items-center gap-1.5 hover:text-[var(--color-accent-bright)]"
          style={{ color: "var(--color-accent-bright)" }}
        >
          see the jackpot and claim winnings →
        </Link>
      </div>
    </details>
  );
}

function Stat({
  label,
  value,
  suffix,
  ink,
}: {
  label: string;
  value: number;
  suffix?: string;
  ink?: string;
}) {
  const lit = Boolean(ink);
  return (
    <div className="relative py-3">
      <span className="t-label block text-[0.625rem]">{label}</span>
      <Counter
        value={value}
        suffix={suffix}
        className="t-chain mt-1 block text-[1.25rem] font-medium leading-none"
        style={{
          color: ink ?? "var(--color-ink)",
          textShadow: lit ? `0 0 24px color-mix(in oklab, ${ink} 55%, transparent)` : undefined,
        }}
      />
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

const IconVault = () => (
  <svg {...S} width={14} height={14}>
    <rect x="1.5" y="2" width="13" height="12" rx="1.2" />
    <circle cx="8" cy="8" r="2.8" />
    <path d="M8 5.2v5.6M5.2 8h5.6" />
  </svg>
);

const IconChevron = () => (
  <svg
    {...S}
    width={11}
    height={11}
    className="transition-transform duration-200 group-open/t:rotate-180"
  >
    <path d="M4 6.5 8 10.5l4-4" />
  </svg>
);

const Mark = () => (
  <span
    className="grid h-8 w-8 shrink-0 place-items-center rounded-[3px]"
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
