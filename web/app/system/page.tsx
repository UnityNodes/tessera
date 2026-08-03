"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Panel, DataRow } from "@/components/ui/Panel";
import { Tessera, type TileState } from "@/components/Tessera";
import { PoolCounter } from "@/components/PoolCounter";
import { ShardMeter } from "@/components/ShardMeter";
import { TIERS, type DeckShape } from "@/lib/deck";

const DECK: DeckShape = { size: 100, shardSlots: 40 };

export default function SystemPage() {
  const [tile, setTile] = useState<TileState>("sealed");
  const [shards, setShards] = useState(3);

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-20 md:py-28">
      <header className="mb-20">
        <p className="t-label mb-5">Tessera · design system</p>
        <h1 className="t-display text-[clamp(2.75rem,7vw,4.5rem)] mb-6">
          A floor that keeps
          <br />
          <span className="text-[var(--color-sinopia-400)]">its own secret</span>
        </h1>
        <p className="max-w-xl text-[1.0625rem] text-[var(--color-travertine-dim)]">
          Every surface here behaves like stone set in grout: it has thickness, it
          catches light from one direction, and it sinks when pressed. Nothing
          glows for its own sake.
        </p>
      </header>

      <Section n="01" title="Pigments">
        <p className="mb-8 max-w-xl text-[var(--color-travertine-dim)]">
          Taken from real Roman pigments rather than picked for prettiness. Lapis
          was the costliest colour in the empire, which is why it means{" "}
          <em>paid for, not yet seen</em>.
        </p>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
          {SWATCHES.map((s) => (
            <div key={s.token} className="flex items-center gap-3">
              <span
                className="h-9 w-9 shrink-0 rounded-[2px] shadow-[inset_0_0_0_1px_var(--edge-strong),inset_0_1px_0_rgb(255_255_255/0.1),0_2px_3px_rgb(0_0_0/0.5)]"
                style={{ background: `var(${s.token})` }}
              />
              <span className="min-w-0">
                <span className="block text-[0.9375rem] leading-tight">{s.name}</span>
                <span className="t-label">{s.role}</span>
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section n="02" title="Voice">
        <div className="space-y-8">
          <div>
            <span className="t-label mb-3 block">Inscription · Bodoni Moda</span>
            <p className="t-inscription text-2xl">Open the case</p>
          </div>
          <div>
            <span className="t-label mb-3 block">Body · Newsreader</span>
            <p className="max-w-xl text-[1.0625rem]">
              The pool is drawn without replacement, so the counter saying three
              legendaries remain out of four hundred is a fact you can check, not a
              claim you have to trust.
            </p>
          </div>
          <div>
            <span className="t-label mb-3 block">On chain · IBM Plex Mono</span>
            <p className="t-chain text-[0.9375rem] text-[var(--color-patina-400)]">
              0x790bA6ACA3d0e5b0320faaf15d12b9e6C8D98311 · 282 604 gas · 8.4 s
            </p>
          </div>
        </div>
      </Section>

      <Section n="03" title="The tile">
        <p className="mb-8 max-w-xl text-[var(--color-travertine-dim)]">
          One component carries the whole game. Sealed, it breathes lapis. While
          the covalidators work it takes a slow sweep, six to eight seconds we do
          not control, so the motion must not look impatient. Revealed, it turns
          over: it was always there, just face down.
        </p>
        <div className="flex flex-wrap items-center gap-10">
          <div className="flex items-end gap-4">
            <Labeled text="sealed">
              <Tessera state="sealed" deck={DECK} />
            </Labeled>
            <Labeled text="waiting">
              <Tessera state="waiting" deck={DECK} />
            </Labeled>
            <Labeled text="revealed">
              <Tessera state="revealed" value={12} deck={DECK} />
            </Labeled>
          </div>

          <div className="flex items-center gap-4">
            <Tessera state={tile} value={17} deck={DECK} size={96} />
            <Button
              variant="quiet"
              onClick={() =>
                setTile((s) => (s === "sealed" ? "waiting" : s === "waiting" ? "revealed" : "sealed"))
              }
            >
              Next state
            </Button>
          </div>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-6 sm:grid-cols-5">
          {Object.values(TIERS).map((t, i) => (
            <div key={t.tier} className="text-center">
              <div className="mx-auto mb-3 w-16">
                <div
                  className="tessera grid place-items-center"
                  style={{ "--tile-tint": t.tint } as React.CSSProperties}
                >
                  <span className="t-chain text-sm font-semibold" style={{ color: t.ink }}>
                    {[7, 44, 58, 76, 93][i]}
                  </span>
                </div>
              </div>
              <span className="t-inscription block text-[0.6875rem]" style={{ color: t.ink }}>
                {t.name}
              </span>
              <span className="mt-1 block text-[0.8125rem] leading-snug text-[var(--color-travertine-faint)]">
                {t.note}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section n="04" title="Actions">
        <div className="flex flex-wrap items-center gap-4">
          <Button>Open a case · $1</Button>
          <Button variant="quiet">Redeem shards</Button>
          <Button variant="ghost">View on Basescan</Button>
          <Button disabled>Deck empty</Button>
        </div>
      </Section>

      <Section n="05" title="Counters">
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel label="Verifiable, not promised">
            <PoolCounter size={DECK.size} drawn={13} shardSlots={DECK.shardSlots} />
          </Panel>
          <Panel label="Inventory">
            <ShardMeter held={shards} />
            <div className="mt-6 flex gap-3">
              <Button variant="ghost" onClick={() => setShards((s) => Math.max(0, s - 1))}>
                −
              </Button>
              <Button variant="ghost" onClick={() => setShards((s) => s + 1)}>
                +
              </Button>
            </div>
          </Panel>
        </div>
      </Section>

      <Section n="06" title="Chain facts">
        <Panel label="Base Sepolia · live">
          <DataRow name="deck" value="0x790b…8311" />
          <DataRow name="click to prize" value="8.4 s" ink="var(--color-patina-400)" />
          <DataRow name="gas per open" value="282 604" />
          <DataRow name="referral per $1" value="$0.10" ink="var(--color-ochre-300)" />
          <DataRow name="inco fee per open" value="0" ink="var(--color-patina-400)" />
        </Panel>
      </Section>
    </main>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-24 border-t border-[var(--edge)] pt-10">
      <div className="mb-8 flex items-baseline gap-4">
        <span className="t-chain text-[0.8125rem] text-[var(--color-travertine-faint)]">{n}</span>
        <h2 className="t-inscription text-sm">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Labeled({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center">
      <div className="leading-[0]">{children}</div>
      <span className="t-label mt-3 block">{text}</span>
    </div>
  );
}

const SWATCHES = [
  { token: "--color-grout", name: "Grout", role: "ground" },
  { token: "--color-stone-700", name: "Stone", role: "surface" },
  { token: "--color-travertine", name: "Travertine", role: "text" },
  { token: "--color-sinopia-500", name: "Sinopia", role: "action" },
  { token: "--color-ochre-500", name: "Ochre", role: "shards, rarity" },
  { token: "--color-patina-500", name: "Verdigris", role: "confirmed" },
  { token: "--color-lapis-500", name: "Lapis", role: "sealed" },
];
