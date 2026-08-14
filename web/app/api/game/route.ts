import { gameFresh } from "@/lib/game";

/**
 * The game state for the browser.
 *
 * All of the work is in lib/game: the same cache serves both this route and
 * the server render of the page. Two caches would drift apart, and the HTML
 * would show one set of numbers and the first refresh another.
 */
export async function GET() {
  try {
    return Response.json(await gameFresh(), { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "chain unavailable" }, { status: 503 });
  }
}

export const dynamic = "force-dynamic";
