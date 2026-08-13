import Link from "next/link";
import type { Metadata } from "next";

/**
 *
 *
 */
export const metadata: Metadata = {
  title: "Tessera, demo",
  description:
    "Two minutes of the live game: a $1 case buys a real Megapot ticket and draws from a deck Inco keeps sealed.",
  openGraph: {
    title: "Tessera, demo",
    description:
      "Two minutes of the live game: a $1 case buys a real Megapot ticket and draws from a deck Inco keeps sealed.",
    videos: [{ url: "https://tessera.unitynodes.com/demo/tessera.mp4", type: "video/mp4" }],
    images: [{ url: "/demo/poster.jpg", width: 1600, height: 900 }],
  },
};

export default function DemoPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <Link
        href="/"
        className="t-label inline-flex items-center gap-1.5 text-[var(--color-ink-dim)] transition-colors hover:text-[var(--color-accent-hover)]"
      >
        ‹ all decks
      </Link>

      <h1 className="t-page mt-3 text-white">Two minutes of the real thing</h1>
      <p className="mt-2 max-w-2xl text-base leading-relaxed text-slate-300">
        Recorded straight off the live site on Base Sepolia, every open below is a real
        transaction that bought a real Megapot ticket and drew a card from an encrypted deck.
        Nothing here is a mockup.
      </p>

      <video
        className="mt-6 w-full rounded-[var(--radius-panel)] border border-slate-800 bg-black"
        src="/demo/tessera.mp4"
        poster="/demo/poster.jpg"
        controls
        preload="metadata"
        playsInline
      />

      <p className="mt-4 text-sm text-[var(--color-ink-dim)]">
        No voice-over: the captions carry it. Direct file:{" "}
        <a
          className="t-chain underline decoration-dotted underline-offset-4 hover:text-[var(--color-accent-hover)]"
          href="/demo/tessera.mp4"
        >
          tessera.mp4
        </a>{" "}
        · 1600×900 · 1:50
      </p>
    </main>
  );
}
