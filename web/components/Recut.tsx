"use client";

import { useCallback, useMemo, useState } from "react";
import { useAccount, useConfig, useReadContract } from "wagmi";
import {
  readContract,
  simulateContract,
  writeContract,
  waitForTransactionReceipt,
} from "wagmi/actions";
import { formatEther, parseEventLogs } from "viem";
import { Copy } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { TESSERA_DECK_ABI } from "@/lib/abi";
import { DECK_ADDRESS, txUrl } from "@/lib/chain";
import { explain } from "@/lib/errors";
import { fitsBudget, specFor, totalWeight, WEIGHT_PER_TICKET } from "@/lib/deck";
import type { DeckInfo } from "@/hooks/useDeck";

/**
 * A fresh copy of a deck with the same drop table.
 *
 * An already cut deck cannot be reshuffled, not here and not anywhere, and
 * that is not an omission. The cards are shuffled once, encrypted, and that
 * order stands to the last slot: the pool players paid into is not
 * rewritten under them. So renewing a deck always means a NEW deck beside
 * it, and the old one stays played out forever.
 *
 * What gets copied is exactly what is written in the chain: the size, the
 * tier table and how many slots open the vault. Nothing "almost the same"
 * can live here, otherwise the copy would promise something the original
 * did not.
 *
 * Why the button is absent on other people's decks: `createDeck` sets the
 * creator to zero. A copy of someone else's deck made from here would pay
 * its share to nobody, that is, would quietly take from the creator what
 * they paid for. A creator renews their own deck themselves, through
 * /create, and the share stays theirs.
 *
 * And the button is absent on decks whose table does not fit the budget.
 * Those are left over from the old rule that forgot to subtract the vault
 * share: the contract now rejects their copy, and offering it would lead
 * the owner into a revert. Such a deck can only be renewed with a NEW table.
 *
 * @param vaultShareBps the share of the fee that goes into vaults, right now.
 */
export function canRecut(deck: DeckInfo, vaultShareBps: number): boolean {
  return !deck.creator && deck.tiers.length > 0 && fitsBudget(deck, vaultShareBps);
}

export function RecutButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <Button size="sm" variant="quiet" onClick={onToggle}>
      <Copy className="h-4 w-4" />
      {open ? "Never mind" : "Cut a fresh copy"}
    </Button>
  );
}

