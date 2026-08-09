"use client";

import Link from "next/link";
import { formatUnits } from "viem";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import {
  Wallet,
  ShieldCheck,
  ChevronDown,
  PlusCircle,
  Ticket,
  ExternalLink,
  LogOut,
} from "lucide-react";
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
        <div className="rounded-[var(--radius-control)] bg-[var(--color-bg)] px-3 py-2.5">
          <p className="t-label">your wallet</p>
          <a
            href={addressUrl(address!)}
            target="_blank"
            rel="noreferrer"
            className="t-addr mt-1 flex items-center gap-1.5 text-[0.9375rem] font-bold text-slate-100 hover:text-[var(--color-accent-hover)]"
          >
            {short(address!)}
            <ExternalLink className="h-3.5 w-3.5 opacity-60" />
          </a>
          <p className="t-chain mt-1 text-[0.6875rem] text-slate-500">{CHAIN.name}</p>
        </div>

        <p className="t-label mt-3 px-3">what you hold</p>
        <div className="mt-1.5 space-y-1">
          <Row
            icon={<Wallet className="h-4 w-4" />}
            name="test dollars"
            note="free on this testnet, the ticket contract is not"
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
            name="TESA"
            note={
              tesa > 0 && tesa % WEIGHT_PER_TICKET === 0
                ? "a full ticket is ready to claim"
                : `${WEIGHT_PER_TICKET - (tesa % WEIGHT_PER_TICKET)} more make the next ticket`
            }
            value={String(tesa)}
            ink="var(--color-tier-shard)"
          />
        </div>

        <p className="t-label mt-3 px-3">what you can do</p>
        <div className="mt-1.5">
          <Act href="/profile" icon={<ShieldCheck className="h-4 w-4" />}>
            Your shelf
            <span className="block text-[0.6875rem] font-normal text-slate-500">
              your slots, and what you can claim
            </span>
          </Act>
          <Act href={megapotHref} icon={<Ticket className="h-4 w-4" />}>
            The jackpot
            <span className="block text-[0.6875rem] font-normal text-slate-500">
              the Megapot draw your tickets are in
            </span>
          </Act>
          <button
            type="button"
            onClick={() => void mint()}
            disabled={minting}
            className="flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-[var(--radius-control)] px-3 py-2 text-left text-sm font-bold text-[var(--color-accent-hover)] transition-colors hover:bg-slate-800 disabled:text-slate-500"
          >
            <PlusCircle className="h-4 w-4 shrink-0" />
            <span>
              {minting ? "Minting…" : "Get $20 in test dollars"}
              <span className="block text-[0.6875rem] font-normal text-slate-500">
                the faucet mints straight to your wallet
              </span>
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => disconnect()}
          className="mt-2 flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-[var(--radius-control)] border-t border-slate-800 px-3 py-2.5 pt-3 text-left text-sm font-bold text-slate-400 transition-colors hover:text-[var(--color-danger)]"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Disconnect
        </button>
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
    <div className="flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-1.5">
      <span className="grid h-7 w-7 shrink-0 place-items-center" style={{ color: ink ?? "var(--color-ink-dim)" }}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className="t-chain block text-base font-extrabold leading-none"
          style={{ color: ink ?? "var(--color-ink)" }}
        >
          {value}
        </span>
        <span className="block truncate text-[0.75rem] leading-tight text-slate-300">{name}</span>
        {note && (
          <span className="block text-[0.6875rem] leading-snug text-slate-500">{note}</span>
        )}
      </span>
    </div>
  );
}

function Act({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-11 items-center gap-2.5 rounded-[var(--radius-control)] px-3 py-2 text-sm font-bold text-slate-200 transition-colors hover:bg-slate-800 hover:text-[var(--color-accent-hover)]"
    >
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0">{children}</span>
    </Link>
  );
}
