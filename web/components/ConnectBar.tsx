"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { Wallet, ShieldCheck, ChevronDown } from "lucide-react";
import { Button } from "./ui/Button";
import { useMint } from "@/hooks/useMint";
import { CHAIN, addressUrl } from "@/lib/chain";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/**
 *
 *
 *
 */
export function ConnectBar({ onMinted }: { onMinted?: () => void } = {}) {
  const { address, chainId, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { mint, minting } = useMint(onMinted);

  if (!isConnected) {
    return (
      <details className="group/w relative">
        <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <span className="flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] bg-[var(--color-accent)] px-4 py-2 text-xs font-bold text-slate-950 shadow-[var(--glow-accent)] transition-all hover:bg-[var(--color-accent-hover)] hover:shadow-[var(--glow-accent-lift)] sm:min-h-0">
            <Wallet className="h-4 w-4" />
            {isPending ? "Connecting…" : "Connect wallet"}
          </span>
        </summary>
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
      </details>
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
    <details className="group/w relative">
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <span className="t-chain flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] border border-[rgb(57_255_136_/_0.4)] bg-slate-800 px-4 py-2 text-xs font-bold text-[var(--color-accent-bright)] transition-colors hover:bg-slate-700 sm:min-h-0">
          <ShieldCheck className="h-4 w-4 text-[var(--color-accent-hover)]" />
          {short(address!)}
          <ChevronDown className="h-3 w-3 opacity-60 transition-transform duration-200 group-open/w:rotate-180" />
        </span>
      </summary>

      <Panel>
        <button
          type="button"
          onClick={() => void mint()}
          disabled={minting}
          className="block w-full cursor-pointer rounded-[var(--radius-control)] px-3 py-2.5 text-left text-sm font-bold text-slate-200 transition-colors hover:bg-slate-800 hover:text-[var(--color-accent-hover)] disabled:text-slate-500"
        >
          {minting ? "Minting…" : "Get $20 in test dollars"}
        </button>
        <a
          href={addressUrl(address!)}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-11 items-center rounded-[var(--radius-control)] px-3 py-2.5 text-sm font-bold text-slate-200 transition-colors hover:bg-slate-800 hover:text-[var(--color-accent-hover)]"
        >
          View on Basescan ↗
        </a>
        <button
          type="button"
          onClick={() => disconnect()}
          className="mt-1 block w-full cursor-pointer rounded-[var(--radius-control)] border-t border-slate-800 px-3 py-2.5 pt-3 text-left text-sm font-bold text-slate-400 transition-colors hover:text-[var(--color-danger)]"
        >
          Disconnect
        </button>
      </Panel>
    </details>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute right-0 top-full z-[var(--z-sticky)] mt-2 w-[15rem] rounded-[var(--radius-panel)] border border-slate-800 bg-[var(--color-modal)] p-2 shadow-2xl">
      {children}
    </div>
  );
}
