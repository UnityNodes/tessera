import { createPublicClient } from "viem";
import { TESSERA_DECK_ABI } from "@/lib/abi";
import { CHAIN, chainTransport, DECK_ADDRESS, ONE_DOLLAR } from "@/lib/chain";

export type ServerGame = Awaited<ReturnType<typeof read>>;

/**
 * Game state, read once by the server for everyone.
 *
 * The same reasoning as in `api/opens`, but about a different problem. The
 * browser read the history slowly because of its size; it read the deck state
 * slowly because of the CHAIN of calls: first `deckCount`, and only knowing that,
 * three calls per deck; first `adapter`, and only knowing that, the ticket price.
 * Every step waits for the previous one, and no amount of browser caching helps:
 * the first guest has no cache by definition.
 *
 * Measured on 3G with a slow CPU: the page frame appeared in 0.5 seconds and the
 * deck numbers at 12.4. So for twelve seconds a person stared at empty frames
 * and concluded the site was broken.
 *
 * The state, meanwhile, is the same for everyone: they are public fields of one
 * contract. So it is read here, in a single batch, and served ready made.
 *
 * What is deliberately NOT here is anything that depends on a wallet: balance,
 * allowance, slot count. None of that can be shared, so none of it belongs in a
 * shared cache.
 */

const client = createPublicClient({ chain: CHAIN, transport: chainTransport() });

const deck = { address: DECK_ADDRESS, abi: TESSERA_DECK_ABI } as const;

/**
 * How long an answer lives.
 *
 * The state changes only from opens, and an open is a transaction on chain: we
 * do not get them more often than once every few seconds, nor much less often.
 * Eight seconds is roughly two Base blocks: as fresh as makes any sense, and
 * enough to keep a crowd on the home page from becoming a crowd at the public
 * RPC.
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
    // The old logic does not have this constant. A silent one is more honest
    // here than failing the whole request: without it the page shows nothing,
    // with it everything except the multipliers.
    client.readContract({ ...deck, functionName: "MAX_BATCH" }).catch(() => 1) as Promise<number>,
  ]);

  const n = Number(count);
  const ids = Array.from({ length: n }, (_, i) => i);

  // Four reads per deck, but all together: the server can afford what the
  // browser could not, exactly one round instead of n sequential ones.
  const rows = await Promise.all(
    ids.map(async (id) => {
      const [d, tiers, cid, cut] = await Promise.all([
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
        // The deal number: a deck reshuffles itself, and everything computed
        // from the history of opens has to know which pool it is counting.
        client.readContract({ ...deck, functionName: "reseals", args: [id] }) as Promise<number>,
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
        cut: Number(cut ?? 0),
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
 * Ready state, or nothing.
 *
 * Called from the layout, which puts it in the path of EVERY page. So waiting
 * here is never acceptable: a cold chain read takes a second, and that second
 * would land in everyone's TTFB, including people who do not need this state.
 * Nothing fresh means we serve what we have, stale or not, kick off a refresh in
 * the background and leave the rest to the browser. The HTML never slows down
 * because of it.
 */
export function gameNow(): unknown | null {
  const fresh = cache && Date.now() - cache.at < TTL_MS;
  if (!fresh) void refresh().catch(() => {});
  return cache ? cache.body : null;
}

/** One read for everyone, however many guests arrive at once. */
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
