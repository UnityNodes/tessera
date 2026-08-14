// An independent recount of everything the site shows.
//
// The point is the independence: this file does NOT import the hooks, or
// lib/inco, or lib/deck. It reads the chain with its own client, assembles the
// events itself, reveals the values itself, and only then compares them with
// what /api/opens hands over and what is shown on screen. A check assembled from
// the very code it checks would pass on any mistake that code makes.
//
// Exactly two indisputable facts are taken from the site code: the ABI (that is
// a description of the contract, not our logic) and the addresses.
//
//   node audit-chain.cjs [url] > /tmp/audit-chain.json
//
// The numbers for the next step go into SHOT_DIR/audit-expected.json, where
// audit-ui.py reads them and compares them against the screen.

const fs = require("node:fs");
const path = require("node:path");
const { createPublicClient, http, parseAbiItem, getAddress } = require("viem");
const { baseSepolia } = require("viem/chains");

const URL = (process.argv[2] || "https://tessera.unitynodes.com").replace(/\/+$/, "");
const RPC = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
const OUT = process.env.SHOT_DIR || "/tmp";

// -- what we take from the site code: addresses and the ABI ---------------
const WEB = path.join(__dirname, "..", "web");
const chainSrc = fs.readFileSync(path.join(WEB, "lib", "chain.ts"), "utf8");
const pick = (name) => {
  const m = chainSrc.match(new RegExp(`${name}[^"']*["'](0x[0-9a-fA-F]{40}|\\d+)["']`));
  return m ? m[1] : null;
};
const DECK = getAddress(pick("DECK_ADDRESS"));
const TOKEN = getAddress(pick("TICKET_TOKEN"));
const FROM_BLOCK = BigInt(chainSrc.match(/DECK_FROM_BLOCK[^"']*["'](\d+)["']/)[1]);

// The ABI is pulled out of web/lib/abi.ts as a JSON array.
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

