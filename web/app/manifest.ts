import type { MetadataRoute } from "next";

/**
 *
 *
 *
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
