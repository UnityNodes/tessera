"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain, useConfig } from "wagmi";
import { writeContract, waitForTransactionReceipt } from "wagmi/actions";
import { useState } from "react";
import { Button } from "./ui/Button";
import { CHAIN, TICKET_TOKEN, TOKEN_ABI, addressUrl } from "@/lib/chain";

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
  const config = useConfig();
  const [minting, setMinting] = useState(false);

  if (!isConnected) {
    return (
      <details className="group/w relative">
        <summary className="list-none [&::-webkit-details-marker]:hidden">
          <Button variant="quiet" disabled={isPending} className="pointer-events-none">
            {isPending ? "Connecting…" : "Connect wallet"}
          </Button>
        </summary>
        <Panel>
          <p className="t-label mb-3 text-[0.75rem]">choose a wallet</p>
          {connectors.map((c) => (
            <button
              key={c.uid}
              onClick={() => connect({ connector: c })}
              className="block w-full rounded-[var(--radius-control)] px-3 py-2.5 text-left text-[0.9375rem] text-[var(--color-ink)] transition-colors hover:bg-[color-mix(in_oklab,var(--color-accent)_16%,transparent)]"
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
      <Button onClick={() => switchChain({ chainId: CHAIN.id })}>Switch to Base Sepolia</Button>
    );
  }

  const mint = async () => {
    if (!address) return;
    setMinting(true);
    try {
      const hash = await writeContract(config, {
        address: TICKET_TOKEN,
        abi: TOKEN_ABI,
        functionName: "mint",
        args: [address, 20_000_000n],
      });
      await waitForTransactionReceipt(config, { hash });
      onMinted?.();
    } finally {
      setMinting(false);
    }
  };

  return (
    <details className="group/w relative">
      <summary className="list-none [&::-webkit-details-marker]:hidden">
        <span className="t-chain flex cursor-pointer items-center gap-2 rounded-[var(--radius-panel)] border border-[var(--edge)] px-3.5 py-2 text-[0.875rem] text-[var(--color-ink)] transition-colors hover:border-[var(--edge-strong)]">
          <span
            aria-hidden
            className="h-1.5 w-1.5 rounded-full"
            style={{
              background: "var(--color-tier-denarius)",
              boxShadow: "0 0 8px var(--color-tier-denarius)",
            }}
          />
          {short(address!)}
          <IconChevron />
        </span>
      </summary>

      <Panel>
        <button
          onClick={mint}
          disabled={minting}
          className="block w-full rounded-[var(--radius-control)] px-3 py-2.5 text-left text-[0.9375rem] text-[var(--color-ink)] transition-colors hover:bg-[color-mix(in_oklab,var(--color-accent)_16%,transparent)] disabled:text-[var(--color-ink-faint)]"
        >
          {minting ? "Minting…" : "Get $20 in test dollars"}
        </button>
        <a
          href={addressUrl(address!)}
          target="_blank"
          rel="noreferrer"
          className="block rounded-[var(--radius-control)] px-3 py-2.5 text-[0.9375rem] text-[var(--color-ink)] transition-colors hover:bg-[color-mix(in_oklab,var(--color-accent)_16%,transparent)]"
        >
          View on Basescan ↗
        </a>
        <button
          onClick={() => disconnect()}
          className="mt-1 block w-full rounded-[var(--radius-control)] border-t border-[var(--edge)] px-3 py-2.5 pt-3 text-left text-[0.9375rem] text-[var(--color-ink-dim)] transition-colors hover:text-[var(--color-danger)]"
        >
          Disconnect
        </button>
      </Panel>
    </details>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="surface absolute right-0 top-full z-[var(--z-sticky)] mt-1.5 w-[15rem] p-2">
      {children}
    </div>
  );
}

const IconChevron = () => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="ml-0.5 opacity-60 transition-transform duration-200 group-open/w:rotate-180"
    aria-hidden
  >
    <path d="M4 6.5 8 10.5l4-4" />
  </svg>
);