// -- the report -----------------------------------------------------------
const rows = [];
const fail = [];
function check(level, name, ok, detail) {
  rows.push({ level, name, ok, detail });
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? `  - ${detail}` : ""}`);
  if (!ok) fail.push(`[${level}] ${name}: ${detail}`);
}
const usd = (v) => `$${(Number(v) / 1e6).toFixed(2)}`;

(async () => {
  // === level 0: the contract ==============================================
  console.log("\n-- level 0: the contract --");

  const read = (functionName, args) =>
    client.readContract({ address: DECK, abi: DECK_ABI, functionName, args });

  // The game address has to be a PROXY rather than an implementation.
  //
  // Deploying the implementation directly looks exactly the same: decks are
  // cut, cases are opened, the site works. The difference shows up once, when
  // something has to be fixed and it turns out the board has to be wiped again.
  // So we ask not "does it work" but "is there a logic address in the ERC-1967
  // slot".
  const IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const implWord = await client.getStorageAt({ address: DECK, slot: IMPL_SLOT });
  const impl = implWord && implWord !== `0x${"0".repeat(64)}`
    ? getAddress(`0x${implWord.slice(26)}`)
    : null;
  check(0, "the game is behind a proxy", impl !== null, impl ? `logic ${impl}` : "the ERC-1967 slot is empty");

  if (impl) {
    const code = await client.getBytecode({ address: impl });
    check(0, "the implementation is in place", Boolean(code) && code !== "0x", `${(code.length - 2) / 2} bytes`);
  }

  const count = Number(await read("deckCount"));
  check(0, "the decks are readable", count > 0, `${count} of them`);

  const decks = [];
  for (let id = 0; id < count; id++) {
    const d = await read("deckAt", [id]);
    const t = await read("tiers", [id]);
    decks.push({
      id,
      size: Number(d.size),
      drawn: Number(d.drawn),
      // The cut number. A deck reshuffles itself, and everything counted from
      // the open history has to know WHICH pool it is counting.
      cut: Number(await read("reseals", [id])),
      vaultUpTo: Number(d.vaultUpTo),
      vault: BigInt(d.vault),
      unswept: Number(d.unsweptOpens),
      creator: d.creator,
      tiers: t.map((x) => ({ upTo: Number(x.upTo), weight: Number(x.weight) })),
    });
  }
  for (const d of decks) {
    check(
      0,
      `deck #${d.id}: no more drawn than the size`,
      d.drawn <= d.size,
      `${d.drawn} of ${d.size}`,
    );
    const sorted = d.tiers.every((t, i) => i === 0 || t.upTo > d.tiers[i - 1].upTo);
    check(0, `deck #${d.id}: the tier table ascends`, sorted, `${d.tiers.length} tiers`);
    check(
      0,
      `deck #${d.id}: the vault is within the deck`,
      d.vaultUpTo <= d.size,
      `${d.vaultUpTo} vault slots`,
    );
  }

  // Whether there is enough money for the prizes the decks have already
  // promised.
  //
  // The most important check in this file. The player's dollar goes whole into
  // Megapot and buys a real ticket; what comes back to the game is the referral
  // commission alone, ten cents per slot. Part settles into the vaults, the rest
  // buys bonus tickets. So the whole promised weight, divided by five, has to fit
  // into the treasury share of the commission from ALL the slots.
  //
  // If it does not, a player will see "+5 tickets", press exchange and get
  // TreasuryEmpty. The error fails neither when a deck is cut nor when a case is
  // opened: it waits for the first person to come and collect a win.
  const share = BigInt(await read("vaultShareBps"));
  const promisedWeight = BigInt(await read("budgetWeight"));
  // Slots are counted WITH the reshuffles: a fresh cut both promises its weight
  // anew and sells its slots anew. The sizes alone would compare the promise of
  // two cuts against the commission of one.
  const slotsAll = decks.reduce((a, d) => a + BigInt(d.size) * BigInt(1 + d.cut), 0n);
  const promised = (promisedWeight * 1_000_000n) / 5n;
  const funded = (slotsAll * 100_000n * (10_000n - share)) / 10_000n;
  check(
    0,
    "the prizes are covered by the commission",
    funded >= promised,
    `promised ${usd(promised)}, the commission will give ${usd(funded)}` +
      ` (the vault takes ${Number(share) / 100}%)`,
  );

  // Every house deck can still be recut.
  //
  // Nobody refills a played out deck, so the only renewal is a fresh copy beside
  // it, and the button in moderation sends exactly these arguments: the size, the
  // tier table and the vault boundary, read from the chain. The check simulates
  // the same call from the owner.
  //
  // But what is compared is not "it always copies" but "it copies exactly when
  // the screen promises it will". A deck whose table does not fit the budget must
  // NOT have a copy, and must not have a button either. Those two answers can
  // diverge silently: the site draws the button, the chain rejects it, and the
  // owner finds out about it in their wallet.
  const boss = await read("owner");
  for (const d of decks.filter((x) => /^0x0+$/.test(x.creator))) {
    let prev = 0;
    let weightSum = 0;
    for (const t of d.tiers) {
      weightSum += (t.upTo - prev) * t.weight;
      prev = t.upTo;
    }
    const shouldFit = weightSum * 2 * 10_000 <= d.size * (10_000 - Number(share));
    const fee = await read("deckFee", [d.size]);
    const args = [d.size, d.tiers.map((t) => t.upTo), d.tiers.map((t) => t.weight), d.vaultUpTo];
    // We substitute the owner's balance: what is being checked is whether the
    // deck can be copied, not how much ETH is in the wallet right now. Without
    // the substitution eth_call would fail on "insufficient funds", and the audit
    // would report an invented fault.
    const override = [{ address: boss, balance: fee + 10n ** 17n }];
    let why = "";
    const ok = await client
      .simulateContract({
        address: DECK,
        abi: DECK_ABI,
        functionName: "createDeck",
        args,
        value: fee,
        account: boss,
        stateOverride: override,
      })
      .then(() => true)
      .catch((e) => {
        why = (e.shortMessage || e.message || "").split("\n")[0];
        return false;
      });
    check(
      0,
      `deck #${d.id}: a copy is possible exactly when it fits the budget`,
      ok === shouldFit,
      shouldFit
        ? ok
          ? `weight ${weightSum} of ${d.size / 2}, it copies`
          : `it should copy, but the chain says: ${why}`
        : ok
          ? `weight ${weightSum} is too large and the chain allows it anyway`
          : `weight ${weightSum} is too large for ${d.size} slots, there is no copy, and rightly so`,
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
  // What is owed to the creators of custom decks is a third liability alongside
  // the vaults.
  //
  // It is read separately and with tolerance for an OLD contract: custom decks
  // appeared later, and on an address deployed without them the call simply does
  // not exist. But there will be no silent zero here, the line below says
  // outright that the check is measuring a contract that does not know this
  // mechanic. A silent skip is the same dead check, just from the other side.
  let creators = null;
  try {
    creators = BigInt(await read("creatorOwed"));
  } catch {
    console.log(
      "    ! the deployed contract does not know custom decks, creatorOwed is not checked",
    );
  }
  const owed = vaults + treasury + (creators ?? 0n);

  // feesClaimable() is how much Megapot OWES us; that money sits in its
  // contract, not in ours. Adding it to our liabilities and comparing against our
  // balance would be an accounting error.
  check(
    0,
    creators === null
      ? "the accounting adds up: vaults plus treasury is no more than the contract balance"
      : "the accounting adds up: vaults plus creators plus treasury is no more than the contract balance",
    owed <= held,
    `${usd(vaults)}${creators === null ? "" : ` + ${usd(creators)}`} + ${usd(treasury)}` +
      ` = ${usd(owed)} against ${usd(held)}` +
      (owed === held ? " (exactly)" : ` (slack ${usd(held - owed)})`),
  );
  console.log(`    Megapot owes us separately: ${usd(fees)}`);

  // How many opens since the last sweep, the number the commission is split
  // between the decks by.
  const unsweptTotal = BigInt(await read("unsweptOpens"));
  const battles = Number(await read("battleCount"));
  check(0, "the battles are readable", Number.isFinite(battles), `${battles} of them`);

  // === level 1: what we accept ============================================
  console.log("\n-- level 1: what we accept --");

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
  check(1, "our own reading of the events", mine.length > 0, `${mine.length} opens`);

  const api = await fetch(`${URL}/api/opens`).then((r) => r.json());
  const theirs = api.events ?? [];

  const mySet = new Set(mine.map((e) => e.handle.toLowerCase()));
  const theirSet = new Set(theirs.map((e) => e.handle.toLowerCase()));
  const onlyMine = [...mySet].filter((h) => !theirSet.has(h));
  const onlyTheirs = [...theirSet].filter((h) => !mySet.has(h));
  check(
    1,
    "the set of events matches /api/opens",
    onlyMine.length === 0 && onlyTheirs.length === 0,
    `ours ${mySet.size}, theirs ${theirSet.size}; only ours ${onlyMine.length}, only theirs ${onlyTheirs.length}`,
  );

  check(
    1,
    "there are no holes in the windows: scanned reached the end",
    latest - BigInt(api.scanned) <= 2n * WINDOW,
    `scanned ${api.scanned}, latest block ${latest}`,
  );

  const myRisk = risky.size;
  const theirRisk = theirs.filter((e) => e.risk).length;
  check(1, "the 'risked' markers match", myRisk === theirRisk, `${myRisk} against ${theirRisk}`);

  // -- are the values the API hands over even possible ------------------
  //
  // There is no second source of decryption outside the browser: the value is not
  // published on chain (SlotRevealed carries only the player and the index), and
  // the covalidator SDK does not resolve in plain Node. So what is checked is not
  // "the same value" but "such a value is possible at all": it has to lie within
  // the range of its deck, not repeat inside it, and have a signature of the
  // right length. A number corrupted on the way will fail all three.
  const vals = api.revealed ?? [];
  const byHandle = new Map(theirs.map((e) => [e.handle.toLowerCase(), e]));

  const outOfRange = vals.filter((r) => {
    const ev = byHandle.get(r.handle.toLowerCase());
    const d = ev ? decks[ev.deckId] : undefined;
    return !d || !Number.isInteger(r.value) || r.value < 1 || r.value > d.size;
  });
  check(
    1,
    "the revealed values are within their own deck",
    outOfRange.length === 0,
    `${vals.length} values, out of range ${outOfRange.length}`,
  );

  const seen = new Map();
  const dupes = [];
  for (const r of vals) {
    const ev = byHandle.get(r.handle.toLowerCase());
    if (!ev) continue;
    // The key includes the cut number. Without it the very first reshuffle
    // looked like a forged pool: value 169 legitimately comes up in both the old
    // cut and the new one, because those are DIFFERENT packs of cards.
    const k = `${ev.deckId}#${ev.cut ?? 0}:${r.value}`;
    if (seen.has(k)) dupes.push(k);
    seen.set(k, r.handle);
  }
  // The deck is drawn from without return, so two identical slots in one deck
  // would mean the pool is not what was promised.
  check(
    1,
    "no slot was drawn twice",
    dupes.length === 0,
    dupes.length ? `repeats: ${dupes.slice(0, 3).join(", ")}` : `${seen.size} unique`,
  );

  const badSig = vals.filter(
    (r) => !r.signatures?.length || r.signatures.some((s) => !/^0x[0-9a-fA-F]{130}$/.test(s)),
  );
  check(
    1,
    "every value has a covalidator signature of the right length",
    badSig.length === 0,
    `${vals.length} values, without a usable signature ${badSig.length}`,
  );

  const revealedSet = new Set(vals.map((r) => r.handle.toLowerCase()));
  const orphan = [...revealedSet].filter((h) => !byHandle.has(h));
  check(
    1,
    "the revealed values match the events that exist",
    orphan.length === 0,
    `orphans ${orphan.length}`,
  );

  // === level 2: what aggregates ===========================================
  console.log("\n-- level 2: what aggregates --");

  const t0 = Date.now();
  const res = await fetch(`${URL}/api/opens`);
  const ms = Date.now() - t0;
  const body = await res.json();
  check(2, "/api/opens answers", res.ok, `${res.status} in ${ms} ms`);
  // The Cloudflare in front of the site normalises no-store to no-cache. Both
  // forbid handing over a stale response without revalidation, and we set no
  // ETag, so revalidation means re-reading. The freshness is preserved.
  const cc = res.headers.get("cache-control") || "";
  check(
    2,
    "the response is not served from a third party cache without revalidation",
    /no-store|no-cache/.test(cc),
    cc || "there is no header",
  );
  check(
    2,
    "the shape of the response",
    Array.isArray(body.events) && typeof body.scanned === "string",
    `events ${Array.isArray(body.events)}, scanned ${typeof body.scanned}`,
  );

  // The main comparison: three numbers about the same thing.
  //
  // But drawn grows when a card is handed to a battle too, and CaseOpened is
  // deliberately not published for it until the opponent has paid: otherwise it
  // would be visible that the slot is already spent, and the promise "the card is
  // sealed" would be empty. So the expected difference is the cards lying in
  // battles and not yet announced.
  // Battles are numbered from one: _battle() rejects zero as non existent.
  const waiting = [];
  for (let i = 1; i <= battles; i++) {
    const b = await read("battleAt", [i]);
    const joined = BigInt(b.b) !== 0n && b.b !== "0x0000000000000000000000000000000000000000";
    if (!b.resolved && !joined) waiting.push(Number(b.deckId));
  }
  check(
    2,
    "battles whose cards are not announced yet",
    true,
    waiting.length ? `${waiting.length} of them, decks ${waiting.join(", ")}` : "none",
  );

  for (const d of decks) {
    // The current cut only: `drawn` in the contract resets to zero on a
    // reshuffle, while the events of old cuts stay in the history forever.
    const fromApi = theirs.filter((e) => e.deckId === d.id && (e.cut ?? 0) === d.cut).length;
    const sealedInBattles = waiting.filter((id) => id === d.id).length;
    check(
      2,
      `deck #${d.id}: drawn equals events plus cards in battles`,
      d.drawn === fromApi + sealedInBattles,
      `contract ${d.drawn} equals API ${fromApi} plus ${sealedInBattles} in battles`,
    );
  }

  // What is expected for the next step: what exactly has to be on the screen.
  const expected = {
    url: URL,
    at: new Date().toISOString(),
    decks: decks.map((d) => {
      // The site shows the vault together with the share of the commission
      // Megapot already owes: claimVault sweeps first, so the player really will
      // get that amount. The recount is our own, from the contract's numbers
      // rather than from the site code.
      //
      // The share is taken from the CHAIN rather than halved. `fees / 2n` stood
      // here, a half written as a number back when vaultShareBps really did equal
      // 5000. The moment the owner lowered the share to 10%, the audit started
      // demanding vaults five times larger than they are and blaming a screen
      // that was working.
      const coming =
        d.vaultUpTo > 0 && unsweptTotal > 0n
          ? (((fees * share) / 10_000n) * BigInt(d.unswept)) / unsweptTotal
          : 0n;
      return {
        id: d.id,
        size: d.size,
        drawn: d.drawn,
        remaining: d.size - d.drawn,
        vaultBankedUsd: (Number(d.vault) / 1e6).toFixed(2),
        vaultUsd: (Number(d.vault + coming) / 1e6).toFixed(2),
        hasVault: d.vaultUpTo > 0,
        // How many TESA slots are cut into the deck.
        //
        // TESA is a tier of weight exactly 1: on its own it is not worth a
        // ticket, five make a real one. The catalogue promises this number to the
        // player ("40 TESA still in the deck"), so it has to be recomputable from
        // the contract rather than taken from the screen on faith. The vault
        // slots stand at the start of the range and weigh zero, so they have to
        // be subtracted from the tier, exactly as slotsPerTier does on the site.
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
    // Who moderates and which decks can be recut at all.
    //
    // Both numbers are needed by the next step: without the owner's address the
    // moderation page cannot be seen (it asks the chain for owner()), and without
    // the list of house decks there is no saying how many "cut a copy" buttons
    // SHOULD be there, and the check would come down to "there is at least one".
    owner: boss,
    houseDecks: decks.filter((d) => /^0x0+$/.test(d.creator)).map((d) => d.id),
    // Not every house deck can be copied: a table that promises beyond the
    // budget is rejected by the contract, and there must be no button for it
    // either.
    recutableDecks: decks
      .filter((d) => {
        if (!/^0x0+$/.test(d.creator)) return false;
        let prev = 0;
        let w = 0;
        for (const t of d.tiers) {
          w += (t.upTo - prev) * t.weight;
          prev = t.upTo;
        }
        return w * 2 * 10_000 <= d.size * (10_000 - Number(share));
      })
      .map((d) => d.id),
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
    `\n  what the screen should show -> ${path.join(OUT, "audit-expected.json")}` +
      `\n  opened ${expected.totals.drawn}, left ${expected.totals.remaining} of ${expected.totals.size},` +
      ` players ${expected.totals.players}, battles ${battles}`,
  );

  console.log(`\n${"═".repeat(60)}`);
  console.log(`passed ${rows.filter((r) => r.ok).length}, failed ${fail.length}`);
  for (const f of fail) console.log("  ✗", f);
  process.exit(fail.length ? 1 : 0);
})().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(2);
});
