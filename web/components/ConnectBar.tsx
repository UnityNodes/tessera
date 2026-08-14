"use client";

import { useSyncExternalStore } from "react";

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
import { Shards } from "./Shards";
import { WalletButtons } from "./Wallets";
import { WEIGHT_PER_TICKET } from "@/lib/deck";
import { Button } from "./ui/Button";
import { Disclosure } from "./ui/Disclosure";
import { useMint } from "@/hooks/useMint";
import { CHAIN, addressUrl } from "@/lib/chain";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/**
 * The wallet as one button rather than a row of them.
 *
 * The header used to hold every connector at once, and after connecting, the
 * address, the test dollar faucet and "disconnect", each its own button. Five
 * elements under one action: a person who had not even played yet saw their
 * wallet's settings menu first.
 *
 * Now there is one button and one disclosure under it. Choosing a connector is a
 * rare action done once; so are the faucet and signing out. What is permanently
 * on screen should be only what is used permanently, and that is the address and
 * nothing else.
 *
 * On the <details> inside <Disclosure>: the disclosure itself gives keyboard and
 * screen reader support out of the box, and the wrapper adds what it does NOT
 * do, closing on an outside click, on Escape and on navigation. There used to be
 * a bare <details> here with a comment claiming it did all of that; it did not,
 * and the menu hung over the page until you poked it a second time.
 */
