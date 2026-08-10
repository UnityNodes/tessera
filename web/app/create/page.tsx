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
import { SHAPES, shapeFor, paysOneIn, totalWeight, type ShapeKind } from "@/lib/shapes";

const HUES = [333, 300, 265, 225, 194, 160, 120, 75, 40, 12];

const SIZES = [100, 200, 400];

/**
 *
 *
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

  const shape = useMemo(() => shapeFor(kind, size), [kind, size]);
  const clean = name.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const maxShare = mk.maxBps / 100;

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
            Anyone can. The deck is shuffled once by the contract and nobody, not you, not us, can see or change what is inside afterwards. You take a share of the commission it
            earns; the dollar players pay still buys them a whole real ticket.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-12">
          <div className="space-y-7 lg:col-span-7">
            <section>
              <label className="t-label mb-2 block" htmlFor="deck-name">
                1. name it
              </label>
              <input
                id="deck-name"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 20))}
                placeholder="unnamed"
                className="w-full rounded-[var(--radius-control)] border border-slate-800 bg-slate-950 px-4 py-3 text-lg text-white outline-none placeholder:text-slate-500 focus:border-[var(--color-accent)]"
              />
              <p className="mt-2 text-sm text-slate-400">
                letters and digits only, it goes on chain and cannot be changed later
                {clean && clean !== name.trim().toLowerCase() ? ` · will be saved as “${clean}”` : ""}
              </p>
            </section>

            <section>
              <label className="t-label mb-2 block" htmlFor="deck-art">
                2. its picture, or just a colour
              </label>
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
                automatically, anything explicit is refused and the deck keeps the plain chest.
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
                  const fits = size >= s.min && shapeFor(s.kind, size) !== null;
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
                        {fits ? s.note : `needs ${s.min} cases or more`}
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
              <p className="mt-2 text-sm text-slate-400">
                of the game&apos;s half of the commission, capped at {maxShare}%, the rest pays
                for turning TESA into real tickets, in your deck too
              </p>
            </section>
          </div>

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
                  value={shape ? `1 in ${paysOneIn(shape, size)}` : ", "}
                />
                <Line name="a vault inside" value={shape?.vaultSlots ? "yes" : "no"} />
                <Line
                  name="prize budget"
                  value={shape ? `${totalWeight(shape)} of ${Math.floor(size / 2)}` : ", "}
                />
                <Line name="your share" value={`${Math.min(share, maxShare)}%`} />
                <Line
                  name="it costs you"
                  value={`$${Number(formatUnits(mk.fee, 6)).toFixed(2)} + gas`}
                />
              </dl>

              <div className="border-t border-slate-800 pt-4">
                {!address ? (
                  <StartHere what="Your own case" />
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
                {mk.state.art && (
                  <p className="mt-3 text-sm text-[var(--color-danger)]">
                    The deck is cut, but its picture was refused: {mk.state.art}. It shows the
                    plain chest instead.
                  </p>
                )}
                <p className="mt-3 text-sm leading-snug text-slate-400">
                  Once cut, nothing about it can be changed, not the drop table, not the name,
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
