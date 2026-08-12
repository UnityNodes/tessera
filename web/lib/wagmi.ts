import { createConfig } from "wagmi";
import { injected, coinbaseWallet } from "wagmi/connectors";
import { CHAIN, chainTransport } from "./chain";

/**
 *
 */
export const wagmiConfig = createConfig({
  chains: [CHAIN],
  connectors: [
    injected(),
    coinbaseWallet({ appName: "Tessera", preference: "all" }),
  ],
  transports: {
    //
    [CHAIN.id]: chainTransport(),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
