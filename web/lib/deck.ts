/**
 *
 */

export interface Tier {
  upTo: number;
  weight: number;
}

export interface DeckShape {
  size: number;
  tiers: Tier[];
  vaultUpTo: number;
}

export function weightOf(value: number, deck: DeckShape): number {
  for (const t of deck.tiers) {
    if (value <= t.upTo) return t.weight;
  }
  return 0;
}

export const WEIGHT_PER_TICKET = 5;

export type Rarity =
  | "vault"
  | "porphyry"
  | "aureus"
  | "denarius"
  | "shard"
  | "grout"
  | "sealed";

export interface TierSpec {
  name: string;
  note: string;
  tint: string;
  ink: string;
  tickets: number;
  rarity: Rarity;
}

/**
 * «+1 ticket» / «+5 tickets».
 *
 */
export const ticketsLabel = (n: number) => `+${n} ticket${n === 1 ? "" : "s"}`;

/**
 *
 *
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
  //
  if (weight > 0) {
    return {
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
    note: "no bonus on top",
    tint: "color-mix(in oklab, var(--color-tier-grout) 8%, var(--color-surface))",
    ink: "var(--color-tier-grout)",
    tickets: 0,
    rarity: "grout",
  };
}

export function specOf(value: number, deck: DeckShape): TierSpec {
  if (deck.vaultUpTo > 0 && value >= 1 && value <= deck.vaultUpTo) return VAULT_SPEC;
  return specFor(weightOf(value, deck));
}

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
 *
 */
export const isShard = (spec: TierSpec) => spec.rarity === "shard";

export const isPrize = (spec: TierSpec) =>
  spec.tickets > 0 || spec.rarity === "shard" || isVault(spec);

export function ticketsFromWeight(weight: number): number {
  return Math.floor(weight / WEIGHT_PER_TICKET);
}

/**
 *
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
 */
export function slotsPerTier(deck: DeckShape): { spec: TierSpec; count: number; weight: number }[] {
  const out: { spec: TierSpec; count: number; weight: number }[] = [];
  let prev = 0;
  for (const t of deck.tiers) {
    const count = t.upTo - prev;
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
 *
 *
 */
export function deckFace(deck: DeckShape & { drawn?: number }): TierSpec {
  if (deck.vaultUpTo > 0) return VAULT_SPEC;
  return bestTier(deck) ?? specFor(0);
}
