"use client";

import { createContext, useEffect, useState } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wagmi";
import { warmInco } from "@/lib/inco";

/**
 * The game state, read by the server before the browser has run its first line of
 * JavaScript.
 *
 * Measured on 3G with a weak processor: the HTML arrived in 0.2 s, the last chunk
 * of JS in 2.5 s, and only then did the browser start asking for the numbers. So
 * for four seconds a person looked at frames without content, and no network
 * speedup changed that: the numbers simply did not exist before hydration.
 *
 * Now they arrive inside the HTML and are drawn by the same render as the markup.
 * The wagmi reads are not going anywhere, they are still the source of truth,
 * just no longer the only source for the FIRST screen.
 */
export const GameSeed = createContext<unknown | null>(null);

/**
 * The latest drops, read by the server.
 *
 * The same reason as in GameSeed, but about the strip: it waited for JS and
 * appeared at second 4.8, when the rest of the page had been up since 0.4.
 */
export const FeedSeed = createContext<unknown | null>(null);

export function Providers({
  children,
  seed = null,
  feed = null,
}: {
  children: React.ReactNode;
  seed?: unknown | null;
  feed?: unknown | null;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Deck state changes through other people's transactions too, so we
            // keep it fresh, but without fanaticism.
            staleTime: 4_000,
            retry: 2,
          },
        },
      }),
  );

  // The Inco cold start takes 49 seconds. We start it now, while the player is
  // reading what kind of game this is, rather than at the moment of the click.
  //
  // But specifically AFTER `load` rather than just in an effect. The SDK weighs
  // 780 KB unpacked, and while the start depended on when React reached the
  // effect it came out as a race of tens of milliseconds: four cold visits
  // measured, 306 ms against a load of 290, 318 against 302, 361 against 218.
  // That is, "in time or not" was decided by the network, and now and then the
  // heavy chunk did take the channel away from the first paint. The audit caught
  // it too, one run in five.
  //
  // Now it is a property rather than luck: if `load` has not happened yet we wait
  // for it; if it already has (a navigation between pages) we start at once.
  // requestIdleCallback on top pushes the warmup past the first quiet frame as
  // well, and a timer covers Safari, which cannot do idle.
  useEffect(() => {
    let cancelled = false;
    const start = () => {
      if (cancelled) return;
      const go = () => void warmInco().catch(() => {});
      if (typeof requestIdleCallback === "function") requestIdleCallback(go, { timeout: 1500 });
      else setTimeout(go, 200);
    };

    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("load", start);
    };
  }, []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <GameSeed.Provider value={seed}>
          <FeedSeed.Provider value={feed}>{children}</FeedSeed.Provider>
        </GameSeed.Provider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
