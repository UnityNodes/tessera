/**
 * The drop table. Public by design: what is hidden is not "what exists" but
 * "which slot goes to whom".
 *
 * The contract measures prizes in weight. Five weight makes one real ticket.
 * A shard weighs 1, a ticket slot 5, the top slot 25, which is five tickets at
 * once. It is the differing weights that make the table steep: almost always
 * zero, rarely a lot.
 */

export interface Tier {
  /** Every value up to and including upTo belongs to this rung. */
  upTo: number;
  weight: number;
}

export interface DeckShape {
  size: number;
  tiers: Tier[];
  /** Values 1..vaultUpTo open the vault. Zero means the season has none. */
  vaultUpTo: number;
}

/** How much weight such a slot value is worth. */
export function weightOf(value: number, deck: DeckShape): number {
  for (const t of deck.tiers) {
    if (value <= t.upTo) return t.weight;
  }
  return 0;
}

/** How much weight makes one ticket. Must match the contract. */
export const WEIGHT_PER_TICKET = 5;

/** The rungs of the rarity ladder. Matches the variants of <Crate>. */
export type Rarity =
  | "vault"
  | "porphyry"
  | "aureus"
  | "denarius"
  | "shard"
  | "grout"
  | "sealed";

export interface TierSpec {
  /** What the player is shown. */
  name: string;
  /** One line, under the name. */
  note: string;
  /** The stone's colour. */
  tint: string;
  /** The label's colour. */
  ink: string;
  /** How many real tickets this slot gives. */
  tickets: number;
  /** Which chest to draw. */
  rarity: Rarity;
}

/**
 * "+1 ticket" versus "+5 tickets".
 *
 * The singular lived in one place, the rung's own note, and did not live in the
 * four others where the string was assembled by hand. Which is why "Best case +1
 * tickets" stood in the catalogue, on the home page and in the feed, next to a
 * correct "+1 ticket" in the contents table on the very same page.
 */
export const ticketsLabel = (n: number) => `+${n} ticket${n === 1 ? "" : "s"}`;

/**
 * Weight to what it looks like and how many tickets it is.
 *
 * The player never sees the word "weight" or a slot number: those are the
 * contract's units of account, not what happened to them. On screen there are
 * only tickets, because a ticket is the one unit that needs no explaining.
 *
 * Porphyry is not decoration: it is the imperial stone, quarried in a single
 * mountain in Egypt and permitted to emperors alone. Rarity by decree is exactly
 * what a top prize needs.
 */
export function specFor(weight: number): TierSpec {
  const tickets = Math.floor(weight / WEIGHT_PER_TICKET);
  if (tickets >= 5) {
    return {
      name: "Porphyry",
      note: ticketsLabel(tickets),
      tint: "color-mix(in oklab, var(--color-tier-porphyry) 9%, var(--color-surface))",
      ink: "var(--color-tier-porphyry)",
      tickets,
      rarity: "porphyry",
    };
  }
  if (tickets >= 2) {
    return {
      name: "Aureus",
      note: ticketsLabel(tickets),
      tint: "color-mix(in oklab, var(--color-tier-aureus) 9%, var(--color-surface))",
      ink: "var(--color-tier-aureus)",
      tickets,
      rarity: "aureus",
    };
  }
  if (tickets === 1) {
    return {
      name: "Denarius",
      note: ticketsLabel(1),
      tint: "color-mix(in oklab, var(--color-tier-denarius) 9%, var(--color-surface))",
      ink: "var(--color-tier-denarius)",
      tickets: 1,
      rarity: "denarius",
    };
  }
  // A shard: it weighs something, but is not worth a ticket on its own.
  //
  // It used to land in the same bucket as emptiness, and the player was told
  // "nothing this time" for a slot the contract values at a fifth of a ticket.
  // Which is why no live deck had shards in it: they were simply unusable, even
  // though the contract, the redemption and the name of the game all rest on them.
  if (weight > 0) {
    return {
      // TESA is the thing you collect. The name comes from the design system,
      // and it beats "Shard" precisely because it sounds like a currency: a
      // shard on its own is worth nothing, and five make a real ticket.
      name: "TESA",
      note: `${WEIGHT_PER_TICKET} make a ticket`,
      tint: "color-mix(in oklab, var(--color-tier-shard) 9%, var(--color-surface))",
      ink: "var(--color-tier-shard)",
      tickets: 0,
      rarity: "shard",
    };
  }

  return {
    name: "Grout",
    // A case is not "empty": the player got their ticket either way.
    // The only thing that can be empty is what came ON TOP.
    note: "no bonus on top",
    tint: "color-mix(in oklab, var(--color-tier-grout) 8%, var(--color-surface))",
    ink: "var(--color-tier-grout)",
    tickets: 0,
    rarity: "grout",
  };
}

