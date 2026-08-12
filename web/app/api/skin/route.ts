import { createPublicClient } from "viem";
import { TESSERA_DECK_ABI } from "@/lib/abi";
import { CHAIN, chainTransport, DECK_ADDRESS } from "@/lib/chain";
import { judge } from "@/lib/nsfw";
import { putSkin, setStatus, readIndex, skinMessage } from "@/lib/skinstore";

const MAX_BYTES = 4 * 1024 * 1024;

const client = createPublicClient({ chain: CHAIN, transport: chainTransport() });

/**
 *
 */
export async function GET() {
  const all = readIndex();
  const ok = Object.entries(all)
    .filter(([, r]) => r.status === "ok")
    .map(([id]) => Number(id));
  return Response.json({ approved: ok }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "expected a form" }, { status: 400 });
  }

  const deckId = Number(form.get("deckId"));
  const signature = String(form.get("signature") ?? "");
  const file = form.get("file");

  if (!Number.isInteger(deckId) || deckId < 0 || !signature || !(file instanceof Blob)) {
    return Response.json({ error: "deckId, signature and file are required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "the file is over 4 MB" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const isPng = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (!isPng) {
    return Response.json({ error: "PNG only" }, { status: 400 });
  }

  let creator: string;
  try {
    const deck = (await client.readContract({
      address: DECK_ADDRESS,
      abi: TESSERA_DECK_ABI,
      functionName: "deckAt",
      args: [deckId],
    })) as { creator: `0x${string}` };
    creator = deck.creator;
  } catch {
    return Response.json({ error: "no such deck" }, { status: 404 });
  }
  if (!creator || creator === "0x0000000000000000000000000000000000000000") {
    return Response.json({ error: "house decks keep their own art" }, { status: 403 });
  }

  const ok = await client
    .verifyMessage({
      address: creator as `0x${string}`,
      message: skinMessage(deckId, bytes),
      signature: signature as `0x${string}`,
    })
    .catch(() => false);
  if (!ok) {
    return Response.json({ error: "only the deck's creator can set its picture" }, { status: 403 });
  }

  let verdict;
  try {
    verdict = await judge(bytes);
  } catch {
    return Response.json({ error: "could not read that image" }, { status: 400 });
  }

  putSkin(deckId, bytes, creator);
  setStatus(deckId, verdict.ok ? "ok" : "no", verdict.why);

  return Response.json(
    { status: verdict.ok ? "ok" : "no", why: verdict.why, scores: verdict.scores },
    { status: verdict.ok ? 200 : 422 },
  );
}
