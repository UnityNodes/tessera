import type { Metadata } from "next";
import { DemoPlayer } from "@/components/DemoPlayer";

/**
 *
 *
 */
export const metadata: Metadata = {
  title: "Demo · Tessera",
  description:
    "Two minutes of the live game: a $1 case buys a real Megapot ticket and draws from a deck Inco keeps sealed.",
  openGraph: {
    title: "Tessera, in under two minutes",
    description:
      "A recorded walkthrough of the live game on Base Sepolia. Every open is a real transaction.",
    videos: [{ url: "https://tessera.unitynodes.com/demo/tessera.mp4", type: "video/mp4" }],
    images: [{ url: "/demo/poster.jpg", width: 1600, height: 900 }],
  },
};

/**
 *
 */
const CHAPTERS = [
  { at: 0, title: "A finite pool", note: "The catalogue, and the claim the whole project rests on." },
  { at: 10, title: "The deck is a ciphertext", note: "An encrypted list, shuffled on chain by Inco. Nobody can read it." },
  { at: 20, title: "Drawn without replacement", note: "Cards leave in order and never come back. Every one is public." },
  { at: 30, title: "A dollar buys a real ticket", note: "Megapot mints it in the same transaction that opens the case." },
  { at: 38, title: "The covalidators decrypt", note: "Six to nine seconds. The roll brakes onto what the chain returned." },
  { at: 46, title: "Most cases add nothing", note: "The honest case, and the game says so plainly instead of hiding it." },
  { at: 62, title: "Ten cases, one transaction", note: "Five strips settle independently, each on its own value." },
  { at: 82, title: "TESA", note: "A shard. Five of them make one more real ticket." },
  { at: 90, title: "The pool moved", note: "194 of 200 still sealed, a number anyone can recount." },
  { at: 98, title: "Cut your own deck", note: "Anyone can, and takes a share of the commission it earns." },
];

const STACK = [
  "Inco Lightning",
  "Megapot",
  "Base Sepolia",
  "Solidity 0.8.30",
  "UUPS proxy",
  "Next.js 16",
];

const DOORS = [
  {
    eyebrow: "Open one yourself",
    title: "A case, for a dollar",
    note: "Test dollars mint free from the page. The ticket you get is not a test.",
    href: "/case/4",
    cta: "Open a case",
    ink: "var(--color-tier-denarius)",
  },
  {
    eyebrow: "Check the arithmetic",
    title: "Recount the pool",
    note: "Every drawn card is public. The site's counter is one you can redo by hand.",
    href: "/case/1",
    cta: "See what is left",
    ink: "var(--color-tier-aureus)",
  },
  {
    eyebrow: "Make your own",
    title: "Cut a deck",
    note: "Choose the size, write the drop table, take a share of the commission.",
    href: "/create",
    cta: "Cut a deck",
    ink: "var(--color-tier-porphyry)",
  },
];

export default function DemoPage() {
  return (
    <main className="mx-auto w-full max-w-[1180px] px-6 py-12">
      <span
        className="t-label inline-flex items-center gap-2 rounded-[var(--radius-chip)] border px-3 py-1"
        style={{
          borderColor: "color-mix(in oklab, var(--color-accent) 45%, transparent)",
          color: "var(--color-accent)",
        }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: "var(--color-accent)" }}
          aria-hidden
        />
        live on base sepolia
      </span>

      <h1 className="t-page mt-5 max-w-3xl text-balance text-white">
        Tessera, in under two minutes.
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-300">
        A recorded walkthrough of the running game. Watch a dollar buy a real Megapot lottery
        ticket in the same transaction that draws a card, wait out the covalidators exactly as a
        player does, and see a deck that anyone can recount. Nothing here is a mockup, every open
        below is a transaction on chain.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {STACK.map((s) => (
          <span
            key={s}
            className="t-label rounded-[var(--radius-chip)] border border-slate-800 bg-slate-950 px-3 py-1 text-[var(--color-ink-dim)]"
          >
            {s}
          </span>
        ))}
      </div>

      <DemoPlayer chapters={CHAPTERS} src="/demo/tessera.mp4" poster="/demo/poster.jpg" />

      <section className="mt-20">
        <p className="t-label text-[var(--color-ink-dim)]">then try it yourself</p>
        <h2 className="t-display mt-2 text-[clamp(1.5rem,3.4vw,2.1rem)] text-white">
          Three doors into the live game.
        </h2>
        <div className="mt-7 grid gap-4 md:grid-cols-3">
          {DOORS.map((d) => (
            <a
              key={d.href}
              href={d.href}
              className="group flex flex-col rounded-[var(--radius-panel)] border border-slate-800 bg-slate-950/40 p-6 transition-colors hover:border-slate-700"
            >
              <span className="t-label" style={{ color: d.ink }}>
                {d.eyebrow}
              </span>
              <span className="t-display mt-2 text-lg text-white">{d.title}</span>
              <span className="mt-2 flex-1 text-sm leading-relaxed text-slate-300">{d.note}</span>
              <span className="t-label mt-5 text-[var(--color-ink-dim)] transition-colors group-hover:text-[var(--color-accent-hover)]">
                {d.cta} →
              </span>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
