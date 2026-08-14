"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatUnits } from "viem";
import { Sparkles, Swords, TrendingDown, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Chest, skinOf } from "@/components/Chest";
import { DeckHero } from "@/components/DeckHero";
import { useDeck, type DeckInfo } from "@/hooks/useDeck";
import { useOpens } from "@/hooks/useOpens";
import { PoolCurve } from "@/components/PoolCurve";
import { useBattleList } from "@/hooks/useBattles";
import { useSkins } from "@/hooks/useSkins";
import { useHidden } from "@/hooks/useHidden";
import { slotsPerTier, bestTier, isShard, ticketsLabel } from "@/lib/deck";

/**
 * The home page.
 *
 * Three screens one under another: the promise, all the decks, and the mechanics
 * explained in three steps.
 *
 * The middle screen IS the case catalogue. There is no separate page for it: the
 * decks all fit here, and a second page with the same cards only asked "how do
 * these two differ" without having an answer.
 *
 * The page is built around the single thing that makes Tessera different from any
 * other case opener: the pool is finite and public. There are exactly as many
 * slots as were cut; they were shuffled once and are drawn in order; somebody
 * else's win disappears for you too.
 */
export default function Home() {
  const game = useDeck();
  const skinUrl = useSkins();
  const hidden = useHidden();
  // A hidden deck disappears from the showcase but not from the chain: it works
  // over a direct link, and whoever is already playing it loses nothing.
  const shown = game.decks.filter((d) => !hidden.has(d.id));
  const battles = useBattleList();
  const first = game.decks.find((d) => !d.empty) ?? game.decks[0];
  const total = game.decks.reduce((n, d) => n + d.size, 0);

  return (
    <div className="flex w-full flex-col">
      {/* -- the promise --------------------------------------------------
          One screen, one thought, and it stands centred, as in the system. There
          is no chest here any more: in the hero it showed a SEALED placeholder,
          that is, an item that does not exist in the game. Chests live on the deck
          cards, where each names its own real tier. */}
      <section className="relative w-full overflow-hidden px-4 pb-14 pt-12 text-center lg:px-8 lg:pt-16">
        <div className="pointer-events-none absolute right-1/4 top-0 h-96 w-96 rounded-full bg-[rgb(57_255_136_/_0.07)] blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/4 h-96 w-96 rounded-full bg-[rgb(31_207_108_/_0.06)] blur-3xl" />

        <div className="relative z-10 mx-auto flex max-w-[1320px] flex-col items-center gap-6">
          {/* The tag above the heading is gold, as in the system. It names the
              one thing the game promises unconditionally: the dollar buys a real
              ticket, and the case comes on top. */}
          <p
            className="t-label rounded-full border px-4 py-1.5"
            style={{
              borderColor: "color-mix(in oklab, var(--color-tier-vault) 35%, transparent)",
              background: "color-mix(in oklab, var(--color-tier-vault) 6%, transparent)",
              color: "var(--color-tier-vault)",
            }}
          >
            every case = 1 real Megapot ticket
          </p>

          <h1 className="t-black text-4xl text-white sm:text-5xl lg:text-6xl 2xl:text-7xl">
            A finite pool, drawn
            <br />
            without{" "}
            <span className="text-[var(--color-accent-hover)] drop-shadow-[0_0_20px_rgba(57,255,136,0.35)]">
              replacement.
            </span>
          </h1>

          {/* "The same one sold on megapot.io" stood here and was almost true,
              and almost is the worst kind.
              The ticket really is real: Megapot itself buys it and records it to
              the player's wallet in its own contract. But what is sold on
              megapot.io is the mainnet jackpot, and the game lives on Base
              Sepolia, that is, on the testnet, the same legacy contract with the
              same set of selectors but a different deployment, and for test
              dollars. A line that waves that around is the first thing to fall
              apart under a judge's question. The precise fact, "in Megapot's own
              contract", is not weaker but stronger: it is exactly about the depth
              of the integration. Which network this is is spelled out by step 1
              below. */}
          <p className="max-w-2xl text-lg leading-relaxed text-slate-300">
            A case costs $1 and buys you a real Megapot lottery ticket, bought by Megapot itself,
            in the transaction that opens the case. What is inside was shuffled before anyone
            opened one, and is drawn in order. A prize someone else takes is gone for everybody,
            until the deck runs out or its vault is taken, and the contract deals it again.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Link href={`/case/${first?.id ?? 0}`}>
              <Button className="px-8 py-4 text-base">
                <Sparkles className="h-5 w-5 fill-[var(--color-on-accent)]" />
                Open • $1
              </Button>
            </Link>
            <Link href="/battles">
              {/* Quiet, not a second main action.
                  Two equally loud buttons in different colours stood here, green
                  and red, and the page did not say where to begin. Tessera has
                  one main action: open a case. Battles are the section next door,
                  and a link button should lead there rather than a rival for
                  attention. */}
              <Button variant="quiet" className="px-8 py-4 text-base">
                <Swords className="h-5 w-5" />
                Battles
                {battles.open.length > 0 ? ` • ${battles.open.length} waiting` : ""}
              </Button>
            </Link>
          </div>

          {/* -- three numbers as cards ---------------------------------------
              In the system three cards with a large number and a caption stand
              under the hero. There they are drawn ("1,842 players online"), here
              all three are read from the chain, otherwise the very card meant to
              prove honesty would be the first to lie.

              This is the only place on the site where these three numbers are
              shown. The counter bar above every page repeated two of them and has
              been removed; the captions here no longer have to be picked so as
              not to coincide with it. */}
          <div className="mt-8 grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              value={String(game.drawn)}
              label="opened so far"
              tone="var(--color-accent)"
            />
            <StatCard
              value={`${game.remaining} of ${total || "?"}`}
              label="still sealed, across every deck"
            />
            <StatCard
              value={`$${Number(formatUnits(game.vault, 6)).toFixed(2)}`}
              label="waiting in the vaults"
              tone="var(--color-tier-vault)"
            />
          </div>
        </div>
      </section>

      {/* -- the decks ------------------------------------------------------
          This IS the case catalogue, and now the only one.

          There was a separate /case section with the same cards written a second
          time in a different file: the same chest, the same payout rate, the same
          vault, the same remainder. Above them, filters "all / still open / with
          a vault" over FOUR decks, that is, three buttons any of which leaves
          almost everything; at the side, a window with a contents table that
          repeated the table from the deck's own page a third time.

          Two pages with identical content are not a choice for the reader but the
          question "how do they differ", which has no answer. One is left, and
          everything that was missing here moved into it: how much TESA is in a
          deck and how many decks there are at all. */}
      {/* scroll-mt is not cosmetics: the header is sticky and there is a drops
          strip under it. Without the offset a jump to /#decks puts the heading
          exactly UNDER them, that is, a person coming from an "all decks" link
          lands on a screen where the second half of the cards is what they see
          first. */}
      <section
        id="decks"
        className="w-full scroll-mt-32 border-b border-slate-800/60 bg-[var(--color-section)] px-4 py-16 lg:px-8 2xl:px-14"
      >
        {/* Full width, no max-w. The catalogue is the main thing people come
            here for, and keeping it in a narrower column than the rest of the
            screen means drawing the cases smaller than the monitor allows. */}
        <div className="flex w-full flex-col items-center">
          <h2 className="t-inscription mb-10 flex flex-wrap items-baseline justify-center gap-3 text-center text-2xl font-extrabold text-white lg:text-3xl">
            <span>the decks</span>
            <span className="t-chain text-base font-bold normal-case tracking-normal text-[var(--color-ink-dim)]">
              {shown.length} {shown.length === 1 ? "deck" : "decks"}
            </span>
          </h2>

          {shown.length === 0 ? (
            <p className="py-10 text-center text-slate-300">Reading the chain…</p>
          ) : (
            // A grid for any number of decks rather than for exactly three.
            //
            // The columns have an UPPER bound and the row is centred. With `1fr`
            // auto-fill cut as many tracks as would fit, and five cards huddled
            // to the left leaving two empty on the right, so the row looked
            // awkwardly displaced. Replacing it with auto-fit will not do either:
            // then with three decks the cards would be blown up to half a screen
            // each.
            //
            // auto-FIT, not auto-fill: fill leaves empty tracks in the grid, they
            // take up space, and there is nothing left to centre, which is
            // exactly why the first attempt changed nothing. fit collapses the
            // empty ones, and the 17rem upper bound stops three cards from
            // swelling to half a screen each.
            //
            // A card now lives within 15 to 17rem, and the free space goes
            // equally to both sides. While there are few decks the row stands
            // centred; when there are more it will fill the width by itself and
            // start wrapping.
            <div className="grid w-full justify-center gap-5 [grid-template-columns:repeat(auto-fit,minmax(15rem,17rem))]">
              {shown.map((d) => (
                <DeckCard key={d.id} deck={d} art={skinUrl(d.id)} />
              ))}

            </div>
          )}
        </div>
      </section>

      {/* -- how this works ---------------------------------------------- */}
      <section className="w-full border-b border-slate-800/60 bg-[var(--color-section-alt)] px-4 py-16 lg:px-8 2xl:px-14">
        <div className="mx-auto flex max-w-[1320px] flex-col items-center">
          {/* No tag caption above the heading. Small tracked out caps above every
              section is the most recognisable scaffolding of generated pages, and
              here it added nothing: the heading under it says the same thing in
              its own words. */}
          <div className="mb-12 max-w-2xl text-center">
            <h2 className="t-display text-3xl text-white">
              How the ticket, the pool and the vault fit together
            </h2>
          </div>

          <div className="grid w-full grid-cols-1 gap-8 md:grid-cols-3">
            <Step
              ink="var(--color-accent)"
              title="1. Every case buys a real ticket"
            >
              The $1 does not go into a house balance. It buys a Megapot lottery ticket in the same
              transaction that opens the case, recorded against your wallet in Megapot&apos;s own
              contract, on Base Sepolia, that is Megapot&apos;s testnet jackpot, the same contract
              they run on mainnet. The case comes on top.
            </Step>

            <Step
              ink="var(--color-tier-vault)"
              title="2. The vault grows until someone draws it"
            >
              {/* "Every case that gives up its ticket" was a description of a
                  risk mode the game no longer has: the button is gone and the
                  function is out of the contract. The vault is filled by what
                  filled it back then too: a share of the referral commission. The
                  line outlived the mechanic itself and remained the one place on
                  the site where something untrue was written about the vault. */}
              One slot in the deck opens the vault and takes everything in it. It fills from the
              commission the openings themselves earn, a fixed slice of every case, shared out
              between the decks by how often each is played. Nobody can pick which slot that is:
              the deck was shuffled before anyone opened anything.
            </Step>

            <Step
              ink="var(--color-tier-denarius)"
              title="3. Drawn without replacement, in public"
            >
              Contents are encrypted on Inco Lightning and committed before the first open. Every
              opened slot is publicly revealed after the fact, so the count of what is left is
              arithmetic anyone can repeat, not a percentage we assert.
            </Step>
          </div>
        </div>
      </section>

      {/* The "latest out of the pool" section is no longer here, and that is not
          a cut but the removal of a copy.

          It took useFeed, filtered by "the slot paid something" and drew three
          chests with the player's name. Exactly the same thing, the same hook,
          the same filter, the same <Chest>, is done by the live drops strip that
          stands under the header ON EVERY page, shows fourteen instead of three
          and updates before your eyes. That is, the same event was visible twice:
          once at the top and immediately, and a second time two screens of
          scrolling away and in an abridged form. */}
    </div>
  );
}

