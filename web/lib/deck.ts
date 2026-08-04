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
    };
  }
  if (tickets >= 2) {
    return {
      name: "Aureus",
      note: `+${tickets} tickets`,
      tint: "var(--color-ochre-900)",
      ink: "var(--color-ochre-300)",
      tickets,
    };
  }
  if (tickets === 1) {
    return {
      name: "Denarius",
      note: "+1 ticket",
      tint: "var(--color-patina-900)",
      ink: "var(--color-patina-400)",
      tickets: 1,
    };
  }
  return {
    name: "Grout",
    note: "nothing this time",
    tint: "var(--color-stone-700)",
    ink: "var(--color-travertine-faint)",
    tickets: 0,
  };
}

export function specOf(value: number, deck: DeckShape): TierSpec {
  return specFor(weightOf(value, deck));
}

export function ticketsFromWeight(weight: number): number {
  return Math.floor(weight / WEIGHT_PER_TICKET);
}

/**
 */
export function slotsPerTier(deck: DeckShape): { spec: TierSpec; count: number; weight: number }[] {
  const out: { spec: TierSpec; count: number; weight: number }[] = [];
  let prev = 0;
  for (const t of deck.tiers) {
    out.push({ spec: specFor(t.weight), count: t.upTo - prev, weight: t.weight });
    prev = t.upTo;
  }
  const rest = deck.size - prev;
  if (rest > 0) out.push({ spec: specFor(0), count: rest, weight: 0 });
  return out;
}
