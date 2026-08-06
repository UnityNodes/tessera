import { createPublicClient, http, parseAbiItem } from "viem";
import { CHAIN, RPC_URL, DECK_ADDRESS, DECK_FROM_BLOCK } from "@/lib/chain";

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

const WINDOW = 1900n;

/**
 *
 */
const WINDOWS_PER_PASS = 40;

interface Open {
  player: `0x${string}`;
  deckId: number;
  index: number;
  handle: `0x${string}`;
  block: string;
  risk?: boolean;
}

const client = createPublicClient({
  chain: CHAIN,
  transport: http(RPC_URL, { batch: { wait: 16 }, retryCount: 3, retryDelay: 400 }),
});

let scanned = DECK_FROM_BLOCK - 1n;
const events: Open[] = [];
let inflight: Promise<void> | null = null;

async function catchUp() {
  const latest = await client.getBlockNumber();
  let from = scanned + 1n;

  for (let i = 0; i < WINDOWS_PER_PASS && from <= latest; i++) {
    const to = from + WINDOW - 1n > latest ? latest : from + WINDOW - 1n;
    const logs = await client.getLogs({
      address: DECK_ADDRESS,
      events: [CASE_OPENED, RISK_TAKEN],
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
      if (l.eventName !== "CaseOpened") continue;
      if (!l.args.player || !l.args.handle) continue;
      events.push({
        player: l.args.player,
        deckId: Number(l.args.deckId ?? 0),
        index: Number(l.args.index ?? 0),
        handle: l.args.handle,
        block: String(l.blockNumber ?? 0n),
        risk: risky.has(l.args.handle.toLowerCase()) || undefined,
      });
    }

    scanned = to;
    from = to + 1n;
  }
}

export async function GET() {
  try {
    inflight ??= catchUp().finally(() => {
      inflight = null;
    });
    await inflight;
  } catch {
  }

  return Response.json(
    { scanned: String(scanned), events },
    { headers: { "cache-control": "no-store" } },
  );
}

export const dynamic = "force-dynamic";
