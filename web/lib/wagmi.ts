import { createConfig } from "wagmi";
import { injected, coinbaseWallet, walletConnect } from "wagmi/connectors";
import { CHAIN, chainTransport } from "./chain";

/**
 * The WalletConnect project key.
 *
 * It is public by design and ships to the browser with the script; hiding it is
 * impossible and unnecessary, because it is not a secret but an identifier of
 * the application in their registry. So it sits here in the code with an
 * environment variable as an override, exactly as the game's address does in
 * `lib/chain`.
 */
const WALLETCONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "3d17fd64ff03164441920b916dce91bd";

/**
 * One network, three connectors. RainbowKit and its like are deliberately not
 * used: they bring their own look, which would have to be overridden, and the
 * connect screen here is part of the game rather than a utility dialog.
 *
 * The list is not limited to three, and that is the main thing about it: the
 * browser announces every installed wallet itself through EIP-6963, and they all
 * arrive here under their own name and their own icon. `injected()` remains the
 * fallback for those that cannot do this; see `components/Wallets`.
 *
 * WalletConnect is here for the phone, and without it the list was incomplete
 * not slightly but fundamentally: EIP-6963 announces EXTENSIONS only, so on a
 * mobile browser without a built in wallet there was nothing to connect with at
 * all. Now there is a QR code and deep links into the apps.
 *
 * The price is honest: WalletConnect draws its own window with the QR and we
 * cannot override it, which is exactly what we avoided with RainbowKit. The
 * difference is that RainbowKit offered its look instead of ours for something
 * we could already do, while this window is the only way to do something we
 * could not do at all. The list itself stays ours: WalletConnect is one row in
 * it alongside the rest, and that window opens only when the row is pressed.
 */
export const wagmiConfig = createConfig({
  chains: [CHAIN],
  connectors: [
    injected(),
    coinbaseWallet({ appName: "Tessera", preference: "all" }),
    walletConnect({ projectId: WALLETCONNECT_PROJECT_ID, showQrModal: true }),
  ],
  transports: {
    // The same transport as on the server: the endpoint list with its fallbacks,
    // batching, and three attempts on a 429. All the reasoning sits next to
    // `chainTransport` in lib/chain.
    //
    // It became shared for a reason. There used to be a copy of the same
    // settings here, and when the fallback endpoints appeared on the server the
    // browser would have been left with one, which means the very side the
    // player sees would have kept failing on 429s.
    [CHAIN.id]: chainTransport(),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
