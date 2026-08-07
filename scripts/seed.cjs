//
//
//   node seed.cjs <deck> <privateKey> <opensPerDeck> [battlesToLeaveWaiting]

const {
  createWalletClient, createPublicClient, http, parseAbi, formatUnits,
} = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { baseSepolia } = require("viem/chains");

const ADDR = process.argv[2];
const PK = process.argv[3];
const OPENS = Number(process.argv[4] ?? 60);
const BATTLES = Number(process.argv[5] ?? 0);
const RPC = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
const TOKEN = "0xA4253E7C13525287C56550b8708100f93E60509f";

const abi = parseAbi([
  "function openCase(uint32 deckId) returns (uint16 index, bytes32 handle)",
  "function openBattle(uint32 deckId) returns (uint256 id, uint64 slotIndex)",
  "function deckCount() view returns (uint256)",
  "function deckAt(uint32) view returns ((bytes32 cards, uint16 size, uint16 drawn, uint16 vaultUpTo, uint128 vault, uint64 unsweptOpens))",
  "function vaultOf(uint32) view returns (uint256)",
  "function resolveBattle(uint256 id, uint256 valueA, bytes[] signaturesA, uint256 valueB, bytes[] signaturesB) returns (address winner, uint256 banked)",
  "function sweepFees() returns (uint256 claimed)",
  "function vault() view returns (uint256)",
  "function treasury() view returns (uint256)",
  "function feesClaimable() view returns (uint256)",
]);
const erc20 = parseAbi([
  "function mint(address,uint256)",
  "function approve(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
]);

(async () => {
  const account = privateKeyToAccount(PK);
  const wallet = createWalletClient({ chain: baseSepolia, transport: http(RPC), account });
  const pub = createPublicClient({ chain: baseSepolia, transport: http(RPC) });

  const read = (functionName, args = []) =>
    pub.readContract({ address: ADDR, abi, functionName, args });

  const send = async (address, contractAbi, functionName, args = []) => {
    const { request, result } = await pub.simulateContract({
      address, abi: contractAbi, functionName, args, account,
    });
    const hash = await wallet.writeContract(request);
    const rcpt = await pub.waitForTransactionReceipt({ hash });
    if (rcpt.status !== "success") throw new Error(`${functionName} reverted`);
    return result;
  };

  const need = BigInt(OPENS * 5 + BATTLES + 4) * 1_000_000n;
  const balance = await pub.readContract({
    address: TOKEN, abi: erc20, functionName: "balanceOf", args: [account.address],
  });
  if (balance < need) await send(TOKEN, erc20, "mint", [account.address, need]);
  const allowance = await pub.readContract({
    address: TOKEN, abi: erc20, functionName: "allowance", args: [account.address, ADDR],
  });
  if (allowance < need) {
    await send(TOKEN, erc20, "approve", [ADDR, (1n << 256n) - 1n]);
    for (let i = 0; i < 30; i++) {
      const now = await pub.readContract({
        address: TOKEN, abi: erc20, functionName: "allowance", args: [account.address, ADDR],
      });
      if (now >= need) break;
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  const decks = Number(await read("deckCount"));

  const only = process.env.DECK ? [Number(process.env.DECK)] : [...Array(decks).keys()];
  console.log(`${decks} decks, : ${only.join(", ")}`);

  for (const d of only) {
    for (let i = 0; i < OPENS; i++) {
      const info = await read("deckAt", [d]);
      if (info.drawn >= info.size) break;
      await send(ADDR, abi, "openCase", [d]);
      if ((i + 1) % 10 === 0) console.log(`  deck ${d}: ${i + 1} / ${OPENS}`);
    }
  }

  for (let i = 0; i < BATTLES; i++) {
    const [id] = await send(ADDR, abi, "openBattle", [i % decks]);
    console.log(`  battle #${id} on deck ${i % decks} left waiting`);
  }

  if ((await read("feesClaimable")) > 0n) await send(ADDR, abi, "sweepFees");

  const money = (v) => `$${Number(formatUnits(v, 6)).toFixed(2)}`;
  console.log("");
  for (let d = 0; d < decks; d++) {
    const info = await read("deckAt", [d]);
    console.log(
      `deck ${d}   ${info.drawn}/${info.size} opened   vault ${money(await read("vaultOf", [d]))}`,
    );
  }
  console.log(`vault      ${money(await read("vault"))} total`);
  console.log(`treasury   ${money(await read("treasury"))}`);
  console.log(`claimable  ${money(await read("feesClaimable"))}`);
})().catch((err) => {
  console.error(err.shortMessage || err.message || err);
  process.exit(1);
});