/**
 * A deck card.
 *
 * The chest is the best tier the deck holds at all, under a colour patch of its
 * tier. The numbers under it come from the chain: how much is left and how much
 * is in the vault. The bar shows the exhaustion that would otherwise have to be
 * described in words.
 */
/**
 * A number under the hero.
 *
 * The frame is faintly lit with colour only where the number means something:
 * green on the action, gold on the vault. The middle one is white at 8%, because
 * "how much is left" belongs to no tier.
 */
function StatCard({ value, label, tone }: { value: string; label: string; tone?: string }) {
  return (
    <div
      className="rounded-[14px] border px-6 py-5 text-center"
      style={{
        background: "var(--color-surface)",
        borderColor: tone
          ? `color-mix(in oklab, ${tone} 16%, transparent)`
          : "rgb(255 255 255 / 0.08)",
      }}
    >
      <div
        className="t-chain text-2xl font-extrabold leading-none sm:text-3xl"
        style={{ color: tone ?? "var(--color-ink)" }}
      >
        {value}
      </div>
      <div className="t-label mt-2">{label}</div>
    </div>
  );
}

/**
 * The hero size comes from the real window rather than from a number in the code.
 *
 * The card is fluid: the grid holds from one to seven columns, and the same
 * figure that looks good at 330 px pushes the "xN" captions onto the name at 240
 * px. Picking a compromise is pointless, there is none: a pixel size inside a
 * square that itself depends on the screen width will not settle on any single
 * number. So we measure the window and compute.
 *
 * 0.78 is the height of the ladder relative to the size: the oldest chest plus
 * the caption under it. 0.55 of the width keeps a row of five chests from running
 * into the side margins.
 */
