import { gameFresh } from "@/lib/game";

/**
 *
 */
export async function GET() {
  try {
    return Response.json(await gameFresh(), { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "chain unavailable" }, { status: 503 });
  }
}

export const dynamic = "force-dynamic";
