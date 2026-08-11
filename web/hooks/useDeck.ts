"use client";

import { useContext, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { GameSeed } from "@/app/providers";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { parseAbi, type ContractFunctionParameters } from "viem";
import { TESSERA_DECK_ABI } from "@/lib/abi";
import { DECK_ADDRESS, MEGAPOT, MEGAPOT_ABI, ONE_DOLLAR, TICKET_TOKEN, TOKEN_ABI } from "@/lib/chain";
import type { DeckShape } from "@/lib/deck";

const deck = { address: DECK_ADDRESS, abi: TESSERA_DECK_ABI } as const;

const ADAPTER_ABI = parseAbi(["function ticketPrice() view returns (uint256)"]);

export interface DeckInfo extends DeckShape {
  id: number;
  drawn: number;
  remaining: number;
  vaultBanked: bigint;
  vault: bigint;
  empty: boolean;
  creator: `0x${string}` | undefined;
  creatorBps: number;
  cid: string;
}

/**
 *
 *
 */
/**
 *
 *
 */
interface ServerDeck {
  id: number;
  size: number;
  drawn: number;
  vaultUpTo: number;
  vault: string;
  unsweptOpens: string;
  creator: `0x${string}`;
  creatorBps: number;
  cid: string;
  tiers: { upTo: number; weight: number }[];
}

interface ServerGame {
  decks: ServerDeck[];
  treasury: string;
  feesClaimable: string;
  adapter: `0x${string}`;
  unsweptOpens: string;
  vaultShareBps: number;
  maxBatch: number;
  ticketPrice: string;
}

function useServerGame() {
  const seeded = useContext(GameSeed) as ServerGame | null;
  return useQuery<ServerGame>({
    initialData: seeded ?? undefined,
    queryKey: ["game", DECK_ADDRESS],
    queryFn: async () => {
      const r = await fetch("/api/game");
      if (!r.ok) throw new Error("game unavailable");
      return (await r.json()) as ServerGame;
    },
    refetchInterval: 30_000,
    staleTime: 8_000,
  });
}

export function useDeck() {
  const { address } = useAccount();
  const server = useServerGame();

  const head = useReadContracts({
    contracts: [
      { ...deck, functionName: "deckCount" },
      { ...deck, functionName: "treasury" },
      { ...deck, functionName: "feesClaimable" },
      { ...deck, functionName: "adapter" },
      { ...deck, functionName: "unsweptOpens" },
      { ...deck, functionName: "vaultShareBps" },
      //
      { ...deck, functionName: "MAX_BATCH" },
    ],
    query: { refetchInterval: 12_000 },
  });

  const seed = server.data;
  const count = Number(
    (head.data?.[0]?.result as bigint | undefined) ?? BigInt(seed?.decks.length ?? 0),
  );
  //
  const vaultShareBps = BigInt(
    (head.data?.[5]?.result as bigint | number | undefined) ?? seed?.vaultShareBps ?? 5000,
  );
  const adapter = (head.data?.[3]?.result as `0x${string}` | undefined) ?? seed?.adapter;
  const ids = useMemo(() => Array.from({ length: count }, (_, i) => i), [count]);

  const maxBatch = Number((head.data?.[6]?.result as number | undefined) ?? seed?.maxBatch ?? 1);

  const rows = useReadContracts({
    contracts: ids.flatMap(
      (id) =>
        [
          { ...deck, functionName: "deckAt", args: [id] },
          { ...deck, functionName: "tiers", args: [id] },
          { ...deck, functionName: "deckMeta", args: [id] },
        ] as ContractFunctionParameters[],
    ),
    query: { enabled: count > 0, refetchInterval: 12_000 },
  });

  const claimable =
    (head.data?.[2]?.result as bigint | undefined) ?? BigInt(seed?.feesClaimable ?? 0);
  const unswept = BigInt(
    (head.data?.[4]?.result as bigint | number | undefined) ?? seed?.unsweptOpens ?? 0,
  );

  const decks = useMemo<DeckInfo[]>(() => {
    return ids
      .map((id) => {
        const STRIDE = 3;
        const d = rows.data?.[id * STRIDE]?.result as
          | {
              size: number;
              drawn: number;
              vaultUpTo: number;
              vault: bigint;
              unsweptOpens: bigint;
              creator: `0x${string}`;
              creatorBps: number;
            }
          | undefined;
        const t = rows.data?.[id * STRIDE + 1]?.result as
          | readonly { upTo: number; weight: number }[]
          | undefined;
        const cid = (rows.data?.[id * STRIDE + 2]?.result as string | undefined) ?? "";
        const from = seed?.decks.find((x) => x.id === id);
        if (!d && from) {
          return {
            id,
            size: from.size,
            drawn: from.drawn,
            remaining: from.size - from.drawn,
            vaultUpTo: from.vaultUpTo,
            vaultBanked: BigInt(from.vault),
            vault: BigInt(from.vault),
            empty: from.size > 0 && from.drawn >= from.size,
            creator:
              from.creator && from.creator !== "0x0000000000000000000000000000000000000000"
                ? from.creator
                : undefined,
            creatorBps: from.creatorBps,
            cid: from.cid,
            tiers: from.tiers,
          };
        }
        if (!d) return null;

        const size = Number(d.size);
        const drawn = Number(d.drawn);

        const coming =
          d.vaultUpTo > 0 && unswept > 0n
            ? (((claimable * vaultShareBps) / 10_000n) * BigInt(d.unsweptOpens)) / unswept
            : 0n;

        return {
          id,
          size,
          drawn,
          remaining: size - drawn,
          vaultUpTo: Number(d.vaultUpTo),
          vaultBanked: d.vault,
          vault: d.vault + coming,
          empty: size > 0 && drawn >= size,
          creator:
            d.creator && d.creator !== "0x0000000000000000000000000000000000000000"
              ? d.creator
              : undefined,
          creatorBps: Number(d.creatorBps ?? 0),
          cid,
          tiers: (t ?? []).map((x) => ({ upTo: Number(x.upTo), weight: Number(x.weight) })),
        };
      })
      .filter((d): d is DeckInfo => d !== null);
  }, [ids, rows.data, claimable, unswept, vaultShareBps, seed]);

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
          {
            address: TICKET_TOKEN,
            abi: TOKEN_ABI,
            functionName: "allowance",
            args: [address, DECK_ADDRESS],
          },
          { address: MEGAPOT, abi: MEGAPOT_ABI, functionName: "usersInfo", args: [address] },
        ]
      : [],
    query: { enabled: Boolean(address), refetchInterval: 12_000 },
  });

  const ticketPrice =
    (price.data as bigint | undefined) ?? (seed ? BigInt(seed.ticketPrice) : ONE_DOLLAR);
  const allowance = (player.data?.[2]?.result as bigint | undefined) ?? 0n;
  const balance = (player.data?.[1]?.result as bigint | undefined) ?? 0n;
  const ticketsBps =
    (player.data?.[3]?.result as readonly [bigint, bigint, boolean] | undefined)?.[0] ?? 0n;

  return {
    decks,
    maxBatch,
    /**
     *
     */
    vaultShareBps: Number(vaultShareBps),
    drawn: decks.reduce((n, d) => n + d.drawn, 0),
    remaining: decks.reduce((n, d) => n + d.remaining, 0),
    vault: decks.reduce((v, d) => v + d.vault, 0n),
    treasury: (head.data?.[1]?.result as bigint | undefined) ?? BigInt(seed?.treasury ?? 0),
    feesClaimable: claimable,
    adapter,
    ticketPrice,
    /**
     *
     *
     */
    treasuryPerOpen: ((ticketPrice / 10n) * (10_000n - vaultShareBps)) / 10_000n,

    slotCount: Number((player.data?.[0]?.result as bigint | undefined) ?? 0n),
    balance,
    allowance,
    ticketsBps,
    tickets: Number(ticketsBps) / 8500,

    needsApproval: allowance < ticketPrice,
    canAfford: balance >= ticketPrice,

    isLoading: !seed && (head.isLoading || rows.isLoading || (Boolean(address) && player.isLoading)),
    refetch: async () => {
      await Promise.all([head.refetch(), rows.refetch(), player.refetch(), price.refetch()]);
    },
  };
}
