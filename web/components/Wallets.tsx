"use client";

import { useMemo } from "react";
import { useConnect, type Connector } from "wagmi";
import { Wallet } from "lucide-react";

/**
 * The wallet list, one for the whole site.
 *
 * wagmi hands the connectors over as they are, and they cannot be shown as they
 * are. The reason is in how the list is assembled. Besides the two we declared
 * in `lib/wagmi`, it receives EVERY wallet that announced itself over EIP-6963:
 * the browser reports each installed one. That is good: a person sees their own
 * wallet under its own name with its own icon.
 *
 * What is not good is that the generic `injected()` does not go anywhere in the
 * process. wagmi removes duplicates only for connectors that declared an `rdns`,
 * and bare injected has none. So a person with MetaMask at hand ended up with
 * two rows that do the same thing, and the second was called "Injected", a word
 * that means nothing to anyone except whoever wrote the code.
 *
 * Here it comes down to a rule: if the browser named at least one wallet, the
 * generic row is redundant. If it named none, then on the contrary it is the
 * only thread, and then it gets a human name.
 */
export function useWallets(): Connector[] {
  const { connectors } = useConnect();

  return useMemo(() => {
    // A connector found by the browser is the same injected but with a target:
    // it has its own id (rdns), a name and an icon.
    const found = connectors.filter((c) => c.type === "injected" && c.id !== "injected");
    const rest = connectors.filter((c) => c.type !== "injected");
    const generic = connectors.filter((c) => c.id === "injected");

    // The order is not accidental: first what the person already has installed,
    // then what works with nothing, and only then the fallback.
    return [...found, ...rest, ...(found.length > 0 ? [] : generic)];
  }, [connectors]);
}

/** What the wallet is called on screen. "Injected" is not a name. */
export function walletName(c: Connector) {
  return c.id === "injected" ? "Browser wallet" : c.name;
}

/**
 * The wallet choice buttons.
 *
 * They live in their own component because the same list stands in two places,
 * in the header and in `StartHere` in the middle of the page. Until now both
 * drew it by hand, and any rule about what to show would have had to be written
 * twice.
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
          {/* The icon comes from the wallet itself, over EIP-6963 it arrives
              together with the name. Those that do not provide one get the
              generic icon: a row with nothing on the left would stand out from
              the rest. */}
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
