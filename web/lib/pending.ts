"use client";

/**
 *
 *
 */

const KEY = "tessera.pending.v1";

export interface PendingOpen {
  address: string;
  index: number;
  handle: `0x${string}`;
  txHash: `0x${string}`;
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
 *
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
