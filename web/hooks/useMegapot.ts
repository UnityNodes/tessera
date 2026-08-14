"use client";

import { useAccount, useReadContracts, useConfig } from "wagmi";
import { useCallback, useEffect, useState } from "react";
import { simulateContract, writeContract, waitForTransactionReceipt } from "wagmi/actions";
import { parseAbi } from "viem";
import { MEGAPOT, txUrl } from "@/lib/chain";
import { explain, type Explained } from "@/lib/errors";

/**
 * Megapot through a player's eyes, without a trip to their site.
 *
 * Everything a person needs to know and do with their ticket is in the jackpot
 * itself: how many tickets they hold, what the pool is, when the drawing is,
 * whether there is anything to claim, and claiming it. So Tessera sends nobody
 * anywhere: buying, owning, checking and payout all live on one screen.
 *
 * Warning: on Base Sepolia the drawing is frozen. runJackpot() reverts even for
 * the owner, and the last round ended on 6 February. The ticket is real and
 * bought with a real transaction, but there is nothing there for it to play in.
 * The interface has to say so plainly rather than draw a countdown into the past.
 */
const JACKPOT_ABI = parseAbi([
  "function usersInfo(address) view returns (uint256 ticketsPurchasedTotalBps, uint256 winningsClaimable, bool active)",
  "function userPoolTotal() view returns (uint256)",
  "function lpPoolTotal() view returns (uint256)",
  "function lastJackpotEndTime() view returns (uint256)",
  "function roundDurationInSeconds() view returns (uint256)",
  "function lastWinnerAddress() view returns (address)",
  "function ticketPrice() view returns (uint256)",
  "function withdrawWinnings()",
]);

const jackpot = { address: MEGAPOT, abi: JACKPOT_ABI } as const;

export function useMegapot() {
  const { address } = useAccount();
  const config = useConfig();
  const [claim, setClaim] = useState<{
    phase: "idle" | "signing" | "confirming" | "done" | "failed";
    txUrl?: string;
    error?: Explained;
  }>({ phase: "idle" });

  // Two requests rather than one with a spread: a conditional element in the
  // array throws off wagmi's type inference for one single function.
  //
  // lpPoolTotal left here along with the line "liquidity behind it". The number
  // was read from the chain every fifteen seconds and answered no question a
  // player has: Megapot's liquidity pool is not what they measure their ticket
  // by, and no decision of theirs depends on it.
  const reads = useReadContracts({
    contracts: [
      { ...jackpot, functionName: "userPoolTotal" },
      { ...jackpot, functionName: "lastJackpotEndTime" },
      { ...jackpot, functionName: "roundDurationInSeconds" },
      { ...jackpot, functionName: "lastWinnerAddress" },
    ],
    query: { refetchInterval: 15_000 },
  });

  const mine = useReadContracts({
    contracts: address ? [{ ...jackpot, functionName: "usersInfo", args: [address] }] : [],
    query: { enabled: Boolean(address), refetchInterval: 15_000 },
  });

  // Time is state rather than a Date.now() sitting in the render.
  //
  // Reading the clock during a render makes it impure: the same markup gives a
  // different result depending on when React decided to repaint, and no repaint
  // is scheduled for the moment the deadline passes. State stepping every 20
  // seconds both schedules it and keeps the render pure. A second makes no
  // difference here: the flag flips once per round.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(t);
  }, []);

  const big = (i: number) => (reads.data?.[i]?.result as bigint | undefined) ?? 0n;
  const user = mine.data?.[0]?.result as readonly [bigint, bigint, boolean] | undefined;

  const endsAt = Number(big(1) + big(2)) * 1000;
  const winnings = user?.[1] ?? 0n;

  const withdraw = useCallback(async () => {
    if (!address) return;
    try {
      setClaim({ phase: "signing" });
      const sim = await simulateContract(config, {
        address: MEGAPOT,
        abi: JACKPOT_ABI,
        functionName: "withdrawWinnings",
        account: address,
      });
      const hash = await writeContract(config, sim.request);
      setClaim({ phase: "confirming", txUrl: txUrl(hash) });
      const rcpt = await waitForTransactionReceipt(config, { hash });
      if (rcpt.status !== "success") throw new Error("The transaction reverted on chain");
      setClaim({ phase: "done", txUrl: txUrl(hash) });
      await Promise.all([reads.refetch(), mine.refetch()]);
    } catch (err) {
      setClaim({ phase: "failed", error: explain(err) });
    }
  }, [address, config, reads, mine]);

  return {
    /// How many tickets are in hand. Megapot counts in bps: $1 gives 8500,
    /// because it takes 15% as a fee before crediting.
    tickets: Number(user?.[0] ?? 0n) / 8500,
    winnings,
    hasWinnings: winnings > 0n,
    /// The pool the ticket plays for.
    prizePool: big(0),
    endsAt,
    /// The drawing is overdue: on the testnet it is frozen forever.
    stalled: endsAt > 0 && endsAt < now,
    lastWinner: reads.data?.[3]?.result as `0x${string}` | undefined,
    claim,
    withdraw,
    refetch: async () => {
      await Promise.all([reads.refetch(), mine.refetch()]);
    },
  };
}
