import { isOwner } from "@/lib/ownercheck";
import { readHidden, setHidden } from "@/lib/hidden";
import { readIndex, setStatus } from "@/lib/skinstore";

/**
 *
 */
export async function GET() {
  return Response.json(
    { hidden: readHidden(), skins: readIndex() },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    address?: string;
    signature?: string;
    action?: "hide" | "show" | "pull" | "restore";
    deckId?: number;
  } | null;

  if (!body?.address || !body.signature || !body.action || !Number.isInteger(body.deckId)) {
    return Response.json({ error: "address, signature, action and deckId are required" }, { status: 400 });
  }

  const message = `tessera: ${body.action} deck ${body.deckId}`;
  if (!(await isOwner(body.address, message, body.signature))) {
    return Response.json({ error: "only the contract owner can do that" }, { status: 403 });
  }

  const id = body.deckId as number;
  if (body.action === "hide" || body.action === "show") {
    setHidden(id, body.action === "hide");
  } else {
    setStatus(id, body.action === "pull" ? "no" : "ok", body.action === "pull" ? "pulled" : undefined);
  }
  return Response.json({ hidden: readHidden(), skins: readIndex() });
}
