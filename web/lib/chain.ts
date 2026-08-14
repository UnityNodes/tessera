import { baseSepolia } from "viem/chains";
import { fallback, http, parseAbi } from "viem";

/**
 * Addresses. All of them checked with live calls rather than taken from
 * documentation.
 */
export const CHAIN = baseSepolia;

/**
 * The game. This is the PROXY address, and it does not change any more.
 *
 * Before it, every change of the rules was a new deploy, which means a new empty
 * game: decks, slots, vaults and unresolved battles all stayed in the old
 * contract. Here are seven such resets in a row:
 *   0x2381590C8b905796C3AE4448068ac1D915d9122E  last one without a proxy (block 45260039)
 *   0x7BD35cF4ddA6fd8f5c2C7Ca4337c3cA863c97887  before player decks (block 45072152)
 *   0x2385f78C5435C3Af439006B105fC14ac15BF6CbF  before the ticket forfeit (block 45056554)
 *   0x88ec2e5c454b89208f77a6Ae877CE3a1a3f0fAf3  one deck (block 45032469)
 *   0x282cf8C0a6160807D050609da9eb3B935670db4C  before battles (block 45028904)
 *   0x8beb7Ccb4Fc03ee618a610fc93B6e1491314E097  before the vault (block 45025589)
 *   0x773b44eDe2D5454336F98b1DBA3d0c2484cB6579  shards and weight (block 45025076)
 *   0xaD0E81de4A9aA1F86C5CD68e54fd3997a62b7BeD  before stakes (block 45005600)
 *   0x55FbDFA462e44955F715aF98A60e4ec4B6e71EEe  before weights at all
 *
 * Changing the rules is now `forge script script/Deploy.s.sol:Upgrade`: only the
 * implementation changes and the storage stays where it is. This line should
 * never need editing again, and that is the point. If it ever does, something
 * went wrong and the board was wiped once more.
 */
export const DECK_ADDRESS = (process.env.NEXT_PUBLIC_DECK_ADDRESS ??
  "0x985520De2A14BD443d06DcA07A57Ef4F349bd8B1") as `0x${string}`;

/** Megapot's test USDC. mint() is open to everyone and the money is free. */
export const TICKET_TOKEN = "0xA4253E7C13525287C56550b8708100f93E60509f" as const;

export const MEGAPOT = "0x6f03c7BCaDAdBf5E6F5900DA3d56AdD8FbDac5De" as const;

/**
 * Where to reach the chain, and where to go when the first one does not answer.
 *
 * One public RPC for everything is not "free", it is borrowed. Measured twice in
 * a single day: the screen audit failed on five vault numbers, and in that same
 * run the console held 429s from `sepolia.base.org` and 503s from our own
 * `/api/game`, because the server could not read the chain and had nothing to
 * serve. Ten minutes later the same 103 checks passed cleanly, because the limit
 * had let go. So the code was right both times, and what failed was something we
 * do not own.
 *
 * The limit, meanwhile, is counted PER ENDPOINT. Which means the cure is not
 * pacing but having more than one endpoint: `fallback` tries them in turn and
 * moves on when the previous one returns an error.
 *
 * The order is neither random nor by seniority. First comes our own, if one is
 * configured: a dedicated endpoint does not have this problem at all, and the
 * rest below it will never be needed. Then the public ones, each checked on
 * exactly what we need: `eth_call`, a wide `eth_getLogs`, and the header
 * `access-control-allow-origin: *`, without which a browser will not go there
 * at all.
 *
 * The official `sepolia.base.org` is LAST, and that is measured rather than
 * disrespectful. It is the one that returns 429, and a 429 arrives without CORS
 * headers, so the browser sees not "wait" but an access error and prints it in
 * red. The page does not break; fallback simply moves on.
 *
 * What the reordering actually buys, without embellishment. Four screen audit
 * runs measured: 103 of 103 and ZERO 4xx/5xx responses in every one, with 0 to 3
 * red console lines regardless of order. So it does not "remove errors", it
 * reduces how often the queue reaches the one endpoint that produces them. The
 * rest is the load of the audit itself: six pages at six widths in a row, which
 * no single guest does.
 *
 * There is exactly one way to remove them for good: our own endpoint in
 * NEXT_PUBLIC_RPC_URL. It becomes first, and the queue never reaches the public
 * ones.
 *
 * dRPC sits ahead of base.org despite capping `eth_getLogs` at ten thousand
 * blocks on the free tier: that is plenty for us, since the feed reads in
 * windows of 1900.
 */
export const RPC_URLS: string[] = [
  ...new Set(
    [
      process.env.NEXT_PUBLIC_RPC_URL,
      "https://base-sepolia-rpc.publicnode.com",
      "https://base-sepolia.gateway.tenderly.co",
      "https://base-sepolia.drpc.org",
      "https://sepolia.base.org",
    ].filter((u): u is string => Boolean(u)),
  ),
];

/**
 * The transport, ready to use: every endpoint, in turn.
 *
 * batch: several simultaneous calls travel in one HTTP request. Hooks wake on
 * their own timers and almost always land in the same tick (deck, pool, feed,
 * Megapot, battles) and each call used to go as its own POST. wagmi's contract
 * reads already gather through Multicall3; batch takes care of the rest:
 * blockNumber, getLogs, balances.
 *
 * retry: a 429 means "wait", not "it failed". Three attempts with a growing
 * pause absorb a spike. Only when even those do not help does `fallback` move to
 * the next endpoint, so we give up only when all of them are silent.
 */
export const chainTransport = () =>
  fallback(
    RPC_URLS.map((url) => http(url, { batch: { wait: 16 }, retryCount: 3, retryDelay: 400 })),
    // rank: false, because the order is ours rather than measured. Ranking
    // measures latency with live requests, which is precisely what we are
    // trying not to do more often than necessary.
    { rank: false },
  );

export const EXPLORER = "https://sepolia.basescan.org";

/**
 * The block the deck first appeared in.
 *
 * The public RPC will not read logs from block zero and does not keep event
 * filters, so both the pool counter and the open feed have to know where to
 * start. Update it together with DECK_ADDRESS.
 */
export const DECK_FROM_BLOCK = BigInt(process.env.NEXT_PUBLIC_DECK_FROM_BLOCK ?? "45283259");

export const txUrl = (hash: string) => `${EXPLORER}/tx/${hash}`;
export const addressUrl = (a: string) => `${EXPLORER}/address/${a}`;

/**
 * ERC-20 in exactly the amount we need, plus the open mint of the test token.
 * On mainnet the mint disappears, because there the dollar is real.
 */
export const TOKEN_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function mint(address to, uint256 amount)",
]);

/** How many tickets (in bps) Megapot itself has recorded for a player. */
export const MEGAPOT_ABI = parseAbi([
  "function usersInfo(address) view returns (uint256 ticketsPurchasedTotalBps, uint256 winningsClaimable, bool active)",
]);

/** $1 in six decimals. The real price is read from the contract; this is a fallback. */
export const ONE_DOLLAR = 1_000_000n;

/**
 * Measured covalidator wait: 5.9 to 8.6 seconds.
 * We give up only after 60, which never happens, but if a covalidator has gone
 * down the player deserves an explanation rather than an eternal spinner.
 */
export const REVEAL_TIMEOUT_MS = 60_000;
export const REVEAL_POLL_MS = 400;
