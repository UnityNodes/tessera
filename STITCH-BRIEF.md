# Tessera: context brief for Stitch

Paste this whole file as the project context before asking for any screen.

---

## What this product is

**Tessera** is an on-chain case-opening game on Base. One dollar buys the player a
**real Megapot lottery ticket**: the same ticket sold on megapot.io, bought in the
same transaction. **The case comes free on top of the ticket.**

The name is Roman: a *tessera* is a single tile in a mosaic, and also the token a
Roman citizen presented to claim a ration. Both meanings are true here, a small
tile drawn from a finite set, and a token that pays.

Everything the player sees is read from the chain and can be recomputed by anyone.
**There is no backend, no database, no editorial number.**

## The single mechanic that drives every screen

The prizes live in an **encrypted, finite, exhaustible pool** on Inco Lightning.
A deck is shuffled **once**, before anyone opened anything, and slots are drawn
**without replacement**.

That means: a prize somebody else takes is **gone for everyone**, forever. The pool
only empties. Late in a season, if the top prize is still unopened, every remaining
slot is worth more, and that is visible in advance, not explained afterwards.

Every screen must serve this one idea. If a screen does not make the pool feel
finite and countable, it is the wrong screen.

## Screens to design

1. **Home**: the promise, and the shelf of decks.
2. **All cases**: the same shelf, on its own route.
3. **Open a case**: the main screen. One action.
4. **Case battles**: list of open/live battles.
5. **A battle**: two seats, two cards, one winner.

## Persistent chrome, on every screen

- **Header**: wordmark, nav (home / cases / battles), the player's test-dollar
  balance, the current vault amount, wallet connect.
- **Scoreboard strip**: cases opened · players · cases left · your tickets.
  These are counts of real on-chain events. They animate when they change.
- **Live drops strip**: what other people just pulled, newest first, including the
  empty pulls. Cards that are worth something glow; empty ones recede.

## The rarity ladder

Five outcomes. Roman names, because the tiers are Roman coins and stones.
Colours are the materials of a real Roman mosaic, **not** neon, **not** sepia.

| Tier | What it pays | Colour | How often |
|---|---|---|---|
| **Grout** | nothing | cold slate, no glow | the honest majority |
| **Denarius** | +1 real ticket | verdigris green | uncommon |
| **Aureus** | +2–4 tickets | amber gold | rare |
| **Porphyry** | +5 tickets | imperial magenta | very rare |
| **The Vault** | the whole accumulated pot, in dollars | incandescent white-gold, the brightest thing on the page | one slot per deck |

The Vault is **not** the next rung of the ladder, it is a different category. It
pays money, not tickets. It should read as a light source, not as "more gold".

An **unopened** case is cold blue, the same blue as buttons and links. Rarity is
unknown, so it wears the interface colour, not a prize colour.

## Palette (already committed: keep it)

Near-black ground with a whisper of blue. Warm light pools drift across it.
No grid, no scanlines, no glass panels.

```
bg            oklch(13%  0.014 265)     surface  oklch(18.5% 0.020 265)
action/azure  oklch(62%  0.20  255)     ink      oklch(97%  0.006 250)
grout         oklch(50%  0.022 252)     denarius oklch(73%  0.16  158)
aureus        oklch(78%  0.165 70)      porphyry oklch(64%  0.25  340)
vault         oklch(94%  0.105 98)      danger   oklch(65%  0.21  20)
```

Typography: one family (Archivo), 800 for headlines, 400 for text. **Monospace
(IBM Plex Mono) for every number that came from the chain**, that is a promise
that the figure can be verified, not a style choice.

## The case object

A **cube crate** rendered in real 3D: lid seam across the top third, four corner
studs, a circular seal plate on the face carrying the tier mark (1 / 2 / 5 / a
diamond for the vault / a padlock when sealed). It floats, sways in three-quarter
view, and throws a shadow. Same silhouette at every size and every tier, the
player must read "the same chest turned out to be worth more", not "five different
objects".

## The opening, second by second

1. **Idle**: the sealed crate, clickable. One button: `Open a case · $1`.
2. **Paying**: wallet confirmation, then the ticket purchase.
3. **Revealing**: two Inco covalidators decrypt the slot. This takes **6 to 9
   seconds and we do not control it**. A horizontal strip of possible outcomes
   scrolls at constant speed. **No progress bar, no percentage, no countdown**:
   any of those would be a lie about a duration we cannot know.
4. **Landing**: the chain answers, and only then does the strip brake onto the
   result. Never the other way round.
5. **Done**: burst of the tier colour, shards fly out, the crate is now that tier,
   and the payout is spelled out in words.

The strip shows rare tiers more often than they actually occur, the same as any
case opener. That is honest here only because two things stay true: **the chain
decides where it lands**, and **the true odds are printed next to it as counts
anyone can recompute**.

## What the "Open a case" screen must contain

- The crate and the strip, together, always, not one replacing the other.
- The vault: how much it holds now, and whether its slot is still in the pool.
- The result, in plain sentences. Ticket first (it always happens), case second
  (it is usually empty).
- **What is still in the pool**: per tier, `left / total`, counted from public
  reveals. Plus the real percentage of remaining slots that carry anything.
- **What is in this case**: every tier including Grout, each labelled with how many
  are left. Empty outcomes are shown, never hidden.
- The player's Megapot position: jackpot size, their tickets, claim button.

## Shards, and "take it or risk it"

Small slots pay **shards**. Five shards = one more real ticket, paid for out of the
10% referral fee the game earns on every purchase, **no outside money, ever**.

When shards are holdable, the player gets two equally weighted buttons side by
side: **take it** or **risk it**. Never one loud button and one quiet one. The copy
always names the cost of the choice in figures: "double it" without "or lose it" is
incitement, not an offer.

## Absolute bans: these break the product's only claim

- **No marketplace.** No Sell, no Withdraw item, no item price in dollars, no
  "Factory New" / wear grades, no trade. Prizes are lottery tickets and the vault.
  There is nothing to resell.
- **No invented numbers.** No "12,654 players online", no fake recent-winner names,
  no seeded activity. Every figure is an on-chain count or it does not appear.
- **No urgency theatre.** No countdown timers to fake deadlines, no "3 left!" unless
  three are genuinely left, no confetti on an empty pull.
- **No "Add Funds".** Test dollars are minted free from the header, one click.
- **No hidden odds.** The drop table is public by design. What is hidden is only
  *which slot belongs to whom*, never *what exists*.
- **No progress bar during the reveal.** See above.
- **No neon-cyberpunk pass.** Not magenta-on-black arcade. The reference is
  Ravenna and Hagia Sophia: gold leaf, lapis, porphyry, cinnabar on a dark ground.
  Lit like a room, not like a nightclub.

## Tone of the copy

Short, plain, declarative. It states what happened and what it costs. It never
congratulates the player on an empty case and never sells them the next one.

Good: "The case was empty. Most of them are."
Good: "You own 1 more real ticket."
Bad: "So close! Try again for your chance at EPIC rewards!"

## Current state, for accuracy

Base Sepolia. Three decks: 100, 100, and 200 cases. Dollars are test dollars and
free. The Megapot draw is frozen on this testnet, tickets are real purchases
against the real contract, they simply have nothing to play in until mainnet.
The interface says this plainly rather than drawing a countdown into the past.
