"use client";

import { toHex } from "viem";
import { REVEAL_POLL_MS, REVEAL_TIMEOUT_MS } from "./chain";

/**
 * The Inco client.
 *
 * Warning: a cold SDK start takes 49 seconds, a warm one under a second. So the
 * initialization is kicked off in the background as soon as the page loads
 * rather than at the moment of the click. Otherwise the first open would look
 * like a freeze.
 */

type Zap = {
  attestedReveal: (handles: string[]) => Promise<RevealResult[]>;
};

interface RevealResult {
  handle: string;
  plaintext: { value: string | bigint };
  /** The SDK returns a signature as {0: byte, 1: byte, ...} rather than a Uint8Array. */
  covalidatorSignatures: Record<string, number>[];
}

let pending: Promise<Zap> | null = null;

/** Warm up. Call on page mount; the result is not needed. */
export function warmInco(): Promise<Zap> {
  if (!pending) {
    pending = import("@inco/lightning-js/lite").then(({ Lightning }) =>
      Lightning.baseSepoliaTestnet(),
    ) as Promise<Zap>;
  }
  return pending;
}

/** Whether it is warm yet, so the interface can honestly say "getting ready". */
let ready = false;
export const incoReady = () => ready;

/**
 * The warmup starts AFTER the page is on its feet.
 *
 * This line used to sit bare at module level, which meant the SDK started
 * downloading at the very moment the browser was fetching everything else. And
 * it weighs 214 KB compressed (780 uncompressed: ML-KEM, Keccak and effect); on
 * 3G that is four seconds of bandwidth taken from the catalogue a person wants
 * to see FIRST. Measured: the first deck appeared on screen after 5.7 seconds.
 *
 * Deferring it entirely is not an option, because a cold SDK start takes 49
 * seconds, which is why the warmup exists at all. But between "saw the
 * catalogue" and "revealed a card" lie a wallet connection and a signature, that
 * is, tens of seconds. There is time to spare if it starts right after the first
 * paint.
 *
 * The window check is separately mandatory: a file with "use client" still runs
 * on the server during SSR, and without it Node would pull the SDK on every page
 * render.
 */
function warmWhenIdle() {
  const go = () =>
    void warmInco()
      .then(() => {
        ready = true;
      })
      .catch(() => {});

  if (typeof window === "undefined") return;
  // We check the type rather than `"requestIdleCallback" in window`: in the DOM
  // typings that field is declared required, so `in` narrows the else branch to
  // never and the build fails on addEventListener. In reality Safari lacked it
  // until recently, and the fallback is genuinely needed.
  if (typeof window.requestIdleCallback === "function") {
    // The ceiling is mandatory: without it a permanently busy tab would never
    // warm up, and the first open would become that same forty nine second
    // freeze.
    window.requestIdleCallback(go, { timeout: 4000 });
  } else {
    window.addEventListener("load", () => window.setTimeout(go, 200), { once: true });
  }
}

warmWhenIdle();

/** A covalidator signature in the form the contract accepts. */
export function signatureToHex(sig: Record<string, number>): `0x${string}` {
  return toHex(Uint8Array.from(Object.values(sig)));
}

export interface Revealed {
  handle: string;
  value: number;
  signatures: `0x${string}`[];
}

/**
 * A revealed slot value will never change again, and the covalidator signatures
 * are verified by the contract without reference to time. So we cache forever,
 * and in localStorage rather than for the life of the tab: otherwise an
 * inventory of fifty tiles would push fifty handles through the covalidators
 * after every return and wait seconds for what it already knows.
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
 * Waits for the covalidators to process the handles and returns the decrypted
 * value together with the signatures.
 *
 * While a ciphertext is not ready a covalidator answers with "not found, it
 * might not have been processed yet", which is the normal course of events
 * rather than a failure, so we simply retry. Measured: 5.9 to 8.6 seconds, that
 * is 15 to 22 attempts.
 */
/**
 * How many reveals are in flight that a player is currently watching.
 *
 * There are two covalidators and the quorum is 2 of 2, so a batch of twenty
 * handles for the inventory noticeably slows down the single reveal a player is
 * waiting on right now. Measured: without priority, click to prize rose from 7-9
 * to 14.7 seconds. So background reveals give way.
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
 * How many handles go in one request to the covalidators.
 *
 * Six rather than all at once: on a batch of forty both nodes return 500, and
 * the drop feed sits empty while the event history is full.
 */
