"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain, useConfig } from "wagmi";
import { writeContract, waitForTransactionReceipt } from "wagmi/actions";
import { useState } from "react";
import { Button } from "./ui/Button";
import { CHAIN, TICKET_TOKEN, TOKEN_ABI, addressUrl } from "@/lib/chain";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export function ConnectBar({ onMinted }: { onMinted?: () => void }) {
  const { address, chainId, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const config = useConfig();
  const [minting, setMinting] = useState(false);

  if (!isConnected) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        {connectors.map((c) => (
          <Button key={c.uid} variant="quiet" onClick={() => connect({ connector: c })} disabled={isPending}>
            {c.name}
          </Button>
        ))}
      </div>
    );
  }

  if (chainId !== CHAIN.id) {
    return (
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-[0.9375rem] text-[var(--color-travertine-dim)]">
          This game lives on Base Sepolia.
        </span>
        <Button onClick={() => switchChain({ chainId: CHAIN.id })}>Switch network</Button>
      </div>
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
    <div className="flex flex-wrap items-center gap-4">
      <a
        href={addressUrl(address!)}
        target="_blank"
        rel="noreferrer"
        className="t-chain text-[0.8125rem] text-[var(--color-travertine-dim)] hover:text-[var(--color-travertine)]"
      >
        {short(address!)}
      </a>
      <Button variant="ghost" onClick={mint} disabled={minting}>
        {minting ? "Minting…" : "Get $20 test"}
      </Button>
      <Button variant="ghost" onClick={() => disconnect()}>
        Disconnect
      </Button>
    </div>
  );
}
