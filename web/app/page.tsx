"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatUnits } from "viem";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/Button";
import { useDeck } from "@/hooks/useDeck";
import { usePool } from "@/hooks/usePool";
import { useBattleList } from "@/hooks/useBattles";
import { slotsPerTier, specFor, VAULT_SPEC, type DeckShape } from "@/lib/deck";
import type { PoolState } from "@/hooks/usePool";

/**
 *
 */
export default function Home() {
  const { isConnected } = useAccount();
  const deck = useDeck();
  const shape = useMemo(
    () => ({ size: deck.size, tiers: deck.tiers, vaultUpTo: deck.vaultUpTo }),
    [deck.size, deck.tiers, deck.vaultUpTo],
  );
  const pool = usePool(shape, deck.drawn);
  const battles = useBattleList();

  const vault = Number(formatUnits(deck.vault, 6)).toFixed(2);

  return (
    <>
      <section
        className="relative overflow-hidden rounded-[3px]"
        style={{
          background:
            "linear-gradient(100deg, var(--color-sinopia-600), var(--color-sinopia-500) 45%, var(--color-ochre-500))",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/cases/porphyry.png"
          alt=""
          aria-hidden
          className="pointer-events-none absolute -right-4 top-1/2 hidden w-64 -translate-y-1/2 opacity-35 lg:block"
          draggable={false}
        />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6 px-6 py-7 sm:px-10">
          <div className="max-w-xl">
            <h2 className="t-display text-[clamp(1.25rem,2.4vw,1.9rem)] leading-tight text-[#1b1310]">
              Play for free on Sepolia.
              <br />
              Test dollars are minted from the header.
            </h2>
            <p className="mt-2 text-[0.9375rem] text-[#2a1c16]">
              Every ticket is bought against the real Megapot contract, the money is the only
              part that is fake.
            </p>
          </div>
          <Link href="/case">
            <span
              className="t-inscription inline-block rounded-[3px] px-6 py-3 text-[0.6875rem]"
              style={{ background: "#1b1310", color: "var(--color-ochre-300)" }}
            >
              open a case · $1
            </span>
          </Link>
        </div>
      </section>

      <section className="relative mt-5 overflow-hidden rounded-[3px] border border-[var(--edge)]">
        <div
          className="relative flex min-h-[22rem] flex-col items-center justify-center px-6 py-14 text-center"
          style={{
            backgroundImage: "url(/cases/hero-bg.jpg)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(70% 70% at 50% 45%, color-mix(in oklab, var(--color-grout) 82%, transparent), var(--color-grout) 92%)",
            }}
          />
          <div className="relative">
            <h1 className="t-display text-[clamp(2rem,5vw,3.75rem)]">
              $1 buys a real lottery ticket.
              <br />
              <span className="text-[var(--color-sinopia-400)]">The case is free.</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-[1.0625rem] text-[var(--color-travertine-dim)]">
              The same ticket sold on megapot.io, bought for you in the same transaction that
              opens the case. What is inside sits in an encrypted, finite pool, shuffled once,
              drawn without replacement, and countable by anyone.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/case">
                <Button>{isConnected ? "Open a case · $1" : "Open a case · $1"}</Button>
              </Link>
              <Link href="/battles">
                <Button variant="quiet">
                  Battles{battles.open.length > 0 ? ` · ${battles.open.length} waiting` : ""}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Heading title="the case" note={`season ${deck.season} · ${deck.size} of them, shuffled once`} />
      <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CaseCard
          href="/case"
          art="/cases/hero.png"
          name={`Season ${deck.season}`}
          price="$1"
          note={`${deck.remaining} unopened`}
          accent="var(--color-sinopia-400)"
        />
        <CaseCard
          href="/case"
          art="/cases/vault.png"
          name="The Vault"
          price={`$${vault}`}
          note={pool.data?.vaultTaken ? "already drawn" : "one case takes all of it"}
          accent="var(--color-porphyry-300)"
        />
        <CaseCard
          href="/battles"
          art="/cases/aureus.png"
          name="Battle"
          price="$1"
          note={`${battles.open.length} waiting for an opponent`}
          accent="var(--color-ochre-300)"
        />
        <CaseCard
          href="/case"
          art="/cases/denarius.png"
          name="Bonus tickets"
          price="free"
          note="won cases pay real tickets"
          accent="var(--color-patina-400)"
        />
      </div>

      <Heading title="what is in this case" note="counted from the public reveals, not promised" />
      <Contents deck={shape} pool={pool.data} />
    </>
  );
}

function Heading({ title, note }: { title: string; note: string }) {
  return (
    <div className="mb-5 mt-12 text-center">
      <div className="flex items-center justify-center gap-3">
        <span
          className="h-px w-8"
          style={{ background: "var(--color-sinopia-500)" }}
          aria-hidden
        />
        <h2 className="t-inscription text-base">{title}</h2>
        <span
          className="h-px w-8"
          style={{ background: "var(--color-sinopia-500)" }}
          aria-hidden
        />
      </div>
      <p className="t-label mt-2">{note}</p>
    </div>
  );
}

function CaseCard({
  href,
  art,
  name,
  price,
  note,
  accent,
}: {
  href: string;
  art: string;
  name: string;
  price: string;
  note: string;
  accent: string;
}) {
  return (
    <Link href={href} className="group block h-full">
      <div
        className="surface flex h-full flex-col overflow-hidden rounded-[3px] transition-transform duration-300 group-hover:-translate-y-1"
        style={{ boxShadow: `inset 0 2px 0 ${accent}` }}
      >
        <div className="grid flex-1 place-items-center p-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={art}
            alt=""
            className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
            draggable={false}
          />
        </div>
        <div className="border-t border-[var(--edge)] px-4 py-3.5 text-center">
          <div className="t-inscription text-[0.6875rem]" style={{ color: accent }}>
            {name}
          </div>
          <div className="mt-2 flex items-center justify-center gap-2">
            <span
              className="t-chain rounded-[2px] px-2.5 py-1 text-[0.8125rem]"
              style={{
                background: "var(--color-stone-800)",
                boxShadow: "inset 0 0 0 1px var(--edge)",
              }}
            >
              {price}
            </span>
            <span className="t-label">{note}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

/**
 *
 */
function Contents({ deck, pool }: { deck: DeckShape; pool?: PoolState }) {
  const tiers = slotsPerTier(deck);
  const [only, setOnly] = useState<"all" | "prizes">("all");
  if (tiers.length === 0) return null;

  const grout = specFor(0);
  const byWeight = new Map((pool?.tiers ?? []).map((t) => [t.weight, t.left]));

  const vaultLeft = deck.vaultUpTo > 0 && !pool?.vaultTaken ? deck.vaultUpTo : 0;
  const groutLeft = pool ? Math.max(0, pool.remaining - pool.prizesLeft - vaultLeft) : undefined;

  const shown = tiers.filter((t) => only === "all" || t.spec.name !== grout.name);

  return (
    <>
      <div className="mb-4 flex justify-center gap-2">
        {(["all", "prizes"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setOnly(k)}
            className="t-label rounded-[3px] px-3 py-1.5 hover:text-[var(--color-travertine)]"
            style={
              only === k
                ? {
                    background: "var(--color-sinopia-900)",
                    color: "var(--color-sinopia-400)",
                    boxShadow:
                      "inset 0 0 0 1px color-mix(in oklab, var(--color-sinopia-400) 30%, transparent)",
                  }
                : undefined
            }
          >
            {k === "all" ? "everything" : "prizes only"}
          </button>
        ))}
      </div>

      <ul className="grid auto-rows-fr grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {shown.map((t, i) => {
          const isGrout = t.spec.name === grout.name;
          const isVaultRow = t.spec.name === VAULT_SPEC.name;
          const left = isVaultRow ? vaultLeft : isGrout ? groutLeft : byWeight.get(t.weight);
          return (
            <li
              key={i}
              className="flex flex-col overflow-hidden rounded-[3px]"
              style={{
                background: isGrout
                  ? "linear-gradient(158deg, var(--color-stone-700), var(--color-stone-900))"
                  : `linear-gradient(158deg, color-mix(in oklab, ${t.spec.ink} 20%, ${t.spec.tint}), ${t.spec.tint})`,
                boxShadow: `inset 0 2px 0 ${isGrout ? "var(--edge-strong)" : t.spec.ink}, inset 0 0 0 1px color-mix(in oklab, ${t.spec.ink} 24%, transparent)`,
              }}
            >
              <div className="grid flex-1 place-items-center p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={t.spec.art}
                  alt=""
                  className="h-full w-full object-contain"
                  draggable={false}
                />
              </div>
              <div className="px-3 pb-3 text-center">
                <div
                  className="t-inscription text-[0.625rem]"
                  style={{ color: isGrout ? "var(--color-travertine-faint)" : t.spec.ink }}
                >
                  {t.spec.name}
                </div>
                <div className="mt-1.5 flex items-center justify-center gap-2">
                  {t.spec.tickets > 0 && (
                    <span
                      className="t-chain rounded-[2px] px-2 py-0.5 text-[0.75rem]"
                      style={{ background: "rgb(0 0 0/0.35)", color: t.spec.ink }}
                    >
                      +{t.spec.tickets}
                    </span>
                  )}
                  <span className="t-label">
                    {left === undefined ? `${t.count} of ${t.count}` : `${left} left`}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
