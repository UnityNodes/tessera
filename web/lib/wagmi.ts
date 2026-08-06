import { createConfig, http } from "wagmi";
import { injected, coinbaseWallet } from "wagmi/connectors";
import { CHAIN, RPC_URL } from "./chain";

/**
 */
export const wagmiConfig = createConfig({
  chains: [CHAIN],
  connectors: [
    injected(),
    coinbaseWallet({ appName: "Tessera", preference: "all" }),
  ],
  transports: {
    //
    //
    [CHAIN.id]: http(RPC_URL, {
      batch: { wait: 16 },
      retryCount: 3,
      retryDelay: 400,
    }),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
