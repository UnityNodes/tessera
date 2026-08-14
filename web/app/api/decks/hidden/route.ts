import { readHidden } from "@/lib/hidden";

/** The public list of hidden decks, read by the catalogue. */
export async function GET() {
  return Response.json({ hidden: readHidden() }, { headers: { "cache-control": "no-store" } });
}
