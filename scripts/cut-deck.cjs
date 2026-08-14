// Cut a new season.
//
//   node cut-deck.cjs <deck> <n> <upTo> <weight> <vaultSlots>
//   node cut-deck.cjs 0x7BD3... 200 1,2,4,7,47 0,25,10,5,1 1
//
// It takes the key from DEPLOYER_PRIVATE_KEY: argv is visible in ps to anyone on
// the machine.
//
// A simulation first, and only then the transaction. The contract has three
// reasons to refuse, the table is not ascending, the vault is larger than the
// deck, the total weight is more than half the slots, and all three are cheaper
// to hear from a simulation than from spent gas.
//
// A deck is irreversible: the shape is not edited after the cut, and the Inco fee
// is paid per season. So the script shows the slot layout and waits for
// confirmation unless YES=1 is passed.

const { createWalletClient, createPublicClient, http, parseAbi, formatEther } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { baseSepolia } = require("viem/chains");

const ADDR = process.argv[2];
const N = Number(process.argv[3]);
const UP_TO = (process.argv[4] ?? "").split(",").filter(Boolean).map(Number);
const WEIGHT = (process.argv[5] ?? "").split(",").filter(Boolean).map(Number);
const VAULT = Number(process.argv[6] ?? 0);
const PK = process.env.DEPLOYER_PRIVATE_KEY;
const RPC = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";

if (!ADDR || !N || !UP_TO.length || UP_TO.length !== WEIGHT.length) {
  console.error("node cut-deck.cjs <deck> <n> <upTo,…> <weight,…> <vaultSlots>");
  process.exit(2);
}
if (!PK) {
  console.error("no key: DEPLOYER_PRIVATE_KEY in the environment");
  process.exit(2);
}

const abi = parseAbi([
  "function createDeck(uint16 n, uint16[] upTo, uint16[] weight, uint16 vaultSlots) payable returns (uint32 deckId)",
  "function deckFee(uint16 n) view returns (uint256)",
  "function deckCount() view returns (uint256)",
  "function budgetLeft() view returns (uint256)",
  "function owner() view returns (address)",
]);

/** The same arithmetic as in the contract, so the limit can be seen before it. */
function layout() {
  const rows = [];
  let prev = 0;
  let total = 0;
  for (let i = 0; i < UP_TO.length; i++) {
    const count = UP_TO[i] - prev;
    total += count * WEIGHT[i];
    rows.push({ from: prev + 1, to: UP_TO[i], count, weight: WEIGHT[i] });
    prev = UP_TO[i];
  }
  return { rows, total, grout: N - prev };
}

(async () => {
  const account = privateKeyToAccount(PK.startsWith("0x") ? PK : `0x${PK}`);
  const pub = createPublicClient({ chain: baseSepolia, transport: http(RPC) });
  const wallet = createWalletClient({ chain: baseSepolia, transport: http(RPC), account });

  const owner = await pub.readContract({ address: ADDR, abi, functionName: "owner" });
  if (owner.toLowerCase() !== account.address.toLowerCase()) {
    console.error(`createDeck is for the owner only. The owner is ${owner}, the key is ${account.address}`);
    process.exit(1);
  }

  const { rows, total, grout } = layout();
  const fee = await pub.readContract({ address: ADDR, abi, functionName: "deckFee", args: [N] });

  console.log(`\na deck of ${N} slots, ${VAULT} of them vault`);
  for (const r of rows) {
    const tickets = Math.floor(r.weight / 5);
    const what =
      r.weight === 0
        ? VAULT >= r.to
          ? "the vault"
          : "empty"
        : tickets >= 5
          ? `porphyry, +${tickets} tickets`
          : tickets >= 2
            ? `aureus, +${tickets} tickets`
            : tickets === 1
              ? "denarius, +1 ticket"
              : "a shard, five to a ticket";
    console.log(
      `  values ${String(r.from).padStart(3)}-${String(r.to).padEnd(3)} · ${String(r.count).padStart(3)} slots · weight ${String(r.weight).padStart(2)} · ${what}`,
    );
  }
  console.log(`  the remaining ${grout} are empty`);
  const paying = rows.reduce((n, r) => n + (r.weight > 0 ? r.count : 0), 0) + VAULT;
  console.log(
    `\n  total weight ${total} of the ${Math.floor(N / 2)} allowed` +
      (total * 2 > N ? "  <- TOO LARGE, the contract will refuse" : ""),
  );
  console.log(`  ${paying} slots of ${N} give something, roughly every ${Math.round(N / paying)}th`);
  console.log(`  Inco fee ${formatEther(fee)} ETH\n`);

  const sim = await pub.simulateContract({
    address: ADDR,
    abi,
    functionName: "createDeck",
    args: [N, UP_TO, WEIGHT, VAULT],
    value: fee,
    account,
  });
  console.log(`the simulation passed, the deck will get the number #${sim.result}`);

  if (!process.env.YES) {
    console.log("nothing was sent. YES=1 to cut for real.");
    return;
  }

  const hash = await wallet.writeContract(sim.request);
  console.log(`transaction ${hash}`);
  const rcpt = await pub.waitForTransactionReceipt({ hash });
  if (rcpt.status !== "success") throw new Error("the transaction rolled back");

  // We read EXACTLY at the transaction's block rather than "now".
  //
  // The public RPC balances requests between nodes and lags a second or a second
  // and a half behind a write: the first run showed "decks 3, budget 94" although
  // the transaction had gone through and it was really 4 and 194. One more reason
  // to think the cut had failed and to cut another one on top.
  const at = { blockNumber: rcpt.blockNumber };
  const count = await pub.readContract({ address: ADDR, abi, functionName: "deckCount", ...at });
  const left = await pub.readContract({ address: ADDR, abi, functionName: "budgetLeft", ...at });
  console.log(`done: decks ${count}, weight budget ${left}`);
  console.log(`https://sepolia.basescan.org/tx/${hash}`);
})().catch((e) => {
  console.error(e.shortMessage ?? e.message);
  process.exit(1);
});
