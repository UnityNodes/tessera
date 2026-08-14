"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { ChevronLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Chest } from "@/components/Chest";
import { StartHere } from "@/components/StartHere";
import { useCreateDeck } from "@/hooks/useCreateDeck";
import { useDeck } from "@/hooks/useDeck";
import {
  SHAPES,
  shapeFor,
  budgetFor,
  paysOneIn,
  totalWeight,
  type ShapeKind,
} from "@/lib/shapes";

/** The shades to choose from. Equal steps around the circle rather than a set of flavours. */
const HUES = [333, 300, 265, 225, 194, 160, 120, 75, 40, 12];

const SIZES = [100, 200, 400];

/**
 * Cut your own deck.
 *
 * Until now only the console could do this: the contract is open to everyone,
 * but `createCustomDeck` had to be called by a script. Here is the same thing
 * without knowing the ABI.
 *
 * The form deliberately does not show `upTo[]` and `weight[]`. That is an honest
 * way to describe a deck and a terrible way to order one: a person who wants
 * "rarely, but a big prize" should not have to add up total weight and remember
 * the break even line. They choose a character, a size and a colour, and the
 * code computes the rest and shows it with the same number the deck is later
 * signed with in the catalogue.
 */
export default function CreatePage() {
  const { address } = useAccount();
  const router = useRouter();
  const game = useDeck();
  const mk = useCreateDeck();

  const [name, setName] = useState("");
  const [hue, setHue] = useState(HUES[0]);
  const [size, setSize] = useState(200);
  const [kind, setKind] = useState<ShapeKind>("jackpot");
  const [share, setShare] = useState(25);
  const [art, setArt] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // The vault share comes from the chain, because how much a deck may promise
  // depends on it. While the form split the size in half, it offered tables of
  // 100 weight where the chain allowed 90: the "Cut the deck" button worked, the
  // wallet asked for a signature, and the transaction failed.
  const shape = useMemo(
    () => shapeFor(kind, size, game.vaultShareBps),
    [kind, size, game.vaultShareBps],
  );
  const budget = budgetFor(size, game.vaultShareBps);
  const clean = name.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const maxShare = mk.maxBps / 100;

  // An empty name, a character that does not suit this size, a wallet that is
  // not connected: each reason on its own, because "the button is grey" explains
  // nothing by itself.
  const problem = !address
    ? "connect a wallet first"
    : !clean
      ? "give it a name"
      : clean.length < 3
        ? "the name needs three letters or more"
        : size < mk.minSize
          ? `the smallest deck is ${mk.minSize} cases`
          : !shape
            ? "that shape does not fit this size, pick a bigger deck"
            : null;

  const submit = async () => {
    if (!shape || problem) return;
    const id = await mk.create({
      name: clean,
      hue,
      size,
      upTo: shape.upTo,
      weight: shape.weight,
      vaultSlots: shape.vaultSlots,
      sharePercent: share,
      art: art ?? undefined,
    });
    if (id !== undefined) router.push(`/case/${id}`);
  };

  return (
    <div className="w-full bg-[var(--color-section)] px-4 py-10 lg:px-8 2xl:px-14">
      <div className="mx-auto flex max-w-[1320px] flex-col gap-6">
        <div className="border-b border-slate-800 pb-6">
          <Link
            href="/#decks"
            className="t-label inline-flex items-center gap-1 hover:text-[var(--color-accent-hover)]"
          >
            <ChevronLeft className="h-4 w-4" />
            all decks
          </Link>
          <h1 className="t-page mt-2 text-white">Cut your own case</h1>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-slate-300">
            Anyone can. The contract shuffles the deck and nobody, not you and not us, can see or
            change what is inside, or re-deal it on a whim: it deals itself again only when it runs
            out or when its vault is taken. You take a share of the commission it earns; the dollar
            players pay still buys them a whole real ticket.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-12">
          {/* -- the choice ------------------------------------------------ */}
          <div className="space-y-7 lg:col-span-7">
            <section>
              <label className="t-label mb-2 block" htmlFor="deck-name">
                1. name it
              </label>
              <input
                id="deck-name"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 20))}
                // The placeholder was the name of a LIVE deck, kungfumode, and
                // in an empty field it read as somebody else's name already
                // typed in. Now it is the same word the preview on the right
                // shows while there is no name. The form demands a name all the
                // same: without one the button says "give it a name".
                placeholder="unnamed"
                className="w-full rounded-[var(--radius-control)] border border-slate-800 bg-slate-950 px-4 py-3 text-lg text-white outline-none placeholder:text-slate-500 focus:border-[var(--color-accent)]"
              />
              {/* Latin letters and digits, and that is not a whim: the name goes
                  into the chain and becomes the case's signature everywhere, in
                  the catalogue, in the strip, in the result. A character that
                  fails to render somewhere can no longer be fixed: the metadata
                  is immutable. */}
              <p className="mt-2 text-sm text-slate-400">
                letters and digits only, it goes on chain and cannot be changed later
                {clean && clean !== name.trim().toLowerCase() ? ` · will be saved as “${clean}”` : ""}
              </p>
            </section>

            <section>
              <label className="t-label mb-2 block" htmlFor="deck-art">
                2. its picture, or just a colour
              </label>
              {/* A picture is NOT required, and that is deliberate. A deck
                  without one takes a chest in the chosen colour and works the
                  same; the file only makes it its own. A required field here
                  would mean you cannot cut a case without an artist. */}
              {/* Our own button rather than the system one.
                  The caption on a native <input type="file"> is drawn by the
                  browser, and it takes it from the SYSTEM language: on a
                  Ukrainian machine, in the middle of an English site, up came
                  "Choose file / No file chosen" in Ukrainian. That caption cannot
                  be changed at all, so the input itself is hidden and what you
                  see is a label we write ourselves. The keyboard did not suffer:
                  the <label> is bound to the input, and Tab reaches it. */}
              <label
                htmlFor="deck-art"
                className="flex cursor-pointer items-center gap-3 rounded-[var(--radius-control)] border border-slate-800 bg-slate-950 p-2 transition-colors hover:border-slate-700"
              >
                <span className="rounded-[var(--radius-chip)] bg-slate-800 px-4 py-2 text-sm font-bold text-white">
                  Choose a PNG
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-slate-400">
                  {art ? art.name : "no file chosen"}
                </span>
              </label>
              <input
                id="deck-art"
                type="file"
                accept="image/png"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setArt(f);
                  setPreview(f ? URL.createObjectURL(f) : null);
                }}
                className="sr-only"
              />
              <p className="mt-2 text-sm text-slate-400">
                PNG on a transparent background, up to 4 MB. Every upload is checked
                automatically. Anything explicit is refused and the deck keeps the plain chest.
              </p>
            </section>

            <section>
              <label className="t-label mb-2 block">3. pick its colour</label>
              <div className="flex flex-wrap gap-2.5">
                {HUES.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setHue(h)}
                    aria-label={`hue ${h}`}
                    className={`h-11 w-11 cursor-pointer rounded-full border-2 transition-transform hover:scale-110 ${
                      hue === h ? "scale-110" : "border-transparent"
                    }`}
                    style={{
                      background: `hsl(${h} 100% 59%)`,
                      borderColor: hue === h ? "#fff" : undefined,
                    }}
                  />
                ))}
              </div>
            </section>

            <section>
              <label className="t-label mb-2 block">4. how many cases</label>
              <div className="flex flex-wrap gap-2.5">
                {SIZES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSize(s)}
                    className={`t-chain min-h-11 cursor-pointer rounded-[var(--radius-control)] border px-5 text-lg font-extrabold transition-colors ${
                      size === s
                        ? "border-[rgb(57_255_136_/_0.4)] bg-[rgb(57_255_136_/_0.08)] text-white"
                        : "border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <label className="t-label mb-2 block">5. what it pays</label>
              <div className="grid gap-2.5 sm:grid-cols-3">
                {SHAPES.map((s) => {
                  const fits = shapeFor(s.kind, size, game.vaultShareBps) !== null;
                  // Not "you need N cases" but the smallest size offered HERE:
                  // advice has to name a button visible on the screen rather
                  // than a number there is no button for.
                  const bigger = SIZES.find(
                    (n) => shapeFor(s.kind, n, game.vaultShareBps) !== null,
                  );
                  return (
                    <button
                      key={s.kind}
                      type="button"
                      disabled={!fits}
                      onClick={() => setKind(s.kind)}
                      className={`cursor-pointer rounded-[var(--radius-control)] border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        kind === s.kind
                          ? "border-[rgb(57_255_136_/_0.4)] bg-[rgb(57_255_136_/_0.08)]"
                          : "border-slate-800 bg-slate-950 hover:border-slate-700"
                      }`}
                    >
                      <span className="block text-base font-bold text-white">{s.title}</span>
                      <span className="mt-1 block text-sm leading-snug text-slate-400">
                        {fits
                          ? s.note
                          : bigger
                            ? `needs ${bigger} cases or more`
                            : "does not fit any deck this size"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <label className="t-label mb-2 block" htmlFor="deck-share">
                6. your share of the commission
              </label>
              <div className="flex items-center gap-4">
                <input
                  id="deck-share"
                  type="range"
                  min={0}
                  max={maxShare}
                  step={1}
                  value={Math.min(share, maxShare)}
                  onChange={(e) => setShare(Number(e.target.value))}
                  className="h-2 flex-1 cursor-pointer accent-[var(--color-accent)]"
                />
                <span className="t-chain w-16 text-right text-2xl font-extrabold text-white">
                  {Math.min(share, maxShare)}%
                </span>
              </div>
              {/* "Half the fee" stood here from the days when the vaults really
                  did take half. The share lives in the chain and is no longer a
                  half, so it cannot be named as a number: the line would tell an
                  untruth the very next day it is changed again. The ceiling, on
                  the other hand, is not our whim but a solvency condition: with
                  the rest of the treasury share the game pays for exchanges of
                  TESA into real tickets, including in this same deck. */}
              <p className="mt-2 text-sm text-slate-400">
                of the commission your deck earns, after the vaults take their slice, capped at{" "}
                {maxShare}% because the rest pays for turning TESA into real tickets, in your deck
                too
              </p>
            </section>
          </div>

          {/* -- what comes out -------------------------------------------- */}
          <div className="lg:col-span-5">
            <div
              className="sticky top-28 flex flex-col gap-4 rounded-[var(--radius-window)] border p-6"
              style={{
                background: "var(--color-surface)",
                borderColor: `color-mix(in oklab, hsl(${hue} 100% 59%) 30%, transparent)`,
              }}
            >
              <div className="relative grid place-items-center py-2">
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-8 inset-y-4 rounded-full opacity-25 blur-2xl"
                  style={{ background: `hsl(${hue} 100% 59%)` }}
                />
                {preview ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={preview}
                    alt=""
                    className="relative z-10 h-[170px] w-[170px] object-contain"
                  />
                ) : (
                  <Chest rarity="sealed" skin={`${clean || "unnamed"}:${hue}`} size={170} />
                )}
              </div>

              <h2
                className="t-black text-center text-2xl"
                style={{ color: `hsl(${hue} 100% 59%)` }}
              >
                {clean || "unnamed"}
              </h2>

              <dl className="space-y-2 border-t border-slate-800 pt-4">
                <Line name="cases in the deck" value={String(size)} />
                <Line
                  name="pays"
                  value={shape ? `1 in ${paysOneIn(shape, size)}` : "pick a shape"}
                />
                <Line name="a vault inside" value={shape?.vaultSlots ? "yes" : "no"} />
                <Line
                  name="prize budget"
                  value={shape ? `${totalWeight(shape)} of ${budget}` : "pick a shape"}
                />
                <Line name="your share" value={`${Math.min(share, maxShare)}%`} />
                <Line
                  name="it costs you"
                  value={`$${Number(formatUnits(mk.fee, 6)).toFixed(2)} + gas`}
                />
              </dl>

              <div className="border-t border-slate-800 pt-4">
                {/* StartHere without `what`: the explanation is not printed
                    here, because the price of the cut was just named by the "it
                    costs you" line, and the dollar per open has nothing to do
                    with this page. */}
                {!address ? (
                  <StartHere />
                ) : (
                  <>
                    <Button
                      block
                      className="py-4"
                      disabled={Boolean(problem) || mk.busy}
                      loading={mk.busy}
                      onClick={() => void submit()}
                    >
                      <Sparkles className="h-5 w-5 fill-current" />
                      {mk.state.phase === "approving"
                        ? "Approving…"
                        : mk.busy
                          ? "Cutting…"
                          : "Cut the deck"}
                    </Button>
                    {problem && (
                      <p className="mt-3 text-center text-sm text-slate-400">{problem}</p>
                    )}
                  </>
                )}
                {mk.state.error && (
                  <p className="mt-3 text-sm text-[var(--color-danger)]">
                    {mk.state.error.title}
                    {mk.state.error.next && (
                      <span className="mt-1 block text-slate-400">{mk.state.error.next}</span>
                    )}
                  </p>
                )}
                {/* The picture was rejected and the deck is alive, which is
                    exactly why it is stored off chain. */}
                {mk.state.art && (
                  <p className="mt-3 text-sm text-[var(--color-danger)]">
                    The deck is cut, but its picture was refused: {mk.state.art}. It shows the
                    plain chest instead.
                  </p>
                )}
                <p className="mt-3 text-sm leading-snug text-slate-400">
                  Once cut, nothing about it can be changed: not the drop table, not the name,
                  not your share. {game.decks.length} decks are live right now.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Line({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-sm text-slate-400">{name}</dt>
      <dd className="t-chain text-base font-bold text-white">{value}</dd>
    </div>
  );
}