const REVEAL_CHUNK = 6;

/** How many batches are in flight at a time. */
const REVEAL_LANES = 3;

/**
 * Put what the server has already revealed into the cache.
 *
 * A slot value is public and immutable, so the source does not matter; what
 * matters is that the signatures are there, because without them the contract
 * will not accept the slot. So only complete records go in here.
 */
export function seedRevealed(rows: Revealed[]) {
  const fresh = rows.filter(
    (r) => r.handle && r.signatures?.length && !cache.has(r.handle.toLowerCase()),
  );
  if (fresh.length) remember(fresh);
}

/**
 * Drop the empty places.
 *
 * For those who read a result by handle rather than by position: the feed, the
 * pool, the inventory. A partial answer serves them better than waiting, and a
 * shift does not hurt them, but now that is visible in the code rather than
 * hidden inside revealHandles.
 */
export function present(rows: (Revealed | undefined)[]): Revealed[] {
  return rows.filter((r): r is Revealed => Boolean(r));
}

export async function revealHandles(
  handles: string[],
  opts: {
    signal?: AbortSignal;
    onAttempt?: (n: number, elapsedMs: number) => void;
    /** "background" yields to whatever the player is waiting on right now. */
    priority?: "foreground" | "background";
    /**
     * Called after every batch rather than at the end.
     *
     * Forty handles are revealed in batches of six, and every batch is seconds
     * of waiting on the covalidators. Without this the feed stayed silent for
     * two and a half minutes and then showed everything at once; with it the
     * first tiles appear as soon as the first batch lands.
     */
    onChunk?: (revealed: Revealed[]) => void;
    /**
     * Do not return a result until ALL requested handles are revealed.
     *
     * For the feed and the pool that is unnecessary, since a partial answer
     * serves them better than waiting. But whoever is waiting for one particular
     * slot (an open, the two cards of a battle) has to wait for that one.
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
  /** What is still missing. The next round asks only for that, not for everything. */
  let pending = missing;

  for (;;) {
    if (opts.signal?.aborted) throw new Error("aborted");
    attempt++;
    try {
      // We ask only for what we do not know yet, which is exactly why one fresh
      // handle does not queue behind fifty already revealed ones.
      //
      // And we ask in batches. A covalidator answers for a single handle (the
      // one a player is watching) and returns 500 for a batch of forty, which is
      // exactly why the drop feed sat empty while the event history was full. A
      // batch that fails does not take the rest with it: whatever was revealed
      // goes into the cache and is shown.
      const chunks: string[][] = [];
      for (let i = 0; i < pending.length; i += REVEAL_CHUNK) {
        chunks.push(pending.slice(i, i + REVEAL_CHUNK));
      }

      let revealed = 0;
      let lastErr: unknown;

      // Batches go three at a time. Sequentially the whole feed took two and a
      // half minutes to reveal: the covalidators return each batch in seconds,
      // and those seconds added up. Three is not greedy: a batch of forty they
      // will not carry, three of six they carry comfortably.
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
        // Once per lane rather than per batch: three setStates in a row would
        // mean three repaints instead of one.
        opts.onChunk?.(handles.map((h) => cache.get(h.toLowerCase())!).filter(Boolean));
      }
      if (revealed === 0 && lastErr) throw lastErr;

      // Positions are preserved whatever happens.
      //
      // There used to be a .filter(Boolean) here, and it was no small thing: if
      // the covalidator returned the second value but not the first, the second
      // slid into the first one's place. Anyone reading a result by position (a
      // single slot open, the two cards of a battle) got somebody else's value
      // with no way of knowing. In the arena that would have shown an opponent's
      // card as your own.
      const got = handles.map((h) => cache.get(h.toLowerCase()));
      if (got.every(Boolean)) return got;

      // A partial answer is not a covalidator error: it considers a 200 with
      // half the batch a success. Whoever waits for a specific slot collects the
      // rest; for the feed and the pool partial beats waiting.
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
