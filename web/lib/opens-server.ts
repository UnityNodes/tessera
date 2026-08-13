import fs from "node:fs";
import path from "node:path";
import { createPublicClient, parseAbiItem } from "viem";
import { CHAIN, chainTransport, DECK_ADDRESS, DECK_FROM_BLOCK } from "@/lib/chain";

/**
 *
 *
 *
 */

const CASE_OPENED = parseAbiItem(
  "event CaseOpened(address indexed player, uint32 indexed deckId, uint16 index, bytes32 handle, uint256 paid)",
);

const RISK_TAKEN = parseAbiItem(
  "event RiskTaken(address indexed player, uint32 indexed deckId, uint16 index, bytes32 handle, uint256 toVault)",
);

/**
 *
 */
const DECK_RESEALED = parseAbiItem(
  "event DeckResealed(uint32 indexed deckId, uint32 indexed cut, uint16 size, uint8 why)",
);

const WINDOW = 1900n;

/**
 *
 */
const WINDOWS_PER_PASS = 40;

interface Revealed {
  handle: string;
  value: number;
  signatures: `0x${string}`[];
}

interface Open {
  player: `0x${string}`;
  deckId: number;
  index: number;
  handle: `0x${string}`;
  block: string;
  risk?: boolean;
  cut?: number;
}

const client = createPublicClient({ chain: CHAIN, transport: chainTransport() });

let scanned = DECK_FROM_BLOCK - 1n;
const events: Open[] = [];
const cuts = new Map<number, number>();
let inflight: Promise<void> | null = null;

/**
 *
 *
 */
const revealed = new Map<string, Revealed>();
const REVEAL_CHUNK = 6;
const REVEAL_LANES = 3;
/**
 *
 *
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
 *
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
  } finally {
    revealing = false;
  }
}

/**
 *
 *
 */
const STORE = path.join(process.cwd(), ".data", "opens.json");
let restored = false;

function restore() {
  restored = true;
  try {
    const raw = JSON.parse(fs.readFileSync(STORE, "utf8"));
    if (raw.deck !== DECK_ADDRESS || raw.from !== String(DECK_FROM_BLOCK)) return;
    scanned = BigInt(raw.scanned);
    events.push(...raw.events);
    for (const [id, cut] of raw.cuts ?? []) cuts.set(Number(id), Number(cut));
    for (const r of raw.revealed ?? []) revealed.set(r.handle.toLowerCase(), r);
  } catch {
  }
}

let saveAt = 0;
function save() {
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
  }
}

async function catchUp() {
  const latest = await client.getBlockNumber();
  let from = scanned + 1n;

  for (let i = 0; i < WINDOWS_PER_PASS && from <= latest; i++) {
    const to = from + WINDOW - 1n > latest ? latest : from + WINDOW - 1n;
    const logs = await client.getLogs({
      address: DECK_ADDRESS,
      events: [CASE_OPENED, RISK_TAKEN, DECK_RESEALED],
      fromBlock: from,
      toBlock: to,
    });

    const risky = new Set<string>();
    for (const l of logs) {
      if (l.eventName === "RiskTaken" && l.args.handle) {
        risky.add(l.args.handle.toLowerCase());
      }
    }

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
 *
 */
export async function opensPayload() {
  if (!restored) restore();
  try {
    inflight ??= catchUp().finally(() => {
      inflight = null;
    });
    await inflight;
  } catch {
  }

  void revealSome();

  return { scanned: String(scanned), cuts: [...cuts], events, revealed: [...revealed.values()] };
}

/**
 *
 *
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