export function RecutPanel({ deck, onDone }: { deck: DeckInfo; onDone?: () => void }) {
  const config = useConfig();
  const { address } = useAccount();
  const [state, setState] = useState<{
    phase: "idle" | "signing" | "confirming" | "done" | "failed";
    url?: string;
    id?: number;
    error?: string;
  }>({ phase: "idle" });

  const table = useMemo(
    () => ({ upTo: deck.tiers.map((t) => t.upTo), weight: deck.tiers.map((t) => t.weight) }),
    [deck.tiers],
  );

  // The Inco fee for a shuffle, in ETH, and it depends on the deck size.
  const fee = useReadContract({
    address: DECK_ADDRESS,
    abi: TESSERA_DECK_ABI,
    functionName: "deckFee",
    args: [deck.size],
  });

  const run = useCallback(async () => {
    if (!address) return;
    setState({ phase: "signing" });
    try {
      // Take the shuffle price right before sending rather than from the panel:
      // between the page load and the signature Inco could have changed the
      // tariff, and the transaction would fail underpaid inside the wallet.
      const incoFee = (await readContract(config, {
        address: DECK_ADDRESS,
        abi: TESSERA_DECK_ABI,
        functionName: "deckFee",
        args: [deck.size],
      })) as bigint;

      const sim = await simulateContract(config, {
        address: DECK_ADDRESS,
        abi: TESSERA_DECK_ABI,
        functionName: "createDeck",
        args: [deck.size, table.upTo, table.weight, deck.vaultUpTo],
        value: incoFee,
        account: address,
      });
      const hash = await writeContract(config, sim.request);
      setState({ phase: "confirming", url: txUrl(hash) });

      const receipt = await waitForTransactionReceipt(config, { hash });
      if (receipt.status !== "success") throw new Error("The transaction reverted on chain");

      // The copy number comes from an event in OUR OWN receipt. deckCount()
      // after the transaction would show somebody else's deck if another
      // person cut theirs in the same block.
      const made = parseEventLogs({
        abi: TESSERA_DECK_ABI,
        eventName: "DeckCreated",
        logs: receipt.logs,
      });
      const id = Number((made[0]?.args as { deckId?: number } | undefined)?.deckId ?? 0);
      setState({ phase: "done", url: txUrl(hash), id });
      onDone?.();
    } catch (err) {
      setState({ phase: "failed", error: explain(err).title });
    }
  }, [address, config, deck.size, deck.vaultUpTo, table, onDone]);

  const busy = state.phase === "signing" || state.phase === "confirming";

  return (
    <div className="w-full rounded-[var(--radius-control)] border border-slate-800 bg-slate-950 p-4">
      <p className="text-sm leading-relaxed text-slate-300">
        This does not refill deck #{deck.id}; nothing can. It cuts a{" "}
        <strong className="text-white">new deck</strong> with the same size, the same drop table and
        the same vault rule, and gives it the next number. Deck #{deck.id} stays exactly as it is.
      </p>

      <dl className="mt-4 flex flex-col gap-1.5 text-sm">
        <Row label="slots" value={String(deck.size)} />
        <Row
          label="promises"
          value={`${totalWeight(deck)} weight, ${(totalWeight(deck) / WEIGHT_PER_TICKET).toFixed(1)} tickets over ${deck.size} opens`}
        />
        <Row label="drop table" value={describe(deck)} />
        <Row
          label="vault"
          value={deck.vaultUpTo > 0 ? `values 1…${deck.vaultUpTo} open it` : "no vault"}
        />
        <Row
          label="shuffle fee"
          value={
            fee.isLoading
              ? "reading the chain…"
              : fee.data != null
                ? `${Number(formatEther(fee.data as bigint)).toFixed(6)} ETH`
                : "unknown"
          }
        />
      </dl>

      {!deck.empty && (
        <p className="mt-3 text-sm text-amber-400">
          Deck #{deck.id} still has {deck.remaining} sealed cases. The copy will sit next to it, not
          replace it.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button disabled={busy} onClick={() => void run()}>
          {state.phase === "signing"
            ? "Sign in your wallet…"
            : state.phase === "confirming"
              ? "Confirming…"
              : "Cut it"}
        </Button>
        {state.url && (
          <a
            className="t-chain text-sm text-slate-400"
            href={state.url}
            target="_blank"
            rel="noreferrer"
          >
            transaction
          </a>
        )}
      </div>

      {state.phase === "done" && (
        <p className="mt-3 text-sm" style={{ color: "var(--color-accent-hover)" }}>
          Cut as deck #{state.id}.{" "}
          <Link className="underline" href={`/case/${state.id}`}>
            Open it
          </Link>
          .
        </p>
      )}
      {state.error && <p className="mt-3 text-sm text-[var(--color-danger)]">{state.error}</p>}
    </div>
  );
}

/**
 * The tier table on one line, in the same words as on the case page.
 *
 * Showing raw upTo/weight would mean asking the owner to check the copy
 * against the original in numbers that appear nowhere on a player's screen.
 */
function describe(deck: DeckInfo): string {
  return deck.tiers
    .map((t, i) => {
      const from = (deck.tiers[i - 1]?.upTo ?? 0) + 1;
      const span = from === t.upTo ? `${from}` : `${from}–${t.upTo}`;
      if (t.weight === 0) return `${span} → nothing`;
      const tickets = t.weight / WEIGHT_PER_TICKET;
      const label = tickets >= 1 ? `+${tickets} ticket${tickets === 1 ? "" : "s"}` : "a shard";
      return `${span} → ${label} (${specFor(t.weight).name})`;
    })
    .join("   ·   ");
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <dt className="t-label w-28 shrink-0">{label}</dt>
      <dd className="t-chain text-slate-300">{value}</dd>
    </div>
  );
}
