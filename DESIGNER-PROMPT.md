# Tessera: design brief

Paste everything below into a fresh conversation.

---

You are designing **Tessera**, an on-chain case opener built for the Inco
Summer Game Jam. It is live on Base Sepolia and judged on **14 August**.
I need a full visual redesign: art direction, layout, and the chest itself.

## What the product actually is

A player pays **$1** and gets two things in one transaction:

1. **A real lottery ticket** on Megapot, the same ticket sold on megapot.io,
   bought against the real contract, recorded to the player's own wallet.
   Tessera never holds it.
2. **One slot from an encrypted deck.** Usually empty. Sometimes it pays
   extra tickets. One slot in the deck opens a vault of accumulated money.

There is a second, rarer choice: **give the ticket up**. The same $1, but no
Megapot ticket: the dollar goes into the deck's vault instead, and whatever
you draw is worth double. Most draws are still empty, and double nothing is
nothing.

## The one thing that makes it different

**The pool is finite and public.** A deck has exactly N slots, shuffled once
before anyone opened one, drawn in order, without replacement. A prize
someone else takes is gone for everybody, forever. Nothing is generated on
demand; nothing regenerates.

Every other case opener rolls fresh odds each time. This one visibly
empties. **That is the product, and the design should be about it.**

Second honest constraint worth designing around: the contents are encrypted
(Inco Lightning). Decryption takes **6–9 seconds we do not control**, so the
interface must fill that time without ever showing a progress bar, we don't
know the remaining time, and any bar would be a lie about it.

## Tone

Not a casino. No neon, no coins raining, no "JACKPOT" in gold gradients. The
closest reference is an instrument: something you read numbers off, that
happens to contain a game. Dark, precise, and a little cold, with exactly
one place where it goes loud, and that is the moment a case opens.

The name is Roman: *tessera* was a token, for entry, for rations, for
identification. Tier names follow: Grout, Denarius, Aureus, Porphyry, and
The Vault.

## What exists now (keep or replace: your call, but say which)

- **Stack:** Next.js 16, React 19, Tailwind v4, `motion` v12. All colour in
  OKLCH, defined as CSS custom properties in one file.
- **Type:** Archivo (display) + IBM Plex Mono (all numbers, addresses,
  labels). Every on-chain number is monospace on purpose, it reads as
  something measured rather than written.
- **Palette:** near-black blue background `oklch(13% 0.014 265)`, azure
  accent `oklch(62% 0.20 255)` reserved for actions only, and one colour per
  tier: grey, verdigris green, amber gold, imperial magenta, and an
  incandescent white-gold for the vault.
- **Screens:** home (the pools), a case page, a battles lobby, a single
  battle, and a full-screen opening scene.

## What I need from you

### 1. The chest: this is the biggest problem

The chest is the one object in the whole product, and it is currently built
as CSS 3D: six faces, a separate lid on a hinge, metal fittings, studs, a
lock plate. **It looks wrong when it opens**, the lid swings out sideways
and covers the body instead of falling behind it, and the whole thing reads
as a box coming apart rather than a chest opening.

Design the chest properly:

- closed, and open with the lid behind it, from one fixed three-quarter angle;
- five tier variants that differ by material and light, not just hue;
- a small version legible at ~100 px in a row (the reel and the drops strip);
- and tell me how it should be built: SVG sprite, CSS 3D, or rendered
  sprite sheet. If SVG, give me the actual paths.

### 2. The opening moment

The one place the design is allowed to shout. Right now: the screen dims, a
reel of chests scrolls full-width for those 6–9 seconds, decelerates onto
the result, then the chest opens and a token rises out. The player cannot
close it until the reel stops.

Show me how this should look and move. Three or four frames is enough.
**Include the empty result**: nine draws in ten are empty, so that frame is
the one players see most, and it currently looks like a bug.

### 3. The pool, made visible

Each deck is currently a full-width row: the chest, the tier name, a grid of
one cell per slot (drawn cells dark, sealed cells lit), the counts, and the
vault. The idea is right. Make it beautiful.

### 4. A type and spacing system

Sizes are currently hard-coded per component and drift between screens. Give
me one scale, one panel treatment, and rules for when each is used.

## Hard constraints

- **Dark only.** No light theme.
- **No invented numbers.** Every figure on screen comes from the chain. If a
  layout needs a number to look good, that layout is wrong.
- **No progress bars during decryption.** See above.
- **Never show odds as percentages** where a count works: "3 left of 200",
  not "1.5% chance".
- **Empty must stay visible.** Nine in ten cases are empty and the interface
  must not hide that to look more generous.
- Must work at 390 px wide.
- Motion must degrade to a still frame under `prefers-reduced-motion`.

## What to deliver

1. The chest, all five tiers, closed and open, plus how to build it.
2. The opening sequence as frames, including the empty result.
3. The home screen at 1440 and 390.
4. The case screen at 1440.
5. The type scale, spacing scale, and panel rules as a short spec.

Ask me anything that would change the answer before you start drawing.
