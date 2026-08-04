//
//
//   node vault.cjs <deck> <privateKey> [--claim]

const { Lightning } = require("@inco/lightning-js/lite");
const { createWalletClient, createPublicClient, http, parseAbi, toHex, formatUnits } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { baseSepolia } = require("viem/chains");

const ADDR = process.argv[2];
const PK = process.argv[3];
const CLAIM = process.argv.includes("--claim");
const RPC = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";

const abi = parseAbi([
  "function countOf(address) view returns (uint256)",
  "function handleOf(address, uint256) view returns (bytes32)",
  "function shardSpent(bytes32) view returns (bool)",
  "function vault() view returns (uint256)",
  "function vaultUpTo() view returns (uint16)",
  "function slotSeason(address, uint256) view returns (uint32)",
  "function vaultUpToOfSeason(uint32) view returns (uint16)",
  "function claimVault(uint256 slotIndex, uint256 value, bytes[] signatures) returns (uint256 paid)",
]);

const toBytes = (sig) => toHex(Uint8Array.from(Object.values(sig)));
const money = (v) => `$${Number(formatUnits(v, 6)).toFixed(2)}`;

(async () => {
  const account = privateKeyToAccount(PK);
  const wallet = createWalletClient({ chain: baseSepolia, transport: http(RPC), account });
  const pub = createPublicClient({ chain: baseSepolia, transport: http(RPC) });
  const zap = await Lightning.baseSepoliaTestnet();

  const read = (functionName, args = []) =>
    pub.readContract({ address: ADDR, abi, functionName, args });

  console.log(`wallet ${account.address}`);
  console.log(`vault  ${money(await read("vault"))}`);

  const count = Number(await read("countOf", [account.address]));
  console.log(`slots  ${count}`);
  if (count === 0) return;

  const slots = [];
  for (let i = 0; i < count; i++) {
    slots.push({ index: i, handle: await read("handleOf", [account.address, BigInt(i)]) });
  }

  const found = [];
  for (const s of slots) {
    try {
      const [card] = await zap.attestedReveal([s.handle]);
      const value = Number(card.plaintext.value);
      const season = Number(await read("slotSeason", [account.address, BigInt(s.index)]));
      const upTo = Number(await read("vaultUpToOfSeason", [season]));
      if (value >= 1 && value <= upTo) {
        found.push({ ...s, value, signatures: card.covalidatorSignatures.map(toBytes) });
      }
    } catch {
    }
  }

  if (found.length === 0) {
    console.log("\nno vault slot in this wallet");
    return;
  }

  for (const v of found) {
    const spent = await read("shardSpent", [v.handle]);
    console.log(`\nvault slot at index ${v.index}  spent: ${spent}`);
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
    }
  }
})().catch((err) => {
  console.error(err.shortMessage || err.message || err);
  process.exit(1);
});
