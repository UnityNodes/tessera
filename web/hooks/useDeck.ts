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
  /// How much money sits in this particular deck's vault right now.
  vaultBanked: bigint;
  /// How much its vault would pay if it were opened now.
  vault: bigint;
  empty: boolean;
  /**
   * The deal number: how many times the deck has been reshuffled, from zero.
   *
   * A deck reshuffles itself, either played out or with its vault taken. The
   * pool starts over when it does, so everything computed from the history of
   * opens has to know WHICH deal it is counting.
   */
  cut: number;
  /// Who cut the deck. undefined means a house deck.
  creator: `0x${string}` | undefined;
  /// What share of the treasury half of the fee the creator takes, in bps.
  creatorBps: number;
  /// A pointer to the name and picture on IPFS. Empty means a house deck,
  /// and then its face is the ladder of its own rungs.
  cid: string;
}

/**
 * The game state the screen is drawn from.
 *
 * There are several decks, they live in parallel, and each has its own drop
 * table and its own vault. So everything that belongs to a deck sits in
 * `decks[]` rather than at the root: mixing them up is not allowed, because a
 * slot is judged by its own deck's table.
 *
 * The wallet is read in the same batch. Fetched separately, the interface
 * manages to show an intermediate state along the lines of "the prize is already
 * there but the redeem button is still disabled".
 */
