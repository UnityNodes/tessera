import { createConfig } from "wagmi";
import { injected, coinbaseWallet, walletConnect } from "wagmi/connectors";
import { CHAIN, chainTransport } from "./chain";

/**
 *
 */
const WALLETCONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "3d17fd64ff03164441920b916dce91bd";

/**
 *
 *
 *
 */
export const wagmiConfig = createConfig({
  chains: [CHAIN],
  connectors: [
    injected(),
    coinbaseWallet({ appName: "Tessera", preference: "all" }),
    walletConnect({ projectId: WALLETCONNECT_PROJECT_ID, showQrModal: true }),
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
