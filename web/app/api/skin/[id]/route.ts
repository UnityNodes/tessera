import fs from "node:fs";
import { readIndex, skinFile } from "@/lib/skinstore";

/**
 * Serve a deck picture, and only an approved one.
 *
 * The status check lives here, at the serving end, rather than at upload. The
 * file is on disk either way; whether it can be seen is decided by one row in
 * the index. So taking a picture down means changing a status rather than
 * hunting for wherever it was copied to.
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
        // Briefly: a picture can be taken down at any moment, and a cache of a
        // day would mean that a picture taken down hangs in other people's
        // browsers for another day.
        "cache-control": "public, max-age=60",
      },
    });
  } catch {
    return new Response("no", { status: 404 });
  }
}
