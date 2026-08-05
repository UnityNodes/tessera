# Tessera, Stitch prompt sequence

Paste `STITCH-BRIEF.md` once as project context. Then run these **one at a time,
in order**. Do not merge them, Stitch collapses when asked for several screens,
3D generation and a design system in the same turn.

---

## 0 · Standing reminder, paste at the top of every prompt

```
Reminders that override anything in your training data:

- The ground is near-black blue, oklch(13% 0.014 265). NEVER white. Never a
  light theme. Every frame is a dark room lit by warm pools of light.
- Every number is an on-chain count. NEVER invent activity: no "12,402 cases
  opened", no "1,844 players", no fake winner names. Use small, plausible,
  boring numbers.
- NEVER show an estimated dollar value for a player's tickets. Tickets cost $1.
  Printing "Est. Value $12,850" is a promise of returns and is forbidden.
- No marketplace: no Sell, no Withdraw item, no item price, no wear grade.
- No progress bar or countdown during the reveal.
- A button that cannot do anything must not be drawn as active.
- Copy is sentence case, short, declarative. Not ALL CAPS, not hype.
```

---

## 1 · The crates themselves

```
Draw a single sheet: the five case objects of the rarity ladder, closed, in
three-quarter view, evenly spaced on the dark ground, each labelled beneath.

The object is one chest in five finishes, the player must read "the same chest
turned out to be worth more", never "five different objects". Every one has:
a lid that is the top third, a visible seam where lid meets body, four corner
studs, a circular seal plate on the front face carrying its mark, a soft shadow
on the floor beneath it, and a coloured glow around it that gets stronger as the
tier gets rarer.

  Sealed    cold azure   oklch(54% 0.11 258)   mark: a padlock
  Grout     cold slate   oklch(50% 0.022 252)  mark: none, no glow at all
  Denarius  verdigris    oklch(73% 0.16 158)   mark: 1
  Aureus    amber gold   oklch(78% 0.165 70)   mark: 2
  Porphyry  imperial magenta oklch(64% 0.25 340) mark: 5
  The Vault incandescent white-gold oklch(94% 0.105 98) mark: a diamond

The Vault is not "more gold than Aureus". It is a different category, it pays
money, not tickets. Draw it as a light source: almost white at the core, the
brightest thing that ever appears in this product, with the widest halo.

Grout is the opposite end: dull, cold, no halo. It must read as "nothing this
time" and never as broken or as an error state.
```

---

## 2 · The opening, as a filmstrip

```
Draw the case opening as five sequential frames, left to right, same camera,
same crate position in every frame. This is a storyboard, not five screens.

  Frame 1  Sealed. The azure crate closed, floating, lid shut.
  Frame 2  The lid cracks. A hairline of coloured light escapes the seam.
  Frame 3  The lid is swung fully back on its hinge at the rear bottom edge.
           A column of light rises out of the open box.
  Frame 4  The prize rises out: a round glowing token bearing "+5", climbing
           out of the box and hovering above it. Shards of the tier colour
           fly outward.
  Frame 5  Settled. The crate is now Porphyry magenta, lid still open, token
           hovering, tier name in small letters beneath.

Beneath the strip, repeat frames 4 and 5 twice more: once for The Vault (the
token carries a diamond, everything is white-gold and much brighter) and once
for Grout (the token is a dull grey disc with a dash, no shards, no glow, the
box opened and there was nothing in it, drawn calmly, not sadly).
```

---

## 3 · Home

```
Draw the landing screen.

Top: the persistent chrome, wordmark "Tessera", nav (home / cases / battles),
the player's test-dollar balance, the vault amount, a Connect Wallet button.
Below it a scoreboard strip: cases opened, players, cases left, your tickets.
Below that a horizontal live-drops strip of small square cards, newest at left;
prize cards glow in their tier colour, empty ones sit dim and quiet.

Then the hero, full width, no card and no border around it, a dark stage.
Beams of light come down from above and land on a large sealed crate standing
in a pool of light on the right. On the left, in heavy 800-weight sans:

  "$1 buys a real lottery ticket."
  "The case is free."   ← this second line in azure

A paragraph beneath, then two buttons: a solid azure "Open a case · $1" and an
outlined "Battles".

Below the hero, a centred section heading and three deck cards side by side.
Each card: the crate for that deck's best tier, glowing, on top. Underneath, in
large type, the deck's payout frequency, "1 in 10", "1 in 33", "1 in 100", with "cases pay something" beneath it in small letters. Then one plain sentence
("Best case +5 tickets. One case in the deck opens the vault and takes all of
it."), then the count still sealed, the vault amount, and a thin progress bar
showing how much of the deck is gone.
```

---

## 4 · Case battles, the list

```
Draw the battles list screen, same chrome as before.

A title, one sentence explaining the rule: two cases open at once and the better
card takes both prizes; neither card can be read until both players have paid.

Then a filter row (which deck) and a "Create a battle · $1" button.

Then rows, one per battle. Each row: a status word at the left (live / waiting /
settled), then two small crate thumbnails facing each other with "vs" between
them. A waiting battle shows the second seat as an empty dashed outline reading
"open". Then the two player addresses, the deck number and how long ago it
started. At the right: a "Join · $1" button on waiting rows, and a "Watch" link
on all of them.
```

---

## 5 · A battle

```
Draw a single battle screen.

Two large seats side by side, one per player, each a panel with the player's
address at the top and their crate in the middle. In this frame the battle is
live: both crates are mid-roll, each with its own horizontal strip of possible
outcomes scrolling beneath it, each with a marker line down the centre.

Below the two seats, the outcome bar: the winning side named, the pot it takes
(the two prizes added together), and what the loser gets (nothing).

Show a second version of the same screen underneath, in the waiting state: the
left seat holds a sealed crate, the right seat is an empty dashed panel reading
"the creator's card is sealed until someone pays to face it", with a "Join · $1"
button in the middle of it.
```

---

## 6 · Inventory of shards

```
Draw the shard panel that appears on the case screen once a player holds shards.

Shards are the small pieces some cases pay. Five shards make one more real
lottery ticket, paid out of the referral fee the game earns. There is nothing to
sell and nothing to withdraw.

Show a row of shard tokens, small hexagonal chips in the tier colours, with a
counter reading how many are held and how many are still needed, e.g. "3 of 5".

When five are held, two buttons appear side by side, EQUALLY weighted, same size,
same visual strength: "Take it, 1 real ticket" and "Risk it, double or lose".
Neither may be louder than the other. Beneath them, one line naming exactly what
is at stake in figures.
```