function useHeroSize(min = 56) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(120);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      // Minus the "xN" caption under the chest: it has to fit too and lies
      // outside the chest itself. The chest is square, so its height equals the
      // size, hence a subtraction rather than a multiplication by a fraction.
      setSize(Math.max(min, Math.floor(Math.min(r.height - 14, r.width * 0.5))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [min]);

  return [box, size] as const;
}

function DeckCard({ deck, art }: { deck: DeckInfo; art?: string }) {
  const [flipped, setFlipped] = useState(false);
  // The same events the drops strip in the header already reads: one request for
  // everyone, a shared react-query cache. The card adds nothing to the network.
  const opens = useOpens();
  const events = useMemo(() => opens.data ?? [], [opens.data]);
  const drawnHere = useMemo(
    () => events.filter((e) => e.deckId === deck.id).length,
    [events, deck.id],
  );

  const tiers = slotsPerTier(deck);
  const best = bestTier(deck);
  const [heroBox, heroSize] = useHeroSize();

  const top = tiers.reduce((n, t) => Math.max(n, t.spec.tickets), 0);
  const prizes = tiers.filter((t) => t.weight > 0).reduce((n, t) => n + t.count, 0);
  const paying = prizes + deck.vaultUpTo;
  const oneIn = paying > 0 ? Math.max(1, Math.round(deck.size / paying)) : 0;

  // How many TESA slots were cut into the deck. This is a property of the deck
  // itself rather than of the remainder: how many of them are still undrawn is
  // shown by the pool counter on the case page.
  const tesa = tiers.filter((t) => isShard(t.spec)).reduce((n, t) => n + t.count, 0);

  // A deck with its own skin is called by its own name and glows in its own
  // colour. Without this it would still be named after its top tier, that is,
  // "Porphyry" like the other two, and the skin would make no sense.
  const dress = skinOf(deck.cid);
  const ink = deck.empty
    ? "var(--color-tier-grout)"
    : (dress?.ink ?? best?.ink ?? "var(--color-accent)");
  const title = deck.empty ? "Emptied" : (dress?.name ?? best?.name ?? "Sealed");
  const sealedPercent = deck.size > 0 ? Math.max(1, (deck.remaining / deck.size) * 100) : 0;

  return (
    /* The card flips, and the back is NOT inside the link.
     *
     * That is where it has to be, and not for aesthetics. The screen check reads
     * `inner_text()` of the `<a href="/case/N">` itself and looks for "N sealed"
     * as the first match. A back inside would add "100 of 200 still sealed" to
     * it, text that is visible to the DOM even with `backface-visibility`, and
     * the check would start comparing the remainder against somebody else's
     * number.
     *
     * So the face stays the link, the back is a neighbouring layer, and the
     * button stands outside the rotation: otherwise it would spin with the card
     * and turn up mirrored on the back.
     */
    <div
      data-deck={deck.id}
      className="group/card relative aspect-square [perspective:1200px]"
    >
      <div
        className="relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d] motion-reduce:transition-none"
        style={{ transform: flipped ? "rotateY(180deg)" : undefined }}
      >
    <Link
      href={`/case/${deck.id}`}
      tabIndex={flipped ? -1 : undefined}
      aria-hidden={flipped || undefined}
      // A SQUARE frame, the whole card rather than only the item window.
      //
      // Only the window was square, and under it stood a column of text, so the
      // card came out twice as tall as it was wide. The "best case..." description
      // and the TESA row left here for the case page: it is one click away and
      // there is as much room there as you like. What stays in the square is what
      // people choose by: the item, the name, the payout rate and how much is
      // still sealed.
      //
      // The lift under the cursor moved to the container: a transform of its own
      // here would create a separate context inside preserve-3d, and the back
      // would start showing through the face.
      className="group absolute inset-0 flex flex-col overflow-hidden rounded-[var(--radius-panel)] border bg-slate-900/60 shadow-xl transition-colors duration-300 [backface-visibility:hidden] hover:bg-slate-900/90"
      style={{
        borderColor: `color-mix(in oklab, ${ink} 40%, transparent)`,
        boxShadow: `0 0 25px color-mix(in oklab, ${ink} 22%, transparent)`,
      }}
    >
      {/* The item takes all the free space of the square. The size is a
          percentage of the card rather than pixels: the grid holds from one to
          five columns, and a fixed 200 px would sometimes drown in a wide card
          and sometimes spill out of a narrow one. */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-3">
        <span
          aria-hidden
          className="absolute inset-x-6 inset-y-4 rounded-full opacity-30 blur-xl transition-opacity group-hover:opacity-60"
          style={{ background: ink }}
        />
        <div ref={heroBox} className="relative z-10 flex h-full w-full items-center justify-center [&_img]:max-h-full [&_img]:w-auto [&_svg]:max-h-full">
          {deck.empty ? (
            <Chest rarity="grout" size={heroSize} />
          ) : (
            <DeckHero
              deck={deck}
              size={heroSize}
              skin={deck.cid}
              art={art}
              className="transition-transform duration-300 group-hover:scale-105"
            />
          )}
        </div>
      </div>

      <div className="flex flex-col items-center space-y-1 px-3 pb-1.5 text-center">

        {/* The number next to the name, because the name is not unique.
            It is taken from the deck's top tier, so two seasons with porphyry on
            top are called the same and are drawn in the same purple. One pays
            once in a hundred, the other once in four, and there was no way to tell
            them apart. The season number is immutable and lives in the chain; it
            IS the deck's name. */}
        <h3
          className="t-black flex w-full items-baseline justify-center gap-1.5 truncate text-xl tracking-wide"
          style={{ color: ink }}
        >
          <span>{title}</span>
          <span className="t-chain text-sm font-bold text-[var(--color-ink-dim)]">
            #{deck.id}
          </span>
        </h3>

        {/* The payout rate is the card's main number.
            A deck is named after its top tier, and the top tier is not unique: two
            seasons with porphyry on top are called the same and glow in the same
            purple. The colour is not lying about it, both really are topped by
            porphyry. It is the name that lies.
            What they differ in is depth: one pays once in a hundred, the other
            once in four. That number is what decides which deck to open, and until
            now it lay in small grey type inside a paragraph. */}
        {!deck.empty && oneIn > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            <p
              className="t-chain rounded-full border px-2.5 py-0.5 text-xs font-extrabold"
              style={{
                borderColor: `color-mix(in oklab, ${ink} 30%, transparent)`,
                background: `color-mix(in oklab, ${ink} 8%, transparent)`,
                color: ink,
              }}
            >
              1 in {oneIn} pays
            </p>
            {/* The best prize and the TESA sit next to the pill rather than on a
                row of their own: in a square every line of text takes height away
                from the item people look at the card for. */}
            <span className="t-chain text-xs font-bold" style={{ color: ink }}>
              {top > 0 ? ticketsLabel(top) : "the vault"}
            </span>
            {tesa > 0 && (
              <span
                className="t-chain text-xs font-bold"
                style={{ color: "var(--color-tier-shard)" }}
              >
                · {tesa} TESA
              </span>
            )}
          </div>
        )}

      </div>

      <div className="mt-auto flex flex-col space-y-1 border-t border-slate-800/80 px-3 pb-2.5 pt-2">
        <div className="t-chain flex items-center justify-between text-xs font-semibold text-slate-300">
          <span>
            <strong className="text-white">{deck.remaining}</strong> sealed
          </span>
          <span>
            {deck.vaultUpTo > 0 ? (
              <strong style={{ color: "var(--color-tier-vault)" }}>
                ${Number(formatUnits(deck.vault, 6)).toFixed(2)}
              </strong>
            ) : (
              "no vault"
            )}
          </span>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${sealedPercent}%`,
              backgroundColor: ink,
              boxShadow: `0 0 10px ${ink}`,
            }}
          />
        </div>

      </div>

      {/* The price is a static tag in the corner rather than a tooltip under the
          cursor. At first it stood in the flow and held forty pixels of height at
          all times, although it is only visible on hover. Then I made it an
          overlay, and it landed right on the name and the pill, that is, on the
          most needed part. There is plenty of room in the corner of the picture,
          and there it reads like a price tag in a shop window: always in place,
          covering nothing. */}
      <span
        className="t-chain absolute right-2.5 top-2.5 z-20 rounded-[var(--radius-chip)] border px-2 py-0.5 text-xs font-extrabold"
        style={{
          borderColor: `color-mix(in oklab, ${ink} 35%, transparent)`,
          background: "color-mix(in oklab, var(--color-surface) 82%, transparent)",
          color: ink,
        }}
      >
        {deck.empty ? "empty" : "$1"}
      </span>
    </Link>

        {/* -- the back: how this deck drained -------------------------
            The same place, a different answer. The face says WHAT is in the deck;
            the back says how fast it is being taken apart. The bar at the bottom
            of the face could not say that: it draws an even descent and "opened in
            a batch and abandoned" identically. */}
        <div
          inert={!flipped}
          onClick={() => setFlipped(false)}
          className="absolute inset-0 flex cursor-pointer flex-col rounded-[var(--radius-panel)] border bg-slate-900/90 p-4 [backface-visibility:hidden] [transform:rotateY(180deg)]"
          style={{
            borderColor: `color-mix(in oklab, ${ink} 40%, transparent)`,
            boxShadow: `0 0 25px color-mix(in oklab, ${ink} 22%, transparent)`,
            color: "var(--color-ink-dim)",
          }}
        >
          {/* Padding for the button: it stands outside the rotation, that is, in
              the same corner on the back as well. */}
          <p className="t-label pl-10">how it emptied</p>
          <p className="t-chain mt-1 text-2xl font-extrabold text-white">
            {deck.remaining}
            <span className="ml-1.5 text-sm font-semibold text-slate-400">of {deck.size} sealed</span>
          </p>

          <div className="mt-3 mb-1.5 flex min-h-0 flex-1 items-center">
            <PoolCurve deckId={deck.id} cut={deck.cut} size={deck.size} opens={events} ink={ink} height={78} guides />
          </div>

          <div className="t-chain flex justify-between text-xs text-slate-400">
            <span>first open</span>
            <span>now</span>
          </div>

          <div className="mt-3 flex items-end justify-between border-t border-slate-800/80 pt-2.5">
            <span>
              <span className="t-chain block text-base font-bold text-white">{drawnHere}</span>
              <span className="t-label">opened</span>
            </span>
            <span className="text-right">
              <span
                className="t-chain block text-base font-bold"
                style={{ color: deck.vaultUpTo > 0 ? "var(--color-tier-vault)" : "var(--color-ink-dim)" }}
              >
                {deck.vaultUpTo > 0 ? `$${Number(formatUnits(deck.vault, 6)).toFixed(2)}` : "none"}
              </span>
              <span className="t-label">vault</span>
            </span>
          </div>
        </div>
      </div>

      {/* The button stands OUTSIDE the rotation, so one serves both sides: on the
          back it simply changes its caption. Inside it would spin with the card
          and read mirrored. */}
      <button
        type="button"
        onClick={() => setFlipped((v) => !v)}
        aria-pressed={flipped}
        aria-label={flipped ? "Show the case" : "Show how this deck emptied"}
        title={flipped ? "back to the case" : "how this deck emptied"}
        className="absolute left-2.5 top-2.5 z-30 grid h-8 w-8 cursor-pointer place-items-center rounded-[var(--radius-chip)] border transition-colors"
        style={{
          borderColor: `color-mix(in oklab, ${ink} 35%, transparent)`,
          background: "color-mix(in oklab, var(--color-surface) 82%, transparent)",
          color: ink,
        }}
      >
        {flipped ? <Undo2 className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
      </button>
    </div>
  );
}

/**
 * One step of the explanation.
 *
 * No card and no tile with an icon. Three identical rectangles of "icon plus
 * heading plus paragraph" is the most recognisable template there is, and here it
 * held nothing together: three paragraphs of text need neither a border, nor a
 * background, nor an icon repeating what a word has already said. What is left is
 * what people read, and a thin line on top as a divider.
 */
function Step({
  ink,
  title,
  children,
}: {
  ink: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t pt-5" style={{ borderColor: `color-mix(in oklab, ${ink} 40%, transparent)` }}>
      <h3 className="text-lg font-bold text-white">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-slate-300">{children}</p>
    </div>
  );
}
