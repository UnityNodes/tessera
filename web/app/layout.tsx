import type { Metadata } from "next";
import { Orbitron, Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
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

export const metadata: Metadata = {
  title: "Tessera, a case, and a real lottery ticket",
  description:
    "One dollar buys a real Megapot ticket. The case comes on top. What is inside lives in an encrypted, finite pool on Inco Lightning, committed before anyone opens anything.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${orbitron.variable} ${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-[var(--color-bg)] text-[var(--color-ink)]">
        <Backdrop />
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
