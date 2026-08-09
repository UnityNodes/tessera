import fs from "node:fs";
import { readIndex, skinFile } from "@/lib/skinstore";

/**
 *
 */
export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const deckId = Number(id);
  if (!Number.isInteger(deckId)) return new Response("no", { status: 400 });

  const rec = readIndex()[String(deckId)];
  if (!rec || rec.status !== "ok") return new Response("no", { status: 404 });

  try {
    const png = fs.readFileSync(skinFile(deckId));
    return new Response(new Uint8Array(png), {
      headers: {
        "content-type": "image/png",
        "cache-control": "public, max-age=60",
      },
    });
  } catch {
    return new Response("no", { status: 404 });
  }
}
