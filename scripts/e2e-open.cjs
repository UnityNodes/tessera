const { Lightning } = require('@inco/lightning-js/lite');
const { createWalletClient, createPublicClient, http, defineChain, parseGwei, parseAbi } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { baseSepolia } = require('viem/chains');

const ADDR = process.argv[2];
const PK = process.argv[3];
const abi = parseAbi(['function openCase() returns (uint16 index, bytes32 handle)']);

(async () => {
  const account = privateKeyToAccount(PK);
  const chain = defineChain({ ...baseSepolia, fees: { maxPriorityFeePerGas: parseGwei('2') } });
  const rpc = 'https://sepolia.base.org';
  const wallet = createWalletClient({ chain, transport: http(rpc), account });
  const pub = createPublicClient({ chain, transport: http(rpc) });

  const zap = await Lightning.baseSepoliaTestnet(); // ,

  const T = Date.now();
  console.log('▶ ');

  const { result, request } = await pub.simulateContract({
    address: ADDR, abi, functionName: 'openCase', account, gasPrice: parseGwei('2'),
  });
  const [index, handle] = result;
  console.log(`  ${index}, ${handle.slice(0, 18)}… : +${Date.now() - T} ms`);

  const hash = await wallet.writeContract(request);
  const rcpt = await pub.waitForTransactionReceipt({ hash });
  const T_TX = Date.now();
  console.log(`  openCase : +${T_TX - T} ms   (${rcpt.gasUsed})`);

  let attempt = 0;
  while (Date.now() - T_TX < 120_000) {
    attempt++;
    try {
      const res = await zap.attestedReveal([handle]);
      const v = res?.[0]?.plaintext?.value ?? res?.[0]?.value;
      console.log(`  : ${Date.now() - T_TX} ms  (${attempt})`);
      console.log(`  ⏱ : ${Date.now() - T} ms`);
      console.log(`  : ${v}`);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  console.log('  ');
})().catch((e) => console.error(':', String(e.message).split('\n')[0]));
