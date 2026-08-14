import { opensPayload } from "@/lib/opens-server";

/**
 * The open history for the browser.
 *
 * All of the work is in lib/opens-server: the same cache serves both this route
 * and the server render of the strip.
 */
export async function GET() {
  return Response.json(await opensPayload(), {
    // Going around the browser cache is not allowed: the strip polls this once
    // every ten seconds, and every answer has to be fresh.
    headers: { "cache-control": "no-store" },
  });
}

/** Reading the chain at build time makes no sense. */
export const dynamic = "force-dynamic";
