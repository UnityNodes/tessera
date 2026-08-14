import type { MetadataRoute } from "next";

/**
 * What a phone sees when the site is put on the home screen.
 *
 * Without this file Android takes the name from <title>, "Tessera, a case, and a
 * real lottery ticket", a string that is cut off at the third word under the
 * icon, and draws an icon guessed from a 48 pixel favicon.
 *
 * `display: "browser"` is deliberate. The standard `standalone` for manifests
 * hides the address bar, and on a site that asks for a wallet signature and
 * spends money the address bar is the only thing a person checks that they are
 * where they think they are with. Hiding it for the look of an app costs more
 * here than it gives.
 *
 * The colours come from the mark itself (#12151A) rather than from the page:
 * under the icon on the home screen stands the mark's tile, and the splash should
 * continue it rather than argue.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tessera",
    short_name: "Tessera",
    description: "A finite pool, drawn without replacement. Every case buys a real Megapot ticket.",
    start_url: "/",
    display: "browser",
    background_color: "#12151A",
    theme_color: "#12151A",
    icons: [
      { src: "/brand/tessera-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/tessera-icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/tessera-favicon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
