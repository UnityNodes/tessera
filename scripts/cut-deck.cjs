//
//   node cut-deck.cjs <deck> <n> <upTo> <weight> <vaultSlots>
//   node cut-deck.cjs 0x7BD3… 200 1,2,4,7,47 0,25,10,5,1 1
//
//
//

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
  console.error(": DEPLOYER_PRIVATE_KEY ");
  process.exit(2);
}

const abi = parseAbi([
  "function createDeck(uint16 n, uint16[] upTo, uint16[] weight, uint16 vaultSlots) payable returns (uint32 deckId)",
  "function deckFee(uint16 n) view returns (uint256)",
  "function deckCount() view returns (uint256)",
  "function budgetLeft() view returns (uint256)",
  "function owner() view returns (address)",
]);

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
    console.error(`createDeck . ${owner}, ${account.address}`);
    process.exit(1);
  }

  const { rows, total, grout } = layout();
  const fee = await pub.readContract({ address: ADDR, abi, functionName: "deckFee", args: [N] });

  console.log(`\n${N} , ${VAULT}`);
  for (const r of rows) {
    const tickets = Math.floor(r.weight / 5);
    const what =
      r.weight === 0
        ? VAULT >= r.to
          ? ""
          : ""
        : tickets >= 5
          ? `, +${tickets} `
          : tickets >= 2
            ? `, +${tickets} `
            : tickets === 1
              ? ", +1 "
              : ", '";
    console.log(
      `  ${String(r.from).padStart(3)}-${String(r.to).padEnd(3)} · ${String(r.count).padStart(3)} · ${String(r.weight).padStart(2)} · ${what}`,
    );
  }
  console.log(`  ${grout} `);
  const paying = rows.reduce((n, r) => n + (r.weight > 0 ? r.count : 0), 0) + VAULT;
  console.log(
    `\n  ${total} ${Math.floor(N / 2)}` +
      (total * 2 > N ? "  ← , " : ""),
  );
  console.log(`  ${paying} ${N} ${Math.round(N / paying)}-`);
  console.log(`  Inco ${formatEther(fee)} ETH\n`);

  const sim = await pub.simulateContract({
    address: ADDR,
    abi,
    functionName: "createDeck",
    args: [N, UP_TO, WEIGHT, VAULT],
    value: fee,
    account,
  });
  console.log(`, #${sim.result}`);

  if (!process.env.YES) {
    console.log(". YES=1 .");
    return;
  }

  const hash = await wallet.writeContract(sim.request);
  console.log(`${hash}`);
  const rcpt = await pub.waitForTransactionReceipt({ hash });
  if (rcpt.status !== "success") throw new Error("");

  //
  const at = { blockNumber: rcpt.blockNumber };
  const count = await pub.readContract({ address: ADDR, abi, functionName: "deckCount", ...at });
  const left = await pub.readContract({ address: ADDR, abi, functionName: "budgetLeft", ...at });
  console.log(`: ${count}, ${left}`);
  console.log(`https://sepolia.basescan.org/tx/${hash}`);
})().catch((e) => {
  console.error(e.shortMessage ?? e.message);
  process.exit(1);
});
