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
 * The shared shell of every page: a header with sections and a drops strip.
 *
 * The counter bar is no longer here, and that is a decision rather than a
 * simplification. It showed "cases opened 200" and "cases left 400", and half
 * a screen below, on the home page, the same two numbers stood a second time:
 * "opened so far 200", "400 of 600 still sealed". We solved that by picking
 * DIFFERENT captions for identical numbers, that is, hid the duplication
 * instead of removing it; the reader still had to compare two figures and work
 * out whether they were the same thing.
 *
 * Now every number lives in exactly one place: the world totals in the home
 * page heroes, the player count in the players table, the deck remainder on the
 * deck itself. There is no such bar in the design system for the same reason.
 *
 * "Your tickets" moved into a header chip, next to everything else that
 * concerns the wallet: the balance and the vault total.
 */
export function Shell({ children }: { children: React.ReactNode }) {
  const { isConnected } = useAccount();
  // The case page has to fit the screen without scrolling: there is one action
  // there, and everything for it, the item, the price, the multiplier, the
  // button, the deck contents, has to be in front of you at once. The footer
  // costs eighty nine pixels and takes part in none of those decisions, which
  // is exactly where it is absent. On every other page it is in place.
  const onCase = (usePathname() ?? "").startsWith("/case/");
  const game = useDeck();
  const shapes = useMemo(() => game.decks.map((d) => d), [game.decks]);
  const feed = useFeed(shapes);
  const megapot = useMegapot();
  const { mint, minting, canMint } = useMint(game.refetch);

  // TESA in hand is what people collect, and until now it was visible nowhere
  // except the shelf. The number is computed from the already loaded inventory:
  // the same request the case page and the shelf make, so the header adds no
  // extra chain reads.
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

  // The deck with the largest vault. Its number is what the lock in the header
  // shows, and it is where the lock leads.
  //
  // Every deck has its OWN vault: it is filled by opens of that deck, it is
  // opened by a slot from that deck, there is no shared pot. So the sum of all
  // vaults is a number nobody wins, and it has no place in the header.
  const richest = game.decks.reduce<(typeof game.decks)[number] | undefined>(
    (a, d) => (d.vault > (a?.vault ?? 0n) ? d : a),
    undefined,
  );

  return (
    /* min-h-screen means "no less than the screen", that is, the page still
       grows freely downward, which is exactly why the case scene fitted nothing
       into anything: it had nothing to fit into. On the case route the height is
       fixed to exactly the screen and the excess is cut; on every other page
       things are as they were. */
    <div
      className={`relative z-[1] flex flex-col ${
        onCase ? "h-[100dvh] overflow-hidden" : "min-h-screen"
      }`}
    >
      {/* -- the header -------------------------------------------------- */}
      <header className="sticky top-0 z-[var(--z-sticky)] border-b border-slate-800/80 bg-[color-mix(in_oklab,var(--color-header)_92%,transparent)] px-4 py-3 backdrop-blur-md lg:px-8 2xl:px-14">
        <div className="mx-auto flex flex-col items-center justify-between gap-3 md:flex-row">
          <div className="flex w-full min-w-0 items-center justify-between gap-3 md:w-auto md:gap-8">
            {/* The mark and the word in one ink, that is, as one object.
                The mark deliberately has no colour: in this language a saturated
                colour names a rarity tier, and gold is already taken by the
                vault. The logotype is a signature, not a game state: it does not
                change, is not counted and promises nothing, so no colour belongs
                to it. */}
            <Link
              href="/"
              className="group flex shrink-0 items-center gap-2.5 text-white transition-opacity hover:opacity-90"
            >
              <Mark size={36} className="shrink-0 transition-transform group-hover:scale-105" />
              <span className="t-black text-xl tracking-wide sm:text-2xl">Tessera</span>
            </Link>

            {/* "Shelf" moved from here into the wallet panel: the shelf is not a
                section of the site but your property, and it stands in the same
                place as the rest of what is yours.

                "Cases" followed it, because that was not a section but a second
                copy of the home page: the same deck cards, the same contents, the
                same vault, and filters "all / still open / with a vault" over
                four items. The tab promised a place you had not been to and led
                you back where you came from. There is one catalogue now and it
                lives on the home page; the /case route leads there too.

                Three sections, and each really is about its own thing: the pool,
                the arena, the table. */}
            <nav className="scrollbar-none flex min-w-0 items-center gap-1 overflow-x-auto rounded-[var(--radius-control)] border border-slate-800 bg-slate-900/60 p-1">
              <Tab href="/">home</Tab>
              <Tab href="/battles">battles</Tab>
              <Tab href="/leaderboard">standings</Tab>
            </nav>
          </div>

          {/* Two numbers, and both are labelled.
              Until now neither had a label: next to the wallet buttons stood a
              bare "$6.50", and it read as the wallet balance although it was the
              sum of all vaults. The money a player pays with, meanwhile, was not
              shown in the header at all. */}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {/* What is left in the header is exactly what the wallet panel does
                not have. I first gathered the player's numbers into the panel and
                forgot to remove the chips, so the balance, TESA and the tickets
                stood twice within two centimetres of each other. The same
                duplication we were getting rid of on every page, only in the
                header.
                The split now is this: the header holds the WORLD (how much money
                is in the vaults), the panel holds YOURS (balance, tickets, TESA).
                The faucet stays outside, but only when it is really needed. */}

            {/* The test dollar faucet is a separate labelled button rather than a
                plus sign inside the balance.
                Without money nothing at all is possible on this testnet, and the
                action the whole game depends on was a fourteen pixel icon with
                not a word beside it.
                It is shown only while there is nothing to play with: this is a
                button that fixes a problem, not a permanent part of the
                header. */}
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

            {/* We show the LARGEST vault rather than the sum of all of them.
                Every deck has its own vault: it is filled by opens of that deck,
                and it is opened by a slot from that deck. There is no shared pot
                at all.
                So the sum in the header was a number nobody wins: two vaults of
                five cents each added up to ten, and out came a promise of ten.
                Now there is one concrete number from one concrete deck here, and
                the link leads to that deck. */}
            <Link
              href={richest ? `/case/${richest.id}` : "/#decks"}
              className="group flex items-center gap-2 rounded-[var(--radius-chip)] border px-3 py-2 transition-all hover:-translate-y-px"
              style={{
                borderColor: "color-mix(in oklab, var(--color-tier-vault) 30%, transparent)",
                background: "var(--color-surface)",
                boxShadow: "0 0 12px color-mix(in oklab, var(--color-tier-vault) 12%, transparent)",
              }}
            >
              <Lock
                className="h-3.5 w-3.5 transition-transform group-hover:scale-110"
                style={{ color: "var(--color-tier-vault)" }}
              />
              <span className="flex flex-col leading-none">
                {/* No pulse: when the sum grows it is the number itself that
                    shows it, Counter travels to the new value and flashes. */}
                <Counter
                  value={Number(formatUnits(richest?.vault ?? 0n, 6))}
                  decimals={2}
                  prefix="$ "
                  className="t-chain text-sm font-bold leading-none"
                  style={{ color: "var(--color-tier-vault)" }}
                />
                <span className="t-label mt-1 hidden leading-none sm:block">biggest vault</span>
              </span>
            </Link>

            {/* Cutting your own deck sits next to the wallet rather than being a
                tab. Among home / battles / standings it read as one more section
                to browse, although it is an action.
                The word "create" on its own was not enough: create WHAT? So the
                object is named here, your own case, and it says why anyone would
                do it. As a grey chip it also got lost next to the green wallet
                button, so the colour here is the same as on every other
                action. */}
            <Link
              href="/create"
              className="group flex min-h-11 shrink-0 items-center gap-2 rounded-[var(--radius-chip)] border px-3.5 py-2 transition-all hover:brightness-110 sm:min-h-0"
              style={{
                borderColor: "color-mix(in oklab, var(--color-accent) 45%, transparent)",
                background: "color-mix(in oklab, var(--color-accent) 10%, transparent)",
                color: "var(--color-accent-hover)",
              }}
            >
              <PlusCircle className="h-5 w-5 shrink-0 transition-transform group-hover:scale-110" />
              <span className="flex flex-col leading-none">
                <span className="text-sm font-bold leading-none">Create a case</span>
                <span className="t-label mt-1 hidden leading-none text-[var(--color-ink-dim)] lg:block">
                  yours, and you take a cut
                </span>
              </span>
            </Link>

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

      {/* -- the drops strip ----------------------------------------------
          It is absent from the case page, and that is not saving space for the
          sake of space. The page does not scroll, so height there is a
          distributed resource: a hundred and seventy four pixels of strip meant
          an item of a hundred pixels on a 768 screen. Showing other people's
          drops in a small row above your own case, which cannot be seen because
          of it, is a bad trade. */}
      {!onCase && (
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
      )}

      {/* No padding and no width: in this language a section is itself
          responsible for its background across the full width of the window.

          The background here is not for looks: pages are no longer stretched to
          the screen height artificially, so a short page ends where its content
          ended. To stop a band of a different colour from lying beneath it,
          <main> draws the remaining height itself. */}
      {/* On the case page main gives exactly the height that is left and no
          more: min-h-0 lets a flex child shrink, overflow cuts off any attempt to
          grow. The page itself fits its scene into that height. On every other
          page things are as they were, scrolling is appropriate there. */}
      <main
        className={`w-full flex-1 bg-[var(--color-section)] ${onCase ? "min-h-0 overflow-hidden" : ""}`}
      >
        {children}
      </main>

      {!onCase && (
      <footer className="w-full border-t border-slate-800/80 bg-[var(--color-sunk)] px-4 py-8 lg:px-8 2xl:px-14">
        <div className="mx-auto flex flex-col items-center justify-between gap-4 text-xs text-slate-400 sm:flex-row">
          <span className="flex flex-wrap items-center justify-center gap-2">
            {/* The mark in the footer is a signature at the end of the page rather
                than a second logotype, so it is small and simplified: the thin
                frames of drawn tiles come out at 0.3 pixels on twenty four, that
                is, a blot instead of a mark. It takes its colour from the text
                beside it. */}
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
      )}
    </div>
  );
}

/** A section in the header. The active one is filled with the system green. */
function Tab({ href, children }: { href: string; children: React.ReactNode }) {
  const path = usePathname();
  const active = href === "/" ? path === "/" : path.startsWith(href);
  return (
    <Link
      href={href}
      // On touch the target has to be forty four pixels: a mouse hits thirty, a
      // finger does not. On a wide screen the height goes back to compact,
      // because there is a cursor there.
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

