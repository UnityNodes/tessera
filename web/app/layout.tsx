import type { Metadata, Viewport } from "next";
import { Orbitron, Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { gameNow } from "@/lib/game";
import { feedNow } from "@/lib/opens-server";

/**
 * The HTML is reborn once every eight seconds.
 *
 * Without this the page is static, that is, assembled once at build time, and
 * then the state cache is empty and the numbers did not reach the markup at all.
 * Making it fully dynamic is not right either: then every guest would pay a
 * render for something that is the same for everyone.
 *
 * Eight seconds is exactly as long as the cache in lib/game lives. Two different
 * deadlines would give markup with numbers older than their own source.
 */
export const revalidate = 8;
import { Shell } from "@/components/Shell";
import { Backdrop } from "@/components/Backdrop";

// Two families, and exactly two. That is what the design system says: Orbitron
// for display and data, Inter for text. There was already a third family here, a
// monospace for chain numbers, and by the system its place is taken by the same
// Orbitron: it is geometric and square, so digits stand level in a column.
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

/* The title and description are written for SOMEBODY ELSE'S window rather than
   for our page. Telegram shows the title on one line and the description on three
   or four, then cuts. The old description took all four and ended on "committed
   before anyone opens anything", that is, the longest sentence stood where people
   read for three seconds.

   Now it is one thought per sentence, and the first of them is the one promise
   the game makes unconditionally. */
const TITLE = "Tessera: $1 buys a real lottery ticket";
/* The description does NOT repeat what is already written large on the picture.
   They stand in one card two centimetres from each other, and "the case comes on
   top" twice in a row adds nothing, while there is exactly as much room in those
   three lines as there is. So here is what the picture does not have: how this
   case opener differs from all the others. */
const ABOUT =
  "A real Megapot ticket, bought in the same transaction that opens the case. The pool is finite and public: a prize someone else takes is gone for everybody.";

/* The preview in messengers.
   It was 1600x400, a ratio of 4:1 that none of them expects: Telegram and X crop
   to about 1.91:1, that is, they cut off either the mark or the word. The lockup
   itself is light on top of that, and on a light messenger card the text on it
   was lost, exactly the complaint this all started from.
   Now it is 1200x630, precisely what they crop to, and in the site's language:
   a dark ground, the mark, the promise in large type, a ladder of open chests on
   the right. Checked at 420 pixels, which is how it is seen in a Telegram
   feed. */
const OG_IMAGE = "/brand/tessera-og-1200x630.png";

export const metadata: Metadata = {
  // An absolute address is needed here specifically: the link in the metadata is
  // read not by a browser but by somebody else's server (Telegram, X, Discord),
  // and a relative path tells it nothing.
  metadataBase: new URL("https://tessera.unitynodes.com"),
  title: TITLE,
  description: ABOUT,

  /* The Tessera mark is a mosaic drawn from without return: the filled tiles are
     still in the pool, the bright one with a gap is the one being opened now, the
     outlined ones have been drawn already and are gone for everyone. That is, the
     mark itself draws the very rule the game rests on.

     Three formats, each for its own case:
       .ico  old browsers that understand no others;
       .svg  modern ones, it is vector, so it stays crisp at any density;
       .png  the icon on an iOS home screen, which does not take SVG.

     favicon.ico lives in public/ and NOT in app/. Next's file convention puts a
     <link rel="icon" sizes="48x48"> on it by itself, and then together with the
     entry below there were two identical tags in <head> for the same file, with
     different sizes into the bargain. One description, one place. */
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
        // alt is read by those who are not shown the picture at all.
        alt: "Tessera: $1 buys a real lottery ticket, the case comes on top",
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

/* The colour of the browser bar on a phone. It takes the background of the mark
   itself (#12151A) rather than the page background: that is what stands under the
   icon on the home screen, and the bar should continue the mark rather than argue
   with it. */
export const viewport: Viewport = {
  themeColor: "#12151A",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${orbitron.variable} ${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-[var(--color-bg)] text-[var(--color-ink)]">
        {/* Patches of light under the page, the same thing the hero does in the
            reference: two green patches under blur-3xl. There is no shader hall
            here any more: the reference language holds to clean planes, and a
            moving texture beneath them dimmed the very colours it is built
            on. */}
        <Backdrop />
        {/* The game state, from the process cache, with no waiting. A cold start
            returns null and the page simply finishes reading the numbers in the
            browser, as it has done all along. Waiting here is not allowed: a
            second of reading the chain would land in the TTFB of every page,
            including the ones that do not need this state. */}
        <Providers seed={gameNow()} feed={feedNow()}>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
