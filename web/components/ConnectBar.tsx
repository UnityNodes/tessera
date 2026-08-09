"use client";

import Link from "next/link";
import { formatUnits } from "viem";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { Wallet, ShieldCheck, ChevronDown, PlusCircle, Ticket } from "lucide-react";
import { Chest } from "./Chest";
import { WEIGHT_PER_TICKET } from "@/lib/deck";
import { Button } from "./ui/Button";
import { Disclosure } from "./ui/Disclosure";
import { useMint } from "@/hooks/useMint";
import { CHAIN, addressUrl } from "@/lib/chain";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/**
 *
 *
 *
 */
export function ConnectBar({
  onMinted,
  balance = 0n,
  tesa = 0,
  tickets = 0,
  megapotHref = "/case/0#megapot",
}: {
  onMinted?: () => void;
  balance?: bigint;
  tesa?: number;
  tickets?: number;
  megapotHref?: string;
} = {}) {
  const { address, chainId, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { mint, minting } = useMint(onMinted);

  if (!isConnected) {
    return (
      <Disclosure
        summary={
          <span className="flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] bg-[var(--color-accent)] px-4 py-2 text-sm font-bold text-slate-950 shadow-[var(--glow-accent)] transition-all hover:bg-[var(--color-accent-hover)] hover:shadow-[var(--glow-accent-lift)] sm:min-h-0">
            <Wallet className="h-4 w-4" />
            {isPending ? "Connecting…" : "Connect wallet"}
          </span>
        }
      >
        <Panel>
          <p className="t-label mb-2 px-1">choose a wallet</p>
          {connectors.map((c) => (
            <button
              key={c.uid}
              type="button"
              onClick={() => connect({ connector: c })}
              className="flex min-h-11 w-full cursor-pointer items-center rounded-[var(--radius-control)] px-3 py-2.5 text-left text-sm font-bold text-slate-200 transition-colors hover:bg-slate-800 hover:text-[var(--color-accent-hover)]"
            >
              {c.name}
            </button>
          ))}
        </Panel>
      </Disclosure>
    );
  }

  if (chainId !== CHAIN.id) {
    return (
      <Button size="sm" onClick={() => switchChain({ chainId: CHAIN.id })}>
        Switch to Base Sepolia
      </Button>
    );
  }

  return (
    <Disclosure
      summary={
        <span className="t-chain flex min-h-11 items-center gap-2 rounded-[var(--radius-chip)] border border-[rgb(57_255_136_/_0.4)] bg-slate-800 px-3 py-2 text-sm font-bold text-[var(--color-accent-bright)] transition-colors hover:bg-slate-700 sm:min-h-0">
          <ShieldCheck className="h-4 w-4 text-[var(--color-accent-hover)]" />
          {short(address!)}
          <ChevronDown className="h-3.5 w-3.5 opacity-60 transition-transform duration-200 group-open/d:rotate-180" />
        </span>
      }
    >
      <Panel>
        <div className="border-b border-slate-800 px-3 pb-3">
          <p className="t-label">your wallet</p>
          <a
            href={addressUrl(address!)}
            target="_blank"
            rel="noreferrer"
            className="t-addr mt-1 block text-sm font-bold text-slate-200 hover:text-[var(--color-accent-hover)]"
          >
            {short(address!)} ↗
          </a>
        </div>

        <div className="space-y-1.5 py-2">
          <Row
            icon={<Wallet className="h-4 w-4" />}
            name="test dollars"
            value={`$${Number(formatUnits(balance, 6)).toFixed(2)}`}
          />
          <Row
            icon={<Ticket className="h-4 w-4" />}
            name="real Megapot tickets"
            note="bought in the same transaction that opens a case"
            value={String(tickets)}
            ink="var(--color-accent-hover)"
          />
          <Row
            icon={<Chest rarity="shard" size={18} />}
            name={
              tesa > 0 && tesa % WEIGHT_PER_TICKET === 0
                ? "TESA · a ticket ready"
                : `TESA · ${WEIGHT_PER_TICKET - (tesa % WEIGHT_PER_TICKET)} to the next ticket`
            }
            value={String(tesa)}
            ink="var(--color-tier-shard)"
          />
        </div>

        <div className="border-t border-slate-800 pt-2">
          <button
            type="button"
            onClick={() => void mint()}
            disabled={minting}
            className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-[var(--radius-control)] px-3 py-2.5 text-left text-sm font-bold text-[var(--color-accent-hover)] transition-colors hover:bg-slate-800 disabled:text-slate-500"
          >
            <PlusCircle className="h-4 w-4" />
            {minting ? "Minting…" : "Get $20 in test dollars"}
          </button>
          <Link
            href="/profile"
            className="flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] px-3 py-2.5 text-sm font-bold text-slate-200 transition-colors hover:bg-slate-800 hover:text-[var(--color-accent-hover)]"
          >
            <ShieldCheck className="h-4 w-4" />
            Your shelf, claim what you collected
          </Link>
          <Link
            href={megapotHref}
            className="flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] px-3 py-2.5 text-sm font-bold text-slate-200 transition-colors hover:bg-slate-800 hover:text-[var(--color-accent-hover)]"
          >
            <Ticket className="h-4 w-4" />
            The jackpot your tickets are in
          </Link>
          <button
            type="button"
            onClick={() => disconnect()}
            className="mt-1 block w-full cursor-pointer rounded-[var(--radius-control)] border-t border-slate-800 px-3 py-2.5 pt-3 text-left text-sm font-bold text-slate-400 transition-colors hover:text-[var(--color-danger)]"
          >
            Disconnect
          </button>
        </div>
      </Panel>
    </Disclosure>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-[min(20rem,calc(100vw-2rem))] rounded-[var(--radius-panel)] border border-slate-800 bg-[var(--color-modal)] p-2 shadow-2xl">
      {children}
    </div>
  );
}

function Row({
  icon,
  name,
  note,
  value,
  ink,
}: {
  icon: React.ReactNode;
  name: string;
  note?: string;
  value: string;
  ink?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-[var(--radius-control)] px-3 py-1.5">
      <span className="shrink-0" style={{ color: ink ?? "var(--color-ink-dim)" }}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.8125rem] text-slate-300">{name}</span>
        {note && <span className="block text-[0.6875rem] leading-snug text-slate-500">{note}</span>}
      </span>
      <span
        className="t-chain shrink-0 text-sm font-bold"
        style={{ color: ink ?? "var(--color-ink)" }}
      >
        {value}
      </span>
    </div>
  );
}
