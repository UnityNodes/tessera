//
//
//
//   node audit-chain.cjs [url] > /tmp/audit-chain.json
//

const fs = require("node:fs");
const path = require("node:path");
const { createPublicClient, http, parseAbiItem, getAddress } = require("viem");
const { baseSepolia } = require("viem/chains");

const URL = (process.argv[2] || "https://tessera.unitynodes.com").replace(/\/+$/, "");
const RPC = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
const OUT = process.env.SHOT_DIR || "/tmp";

const WEB = path.join(__dirname, "..", "web");
const chainSrc = fs.readFileSync(path.join(WEB, "lib", "chain.ts"), "utf8");
const pick = (name) => {
  const m = chainSrc.match(new RegExp(`${name}[^"']*["'](0x[0-9a-fA-F]{40}|\\d+)["']`));
  return m ? m[1] : null;
};
const DECK = getAddress(pick("DECK_ADDRESS"));
const TOKEN = getAddress(pick("TICKET_TOKEN"));
const FROM_BLOCK = BigInt(chainSrc.match(/DECK_FROM_BLOCK[^"']*["'](\d+)["']/)[1]);

const abiSrc = fs.readFileSync(path.join(WEB, "lib", "abi.ts"), "utf8");
const DECK_ABI = JSON.parse(abiSrc.slice(abiSrc.indexOf("["), abiSrc.lastIndexOf("]") + 1));

const ERC20 = [
  parseAbiItem("function balanceOf(address) view returns (uint256)"),
  parseAbiItem("function decimals() view returns (uint8)"),
];

const CASE_OPENED = parseAbiItem(
  "event CaseOpened(address indexed player, uint32 indexed deckId, uint16 index, bytes32 handle, uint256 paid)",
);
const RISK_TAKEN = parseAbiItem(
  "event RiskTaken(address indexed player, uint32 indexed deckId, uint16 index, bytes32 handle, uint256 toVault)",
);

const client = createPublicClient({ chain: baseSepolia, transport: http(RPC, { retryCount: 5 }) });

