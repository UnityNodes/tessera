import { baseSepolia } from "viem/chains";
import { parseAbi } from "viem";

/**
 */
export const CHAIN = baseSepolia;

/**
 *
 */
export const DECK_ADDRESS = (process.env.NEXT_PUBLIC_DECK_ADDRESS ??
  "0x2381590C8b905796C3AE4448068ac1D915d9122E") as `0x${string}`;

export const TICKET_TOKEN = "0xA4253E7C13525287C56550b8708100f93E60509f" as const;

export const MEGAPOT = "0x6f03c7BCaDAdBf5E6F5900DA3d56AdD8FbDac5De" as const;

export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? "https://sepolia.base.org";

export const EXPLORER = "https://sepolia.basescan.org";

/**
 *
 */
export const DECK_FROM_BLOCK = BigInt(process.env.NEXT_PUBLIC_DECK_FROM_BLOCK ?? "45260039");

export const txUrl = (hash: string) => `${EXPLORER}/tx/${hash}`;
export const addressUrl = (a: string) => `${EXPLORER}/address/${a}`;

/**
 */
export const TOKEN_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function mint(address to, uint256 amount)",
]);

export const MEGAPOT_ABI = parseAbi([
  "function usersInfo(address) view returns (uint256 ticketsPurchasedTotalBps, uint256 winningsClaimable, bool active)",
]);

export const ONE_DOLLAR = 1_000_000n;

/**
 */
export const REVEAL_TIMEOUT_MS = 60_000;
export const REVEAL_POLL_MS = 400;
