/**
 *
 */

export type Tier = "shard" | "lapis" | "bronze" | "terracotta" | "grout";

export interface TierSpec {
  tier: Tier;
  name: string;
  note: string;
  tint: string;
  ink: string;
}

export const TIERS: Record<Tier, TierSpec> = {
  shard: {
    tier: "shard",
    name: "Shard",
    note: "Five of these buy another real ticket",
    tint: "var(--color-ochre-900)",
    ink: "var(--color-ochre-300)",
  },
  lapis: {
    tier: "lapis",
    name: "Lapis",
    note: "The costliest pigment in the empire",
    tint: "var(--color-lapis-900)",
    ink: "var(--color-lapis-400)",
  },
  bronze: {
    tier: "bronze",
    name: "Verdigris",
    note: "Bronze that has met the weather",
    tint: "var(--color-patina-900)",
    ink: "var(--color-patina-400)",
  },
  terracotta: {
    tier: "terracotta",
    name: "Sinopia",
    note: "Red earth from Sinope",
    tint: "var(--color-sinopia-900)",
    ink: "var(--color-sinopia-400)",
  },
  grout: {
    tier: "grout",
    name: "Grout",
    note: "What holds the floor together",
    tint: "var(--color-stone-700)",
    ink: "var(--color-travertine-dim)",
  },
};

export interface DeckShape {
  size: number;
  shardSlots: number;
}

/**
 *
 */
export function tierOf(value: number, deck: DeckShape): TierSpec {
  if (value >= 1 && value <= deck.shardSlots) return TIERS.shard;

  const rest = deck.size - deck.shardSlots;
  const offset = value - deck.shardSlots; // 1..rest
  const share = offset / rest;

  if (share <= 0.1) return TIERS.lapis;
  if (share <= 0.3) return TIERS.bronze;
  if (share <= 0.6) return TIERS.terracotta;
  return TIERS.grout;
}

export const SHARDS_PER_TICKET = 5;

export function shardsToNextTicket(held: number): number {
  return (SHARDS_PER_TICKET - (held % SHARDS_PER_TICKET)) % SHARDS_PER_TICKET;
}
