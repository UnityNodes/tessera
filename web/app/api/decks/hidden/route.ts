import { readHidden } from "@/lib/hidden";

export async function GET() {
  return Response.json({ hidden: readHidden() }, { headers: { "cache-control": "no-store" } });
}
