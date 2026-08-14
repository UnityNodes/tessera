import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DECK_ADDRESS } from "./chain";

/**
 * Pictures for player decks live off chain, and that is a decision rather than
 * laziness.
 *
 * Only `name:hue` goes on chain, and it goes there FOREVER: deckMeta cannot be
 * changed after the cut, precisely because otherwise one could gather players on
 * a nice picture and swap it afterwards.
 *
 * But that same immutability makes something else impossible: taking down a
 * picture that does not belong here. A link on chain cannot be revoked by
 * anyone, us included. So the file lives here, tied to the deck number, and can
 * be removed at any time. The deck does not break: without a picture it shows a
 * chest in its own colour, exactly as it did before there was one.
 *
 * There are exactly three states:
 *   pending  uploaded, waiting for eyes
 *   ok       shown
 *   no       rejected; the file stays so it is clear what for
 */
export type SkinStatus = "pending" | "ok" | "no";

export interface SkinRecord {
  status: SkinStatus;
  /** Who uploaded it. Must match the deck's creator on chain. */
  by: string;
  at: number;
  /** Why it was rejected, so the creator can be told something. */
  why?: string;
}

const DIR = path.join(process.cwd(), ".data", "skins");
const INDEX = path.join(DIR, "index.json");

export const skinFile = (deckId: number) => path.join(DIR, `${deckId}.png`);

/**
 * What exactly the creator signs.
 *
 * Not merely "I am the creator of deck 7" but "I am giving deck 7 THIS picture":
 * the message includes the file's hash. Otherwise one intercepted signature
 * would allow any other image to be slipped in under the same number.
 */
export function skinMessage(deckId: number, png: Buffer) {
  const sum = crypto.createHash("sha256").update(png).digest("hex");
  return `tessera: set the picture of deck ${deckId} to ${sum}`;
}

/**
 * The index is tied to the game's address, exactly like the cache of the open
 * feed.
 *
 * A deck number means something only within one contract: in a new game the
 * numbering starts at zero, and a picture approved for somebody else's deck #6
 * would quietly go to whichever new deck came first. Not "unlikely": that is
 * exactly what sat in .data when the game moved behind a proxy.
 *
 * Behind a proxy the address no longer changes, so this safeguard most likely
 * has nowhere left to fire. But it costs nothing, and quietly serving somebody
 * else's picture is precisely what moderation exists for here.
 */
interface SkinIndex {
  deck: string;
  skins: Record<string, SkinRecord>;
}

export function readIndex(): Record<string, SkinRecord> {
  try {
    const raw = JSON.parse(fs.readFileSync(INDEX, "utf8")) as SkinIndex;
    if (raw.deck !== DECK_ADDRESS) return {};
    return raw.skins ?? {};
  } catch {
    // The file does not exist yet, which is an empty queue rather than an error.
    return {};
  }
}

export function writeIndex(all: Record<string, SkinRecord>) {
  fs.mkdirSync(DIR, { recursive: true });
  const out: SkinIndex = { deck: DECK_ADDRESS, skins: all };
  fs.writeFileSync(INDEX, JSON.stringify(out, null, 2));
}

export function putSkin(deckId: number, png: Buffer, by: string) {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(skinFile(deckId), png);
  const all = readIndex();
  // A new picture always starts in the queue, even if the previous one was
  // approved: otherwise approving one would open the door to any that followed
  // under the same number.
  all[String(deckId)] = { status: "pending", by, at: Date.now() };
  writeIndex(all);
}

export function setStatus(deckId: number, status: SkinStatus, why?: string) {
  const all = readIndex();
  const rec = all[String(deckId)];
  if (!rec) return false;
  all[String(deckId)] = { ...rec, status, why };
  writeIndex(all);
  return true;
}