/** The vault is checked FIRST: its slot weighs zero, so otherwise it would read as empty. */
export function specOf(value: number, deck: DeckShape): TierSpec {
  if (deck.vaultUpTo > 0 && value >= 1 && value <= deck.vaultUpTo) return VAULT_SPEC;
  return specFor(weightOf(value, deck));
}

/** The vault. Not tickets, but all the accumulated money at once. */
export const VAULT_SPEC: TierSpec = {
  name: "The Vault",
  note: "everything the vault holds",
  tint: "color-mix(in oklab, var(--color-tier-vault) 10%, var(--color-surface))",
  ink: "var(--color-tier-vault)",
  tickets: 0,
  rarity: "vault",
};

export const isVault = (spec: TierSpec) => spec.name === VAULT_SPEC.name;

/**
 * Whether a slot gave anything at all.
 *
 * Not "how many tickets": a shard gives zero tickets and is still a prize, since
 * five of them make a real ticket. As long as this check was written inline as
 * `tickets > 0 || isVault`, every such place silently counted a shard as
 * emptiness: the opening scene greeted it as a miss, and the feed put it under
 * the marker instead of "nothing".
 */
export const isShard = (spec: TierSpec) => spec.rarity === "shard";

export const isPrize = (spec: TierSpec) =>
  spec.tickets > 0 || spec.rarity === "shard" || isVault(spec);

/** How many bonus tickets are in hand and not yet collected. */
export function ticketsFromWeight(weight: number): number {
  return Math.floor(weight / WEIGHT_PER_TICKET);
}

/**
 * The best TICKET rung of a deck, the one the deck is named after.
 *
 * Not the vault: the vault stands first in the table and weighs zero, so "the
 * first non-empty rung" would give "The Vault" to several decks at once, and the
 * catalogue would hold identical chests with identical names. Almost every deck
 * has a vault, so it says nothing about this one; what does is what it pays in
 * tickets.
 */
export function bestTier(deck: DeckShape): TierSpec | undefined {
  return slotsPerTier(deck)
    .filter((t) => t.weight > 0)
    .reduce<{ spec: TierSpec; count: number; weight: number } | undefined>(
      (a, b) => (b.spec.tickets > (a?.spec.tickets ?? -1) ? b : a),
      undefined,
    )?.spec;
}

/**
 * How many slots of each rung the deck holds. Computed from the table, so the
 * "this many left" counter takes its numbers from where the contract takes them.
 */
export function slotsPerTier(deck: DeckShape): { spec: TierSpec; count: number; weight: number }[] {
  const out: { spec: TierSpec; count: number; weight: number }[] = [];
  let prev = 0;
  for (const t of deck.tiers) {
    const count = t.upTo - prev;
    // Vault slots sit at the start of the range and weigh zero. Without this
    // check they would show up as ordinary emptiness.
    const vaultHere = Math.max(0, Math.min(t.upTo, deck.vaultUpTo) - prev);
    if (vaultHere > 0) out.push({ spec: VAULT_SPEC, count: vaultHere, weight: -1 });
    if (count - vaultHere > 0) {
      out.push({ spec: specFor(t.weight), count: count - vaultHere, weight: t.weight });
    }
    prev = t.upTo;
  }
  const rest = deck.size - prev;
  if (rest > 0) out.push({ spec: specFor(0), count: rest, weight: 0 });
  return out;
}

/**
 * How much weight a deck promises to hand out over its whole life.
 *
 * The same thing `_createDeck` computes in the contract: a sum over the rungs,
 * the width of a rung times its weight. Vault slots weigh zero and are not
 * included, because the vault is paid in money from a different share of the fee.
 */
export function totalWeight(deck: DeckShape): number {
  let sum = 0;
  let prev = 0;
  for (const t of deck.tiers) {
    sum += (t.upTo - prev) * t.weight;
    prev = t.upTo;
  }
  return sum;
}

/**
 * Whether a deck's promise fits inside the money its own opens will bring in.
 *
 * Literally the limit from the contract: `totalWeight * 2 * 10000 <= n * (10000 -
 * vaultShareBps)`. It is repeated here not for elegance but so that we do not
 * offer an action the chain will reject anyway: a button that always reverts is
 * worse than no button.
 *
 * Why the factor of two: an open brings ten cents of commission, a ticket costs
 * a dollar, and a ticket takes five weight. So a unit of weight is twenty cents
 * while a slot earns ten, and not even all of that, since the vault share passes
 * the prizes by.
 */
export function fitsBudget(deck: DeckShape, vaultShareBps: number): boolean {
  return totalWeight(deck) * 2 * 10_000 <= deck.size * (10_000 - vaultShareBps);
}