export function ConnectBar({
  onMinted,
  balance = 0n,
  tesa = 0,
  tickets = 0,
  megapotHref = "/case/0#megapot",
}: {
  onMinted?: () => void;
  /** Everything that is "yours". The sum of the vaults is not included: it is
      not yours, and it lives as a chip in the header. */
  balance?: bigint;
  tesa?: number;
  tickets?: number;
  /** Where to send someone for more about the lottery. */
  megapotHref?: string;
} = {}) {
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const { address, chainId, isConnected, status } = useAccount();
  const { isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { mint, minting } = useMint(onMinted);

  // Until we know for certain, we do not ask.
  //
  // There are two separate moments here and both looked equally bad. First: on
  // the SERVER nobody has a wallet, so a bright green "Connect wallet" button
  // went into the markup, and on a phone it hung there for the full two and a
  // half seconds until hydration. Second: right after hydration wagmi is still
  // restoring the connection from memory, and the button blinked again.
  //
  // useSyncExternalStore rather than useState in an effect: the server snapshot
  // returns false, the client one true, and React tells the two worlds apart
  // itself without an extra render and without a setState during mount.
  //
  // The space stays the same size, otherwise instead of blinking text the page
  // would jump. The placeholder is deliberately neutral: "0x····" would fake an
  // address for somebody who has never connected.
  //
  // For a person who genuinely has no wallet the button appears half a second
  // later, exactly when it BECOMES functional. Before hydration pressing it did
  // nothing, so the early green button was a promise the page could not keep.
  if (!hydrated || status === "connecting" || status === "reconnecting") {
    return (
      <span
        aria-hidden
        className="flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] border border-slate-800 px-4 py-2 text-sm font-bold text-slate-600 sm:min-h-0"
      >
        <Wallet className="h-[1.125rem] w-[1.125rem]" />
        <span className="t-chain">·····</span>
      </span>
    );
  }

  if (!isConnected) {
    return (
      <Disclosure
        summary={
          /* While there is no wallet this is the page's main action, solid
             green with its own light, like everything that can be pressed. */
          <span className="flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] bg-[var(--color-accent)] px-4 py-2 text-sm font-bold text-slate-950 shadow-[var(--glow-accent)] transition-all hover:bg-[var(--color-accent-hover)] hover:shadow-[var(--glow-accent-lift)] sm:min-h-0">
            <Wallet className="h-[1.125rem] w-[1.125rem]" />
            {isPending ? "Connecting…" : "Connect wallet"}
          </span>
        }
      >
        <Panel>
          <p className="t-label mb-2 px-1">choose a wallet</p>
          <WalletButtons />
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
          <ShieldCheck className="h-[1.125rem] w-[1.125rem] text-[var(--color-accent-hover)]" />
          {short(address!)}
          <ChevronDown className="h-4 w-4 opacity-60 transition-transform duration-200 group-open/d:rotate-180" />
        </span>
      }
    >
      {/* The wallet disclosure is a small profile, not a list of menu items.
          Three sections with captions, and exactly one thought in each: who
          you are, what you have, what to do with it. Until now it was one
          continuous column of rows in which the address, the money, the
          tickets and "disconnect" weighed the same, that is, nothing
          weighed anything. */}
      <Panel>
        {/* -- who you are ------------------------------------------------- */}
        <div className="rounded-[var(--radius-control)] bg-[var(--color-bg)] px-3.5 py-3">
          <p className="t-label">your wallet</p>
          <a
            href={addressUrl(address!)}
            target="_blank"
            rel="noreferrer"
            className="t-addr mt-1.5 flex items-center gap-2 text-base font-bold text-slate-100 hover:text-[var(--color-accent-hover)]"
          >
            {short(address!)}
            <ExternalLink className="h-5 w-5 text-white opacity-80" />
          </a>
          <p className="t-chain mt-1.5 text-xs text-slate-400">{CHAIN.name}</p>
        </div>

        {/* -- what you have -----------------------------------------------
            The number first and large, the name below it. In a list of values
            the eye looks for the numbers, not the captions; until now they
            stood on the right in small type and were read last. */}
        <p className="t-label mt-4 px-3.5">what you hold</p>
        <div className="mt-2 space-y-1.5">
          <Row
            icon={<Wallet className="h-7 w-7" />}
            name="test dollars"
            note="free on this testnet, the ticket contract is not"
            value={`$${Number(formatUnits(balance, 6)).toFixed(2)}`}
          />
          <Row
            icon={<Ticket className="h-7 w-7" />}
            name="real Megapot tickets"
            note="bought in the same transaction that opens a case"
            value={String(tickets)}
            ink="var(--color-accent-hover)"
          />
          {/* The row has to say what to DO with the shards.
              It was "5 more make the next ticket", and that was all: neither
              that the ticket has to be taken by hand, nor where the button is.
              The person who built this got confused and asked whether it might
              be automatic; a player all the more so. Now the row either calls
              you to the shelf or says how much is left before it. */}
          {/* Once the ticket is assembled the row becomes an ACTION rather than
              advice. It used to say "take it on your shelf", and that was all:
              the row itself led nowhere, and the shelf stood as a separate item
              below. The question "I have five, now what" arose for exactly that
              reason. */}
          {tesa >= WEIGHT_PER_TICKET ? (
            <Link href="/profile" className="block">
              <Row
                icon={<Shards size={36} ink="#fff" flat />}
                name="TESA"
                note={`${Math.floor(tesa / WEIGHT_PER_TICKET)} real ticket${
                  Math.floor(tesa / WEIGHT_PER_TICKET) > 1 ? "s" : ""
                } waiting, tap to take ${Math.floor(tesa / WEIGHT_PER_TICKET) > 1 ? "them" : "it"}`}
                value={String(tesa)}
                ink="var(--color-tier-shard)"
                action
              />
            </Link>
          ) : (
            <Row
              icon={<Shards size={36} ink="#fff" flat />}
              name="TESA"
              note={`${WEIGHT_PER_TICKET - (tesa % WEIGHT_PER_TICKET)} more make a real ticket`}
              value={String(tesa)}
              ink="var(--color-tier-shard)"
            />
          )}
        </div>

        {/* -- what to do with it ------------------------------------------ */}
        <p className="t-label mt-4 px-3.5">what you can do</p>
        <div className="mt-2">
          <Act href="/profile" icon={<ShieldCheck className="h-6 w-6" />}>
            Your shelf
            <span className="block text-xs font-normal leading-snug text-slate-400">
              your slots, and what you can claim
            </span>
          </Act>
          <Act href={megapotHref} icon={<Ticket className="h-6 w-6" />}>
            The jackpot
            <span className="block text-xs font-normal leading-snug text-slate-400">
              the Megapot draw your tickets are in
            </span>
          </Act>
          <button
            type="button"
            onClick={() => void mint()}
            disabled={minting}
            className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-[var(--radius-control)] px-3.5 py-2.5 text-left text-sm font-bold text-[var(--color-accent-hover)] transition-colors hover:bg-slate-800 disabled:text-slate-400"
          >
            <PlusCircle className="h-6 w-6 shrink-0 text-white" />
            <span>
              {minting ? "Minting…" : "Get $20 in test dollars"}
              <span className="block text-xs font-normal leading-snug text-slate-400">
                the faucet mints straight to your wallet
              </span>
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => disconnect()}
          // Hover highlights white rather than red. Disconnecting a wallet is
          // neither an error nor a loss: you connect back in one click and
          // nothing of yours goes anywhere, because it is on chain. Red in this
          // interface means exactly one thing, that something went wrong, and a
          // button working as intended does not get to wear it.
          className="mt-3 flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-[var(--radius-control)] border-t border-slate-800 px-3.5 py-3 pt-3.5 text-left text-sm font-bold text-slate-400 transition-colors hover:text-white"
        >
          <LogOut className="h-6 w-6 shrink-0 text-white" />
          Disconnect
        </button>
      </Panel>
    </Disclosure>
  );
}

