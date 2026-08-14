// Who holds a vault slot and whether they can really claim it.
//
// The contract does not see slot values, so the question "has the vault already
// been drawn" has no on chain answer: it is computed from the public reveals.
// This script does the same thing the front end does, but checks the result with
// a claimVault simulation, that is, with the contract itself rather than a guess.
//
//   node vault.cjs <contract> <privateKey> [--deck N] [--claim]
//
// `--deck N` is a necessity rather than a convenience. The wallet the checks are
// run with has hundreds of slots, and revealing each one goes to the covalidators
// as a separate request: without the filter the run never finishes at all.

const { Lightning } = require("@inco/lightning-js/lite");
const { createWalletClient, createPublicClient, http, parseAbi, toHex, formatUnits } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { baseSepolia } = require("viem/chains");

const ADDR = process.argv[2];
const PK = process.argv[3];
const CLAIM = process.argv.includes("--claim");
const ONLY = process.argv.includes("--deck") ? Number(process.argv[process.argv.indexOf("--deck") + 1]) : null;
const RPC = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";

const abi = parseAbi([
  "function countOf(address) view returns (uint256)",
  "function handleOf(address, uint256) view returns (bytes32)",
  "function shardSpent(bytes32) view returns (bool)",
  "function vaultOf(uint32) view returns (uint256)",
  "function slotDeck(address, uint256) view returns (uint32)",
  "function deckAt(uint32) view returns ((bytes32,uint16,uint16,uint16,uint128,uint64,address,uint16))",
  "function reseals(uint32) view returns (uint32)",
  "function remaining(uint32) view returns (uint16)",
  "function claimVault(uint256 slotIndex, uint256 value, bytes[] signatures) returns (uint256 paid)",
]);

const toBytes = (sig) => toHex(Uint8Array.from(Object.values(sig)));
const money = (v) => `$${Number(formatUnits(v, 6)).toFixed(2)}`;

(async () => {
  const account = privateKeyToAccount(PK);
  const wallet = createWalletClient({ chain: baseSepolia, transport: http(RPC), account });
  // Batching is mandatory rather than a precaution: the wallet has hundreds of
  // slots, and every `slotDeck` as a separate request means hundreds of trips
  // over the network, after which the script simply does not come back. multicall
  // folds them into one.
  const pub = createPublicClient({
    chain: baseSepolia,
    transport: http(RPC, { batch: { wait: 16 } }),
    batch: { multicall: true },
  });
  const zap = await Lightning.baseSepoliaTestnet();

  const read = (functionName, args = []) =>
    pub.readContract({ address: ADDR, abi, functionName, args });

  console.log(`wallet ${account.address}`);

  const count = Number(await read("countOf", [account.address]));
  console.log(`slots  ${count}`);
  if (count === 0) return;

  // The cheap chain reads first, which deck a slot belongs to, and only then the
  // expensive trips to the covalidators. The other way round it was impossible to
  // wait out.
  const all = await Promise.all(
    Array.from({ length: count }, (_, i) =>
      read("slotDeck", [account.address, BigInt(i)]).then((d) => ({ index: i, deckId: Number(d) })),
    ),
  );
  const owned = all.filter((o) => ONLY === null || o.deckId === ONLY).reverse();
  console.log(`  of those in deck ${ONLY ?? "any"}: ${owned.length}`);

  const slots = await Promise.all(
    owned.map((o) =>
      read("handleOf", [account.address, BigInt(o.index)]).then((handle) => ({ ...o, handle })),
    ),
  );

  // We ask in BATCHES and stop at the first find.
  //
  // One at a time does not work here: the wallet the checks are run with has 175
  // slots in a single deck, and a reveal goes to the covalidators at just over
  // three seconds each, that is, ten minutes for a run that gives no sign of
  // being alive. A batch of six is the same limit the site's server holds its own
  // queue at.
  //
  // A batch is all or nothing: one slot locked in a battle takes down the whole
  // six. So a failed batch is re-asked one at a time, and the losses are limited
  // to six rather than the whole run.
  const CHUNK = 6;
  const found = [];
  const upToOf = new Map();
  for (let i = 0; i < slots.length && found.length === 0; i += CHUNK) {
    const pack = slots.slice(i, i + CHUNK);
    let cards = null;
    try {
      cards = await zap.attestedReveal(pack.map((s) => s.handle));
    } catch {
      cards = [];
      for (const s of pack) {
        try {
          cards.push((await zap.attestedReveal([s.handle]))[0]);
        } catch {
          // not revealed yet or locked in a battle, none of our business
        }
      }
    }
    for (const card of cards) {
      const s = pack.find((x) => x.handle.toLowerCase() === card.handle.toLowerCase());
      if (!s) continue;
      const value = Number(card.plaintext.value);
      // A slot is judged by the table of ITS OWN deck. A season used to stand
      // here, a notion the contract no longer has: decks live in parallel, and
      // each has a vault of its own.
      if (!upToOf.has(s.deckId)) {
        upToOf.set(s.deckId, Number((await read("deckAt", [s.deckId]))[3]));
      }
      const upTo = upToOf.get(s.deckId);
      if (value >= 1 && value <= upTo) {
        found.push({ ...s, value, signatures: card.covalidatorSignatures.map(toBytes) });
      }
    }
    process.stdout.write(`\r  looked at ${Math.min(i + CHUNK, slots.length)}/${slots.length}`);
  }
  process.stdout.write("\n");

  if (found.length === 0) {
    console.log("\nno vault slot in this wallet");
    return;
  }

  for (const v of found) {
    const spent = await read("shardSpent", [v.handle]);
    console.log(
      `\nvault slot at index ${v.index}  deck #${v.deckId}  value ${v.value}  spent: ${spent}`,
    );
    console.log(`  deck vault ${money(await read("vaultOf", [v.deckId]))}`);
    if (spent) continue;

    const { result } = await pub.simulateContract({
      address: ADDR, abi, functionName: "claimVault",
      args: [BigInt(v.index), BigInt(v.value), v.signatures], account,
    });
    console.log(`claimVault would pay ${money(result)}`);

    if (CLAIM) {
      const { request } = await pub.simulateContract({
        address: ADDR, abi, functionName: "claimVault",
        args: [BigInt(v.index), BigInt(v.value), v.signatures], account,
      });
      const hash = await wallet.writeContract(request);
      const rcpt = await pub.waitForTransactionReceipt({ hash });
      console.log(`claimed in ${hash} (${rcpt.status})`);

      // A vault carried out is one of the two triggers that make a deck reshuffle
      // itself. We show it here because this is exactly where it happens: in THE
      // SAME transaction that took the money.
      console.log(
        `  deck #${v.deckId} -> cut ${await read("reseals", [v.deckId])},` +
          ` in the pool ${await read("remaining", [v.deckId])},` +
          ` vault ${money(await read("vaultOf", [v.deckId]))}`,
      );
    }
  }
})().catch((err) => {
  console.error(err.shortMessage || err.message || err);
  process.exit(1);
});
