import fs from "node:fs";
import path from "node:path";
import { DECK_ADDRESS } from "./chain";

/**
 *
 *
 */
const FILE = path.join(process.cwd(), ".data", "hidden.json");

/**
 *
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
