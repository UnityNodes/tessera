"use client";

import { toHex } from "viem";
import { REVEAL_POLL_MS, REVEAL_TIMEOUT_MS } from "./chain";

/**
 *
 */

type Zap = {
  attestedReveal: (handles: string[]) => Promise<RevealResult[]>;
};

interface RevealResult {
  handle: string;
  plaintext: { value: string | bigint };
  covalidatorSignatures: Record<string, number>[];
}

let pending: Promise<Zap> | null = null;

export function warmInco(): Promise<Zap> {
  if (!pending) {
    pending = import("@inco/lightning-js/lite").then(({ Lightning }) =>
      Lightning.baseSepoliaTestnet(),
    ) as Promise<Zap>;
  }
  return pending;
}

let ready = false;
export const incoReady = () => ready;
void warmInco().then(() => {
  ready = true;
}).catch(() => {});

export function signatureToHex(sig: Record<string, number>): `0x${string}` {
  return toHex(Uint8Array.from(Object.values(sig)));
}

export interface Revealed {
  handle: string;
  value: number;
  signatures: `0x${string}`[];
}

/**
 */
const cache = new Map<string, Revealed>();

const STORE_KEY = "tessera.revealed.v1";

const store = () => (typeof window === "undefined" ? null : window.localStorage);

if (typeof window !== "undefined") {
  try {
    const saved = JSON.parse(store()?.getItem(STORE_KEY) ?? "{}");
    for (const [k, v] of Object.entries(saved)) cache.set(k, v as Revealed);
  } catch {}
}

function remember(items: Revealed[]) {
  for (const r of items) cache.set(r.handle.toLowerCase(), r);
  if (typeof window === "undefined") return;
  try {
    store()?.setItem(STORE_KEY, JSON.stringify(Object.fromEntries(cache)));
  } catch {}
}

/**
 *
 */
/**
 *
 */
let foreground = 0;
const idleWaiters: (() => void)[] = [];

function releaseIdle() {
  if (foreground === 0) {
    while (idleWaiters.length) idleWaiters.shift()!();
  }
}

async function waitForQuiet(signal?: AbortSignal) {
  if (foreground === 0) return;
  await new Promise<void>((resolve) => {
    idleWaiters.push(resolve);
    signal?.addEventListener("abort", () => resolve(), { once: true });
  });
}

export async function revealHandles(
  handles: string[],
  opts: {
    signal?: AbortSignal;
    onAttempt?: (n: number, elapsedMs: number) => void;
    priority?: "foreground" | "background";
  } = {},
): Promise<Revealed[]> {
  const missing = handles.filter((h) => !cache.has(h.toLowerCase()));
  if (missing.length === 0) {
    return handles.map((h) => cache.get(h.toLowerCase())!);
  }

  const background = opts.priority === "background";
  if (background) await waitForQuiet(opts.signal);
  else foreground++;

  try {
    return await pollUntilRevealed(missing, handles, opts);
  } finally {
    if (!background) {
      foreground--;
      releaseIdle();
    }
  }
}

async function pollUntilRevealed(
  missing: string[],
  handles: string[],
  opts: { signal?: AbortSignal; onAttempt?: (n: number, elapsedMs: number) => void },
): Promise<Revealed[]> {
  const zap = await warmInco();
  const started = Date.now();
  let attempt = 0;

  for (;;) {
    if (opts.signal?.aborted) throw new Error("aborted");
    attempt++;
    try {
      const res = await zap.attestedReveal(missing);
      remember(
        res.map((r) => ({
          handle: r.handle,
          value: Number(r.plaintext.value),
          signatures: r.covalidatorSignatures.map(signatureToHex),
        })),
      );
      return handles.map((h) => cache.get(h.toLowerCase())!).filter(Boolean);
    } catch (err) {
      const elapsed = Date.now() - started;
      opts.onAttempt?.(attempt, elapsed);
      if (elapsed > REVEAL_TIMEOUT_MS) throw err;
      await new Promise((r) => setTimeout(r, REVEAL_POLL_MS));
    }
  }
}
