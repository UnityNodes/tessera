import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DECK_ADDRESS } from "./chain";

/**
 *
 *
 *
 */
export type SkinStatus = "pending" | "ok" | "no";

export interface SkinRecord {
  status: SkinStatus;
  by: string;
  at: number;
  why?: string;
}

const DIR = path.join(process.cwd(), ".data", "skins");
const INDEX = path.join(DIR, "index.json");

export const skinFile = (deckId: number) => path.join(DIR, `${deckId}.png`);

/**
 *
 */
export function skinMessage(deckId: number, png: Buffer) {
  const sum = crypto.createHash("sha256").update(png).digest("hex");
  return `tessera: set the picture of deck ${deckId} to ${sum}`;
}

/**
 *
 *
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
