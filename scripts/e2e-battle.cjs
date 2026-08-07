//
//
//   DECK=3 node e2e-battle.cjs <deck> <privateKeyA> <privateKeyB>
//

const { Lightning } = require("@inco/lightning-js/lite");
const {
  createWalletClient, createPublicClient, http, defineChain, parseGwei, parseAbi, toHex,
  keccak256,
} = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { baseSepolia } = require("viem/chains");

const fs = require("fs");
const path = require("path");

const chainSrc = fs.readFileSync(
  path.join(__dirname, "..", "web", "lib", "chain.ts"),
  "utf8",
);
const ADDR =
  process.argv[2] ||
  (chainSrc.match(/DECK_ADDRESS[^"']*["'](0x[0-9a-fA-F]{40})["']/) || [])[1];
const PK_A = process.argv[3] || process.env.DEPLOYER_PRIVATE_KEY;
const RPC = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
const TOKEN = "0xA4253E7C13525287C56550b8708100f93E60509f";

const abi = parseAbi([
  "function openBattle(uint32 deckId) returns (uint256 id, uint64 slotIndex)",
  "function joinBattle(uint256 id) returns (uint64 slotIndex)",
  "function resolveBattle(uint256 id, uint256 valueA, bytes[] signaturesA, uint256 valueB, bytes[] signaturesB) returns (address winner, uint256 banked)",
  "function abandonBattle(uint256 id)",
  "function battleAt(uint256 id) view returns ((address a, uint64 slotA, bool resolved, address b, uint64 slotB, uint16 indexA, uint64 openedAt, uint128 paidA))",
  "function openBattleIds(uint256 max) view returns (uint256[])",
  "function sealedSlotsOf(address) view returns (uint64[])",
  "function handleOf(address, uint256) view returns (bytes32)",
  "function weightOf(uint32, uint256) view returns (uint16)",
  "function bankedWeight(address) view returns (uint256)",
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
  const chain = defineChain({ ...baseSepolia, fees: { maxPriorityFeePerGas: parseGwei("2") } });
  const pub = createPublicClient({ chain, transport: http(RPC) });
  const zap = await Lightning.baseSepoliaTestnet();

  const player = (pk) => {
    const account = privateKeyToAccount(pk);
    const wallet = createWalletClient({ chain, transport: http(RPC), account });
    return {
      account,
      address: account.address,
      async send(address, contractAbi, functionName, args = []) {
        const { request, result } = await pub.simulateContract({
          address, abi: contractAbi, functionName, args, account, gasPrice: parseGwei("2"),
        });
        const hash = await wallet.writeContract(request);
        const rcpt = await pub.waitForTransactionReceipt({ hash });
        if (rcpt.status !== "success") throw new Error(`${functionName} reverted`);
        return result;
      },
    };
  };

  const read = (functionName, args = []) =>
    pub.readContract({ address: ADDR, abi, functionName, args });

  const until = async (what, ok) => {
    for (let i = 0; i < 25; i++) {
      const v = await read(...what).catch(() => null);
      if (v && ok(v)) return v;
      await sleep(400);
    }
    throw new Error(`the node never caught up on ${what[0]}`);
  };

  const a = player(PK_A);

  //
  //
  const PK_B =
    process.argv[4] ||
    process.env.OPPONENT_PRIVATE_KEY ||
    keccak256(toHex(`tessera-opponent:${PK_A}`));
  const b = player(PK_B);

  const GAS_FLOOR = 3_000_000_000_000_000n; // 0.003 ETH
  if ((await pub.getBalance({ address: b.address })) < GAS_FLOOR) {
    const wallet = createWalletClient({ chain, transport: http(RPC), account: a.account });
    const hash = await wallet.sendTransaction({
      to: b.address,
      value: 10_000_000_000_000_000n, // 0.01 ETH
    });
    await pub.waitForTransactionReceipt({ hash });

    for (let i = 0; i < 30; i++) {
      if ((await pub.getBalance({ address: b.address })) >= GAS_FLOOR) break;
      await sleep(400);
    }
    console.log(`${b.address}`);
  }

  for (const p of [a, b]) {
    const balance = await pub.readContract({
      address: TOKEN, abi: erc20, functionName: "balanceOf", args: [p.address],
    });
    if (balance < 2_000_000n) await p.send(TOKEN, erc20, "mint", [p.address, 20_000_000n]);
    const allowance = await pub.readContract({
      address: TOKEN, abi: erc20, functionName: "allowance", args: [p.address, ADDR],
    });
    if (allowance < 2_000_000n) {
      await p.send(TOKEN, erc20, "approve", [ADDR, (1n << 256n) - 1n]);
    }
    console.log(`funded ${p.address}`);
  }

  const DECK = Number(process.env.DECK ?? 0);
  const [id] = await a.send(ADDR, abi, "openBattle", [DECK]);
  console.log(`\nbattle #${id} opened by ${a.address} on deck #${DECK}`);

  await until(["battleAt", [id]], (bt) => bt.a.toLowerCase() === a.address.toLowerCase());

  const sealed = await read("sealedSlotsOf", [a.address]);
  console.log(`sealed slots of the creator: [${sealed.join(", ")}]`);
  if (sealed.length === 0) throw new Error("the creator's card should be sealed");

  const bt0 = await read("battleAt", [id]);
  const handleA = await read("handleOf", [a.address, bt0.slotA]);

  const t0 = Date.now();
  let leaked = false;
  try {
    await zap.attestedReveal([handleA]);
    leaked = true;
  } catch {
    console.log(`sealed card refused by the covalidators after ${Date.now() - t0} ms, correct`);
  }
  if (leaked) throw new Error("SEALED CARD LEAKED, the creator could pick easy fights");

  const open = await read("openBattleIds", [10n]);
  console.log(`open battles visible to everyone: [${open.join(", ")}]`);

  const joined = Date.now();
  await b.send(ADDR, abi, "joinBattle", [id]);
  console.log(`\n${b.address} joined in ${Date.now() - joined} ms`);

  const bt = await until(["battleAt", [id]], (x) => x.b.toLowerCase() === b.address.toLowerCase());
  const handleB = await read("handleOf", [bt.b, bt.slotB]);

  const started = Date.now();
  let cards;
  for (let i = 0; i < 40; i++) {
    try {
      cards = await zap.attestedReveal([handleA, handleB]);
      break;
    } catch {
      await sleep(400);
    }
  }
  if (!cards) throw new Error("the covalidators never turned the cards over");
  console.log(`both cards decrypted in ${Date.now() - started} ms`);

  const byHandle = new Map(cards.map((c) => [c.handle.toLowerCase(), c]));
  const cardA = byHandle.get(handleA.toLowerCase());
  const cardB = byHandle.get(handleB.toLowerCase());
  const valueA = Number(cardA.plaintext.value);
  const valueB = Number(cardB.plaintext.value);
  const weightA = await read("weightOf", [DECK, BigInt(valueA)]);
  const weightB = await read("weightOf", [DECK, BigInt(valueB)]);
  console.log(`creator  weight ${weightA}`);
  console.log(`opponent weight ${weightB}`);

  const [winner, banked] = await a.send(ADDR, abi, "resolveBattle", [
    id,
    BigInt(valueA), cardA.covalidatorSignatures.map(toBytes),
    BigInt(valueB), cardB.covalidatorSignatures.map(toBytes),
  ]);

  const zero = "0x0000000000000000000000000000000000000000";
  console.log(
    winner === zero
      ? `\ndraw, each keeps their own (${await read("bankedWeight", [a.address])} / ${await read("bankedWeight", [b.address])})`
      : `\nwinner ${winner} takes ${banked} weight`,
  );
  console.log(`click to verdict: ${Date.now() - joined} ms from the join`);
})().catch((err) => {
  console.error(err.shortMessage || err.message || err);
  process.exit(1);
});
