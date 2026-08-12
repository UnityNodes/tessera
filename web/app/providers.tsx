"use client";

import { createContext, useEffect, useState } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wagmi";
import { warmInco } from "@/lib/inco";

/**
 *
 *
 */
export const GameSeed = createContext<unknown | null>(null);

/**
 *
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
            staleTime: 4_000,
            retry: 2,
          },
        },
      }),
  );

  useEffect(() => {
    void warmInco().catch(() => {});
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