/**
 * The same thing the browser reads, but read by the server in advance.
 *
 * Needed not for network speed but to remove the CHAIN of calls. The browser
 * makes its reads in steps: first deckCount, and only knowing it, three calls
 * per deck; first adapter, and only knowing it, the price. On a slow phone the
 * deck numbers appeared at 12.4 seconds while the frame had been up since 0.5.
 *
 * Hence one request to our own server, which has already assembled all of it. It
 * does not cancel the wagmi reads, which remain the source of truth and keep the
 * numbers updated. Exactly one thing changes: the first screen is not empty.
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
  /** The deck's deal number. The server reads it from the chain with the rest. */
  cut: number;
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
  // What the server has already put into the HTML. During SSR and on the first
  // render in the browser this is a ready answer, so the numbers are drawn in
  // the same pass as the markup, without a single request.
  const seeded = useContext(GameSeed) as ServerGame | null;
  return useQuery<ServerGame>({
    initialData: seeded ?? undefined,
    queryKey: ["game", DECK_ADDRESS],
    queryFn: async () => {
      const r = await fetch("/api/game");
      if (!r.ok) throw new Error("game unavailable");
      return (await r.json()) as ServerGame;
    },
    // After that wagmi keeps the numbers updated. This source is needed for the
    // first screen only, so there is no sense in it polling faster.
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
      // The share of the fee that settles in the vaults. The rest is the only
      // thing the treasury grows by, so without this number one cannot honestly
      // say how many opens remain until a won ticket.
      { ...deck, functionName: "vaultShareBps" },
      // Whether the DEPLOYED logic can open in batches.
      //
      // We ask the chain rather than trusting that the frontend was built with
      // the new ABI: behind a proxy the owner changes the logic in a separate
      // transaction, and between the site's build and that switch there is a
      // window in which an "x10" button would call a function the contract does
      // not have yet. A call to the old implementation simply fails, and the
      // multipliers are not shown instead of reverting in the player's hands.
      { ...deck, functionName: "MAX_BATCH" },
    ],
    query: { refetchInterval: 12_000 },
  });

  const seed = server.data;
  const count = Number(
    (head.data?.[0]?.result as bigint | undefined) ?? BigInt(seed?.decks.length ?? 0),
  );
  // The BigInt(...) here is mandatory rather than defensive: vaultShareBps is a
  // uint16, and viem returns those as a number, not a bigint. Without the
  // wrapper the first expression involving 10_000n throws "Cannot mix BigInt and
  // other types" right in the render, and the header disappears entirely.
  // unsweptOpens below is wrapped for the same reason.
  //
  // 5000 bps is the contract's default. A fallback for when the read has not
  // arrived yet: erring towards "a longer wait" is more honest than promising a
  // shorter one.
  const vaultShareBps = BigInt(
    (head.data?.[5]?.result as bigint | number | undefined) ?? seed?.vaultShareBps ?? 5000,
  );
  const adapter = (head.data?.[3]?.result as `0x${string}` | undefined) ?? seed?.adapter;
  const ids = useMemo(() => Array.from({ length: count }, (_, i) => i), [count]);

  // A one means "no batching": either the old logic, or the read has not
  // arrived. In both cases the honest thing is to show x1 only.
  const maxBatch = Number((head.data?.[6]?.result as number | undefined) ?? seed?.maxBatch ?? 1);

  const rows = useReadContracts({
    contracts: ids.flatMap(
      (id) =>
        [
          { ...deck, functionName: "deckAt", args: [id] },
          { ...deck, functionName: "tiers", args: [id] },
          { ...deck, functionName: "deckMeta", args: [id] },
          { ...deck, functionName: "reseals", args: [id] },
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
        // Three calls per deck, so the stride is three too. It used to be two,
        // which is exactly why the index is written out as a number rather than
        // "the next one": adding a read and forgetting to multiply is a shift
        // that makes deck #1 show deck #0's table, with no error surfacing.
        const STRIDE = 4;
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
        const cut = Number((rows.data?.[id * STRIDE + 3]?.result as number | undefined) ?? 0);
        // While our own reads are in flight we take what the server assembled.
        // An empty card for twelve seconds is worse than a card with numbers
        // eight seconds old.
        const from = seed?.decks.find((x) => x.id === id);
        if (!d && from) {
          // The vault is computed with the SAME expression as below on live
          // data.
          //
          // Until now the seed returned only what had been swept, that is zero
          // where the chain showed $2.01 a second later, and the number jumped
          // in front of the reader. The commission sits in Megapot until it is
          // swept, and claimVault sweeps first anyway, so "zero" was not caution
          // but an untruth lasting one second.
          const soon =
            from.vaultUpTo > 0 && unswept > 0n
              ? (((claimable * vaultShareBps) / 10_000n) * BigInt(from.unsweptOpens)) / unswept
              : 0n;
          return {
            id,
            size: from.size,
            drawn: from.drawn,
            remaining: from.size - from.drawn,
            vaultUpTo: from.vaultUpTo,
            vaultBanked: BigInt(from.vault),
            vault: BigInt(from.vault) + soon,
            empty: from.size > 0 && from.drawn >= from.size,
            cut: from.cut ?? 0,
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

        // The commission sits in Megapot until somebody sweeps it, and half of
        // that goes to the vaults, split between decks by opens. Showing only
        // what has been swept would mean drawing an empty vault where the money
        // is already earned: claimVault sweeps first anyway, so it will pay out
        // exactly this sum.
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
          cut,
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

  // The price lives in the adapter rather than the deck, because the game knows
  // nothing about Megapot's ABI. Read every time, because Megapot has
  // setTicketPrice.
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
     * What share of the fee settles in the vaults, in bps.
     *
     * Needed for decisions rather than for display: a deck's break even limit
     * counts only what remains AFTER the vault, and without this number one
     * cannot say whether a deck's table fits the money.
     */
    vaultShareBps: Number(vaultShareBps),
    /** How many cases have been opened in the game overall. */
    drawn: decks.reduce((n, d) => n + d.drawn, 0),
    /** How many are still unopened across every deck. */
    remaining: decks.reduce((n, d) => n + d.remaining, 0),
    /** The sum of every vault. */
    vault: decks.reduce((v, d) => v + d.vault, 0n),
    treasury: (head.data?.[1]?.result as bigint | undefined) ?? BigInt(seed?.treasury ?? 0),
    feesClaimable: claimable,
    adapter,
    ticketPrice,
    /**
     * How much the treasury receives from one open, in the ticket token.
     *
     * The referral commission is ten cents on the dollar, but part of it settles
     * in the vaults (`vaultShareBps`, which the owner can change), and
     * `spendable()` subtracts the vaults from the balance. So what is available
     * for ordinary prizes is exactly what is left after the vault share.
     *
     * The number is needed where a player is promised a horizon: "this many more
     * opens and the ticket is yours". Computing that horizon from the full ten
     * cents would name a shorter one than it is.
     */
    treasuryPerOpen: ((ticketPrice / 10n) * (10_000n - vaultShareBps)) / 10_000n,

    // the player
    slotCount: Number((player.data?.[0]?.result as bigint | undefined) ?? 0n),
    balance,
    allowance,
    /** Megapot tickets in bps: $1 gives 8500, because Megapot takes 15% as a fee. */
    ticketsBps,
    tickets: Number(ticketsBps) / 8500,

    needsApproval: allowance < ticketPrice,
    canAfford: balance >= ticketPrice,

    // Empty only when there is NOTHING: neither our own reads nor the server's.
    // Otherwise the page would draw a skeleton over ready numbers.
    isLoading: !seed && (head.isLoading || rows.isLoading || (Boolean(address) && player.isLoading)),
    refetch: async () => {
      await Promise.all([head.refetch(), rows.refetch(), player.refetch(), price.refetch()]);
    },
  };
}
