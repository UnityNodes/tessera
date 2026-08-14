import fs from "node:fs";
import path from "node:path";
import { createPublicClient, parseAbiItem } from "viem";
import { CHAIN, chainTransport, DECK_ADDRESS, DECK_FROM_BLOCK } from "@/lib/chain";

/**
 * The history of opens, read once by the server for everyone.
 *
 * Every browser used to read it for itself: the deck began 60 thousand blocks
 * ago, the public RPC will not return a range wider than two thousand, so a new
 * visitor made three dozen getLogs requests before seeing the feed. A cache in
 * localStorage then saved that one person, but the next guest started from
 * scratch, and the older the season the longer that queue. Within a month it
 * would be three hundred requests for everyone who opened the site.
 *
 * The history, meanwhile, is the same for everyone: they are public events of
 * one contract. So it is read here, one pass per process and only the tail after
 * that.
 *
 * The cache lives in the process memory. It does not need to survive a restart:
 * after one, the first request simply collects the history again, and that is
 * the single slow request in the server's lifetime.
 */

const CASE_OPENED = parseAbiItem(
  "event CaseOpened(address indexed player, uint32 indexed deckId, uint16 index, bytes32 handle, uint256 paid)",
);

const RISK_TAKEN = parseAbiItem(
  "event RiskTaken(address indexed player, uint32 indexed deckId, uint16 index, bytes32 handle, uint256 toVault)",
);

/**
 * The deck was reshuffled.
 *
 * Without this event the pool counter would count across ALL deals at once: a
 * fresh deck would look empty, because old opens do not leave the history. So
 * every open here is given the number of the deal it belongs to, and a deck page
 * takes only its own.
 */
const DECK_RESEALED = parseAbiItem(
  "event DeckResealed(uint32 indexed deckId, uint32 indexed cut, uint16 size, uint8 why)",
);

/** The public RPC's limit is 2000 blocks. We take exactly that. */
const WINDOW = 1900n;

/**
 * How many windows per request.
 *
 * We can allow more here than the browser could: nobody is staring at an empty
 * screen while the server collects. But not without a limit, or the very first
 * request after a restart would take a minute.
 */
const WINDOWS_PER_PASS = 40;

interface Revealed {
  handle: string;
  value: number;
  /** Covalidator signatures. The contract accepts a slot only with them. */
  signatures: `0x${string}`[];
}

interface Open {
  player: `0x${string}`;
  deckId: number;
  index: number;
  handle: `0x${string}`;
  block: string;
  risk?: boolean;
  /** The deck's deal number. Zero is the first, before any reshuffle. */
  cut?: number;
}

const client = createPublicClient({ chain: CHAIN, transport: chainTransport() });

let scanned = DECK_FROM_BLOCK - 1n;
const events: Open[] = [];
/** The current deal of each deck, tracked by the pass over the logs itself. */
const cuts = new Map<number, number>();
/** One pass at a time: parallel requests would collect the same history. */
let inflight: Promise<void> | null = null;

/**
 * Revealed slot values, also read once for everyone.
 *
 * The values are public: the covalidators hand them to anyone who names a
 * handle. Every browser used to ask for them itself, and on a first visit the
 * feed stayed silent for a minute while the SDK warmed up and the batches went
 * one after another. The server does it once, and a guest gets the result ready
 * made along with the history.
 *
 * A revealed value will never change, so the cache has no expiry.
 */
const revealed = new Map<string, Revealed>();
/** Handles per request: at forty the covalidators return 500. */
const REVEAL_CHUNK = 6;
/** Batches in flight: sequentially the whole feed takes minutes. */
const REVEAL_LANES = 3;
/**
 * How many events we keep revealed.
 *
 * It started at sixty, on the grounds that "the feed needs no more". But the
 * pool counter on a deck page counts ALL of that deck's opens, and for every
 * unrevealed one the browser went to the covalidators itself. Measured: 71 calls
 * to Inco contracts per minute on a page that is merely open.
 *
 * We keep all of them, with a ceiling: a revealed value will not change again,
 * it weighs two hundred bytes, and a season is finite.
 */
