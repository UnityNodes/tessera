import { WEIGHT_PER_TICKET } from "./deck";

/**
 *
 *
 */
export type ShapeKind = "steady" | "jackpot" | "collector";

/**
 *
 *
 */
export function budgetFor(size: number, vaultShareBps: number): number {
  return Math.floor((size * (10_000 - vaultShareBps)) / 20_000);
}

export interface Shape {
  upTo: number[];
  weight: number[];
  vaultSlots: number;
}

export const SHAPES: {
  kind: ShapeKind;
  title: string;
  note: string;
}[] = [
  {
    kind: "steady",
    title: "often, small",
    note: "no vault, a ticket here and there, and plenty of TESA",
  },
  {
    kind: "jackpot",
    title: "rare, huge",
    note: "one vault, a couple of five-ticket slots, the rest in TESA",
  },
  {
    kind: "collector",
    title: "shards only",
    note: "one vault and nothing but TESA, five of them make a ticket",
  },
];

/**
 *
 *
 */
export function shapeFor(kind: ShapeKind, size: number, vaultShareBps: number): Shape | null {
  const budget = budgetFor(size, vaultShareBps);

  if (kind === "steady") {
    const tickets = Math.floor(budget / 2 / WEIGHT_PER_TICKET);
    const shards = budget - tickets * WEIGHT_PER_TICKET;
    if (tickets < 1 || shards < 1) return null;
    const upTo = [tickets, tickets + shards];
    if (upTo[1] > size) return null;
    return { upTo, weight: [WEIGHT_PER_TICKET, 1], vaultSlots: 0 };
  }

  if (kind === "jackpot") {
    const big = 2; // 25 '
    const mid = 2; // 10
    const shards = budget - big * 25 - mid * 10;
    if (shards < 1) return null;
    const upTo = [1, 1 + big, 1 + big + mid, 1 + big + mid + shards];
    if (upTo[3] > size) return null;
    return { upTo, weight: [0, 25, 10, 1], vaultSlots: 1 };
  }

  const shards = budget;
  const upTo = [1, 1 + shards];
  if (shards < 1 || upTo[1] > size) return null;
  return { upTo, weight: [0, 1], vaultSlots: 1 };
}

export function paysOneIn(shape: Shape, size: number) {
  let prev = 0;
  let paying = 0;
  shape.upTo.forEach((u, i) => {
    if (shape.weight[i] > 0) paying += u - prev;
    prev = u;
  });
  paying += shape.vaultSlots;
  return paying > 0 ? Math.max(1, Math.round(size / paying)) : 0;
}

export function totalWeight(shape: Shape) {
  let prev = 0;
  let total = 0;
  shape.upTo.forEach((u, i) => {
    total += (u - prev) * shape.weight[i];
    prev = u;
  });
  return total;
}
