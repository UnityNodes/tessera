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

/**
 *
 *
 *
 */
function warmWhenIdle() {
  const go = () =>
    void warmInco()
      .then(() => {
        ready = true;
      })
      .catch(() => {});

  if (typeof window === "undefined") return;
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(go, { timeout: 4000 });
  } else {
    window.addEventListener("load", () => window.setTimeout(go, 200), { once: true });
  }
}

warmWhenIdle();

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

/**
 *
 */
const REVEAL_CHUNK = 6;

const REVEAL_LANES = 3;

/**
 *
 */
export function seedRevealed(rows: Revealed[]) {
  const fresh = rows.filter(
    (r) => r.handle && r.signatures?.length && !cache.has(r.handle.toLowerCase()),
  );
  if (fresh.length) remember(fresh);
}

/**
 *
 */
export function present(rows: (Revealed | undefined)[]): Revealed[] {
  return rows.filter((r): r is Revealed => Boolean(r));
}

export async function revealHandles(
  handles: string[],
  opts: {
    signal?: AbortSignal;
    onAttempt?: (n: number, elapsedMs: number) => void;
    priority?: "foreground" | "background";
    /**
     *
     */
    onChunk?: (revealed: Revealed[]) => void;
    /**
     *
     */
    waitForAll?: boolean;
  } = {},
): Promise<(Revealed | undefined)[]> {
  const missing = handles.filter((h) => !cache.has(h.toLowerCase()));
  if (missing.length === 0) {
    return handles.map((h) => cache.get(h.toLowerCase()));
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
  opts: {
    signal?: AbortSignal;
    onAttempt?: (n: number, elapsedMs: number) => void;
    onChunk?: (revealed: Revealed[]) => void;
    waitForAll?: boolean;
  },
): Promise<(Revealed | undefined)[]> {
  const zap = await warmInco();
  const started = Date.now();
  let attempt = 0;
  let pending = missing;

  for (;;) {
    if (opts.signal?.aborted) throw new Error("aborted");
    attempt++;
    try {
      //
      const chunks: string[][] = [];
      for (let i = 0; i < pending.length; i += REVEAL_CHUNK) {
        chunks.push(pending.slice(i, i + REVEAL_CHUNK));
      }

      let revealed = 0;
      let lastErr: unknown;

      for (let i = 0; i < chunks.length; i += REVEAL_LANES) {
        if (opts.signal?.aborted) throw new Error("aborted");
        const lane = chunks.slice(i, i + REVEAL_LANES);
        const results = await Promise.allSettled(
          lane.map((chunk) => zap.attestedReveal(chunk)),
        );
        for (const r of results) {
          if (r.status === "rejected") {
            lastErr = r.reason;
            continue;
          }
          remember(
            r.value.map((x) => ({
              handle: x.handle,
              value: Number(x.plaintext.value),
              signatures: x.covalidatorSignatures.map(signatureToHex),
            })),
          );
          revealed += r.value.length;
        }
        opts.onChunk?.(handles.map((h) => cache.get(h.toLowerCase())!).filter(Boolean));
      }
      if (revealed === 0 && lastErr) throw lastErr;

      //
      const got = handles.map((h) => cache.get(h.toLowerCase()));
      if (got.every(Boolean)) return got;

      if (!opts.waitForAll) return got;
      if (Date.now() - started > REVEAL_TIMEOUT_MS) return got;
      pending = handles.filter((h) => !cache.has(h.toLowerCase()));
      opts.onAttempt?.(attempt, Date.now() - started);
      await new Promise((r) => setTimeout(r, REVEAL_POLL_MS));
      continue;
    } catch (err) {
      const elapsed = Date.now() - started;
      opts.onAttempt?.(attempt, elapsed);
      if (elapsed > REVEAL_TIMEOUT_MS) throw err;
      await new Promise((r) => setTimeout(r, REVEAL_POLL_MS));
    }
  }
}
