import fs from "node:fs";
import path from "node:path";

/**
 *
 *
 */
const FILE = path.join(process.cwd(), ".data", "hidden.json");

export function readHidden(): number[] {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8")) as number[];
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
  fs.writeFileSync(FILE, JSON.stringify(out));
  return out;
}
