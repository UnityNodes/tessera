"use client";

import { useCallback, useState } from "react";
import { useAccount, useConfig, useReadContracts, useSignMessage } from "wagmi";
import {
  readContract,
  simulateContract,
  writeContract,
  waitForTransactionReceipt,
} from "wagmi/actions";
import { parseEventLogs } from "viem";
import { TESSERA_DECK_ABI } from "@/lib/abi";
import { DECK_ADDRESS, TICKET_TOKEN, TOKEN_ABI, txUrl } from "@/lib/chain";
import { explain, type Explained } from "@/lib/errors";

const deck = { address: DECK_ADDRESS, abi: TESSERA_DECK_ABI } as const;

export type CreatePhase = "idle" | "approving" | "signing" | "confirming" | "done" | "failed";

export interface DeckPlan {
  name: string;
  hue: number;
  size: number;
  upTo: number[];
  weight: number[];
  vaultSlots: number;
  /** The creator's share in percent. It goes to the contract in bps. */
  sharePercent: number;
  /** Their own picture. Optional: without it the deck takes a chest in its own colour. */
  art?: File;
}

/**
 * Cut your own deck.
 *
 * Two payments, and they must not be confused: the Inco fee is paid in ETH along
 * with the call, being the price of shuffling the season, while the fee to the
 * game goes in the ticket token and needs a separate approval. So both are read.
 */
export function useCreateDeck() {
  const { address } = useAccount();
  const config = useConfig();
  const { signMessageAsync } = useSignMessage();
  const [state, setState] = useState<{
    phase: CreatePhase;
    txUrl?: string;
    deckId?: number;
    /** What happened to the picture: undefined means none was given, a string is a refusal. */
    art?: string;
    error?: Explained;
  }>({ phase: "idle" });

  const rules = useReadContracts({
    contracts: [
      { ...deck, functionName: "customDeckFee" },
      { ...deck, functionName: "maxCreatorBps" },
      { ...deck, functionName: "minCustomSize" },
      {
        address: TICKET_TOKEN,
        abi: TOKEN_ABI,
        functionName: "allowance",
        args: [address ?? "0x0000000000000000000000000000000000000000", DECK_ADDRESS],
      },
    ],
    query: { refetchInterval: 20_000 },
  });

  const fee = (rules.data?.[0]?.result as bigint | undefined) ?? 0n;
  const maxBps = Number((rules.data?.[1]?.result as number | undefined) ?? 5000);
  const minSize = Number((rules.data?.[2]?.result as number | undefined) ?? 50);
  const allowance = (rules.data?.[3]?.result as bigint | undefined) ?? 0n;

  const create = useCallback(
    async (plan: DeckPlan) => {
      if (!address) return undefined;
      try {
        // Approve only when the allowance is short: a needless approve is a
        // needless transaction and a needless signature in the wallet for nothing.
        if (allowance < fee) {
          setState({ phase: "approving" });
          const sim = await simulateContract(config, {
            address: TICKET_TOKEN,
            abi: TOKEN_ABI,
            functionName: "approve",
            args: [DECK_ADDRESS, fee * 100n],
            account: address,
          });
          const hash = await writeContract(config, sim.request);
          await waitForTransactionReceipt(config, { hash });
        }

        setState({ phase: "signing" });
        // The Inco fee is read right before sending: it depends on the deck
        // size, and the size is what the player has just chosen.
        // readContract rather than simulateContract: deckFee is a view, and
        // there is nothing to simulate about a read.
        const incoFee = (await readContract(config, {
          ...deck,
          functionName: "deckFee",
          args: [plan.size],
        })) as bigint;

        const sim = await simulateContract(config, {
          ...deck,
          functionName: "createCustomDeck",
          args: [
            plan.size,
            plan.upTo,
            plan.weight,
            plan.vaultSlots,
            Math.round(plan.sharePercent * 100),
            `${plan.name}:${plan.hue}`,
          ],
          value: incoFee,
          account: address,
        });
        const hash = await writeContract(config, sim.request);
        setState({ phase: "confirming", txUrl: txUrl(hash) });

        const receipt = await waitForTransactionReceipt(config, { hash });
        if (receipt.status !== "success") throw new Error("The transaction reverted on chain");

        // The deck id comes from an event in their OWN receipt rather than from
        // deckCount() afterwards: between the call and the read somebody else
        // manages to cut theirs, and the person would land on the wrong page.
        const made = parseEventLogs({
          abi: TESSERA_DECK_ABI,
          eventName: "DeckCreated",
          logs: receipt.logs,
        });
        const id = Number((made[0]?.args as { deckId?: number } | undefined)?.deckId ?? 0);

        // The picture travels AFTER the cut, and it cannot be otherwise: it is
        // tied to the deck number, and the number exists only from the moment
        // the transaction landed in a block.
        //
        // A failure here does not cancel the deck. The deck is already on chain
        // and already playing, simply with a chest in its own colour. That is
        // the whole reason for keeping the picture off chain.
        let art: string | undefined;
        if (plan.art) {
          try {
            art = await putArt(id, plan.art, signMessageAsync);
          } catch (e) {
            art = e instanceof Error ? e.message : "the picture was not accepted";
          }
        }
        setState({ phase: "done", txUrl: txUrl(hash), deckId: id, art });
        await rules.refetch();
        return id;
      } catch (err) {
        setState({ phase: "failed", error: explain(err) });
        return undefined;
      }
    },
    [address, config, allowance, fee, rules, signMessageAsync],
  );

  return {
    state,
    reset: useCallback(() => setState({ phase: "idle" }), []),
    busy: ["approving", "signing", "confirming"].includes(state.phase),
    fee,
    maxBps,
    minSize,
    create,
  };
}

/**
 * Put a deck's picture in place.
 *
 * The signature proves not "I am the creator" but "I am giving THIS deck THIS
 * file": the message includes the hash of the contents. The server assembles the
 * same string on its side and checks it against the creator read from the chain.
 */
async function putArt(
  deckId: number,
  file: File,
  sign: (a: { message: string }) => Promise<string>,
) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const sum = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const signature = await sign({
    message: `tessera: set the picture of deck ${deckId} to ${sum}`,
  });

  const form = new FormData();
  form.set("deckId", String(deckId));
  form.set("signature", signature);
  form.set("file", file);

  const res = await fetch("/api/skin", { method: "POST", body: form });
  const body = (await res.json().catch(() => ({}))) as { error?: string; why?: string };
  if (!res.ok) throw new Error(body.why ?? body.error ?? "the picture was not accepted");
  return undefined;
}
