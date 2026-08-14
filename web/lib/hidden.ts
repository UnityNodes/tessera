import fs from "node:fs";
import path from "node:path";
import { DECK_ADDRESS } from "./chain";

/**
 * Decks hidden from the catalogue.
 *
 * Nobody can remove a deck from the chain, neither its creator nor the owner of
 * the contract. That is deliberate: a pool players paid into cannot be cancelled
 * after the fact. But the catalogue is a shop window rather than the chain, and
 * a window can be curated.
 *
 * So the list lives here rather than in the contract. A hidden deck stays
 * playable by direct link: its slots, its vault and its prizes are all still
 * there, and anyone already playing it loses nothing. Only the card on the home
 * page disappears.
 */
const FILE = path.join(process.cwd(), ".data", "hidden.json");

/**
 * The list is tied to the game's address, like the feed cache and the picture
 * index.
 *
 * A deck number is unique only within one contract. A list of [5, 6] from a
 * previous game would hide the first two new decks that came along, and nobody
 * would understand why: on chain they are fine, and the card on the home page is
 * simply missing.
 */
interface HiddenFile {
  deck: string;
  ids: number[];
}

export function readHidden(): number[] {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, "utf8")) as HiddenFile;
    if (raw.deck !== DECK_ADDRESS) return [];
    return raw.ids ?? [];
  } catch {
    return [];
  }
}

export function setHidden(deckId: number, hide: boolean) {
  const now = new Set(readHidden());
  if (hide) now.add(deckId);
  else now.delete(deckId);
  const out = [...now].sort((a, b) => a - b);
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const file: HiddenFile = { deck: DECK_ADDRESS, ids: out };
  fs.writeFileSync(FILE, JSON.stringify(file));
  return out;
}
