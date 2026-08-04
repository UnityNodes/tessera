//
//
//   node seed.cjs <deck> <privateKey> <opens> [battlesToLeaveWaiting]

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
  "function openCase() returns (uint16 index, bytes32 handle)",
  "function openBattle() returns (uint256 id, uint64 slotIndex)",
  "function resolveBattle(uint256 id, uint256 valueA, bytes[] signaturesA, uint256 valueB, bytes[] signaturesB) returns (address winner, uint256 banked)",
  "function sweepFees() returns (uint256 claimed)",
  "function vault() view returns (uint256)",
  "function treasury() view returns (uint256)",
  "function feesClaimable() view returns (uint256)",
  "function drawn() view returns (uint16)",
  "function remaining() view returns (uint16)",
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

  const need = BigInt(OPENS + BATTLES + 2) * 1_000_000n;
  const balance = await pub.readContract({
    address: TOKEN, abi: erc20, functionName: "balanceOf", args: [account.address],
  });
  if (balance < need) await send(TOKEN, erc20, "mint", [account.address, need]);
  const allowance = await pub.readContract({
    address: TOKEN, abi: erc20, functionName: "allowance", args: [account.address, ADDR],
  });
  if (allowance < need) await send(TOKEN, erc20, "approve", [ADDR, (1n << 256n) - 1n]);

  for (let i = 0; i < OPENS; i++) {
    if ((await read("remaining")) === 0) break;
    await send(ADDR, abi, "openCase");
    if ((i + 1) % 10 === 0) console.log(`  ${i + 1} / ${OPENS}`);
  }

  for (let i = 0; i < BATTLES; i++) {
    const [id] = await send(ADDR, abi, "openBattle");
    console.log(`  battle #${id} left waiting for an opponent`);
  }

  if ((await read("feesClaimable")) > 0n) await send(ADDR, abi, "sweepFees");

  const money = (v) => `$${Number(formatUnits(v, 6)).toFixed(2)}`;
  console.log(`\ndrawn      ${await read("drawn")} / ${Number(await read("drawn")) + Number(await read("remaining"))}`);
  console.log(`vault      ${money(await read("vault"))}`);
  console.log(`treasury   ${money(await read("treasury"))}`);
  console.log(`claimable  ${money(await read("feesClaimable"))}`);
})().catch((err) => {
  console.error(err.shortMessage || err.message || err);
  process.exit(1);
});