const REVEAL_WINDOW = 2000;
let revealing = false;

type Zap = {
  attestedReveal: (h: string[]) => Promise<
    {
      handle: string;
      plaintext: { value: string | bigint };
      covalidatorSignatures: Record<string, number>[];
    }[]
  >;
};
let zap: Promise<Zap> | null = null;

const sigToHex = (sig: Record<string, number>): `0x${string}` =>
  `0x${Object.values(sig)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;

/**
 * Collects values in the background and holds nobody up.
 *
 * A request for the history must not wait on the covalidators: they answer in
 * seconds and the history is needed at once. So revealing runs alongside and a
 * guest gets whatever is ready; the next poll ten seconds later brings the rest.
 */
async function revealSome() {
  if (revealing) return;
  const missing = events
    .slice(-REVEAL_WINDOW)
    .map((e) => e.handle)
    .filter((h) => !revealed.has(h.toLowerCase()))
    .reverse();
  if (missing.length === 0) return;

  revealing = true;
  try {
    zap ??= import("@inco/lightning-js/lite").then(({ Lightning }) =>
      Lightning.baseSepoliaTestnet(),
    ) as Promise<Zap>;
    const client = await zap;

    const chunks: string[][] = [];
    for (let i = 0; i < missing.length; i += REVEAL_CHUNK) {
      chunks.push(missing.slice(i, i + REVEAL_CHUNK));
    }
    for (let i = 0; i < chunks.length; i += REVEAL_LANES) {
      const lane = chunks.slice(i, i + REVEAL_LANES);
      const res = await Promise.allSettled(lane.map((c) => client.attestedReveal(c)));
      for (const r of res) {
        if (r.status !== "fulfilled") continue;
        for (const x of r.value) {
          revealed.set(x.handle.toLowerCase(), {
            handle: x.handle,
            value: Number(x.plaintext.value),
            signatures: x.covalidatorSignatures.map(sigToHex),
          });
        }
      }
    }
    save();
  } catch {
    // The covalidator is silent, so we try next time. A feed with some of the
    // values is more useful than an empty one.
  } finally {
    revealing = false;
  }
}

/**
 * The cache survives a restart.
 *
 * It used to live only in the process memory, and every deploy wiped it: the
 * server collected the history quickly, but revealing the values took three
 * minutes, and for all three the drop feed was empty for newcomers. A deploy
 * should cost players nothing.
 *
 * A file rather than a database: this is a cache of public, immutable data. If
 * it disappears the server collects it again, as it always did.
 */
const STORE = path.join(process.cwd(), ".data", "opens.json");
let restored = false;

function restore() {
  restored = true;
  try {
    const raw = JSON.parse(fs.readFileSync(STORE, "utf8"));
    // Tied to the deck and the starting block: if either changed this is the
    // history of a different season and must not be used.
    if (raw.deck !== DECK_ADDRESS || raw.from !== String(DECK_FROM_BLOCK)) return;
    scanned = BigInt(raw.scanned);
    events.push(...raw.events);
    for (const [id, cut] of raw.cuts ?? []) cuts.set(Number(id), Number(cut));
    for (const r of raw.revealed ?? []) revealed.set(r.handle.toLowerCase(), r);
  } catch {
    // The file does not exist yet or is corrupt, so we start from scratch.
    // That is not an error.
  }
}

let saveAt = 0;
function save() {
  // No more than once every five seconds: revealing happens in batches, and
  // writing to disk after each one makes no sense.
  if (Date.now() - saveAt < 5_000) return;
  saveAt = Date.now();
  try {
    fs.mkdirSync(path.dirname(STORE), { recursive: true });
    fs.writeFileSync(
      STORE,
      JSON.stringify({
        deck: DECK_ADDRESS,
        from: String(DECK_FROM_BLOCK),
        scanned: String(scanned),
        cuts: [...cuts],
        events,
        revealed: [...revealed.values()],
      }),
    );
  } catch {
    // The disk will not write, and that is no disaster: the cache speeds things
    // up but governs nothing.
  }
}

async function catchUp() {
  const latest = await client.getBlockNumber();
  let from = scanned + 1n;

  for (let i = 0; i < WINDOWS_PER_PASS && from <= latest; i++) {
    const to = from + WINDOW - 1n > latest ? latest : from + WINDOW - 1n;
    // Both events in one request: a separate getLogs for RiskTaken would double
    // the load on the same public RPC.
    const logs = await client.getLogs({
      address: DECK_ADDRESS,
      events: [CASE_OPENED, RISK_TAKEN, DECK_RESEALED],
      fromBlock: from,
      toBlock: to,
    });

    // The flags are gathered in a first pass: RiskTaken sits in the logs AFTER
    // its own CaseOpened, so a single pass would not get the flag in place in
    // time.
    const risky = new Set<string>();
    for (const l of logs) {
      if (l.eventName === "RiskTaken" && l.args.handle) {
        risky.add(l.args.handle.toLowerCase());
      }
    }

    // The deal number is tracked by the pass itself, in log order. The order
    // works for us here: a deck reshuffles INSIDE the transaction of whoever
    // came next, so DeckResealed sits before that player's own CaseOpened, and
    // that open correctly belongs to the new deal.
    for (const l of logs) {
      if (l.eventName === "DeckResealed") {
        cuts.set(Number(l.args.deckId ?? 0), Number(l.args.cut ?? 0));
        continue;
      }
      if (l.eventName !== "CaseOpened") continue;
      if (!l.args.player || !l.args.handle) continue;
      const deckId = Number(l.args.deckId ?? 0);
      events.push({
        player: l.args.player,
        deckId,
        index: Number(l.args.index ?? 0),
        handle: l.args.handle,
        block: String(l.blockNumber ?? 0n),
        risk: risky.has(l.args.handle.toLowerCase()) || undefined,
        cut: cuts.get(deckId) || undefined,
      });
    }

    scanned = to;
    from = to + 1n;
  }
  save();
}

/**
 * What is handed to the browser: the history plus the values already revealed.
 *
 * Moved out of the route along with all the state, because the page's server
 * render now uses this same cache. Two caches would drift apart, and the feed in
 * the markup would show one thing while the first refresh showed another.
 */
export async function opensPayload() {
  if (!restored) restore();
  try {
    inflight ??= catchUp().finally(() => {
      inflight = null;
    });
    await inflight;
  } catch {
    // The RPC refused, so we serve what we already have. A feed a few blocks
    // behind is more honest than an empty one.
  }

  // Revealing runs alongside and holds nobody up.
  void revealSome();

  return { scanned: String(scanned), cuts: [...cuts], events, revealed: [...revealed.values()] };
}

/**
 * The latest drops for the feed: ready, without waiting and without signatures.
 *
 * Called from the layout, which puts it in the path of every page, so waiting
 * here is never acceptable: collecting the history takes seconds and they would
 * land in everyone's TTFB. Nothing there means we return null and the feed is
 * drawn in the browser, as it always was.
 *
 * The signatures are deliberately withheld. They are needed only by someone
 * SPENDING their own slot, and the feed shows other people's; across forty four
 * events they weigh twice as much as everything else combined.
 */
export function feedNow(limit = 44) {
  if (!restored) restore();
  if (!events.length) return null;
  const recent = events.slice(-limit);
  return recent.map((e) => ({
    player: e.player,
    deckId: e.deckId,
    index: e.index,
    handle: e.handle,
    block: e.block,
    risk: e.risk,
    value: revealed.get(e.handle.toLowerCase())?.value,
  }));
}
