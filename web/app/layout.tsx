import type { Metadata, Viewport } from "next";
import { Orbitron, Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { gameNow } from "@/lib/game";
import { feedNow } from "@/lib/opens-server";

/**
 *
 *
 */
export const revalidate = 8;
import { Shell } from "@/components/Shell";
import { Backdrop } from "@/components/Backdrop";

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  weight: ["500", "700", "900"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});


const TITLE = "Tessera, $1 buys a real lottery ticket";
const ABOUT =
  "A real Megapot ticket, bought in the same transaction that opens the case. The pool is finite and public: a prize someone else takes is gone for everybody.";

const OG_IMAGE = "/brand/tessera-og-1200x630.png";

export const metadata: Metadata = {
  metadataBase: new URL("https://tessera.unitynodes.com"),
  title: TITLE,
  description: ABOUT,



  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/brand/tessera-favicon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/brand/apple-touch-icon-180.png", sizes: "180x180", type: "image/png" }],
  },

  openGraph: {
    type: "website",
    siteName: "Tessera",
    title: TITLE,
    description: ABOUT,
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "Tessera, $1 buys a real lottery ticket, the case comes on top",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: ABOUT,
    images: [OG_IMAGE],
  },
};

export const viewport: Viewport = {
  themeColor: "#12151A",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${orbitron.variable} ${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-[var(--color-bg)] text-[var(--color-ink)]">
        <Backdrop />
        <Providers seed={gameNow()} feed={feedNow()}>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