/** The shared disclosure under the wallet button. */
function Panel({ children }: { children: React.ReactNode }) {
  return (
    /* 23rem instead of 20: on a narrower panel the labels wrapped onto two or
       three words, and the row "bought in the same transaction that opens a
       case" took three steps of eleven pixels each. Width costs nothing, and
       readability costs everything. */
    /* The panel grew to about 700 pixels tall, and on a laptop under the header
       there is less than that. Without this limit the bottom items, "Disconnect"
       and the faucet, were simply cut off by the edge of the screen, with no
       hint that anything else was there. */
    <div className="scrollbar-none max-h-[calc(100vh-5.5rem)] w-[min(23rem,calc(100vw-1.5rem))] overflow-y-auto rounded-[var(--radius-panel)] border border-slate-800 bg-[var(--color-modal)] p-2.5 shadow-2xl">
      {children}
    </div>
  );
}

/**
 * One profile row: an icon, what it is, and the number itself.
 *
 * The icon is ALWAYS white, whatever rung the thing in the row belongs to. It
 * used to take the same colour as the number below it, and the row then said the
 * same thing twice: a green ticket beside a green number, a green shard beside a
 * green number. The second green added nothing, and the first dimmed the drawing
 * itself: the thin facets of a shard blurred into a smear against muted green.
 *
 * The division is this: the icon says WHAT it is, the number says how much and
 * of what rung. Colour stays with the number, that is, where it is read.
 */
function Row({
  icon,
  name,
  note,
  value,
  ink,
  action,
}: {
  icon: React.ReactNode;
  name: string;
  /** One line of explanation under the name, when the name is not enough. */
  note?: string;
  value: string;
  /** The rung's colour. It belongs to the NUMBER, not the icon. */
  ink?: string;
  /** A row that does something: it highlights under the cursor. */
  action?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-[var(--radius-control)] px-3.5 py-2 ${
        action ? "cursor-pointer transition-colors hover:bg-slate-800" : ""
      }`}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center text-white">{icon}</span>
      <span className="min-w-0 flex-1">
        <span
          className="t-chain block text-xl font-extrabold leading-none"
          style={{ color: ink ?? "var(--color-ink)" }}
        >
          {value}
        </span>
        <span className="mt-1 block truncate text-sm font-bold leading-tight text-slate-200">
          {name}
        </span>
        {/* The explanation was eleven pixels in #5f7368, the same size and the
            same grey we have already been caught on twice with "nothing is
            visible". Thirteen pixels, one rung lighter. */}
        {note && (
          <span className="mt-0.5 block text-xs leading-snug text-slate-400">{note}</span>
        )}
      </span>
    </div>
  );
}

/** An action link with a caption under it. */
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
      className="flex min-h-11 items-center gap-3 rounded-[var(--radius-control)] px-3.5 py-2.5 text-sm font-bold text-slate-200 transition-colors hover:bg-slate-800 hover:text-[var(--color-accent-hover)]"
    >
      <span className="grid w-6 shrink-0 place-items-center text-white">{icon}</span>
      <span className="min-w-0">{children}</span>
    </Link>
  );
}
