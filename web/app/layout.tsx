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

const TITLE = "Tessera, a case, and a real lottery ticket";
const ABOUT =
  "One dollar buys a real Megapot ticket. The case comes on top. What is inside lives in an encrypted, finite pool on Inco Lightning, committed before anyone opens anything.";

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
    images: [{ url: "/brand/tessera-lockup-dark-1600x400.png", width: 1600, height: 400 }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: ABOUT,
    images: ["/brand/tessera-lockup-dark-1600x400.png"],
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
