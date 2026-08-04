"use client";

import { useAccount, useReadContracts, useConfig } from "wagmi";
import { useCallback, useState } from "react";
import { simulateContract, writeContract, waitForTransactionReceipt } from "wagmi/actions";
import { parseAbi } from "viem";
import { MEGAPOT, txUrl } from "@/lib/chain";
import { explain, type Explained } from "@/lib/errors";

/**
 *
 *
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

  const reads = useReadContracts({
    contracts: [
      { ...jackpot, functionName: "userPoolTotal" },
      { ...jackpot, functionName: "lpPoolTotal" },
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

  const big = (i: number) => (reads.data?.[i]?.result as bigint | undefined) ?? 0n;
  const user = mine.data?.[0]?.result as readonly [bigint, bigint, boolean] | undefined;

  const endsAt = Number(big(2) + big(3)) * 1000;
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
    tickets: Number(user?.[0] ?? 0n) / 8500,
    winnings,
    hasWinnings: winnings > 0n,
    prizePool: big(0),
    liquidityPool: big(1),
    endsAt,
    stalled: endsAt > 0 && endsAt < Date.now(),
    lastWinner: reads.data?.[4]?.result as `0x${string}` | undefined,
    claim,
    withdraw,
    refetch: async () => {
      await Promise.all([reads.refetch(), mine.refetch()]);
    },
  };
}
