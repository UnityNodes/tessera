import { createPublicClient } from "viem";
import { TESSERA_DECK_ABI } from "@/lib/abi";
import { CHAIN, chainTransport, DECK_ADDRESS, ONE_DOLLAR } from "@/lib/chain";

export type ServerGame = Awaited<ReturnType<typeof read>>;

/**
 *
 *
 *
 *
 */

const client = createPublicClient({ chain: CHAIN, transport: chainTransport() });

const deck = { address: DECK_ADDRESS, abi: TESSERA_DECK_ABI } as const;

/**
 *
 */
const TTL_MS = 8_000;

interface Cached {
  at: number;
  body: unknown;
}

let cache: Cached | null = null;
let inflight: Promise<unknown> | null = null;

async function read() {
  const [count, treasury, fees, adapter, unswept, vaultShareBps, maxBatch] = await Promise.all([
    client.readContract({ ...deck, functionName: "deckCount" }) as Promise<bigint>,
    client.readContract({ ...deck, functionName: "treasury" }) as Promise<bigint>,
    client.readContract({ ...deck, functionName: "feesClaimable" }) as Promise<bigint>,
    client.readContract({ ...deck, functionName: "adapter" }) as Promise<`0x${string}`>,
    client.readContract({ ...deck, functionName: "unsweptOpens" }) as Promise<bigint | number>,
    client.readContract({ ...deck, functionName: "vaultShareBps" }) as Promise<number>,
    client.readContract({ ...deck, functionName: "MAX_BATCH" }).catch(() => 1) as Promise<number>,
  ]);

  const n = Number(count);
  const ids = Array.from({ length: n }, (_, i) => i);

  const rows = await Promise.all(
    ids.map(async (id) => {
      const [d, tiers, cid] = await Promise.all([
        client.readContract({ ...deck, functionName: "deckAt", args: [id] }) as Promise<{
          size: number;
          drawn: number;
          vaultUpTo: number;
          vault: bigint;
          unsweptOpens: bigint;
          creator: `0x${string}`;
          creatorBps: number;
        }>,
        client.readContract({ ...deck, functionName: "tiers", args: [id] }) as Promise<
          readonly { upTo: number; weight: number }[]
        >,
        client.readContract({ ...deck, functionName: "deckMeta", args: [id] }) as Promise<string>,
      ]);
      return {
        id,
        size: Number(d.size),
        drawn: Number(d.drawn),
        vaultUpTo: Number(d.vaultUpTo),
        vault: d.vault.toString(),
        unsweptOpens: d.unsweptOpens.toString(),
        creator: d.creator,
        creatorBps: Number(d.creatorBps ?? 0),
        cid,
        tiers: tiers.map((t) => ({ upTo: Number(t.upTo), weight: Number(t.weight) })),
      };
    }),
  );

  const ticketPrice = (await client
    .readContract({
      address: adapter,
      abi: [
        {
          type: "function",
          name: "ticketPrice",
          inputs: [],
          outputs: [{ type: "uint256" }],
          stateMutability: "view",
        },
      ] as const,
      functionName: "ticketPrice",
    })
    .catch(() => ONE_DOLLAR)) as bigint;

  return {
    deck: DECK_ADDRESS,
    decks: rows,
    treasury: treasury.toString(),
    feesClaimable: fees.toString(),
    adapter,
    unsweptOpens: unswept.toString(),
    vaultShareBps: Number(vaultShareBps),
    maxBatch: Number(maxBatch),
    ticketPrice: ticketPrice.toString(),
  };
}


/**
 *
 */
export function gameNow(): unknown | null {
  const fresh = cache && Date.now() - cache.at < TTL_MS;
  if (!fresh) void refresh().catch(() => {});
  return cache ? cache.body : null;
}

export function refresh(): Promise<unknown> {
  inflight ??= read()
    .then((body) => {
      cache = { at: Date.now(), body };
      return body;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export async function gameFresh(): Promise<unknown> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.body;
  try {
    return await refresh();
  } catch (e) {
    if (cache) return cache.body;
    throw e;
  }
}
