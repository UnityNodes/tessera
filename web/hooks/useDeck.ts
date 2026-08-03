"use client";

import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { parseAbi } from "viem";
import { TESSERA_DECK_ABI } from "@/lib/abi";
import { DECK_ADDRESS, MEGAPOT, MEGAPOT_ABI, ONE_DOLLAR, TICKET_TOKEN, TOKEN_ABI } from "@/lib/chain";

const deck = { address: DECK_ADDRESS, abi: TESSERA_DECK_ABI } as const;

const ADAPTER_ABI = parseAbi(["function ticketPrice() view returns (uint256)"]);

/**
 *
 */
export function useDeck() {
  const { address } = useAccount();

  const chain = useReadContracts({
    contracts: [
      { ...deck, functionName: "size" },
      { ...deck, functionName: "drawn" },
      { ...deck, functionName: "season" },
      { ...deck, functionName: "treasury" },
      { ...deck, functionName: "feesClaimable" },
      { ...deck, functionName: "adapter" },
    ],
    query: { refetchInterval: 12_000 },
  });

  const adapter = chain.data?.[5]?.result as `0x${string}` | undefined;
  const season = Number((chain.data?.[2]?.result as number | undefined) ?? 0);

  const tierTable = useReadContract({
    address: DECK_ADDRESS,
    abi: TESSERA_DECK_ABI,
    functionName: "tiers",
    args: [season],
    query: { enabled: season > 0, staleTime: Infinity },
  });

  const price = useReadContract({
    address: adapter,
    abi: ADAPTER_ABI,
    functionName: "ticketPrice",
    query: { enabled: Boolean(adapter), refetchInterval: 60_000 },
  });

  const player = useReadContracts({
    contracts: address
      ? [
          { ...deck, functionName: "countOf", args: [address] },
          { address: TICKET_TOKEN, abi: TOKEN_ABI, functionName: "balanceOf", args: [address] },
          { address: TICKET_TOKEN, abi: TOKEN_ABI, functionName: "allowance", args: [address, DECK_ADDRESS] },
          { address: MEGAPOT, abi: MEGAPOT_ABI, functionName: "usersInfo", args: [address] },
        ]
      : [],
    query: { enabled: Boolean(address), refetchInterval: 12_000 },
  });

  const asNumber = (i: number) => Number((chain.data?.[i]?.result as bigint | number | undefined) ?? 0);
  const asBig = (i: number) => (chain.data?.[i]?.result as bigint | undefined) ?? 0n;

  const size = asNumber(0);
  const drawn = asNumber(1);
  const ticketPrice = (price.data as bigint | undefined) ?? ONE_DOLLAR;
  const allowance = (player.data?.[2]?.result as bigint | undefined) ?? 0n;
  const balance = (player.data?.[1]?.result as bigint | undefined) ?? 0n;
  const ticketsBps =
    (player.data?.[3]?.result as readonly [bigint, bigint, boolean] | undefined)?.[0] ?? 0n;

  return {
    size,
    drawn,
    remaining: size - drawn,
    season,
    tiers: ((tierTable.data as readonly { upTo: number; weight: number }[] | undefined) ?? []).map(
      (t) => ({ upTo: Number(t.upTo), weight: Number(t.weight) }),
    ),
    treasury: asBig(3),
    feesClaimable: asBig(4),
    adapter,
    ticketPrice,

    slotCount: Number((player.data?.[0]?.result as bigint | undefined) ?? 0n),
    balance,
    allowance,
    ticketsBps,
    tickets: Number(ticketsBps) / 8500,

    needsApproval: allowance < ticketPrice,
    canAfford: balance >= ticketPrice,
    deckEmpty: size > 0 && drawn >= size,

    isLoading: chain.isLoading || (Boolean(address) && player.isLoading),
    refetch: async () => {
      await Promise.all([chain.refetch(), player.refetch(), price.refetch(), tierTable.refetch()]);
    },
  };
}
