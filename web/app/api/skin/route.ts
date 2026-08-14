import { createPublicClient } from "viem";
import { TESSERA_DECK_ABI } from "@/lib/abi";
import { CHAIN, chainTransport, DECK_ADDRESS } from "@/lib/chain";
import { judge } from "@/lib/nsfw";
import { putSkin, setStatus, readIndex, skinMessage } from "@/lib/skinstore";

/** The largest file. A chest on screen is never larger than 300 pixels. */
const MAX_BYTES = 4 * 1024 * 1024;

const client = createPublicClient({ chain: CHAIN, transport: chainTransport() });

/**
 * A deck picture: upload and the list of approved ones.
 *
 * Who is uploading is proved by a signature rather than by a word. The server
 * reads the deck creator from the CHAIN and compares it with the address that
 * signed the message. Without that anyone could swap somebody else's picture
 * knowing only the deck number.
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
  // PNG and only PNG, and it is checked by content rather than by name: the
  // extension proves nothing, and the file goes to a decoder next.
  const isPng = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (!isPng) {
    return Response.json({ error: "PNG only" }, { status: 400 });
  }

  // -- who this is ---------------------------------------------------
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

  // It is the chain CLIENT that checks, not viem's plain verifyMessage, and
  // that is not pedantry. The plain function knows exactly one way of signing,
  // ECDSA with a private key. But among the wallets that can be connected here
  // is Coinbase Smart Wallet: it has no key behind the address, it signs over
  // ERC-1271, and a plain check answers "not the creator" to a signature by the
  // real creator. The client can do both, because it can ask the wallet
  // contract itself. `lib/ownercheck` does the same.
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

  // -- what this is --------------------------------------------------
  let verdict;
  try {
    verdict = await judge(bytes);
  } catch {
    // Could not read or classify it, so it does not get through. Letting
    // something you did not look at pass is worse than refusing.
    return Response.json({ error: "could not read that image" }, { status: 400 });
  }

  putSkin(deckId, bytes, creator);
  setStatus(deckId, verdict.ok ? "ok" : "no", verdict.why);

  return Response.json(
    { status: verdict.ok ? "ok" : "no", why: verdict.why, scores: verdict.scores },
    { status: verdict.ok ? 200 : 422 },
  );
}
