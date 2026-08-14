// The live "risk it or take it" cycle on Base Sepolia.
//
// It opens cases until it has collected some weight, stakes it, opens one more
// case, the deciding one, closes the stake and takes the win.
//
//   node e2e-stake.cjs <deck> <privateKey>

const { Lightning } = require("@inco/lightning-js/lite");
const {
  createWalletClient, createPublicClient, http, defineChain, parseGwei, parseAbi, toHex,
} = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { baseSepolia } = require("viem/chains");

const ADDR = process.argv[2];
const PK = process.argv[3];
const RPC = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
const TOKEN = "0xA4253E7C13525287C56550b8708100f93E60509f";

const abi = parseAbi([
  "function openCase() returns (uint16 index, bytes32 handle)",
  "function countOf(address) view returns (uint256)",
  "function handleOf(address, uint256) view returns (bytes32)",
  "function shardSpent(bytes32) view returns (bool)",
  "function weightNow(uint256) view returns (uint16)",
  "function stake(uint256[] slotIndexes, uint256[] values, bytes[][] signatures) returns (uint256 weight, uint64 decidingSlot)",
  "function settleStake(uint256 value, bytes[] signatures) returns (bool won, uint256 banked)",
  "function claimBanked() returns (uint256 tickets, uint256 paid)",
  "function bankedWeight(address) view returns (uint256)",
  "function budgetLeft() view returns (uint256)",
]);
const erc20 = parseAbi([
  "function mint(address,uint256)",
  "function approve(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
]);

const toBytes = (sig) => toHex(Uint8Array.from(Object.values(sig)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const account = privateKeyToAccount(PK);
  const chain = defineChain({ ...baseSepolia, fees: { maxPriorityFeePerGas: parseGwei("2") } });
  const wallet = createWalletClient({ chain, transport: http(RPC), account });
  const pub = createPublicClient({ chain, transport: http(RPC) });
  const zap = await Lightning.baseSepoliaTestnet();

  const read = (functionName, args = []) =>
    pub.readContract({ address: ADDR, abi, functionName, args });

  const send = async (functionName, args = []) => {
    const { request, result } = await pub.simulateContract({
      address: ADDR, abi, functionName, args, account, gasPrice: parseGwei("2"),
    });
    const hash = await wallet.writeContract(request);
    const rcpt = await pub.waitForTransactionReceipt({ hash });
    if (rcpt.status !== "success") throw new Error(`${functionName} reverted`);
    return result;
  };

  /** Wait for a slot value from the covalidators. */
  const reveal = async (handle) => {
    for (let i = 0; i < 60; i++) {
      try {
        const [r] = await zap.attestedReveal([handle]);
        return { value: Number(r.plaintext.value), sigs: r.covalidatorSignatures.map(toBytes) };
      } catch {
        await sleep(400);
      }
    }
    throw new Error("covalidators did not answer");
  };

  // -- preparation --------------------------------------------------------------
  const balance = await pub.readContract({ address: TOKEN, abi: erc20, functionName: "balanceOf", args: [account.address] });
  if (balance < 60_000_000n) {
    const h = await wallet.writeContract({ address: TOKEN, abi: erc20, functionName: "mint", args: [account.address, 100_000_000n] });
    await pub.waitForTransactionReceipt({ hash: h });
    console.log("minted test dollars");
  }
  const allowance = await pub.readContract({ address: TOKEN, abi: erc20, functionName: "allowance", args: [account.address, ADDR] });
  if (allowance < 60_000_000n) {
    const h = await wallet.writeContract({ address: TOKEN, abi: erc20, functionName: "approve", args: [ADDR, 2n ** 200n] });
    await pub.waitForTransactionReceipt({ hash: h });
    console.log("the allowance is granted");
  }

  // -- collect some weight --------------------------------------------------------
  console.log("> opening until weight 5 has been collected");
  const held = [];
  let weight = 0;
  for (let n = 0; weight < 5 && n < 60; n++) {
    const [index, handle] = await send("openCase");
    const { value, sigs } = await reveal(handle);
    const w = Number(await read("weightNow", [BigInt(value)]));
    if (w > 0) {
      held.push({ index: Number(index), value, sigs, w });
      weight += w;
      console.log(`  slot ${index}: value ${value}, weight ${w} -> total ${weight}`);
    }
  }
  if (weight < 5) throw new Error("not collected in 60 opens");

  // -- the stake -------------------------------------------------------------------
  console.log(`> staking ${weight}`);
  const [staked, deciding] = await send("stake", [
    held.map((h) => BigInt(h.index)),
    held.map((h) => BigInt(h.value)),
    held.map((h) => h.sigs),
  ]);
  console.log(`  staked ${staked}, slot ${deciding} decides`);

  // -- the deciding slot -------------------------------------------------------------
  const [, decidingHandle] = await send("openCase");
  const decided = await reveal(decidingHandle);
  const decidedWeight = Number(await read("weightNow", [BigInt(decided.value)]));
  console.log(`  the deciding slot: value ${decided.value}, weight ${decidedWeight}`);

  const [won, banked] = await send("settleStake", [BigInt(decided.value), decided.sigs]);
  console.log(won ? `won, ${banked} banked` : "lost, the stake burned");

  const bankedNow = await read("bankedWeight", [account.address]);
  if (bankedNow >= 5n) {
    const [tickets, paid] = await send("claimBanked");
    console.log(`took ${tickets} ticket(s) for $${Number(paid) / 1e6}`);
  }

  console.log(`season budget left: ${await read("budgetLeft")}`);
})().catch((e) => {
  console.error("FATAL:", String(e.shortMessage || e.message).split("\n")[0]);
  process.exit(1);
});
