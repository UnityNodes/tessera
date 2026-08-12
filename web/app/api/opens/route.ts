import { opensPayload } from "@/lib/opens-server";

/**
 *
 */
export async function GET() {
  return Response.json(await opensPayload(), {
    headers: { "cache-control": "no-store" },
  });
}

export const dynamic = "force-dynamic";