const rows = [];
const fail = [];
function check(level, name, ok, detail) {
  rows.push({ level, name, ok, detail });
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? `, ${detail}` : ""}`);
  if (!ok) fail.push(`[${level}] ${name}: ${detail}`);
}
const usd = (v) => `$${(Number(v) / 1e6).toFixed(2)}`;

(async () => {
  console.log("\n── 0: ──");

  const read = (functionName, args) =>
    client.readContract({ address: DECK, abi: DECK_ABI, functionName, args });

  //
  const IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const implWord = await client.getStorageAt({ address: DECK, slot: IMPL_SLOT });
  const impl = implWord && implWord !== `0x${"0".repeat(64)}`
    ? getAddress(`0x${implWord.slice(26)}`)
    : null;
  check(0, "", impl !== null, impl ? `${impl}` : "ERC-1967 ");

  if (impl) {
    const code = await client.getBytecode({ address: impl });
    check(0, "", Boolean(code) && code !== "0x", `${(code.length - 2) / 2} `);
  }

  const count = Number(await read("deckCount"));
  check(0, "", count > 0, `${count} .`);

  const decks = [];
  for (let id = 0; id < count; id++) {
    const d = await read("deckAt", [id]);
    const t = await read("tiers", [id]);
    decks.push({
      id,
      size: Number(d.size),
      drawn: Number(d.drawn),
      vaultUpTo: Number(d.vaultUpTo),
      vault: BigInt(d.vault),
      unswept: Number(d.unsweptOpens),
      tiers: t.map((x) => ({ upTo: Number(x.upTo), weight: Number(x.weight) })),
    });
  }
  for (const d of decks) {
    check(
      0,
      `#${d.id}: `,
      d.drawn <= d.size,
      `${d.drawn} ${d.size}`,
    );
    const sorted = d.tiers.every((t, i) => i === 0 || t.upTo > d.tiers[i - 1].upTo);
    check(0, `#${d.id}: `, sorted, `${d.tiers.length} `);
    check(
      0,
      `#${d.id}: `,
      d.vaultUpTo <= d.size,
      `${d.vaultUpTo} `,
    );
  }

  const treasury = BigInt(await read("treasury"));
  const fees = BigInt(await read("feesClaimable"));
  const vaults = decks.reduce((a, d) => a + d.vault, 0n);
  const held = await client.readContract({
    address: TOKEN,
    abi: ERC20,
    functionName: "balanceOf",
    args: [DECK],
  });
  //
  let creators = null;
  try {
    creators = BigInt(await read("creatorOwed"));
  } catch {
    console.log(
      "    ⚠ creatorOwed ",
    );
  }
  const owed = vaults + treasury + (creators ?? 0n);

  check(
    0,
    creators === null
      ? ": + ≤ "
      : ": + + ≤ ",
    owed <= held,
    `${usd(vaults)}${creators === null ? "" : ` + ${usd(creators)}`} + ${usd(treasury)}` +
      ` = ${usd(owed)} ${usd(held)}` +
      (owed === held ? " ()" : ` (${usd(held - owed)})`),
  );
  console.log(`    Megapot : ${usd(fees)}`);

  const unsweptTotal = BigInt(await read("unsweptOpens"));
  const battles = Number(await read("battleCount"));
  check(0, "", Number.isFinite(battles), `${battles} .`);

  console.log("\n── 1: ──");

  const latest = await client.getBlockNumber();
  const WINDOW = 1900n;
  const mine = [];
  const risky = new Set();
  for (let from = FROM_BLOCK; from <= latest; from += WINDOW) {
    const to = from + WINDOW - 1n > latest ? latest : from + WINDOW - 1n;
    const logs = await client.getLogs({
      address: DECK,
      events: [CASE_OPENED, RISK_TAKEN],
      fromBlock: from,
      toBlock: to,
    });
    for (const l of logs) {
      if (l.eventName === "RiskTaken" && l.args.handle) risky.add(l.args.handle.toLowerCase());
      if (l.eventName !== "CaseOpened") continue;
      mine.push({
        player: l.args.player,
        deckId: Number(l.args.deckId ?? 0),
        handle: l.args.handle,
        block: l.blockNumber,
      });
    }
  }
  check(1, "", mine.length > 0, `${mine.length} `);

  const api = await fetch(`${URL}/api/opens`).then((r) => r.json());
  const theirs = api.events ?? [];

  const mySet = new Set(mine.map((e) => e.handle.toLowerCase()));
  const theirSet = new Set(theirs.map((e) => e.handle.toLowerCase()));
  const onlyMine = [...mySet].filter((h) => !theirSet.has(h));
  const onlyTheirs = [...theirSet].filter((h) => !mySet.has(h));
  check(
    1,
    "/api/opens",
    onlyMine.length === 0 && onlyTheirs.length === 0,
    `${mySet.size}, ${theirSet.size}; ${onlyMine.length}, ${onlyTheirs.length}`,
  );

  check(
    1,
    ": scanned ",
    latest - BigInt(api.scanned) <= 2n * WINDOW,
    `scanned ${api.scanned}, ${latest}`,
  );

  const myRisk = risky.size;
  const theirRisk = theirs.filter((e) => e.risk).length;
  check(1, "", myRisk === theirRisk, `${myRisk} ${theirRisk}`);

  //
  const vals = api.revealed ?? [];
  const byHandle = new Map(theirs.map((e) => [e.handle.toLowerCase(), e]));

  const outOfRange = vals.filter((r) => {
    const ev = byHandle.get(r.handle.toLowerCase());
    const d = ev ? decks[ev.deckId] : undefined;
    return !d || !Number.isInteger(r.value) || r.value < 1 || r.value > d.size;
  });
  check(
    1,
    "",
    outOfRange.length === 0,
    `${vals.length} , ${outOfRange.length}`,
  );

  const seen = new Map();
  const dupes = [];
  for (const r of vals) {
    const ev = byHandle.get(r.handle.toLowerCase());
    if (!ev) continue;
    const k = `${ev.deckId}:${r.value}`;
    if (seen.has(k)) dupes.push(k);
    seen.set(k, r.handle);
  }
  check(
    1,
    "",
    dupes.length === 0,
    dupes.length ? `: ${dupes.slice(0, 3).join(", ")}` : `${seen.size} `,
  );

  const badSig = vals.filter(
    (r) => !r.signatures?.length || r.signatures.some((s) => !/^0x[0-9a-fA-F]{130}$/.test(s)),
  );
  check(
    1,
    "",
    badSig.length === 0,
    `${vals.length} , ${badSig.length}`,
  );

  const revealedSet = new Set(vals.map((r) => r.handle.toLowerCase()));
  const orphan = [...revealedSet].filter((h) => !byHandle.has(h));
  check(
    1,
    "",
    orphan.length === 0,
    `${orphan.length}`,
  );

  console.log("\n── 2: ──");

  const t0 = Date.now();
  const res = await fetch(`${URL}/api/opens`);
  const ms = Date.now() - t0;
  const body = await res.json();
  check(2, "/api/opens ", res.ok, `${res.status} ${ms} `);
  const cc = res.headers.get("cache-control") || "";
  check(
    2,
    "",
    /no-store|no-cache/.test(cc),
    cc || "",
  );
  check(
    2,
    "",
    Array.isArray(body.events) && typeof body.scanned === "string",
    `events ${Array.isArray(body.events)}, scanned ${typeof body.scanned}`,
  );

  //
  const waiting = [];
  for (let i = 1; i <= battles; i++) {
    const b = await read("battleAt", [i]);
    const joined = BigInt(b.b) !== 0n && b.b !== "0x0000000000000000000000000000000000000000";
    if (!b.resolved && !joined) waiting.push(Number(b.deckId));
  }
  check(
    2,
    ", ",
    true,
    waiting.length ? `${waiting.length} ., ${waiting.join(", ")}` : "",
  );

  for (const d of decks) {
    const fromApi = theirs.filter((e) => e.deckId === d.id).length;
    const sealedInBattles = waiting.filter((id) => id === d.id).length;
    check(
      2,
      `#${d.id}: drawn = + `,
      d.drawn === fromApi + sealedInBattles,
      `${d.drawn} = API ${fromApi} + ${sealedInBattles}`,
    );
  }

  const expected = {
    url: URL,
    at: new Date().toISOString(),
    decks: decks.map((d) => {
      const coming =
        d.vaultUpTo > 0 && unsweptTotal > 0n
          ? ((fees / 2n) * BigInt(d.unswept)) / unsweptTotal
          : 0n;
      return {
        id: d.id,
        size: d.size,
        drawn: d.drawn,
        remaining: d.size - d.drawn,
        vaultBankedUsd: (Number(d.vault) / 1e6).toFixed(2),
        vaultUsd: (Number(d.vault + coming) / 1e6).toFixed(2),
        hasVault: d.vaultUpTo > 0,
        //
        tesa: (() => {
          let prev = 0;
          let n = 0;
          for (const t of d.tiers) {
            const inTier = t.upTo - prev;
            const vaultHere = Math.max(0, Math.min(t.upTo, d.vaultUpTo) - prev);
            if (t.weight === 1) n += inTier - vaultHere;
            prev = t.upTo;
          }
          return n;
        })(),
      };
    }),
    totals: {
      drawn: decks.reduce((a, d) => a + d.drawn, 0),
      remaining: decks.reduce((a, d) => a + (d.size - d.drawn), 0),
      size: decks.reduce((a, d) => a + d.size, 0),
      players: new Set(mine.map((e) => e.player.toLowerCase())).size,
      decks: decks.length,
    },
    events: mine.length,
    battles,
  };
  fs.writeFileSync(path.join(OUT, "audit-expected.json"), JSON.stringify(expected, null, 2));

  console.log(
    `\n  → ${path.join(OUT, "audit-expected.json")}` +
      `\n  ${expected.totals.drawn}, ${expected.totals.remaining} ${expected.totals.size},` +
      ` ${expected.totals.players}, ${battles}`,
  );

  console.log(`\n${"═".repeat(60)}`);
  console.log(`${rows.filter((r) => r.ok).length}, ${fail.length}`);
  for (const f of fail) console.log("  ✗", f);
  process.exit(fail.length ? 1 : 0);
})().catch((e) => {
  console.error(":", e.message);
  process.exit(2);
});
