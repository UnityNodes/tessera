"use client";

/**
 * An open that has started but whose result the player has not seen yet.
 *
 * The transaction goes through in a second, and the covalidators take another
 * six to eight to return the value. Eight seconds is plenty of time to switch
 * tabs, minimise the browser or lose the network. The slot is already drawn and
 * paid for by then, so the prize will not become somebody else's; the problem is
 * purely that the player will not see it.
 *
 * So the intent is written to localStorage as soon as the transaction confirms,
 * and cleared only once the player has seen the result.
 */

const KEY = "tessera.pending.v1";

export interface PendingOpen {
  address: string;
  index: number;
  handle: `0x${string}`;
  txHash: `0x${string}`;
  /** When the transaction confirmed. A timestamp, not a timer. */
  at: number;
}

function read(): PendingOpen | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PendingOpen) : null;
  } catch {
    return null;
  }
}

export function rememberPending(p: PendingOpen) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {}
}

export function forgetPending() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

/**
 * This wallet's unfinished open.
 *
 * Anything older than a day is discarded: the slot stays in the inventory
 * anyway, and greeting someone with a result they saw yesterday is no longer
 * "let us carry on where we left off", it is just confusing.
 */
export function pendingFor(address?: string): PendingOpen | null {
  const p = read();
  if (!p || !address) return null;
  if (p.address.toLowerCase() !== address.toLowerCase()) return null;
  if (Date.now() - p.at > 24 * 60 * 60 * 1000) {
    forgetPending();
    return null;
  }
  return p;
}
