// A live exchange of shards for a real ticket.
// It reveals all of its slots through the covalidators, picks out the shards by
// the public drop table and sends five attestations in one redeem().
//
// This is what the front end will do on the "exchange" button.
const { Lightning } = require('@inco/lightning-js/lite');
const { createWalletClient, createPublicClient, http, defineChain, parseGwei, parseAbi, toHex } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { baseSepolia } = require('viem/chains');

const ADDR = process.argv[2];
const PK = process.argv[3];

const abi = parseAbi([
  'function countOf(address) view returns (uint256)',
  'function handleOf(address, uint256) view returns (bytes32)',
  'function shardSlots() view returns (uint16)',
  'function shardSpent(bytes32) view returns (bool)',
  'function treasury() view returns (uint256)',
  'function feesClaimable() view returns (uint256)',
  'function redeem(uint256[] slotIndexes, uint256[] values, bytes[][] signatures) returns (uint256)',
]);

// The SDK hands the signature over as an object {0: byte, 1: byte, ...} rather
// than as a Uint8Array.
const toBytes = (sig) => toHex(Uint8Array.from(Object.values(sig)));

(async () => {
  const account = privateKeyToAccount(PK);
  const chain = defineChain({ ...baseSepolia, fees: { maxPriorityFeePerGas: parseGwei('2') } });
  const rpc = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
  const wallet = createWalletClient({ chain, transport: http(rpc), account });
  const pub = createPublicClient({ chain, transport: http(rpc) });
  const read = (functionName, args) => pub.readContract({ address: ADDR, abi, functionName, args });

  const zap = await Lightning.baseSepoliaTestnet();

  const [count, shardMax] = await Promise.all([read('countOf', [account.address]), read('shardSlots', [])]);
  console.log(`the player has ${count} slots, shard values: 1..${shardMax}`);

  const handles = [];
  for (let i = 0n; i < count; i++) handles.push(await read('handleOf', [account.address, i]));

  console.log('revealing through the covalidators...');
  const revealed = await zap.attestedReveal(handles);

  const shards = [];
  for (let i = 0; i < revealed.length; i++) {
    const value = Number(revealed[i].plaintext.value);
    const spent = await read('shardSpent', [handles[i]]);
    const kind = spent ? 'spent' : value <= Number(shardMax) ? 'SHARD' : 'cosmetics';
    console.log(`  slot ${i}: ${String(value).padStart(3)}  ${kind}`);
    if (!spent && value <= Number(shardMax)) {
      shards.push({ index: BigInt(i), value: BigInt(value), sigs: revealed[i].covalidatorSignatures.map(toBytes) });
    }
  }

  console.log(`\nshards: ${shards.length} of the 5 needed`);
  if (shards.length < 5) {
    console.log(`short by ${5 - shards.length}, open more cases`);
    return;
  }

  const treasury = await read('treasury', []);
  const claimable = await read('feesClaimable', []);
  console.log(`treasury: ${treasury}, not claimed from Megapot: ${claimable}`);

  const five = shards.slice(0, 5);
  const T = Date.now();
  const { request } = await pub.simulateContract({
    address: ADDR,
    abi,
    functionName: 'redeem',
    args: [five.map((s) => s.index), five.map((s) => s.value), five.map((s) => s.sigs)],
    account,
    gasPrice: parseGwei('2'),
  });
  const hash = await wallet.writeContract(request);
  const rcpt = await pub.waitForTransactionReceipt({ hash });

  console.log(`\nredeem: ${Date.now() - T} ms, gas ${rcpt.gasUsed}, status ${rcpt.status}`);
  console.log(`   slots ${five.map((s) => s.index).join(', ')} burned -> a real Megapot ticket`);
  console.log(`   ${hash}`);
})().catch((e) => console.error('FATAL:', String(e.shortMessage || e.message).split('\n')[0]));
