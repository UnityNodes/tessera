import { WEIGHT_PER_TICKET } from "./deck";

/**
 * A deck's character instead of its drop table.
 *
 * The contract takes `upTo[]` and `weight[]`, which is an honest way to describe
 * a deck and a terrible way to order one. Somebody who wants "rare but a big
 * prize" should not have to add up total weight and hold the break even limit in
 * their head.
 *
 * So there are three characters here, and each spends the deck's budget ITSELF.
 * The budget is not invented: `budgetFor` computes it exactly at the contract's
 * limit, and every shape below spends it in full, because otherwise the deck
 * would pay less than it could.
 */
export type ShapeKind = "steady" | "jackpot" | "collector";

/**
 * How much weight a deck is allowed to promise.
 *
 * Literally `_createDeck`'s limit: `totalWeight * 2 * 10000 <= size * (10000 -
 * vaultShareBps)`. Halving it, as this used to do, was only valid while the
 * vaults took nothing out of the commission. The moment the share became
 * non-zero, the form started offering tables of 100 weight where the chain
 * allows 90, and EVERY cut failed with TooManyShardSlots after spending gas and
 * a signature.
 *
 * So there is one number here and it comes from the chain rather than from a
 * memory of what it used to be.
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
    note: "one vault and nothing but TESA, and five of them make a ticket",
  },
];

/**
 * Compute a table for a character and a size.
 *
 * Returns null when the shape does not fit that size: better not to allow the
 * click than to let the contract refuse a transaction that cost gas.
 *
 * The smallest size per character is no longer written here as a number. It
 * depends on the vault share, which lives on chain and changes, so any number in
 * the code would drift out of agreement with the chain in silence. Instead the
 * page simply asks this function about every size it offers.
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
    const big = 2; // 25 weight each, five tickets
    const mid = 2; // 10 each, two tickets
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

/** How many of a deck's slots pay anything: the same "1 in N pays". */
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

/** Total weight, the number the contract checks against `budgetFor`. */
export function totalWeight(shape: Shape) {
  let prev = 0;
  let total = 0;
  shape.upTo.forEach((u, i) => {
    total += (u - prev) * shape.weight[i];
    prev = u;
  });
  return total;
}
