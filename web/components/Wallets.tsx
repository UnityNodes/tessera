"use client";

import { useMemo } from "react";
import { useConnect, type Connector } from "wagmi";
import { Wallet } from "lucide-react";

/**
 *
 *
 *
 */
export function useWallets(): Connector[] {
  const { connectors } = useConnect();

  return useMemo(() => {
    const found = connectors.filter((c) => c.type === "injected" && c.id !== "injected");
    const rest = connectors.filter((c) => c.type !== "injected");
    const generic = connectors.filter((c) => c.id === "injected");

    return [...found, ...rest, ...(found.length > 0 ? [] : generic)];
  }, [connectors]);
}

export function walletName(c: Connector) {
  return c.id === "injected" ? "Browser wallet" : c.name;
}

/**
 *
 */
export function WalletButtons() {
  const wallets = useWallets();
  const { connect } = useConnect();

  return (
    <>
      {wallets.map((c) => (
        <button
          key={c.uid}
          type="button"
          onClick={() => connect({ connector: c })}
          className="flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-[var(--radius-control)] px-3 py-2.5 text-left text-sm font-bold text-slate-200 transition-colors hover:bg-slate-800 hover:text-[var(--color-accent-hover)]"
        >
          <span className="grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-[6px]">
            {c.icon ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={c.icon} alt="" aria-hidden width={24} height={24} className="h-6 w-6" />
            ) : (
              <Wallet className="h-[1.125rem] w-[1.125rem] text-slate-400" />
            )}
          </span>
          {walletName(c)}
        </button>
      ))}
    </>
  );
}
