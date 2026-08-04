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

export interface TierSpec {
  name: string;
  note: string;
  tint: string;
  ink: string;
  tickets: number;
  art: string;
}

/**
 *
 *
 */
export function specFor(weight: number): TierSpec {
  const tickets = Math.floor(weight / WEIGHT_PER_TICKET);
  if (tickets >= 5) {
    return {
      name: "Porphyry",
      note: `+${tickets} tickets`,
      tint: "var(--color-porphyry-900)",
      ink: "var(--color-porphyry-300)",
      tickets,
      art: "/cases/porphyry.png",
    };
  }
  if (tickets >= 2) {
    return {
      name: "Aureus",
      note: `+${tickets} tickets`,
      tint: "var(--color-ochre-900)",
      ink: "var(--color-ochre-300)",
      tickets,
      art: "/cases/aureus.png",
    };
  }
  if (tickets === 1) {
    return {
      name: "Denarius",
      note: "+1 ticket",
      tint: "var(--color-patina-900)",
      ink: "var(--color-patina-400)",
      tickets: 1,
      art: "/cases/denarius.png",
    };
  }
  return {
    name: "Grout",
    note: "nothing this time",
    tint: "var(--color-stone-700)",
    ink: "var(--color-travertine-faint)",
    tickets: 0,
    art: "/cases/grout.png",
  };
}

export function specOf(value: number, deck: DeckShape): TierSpec {
  if (deck.vaultUpTo > 0 && value >= 1 && value <= deck.vaultUpTo) return VAULT_SPEC;
  return specFor(weightOf(value, deck));
}

export const VAULT_SPEC: TierSpec = {
  name: "The Vault",
  note: "everything the vault holds",
  tint: "var(--color-porphyry-900)",
  ink: "var(--color-porphyry-300)",
  tickets: 0,
  art: "/cases/vault.png",
};

export const isVault = (spec: TierSpec) => spec.name === VAULT_SPEC.name;

export function ticketsFromWeight(weight: number): number {
  return Math.floor(weight / WEIGHT_PER_TICKET);
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
