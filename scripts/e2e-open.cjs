// Measuring "click to prize" for the single transaction openCase().
// The handle comes from the simulation, so there is no extra read after the write.
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

  const zap = await Lightning.baseSepoliaTestnet(); // warmed up in advance, as it will be on the front end

  const T = Date.now();
  console.log('> CLICK');

  const { result, request } = await pub.simulateContract({
    address: ADDR, abi, functionName: 'openCase', account, gasPrice: parseGwei('2'),
  });
  const [index, handle] = result;
  console.log(`  the simulation gave slot ${index}, handle ${handle.slice(0, 18)}... : +${Date.now() - T} ms`);

  const hash = await wallet.writeContract(request);
  const rcpt = await pub.waitForTransactionReceipt({ hash });
  const T_TX = Date.now();
  console.log(`  openCase confirmed      : +${T_TX - T} ms   (gas ${rcpt.gasUsed})`);

  let attempt = 0;
  while (Date.now() - T_TX < 120_000) {
    attempt++;
    try {
      const res = await zap.attestedReveal([handle]);
      const v = res?.[0]?.plaintext?.value ?? res?.[0]?.value;
      console.log(`  waiting for a covalidator: ${Date.now() - T_TX} ms  (attempts ${attempt})`);
      console.log(`  from click to prize      : ${Date.now() - T} ms`);
      console.log(`  card: ${v}`);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  console.log('  never arrived');
})().catch((e) => console.error('FATAL:', String(e.message).split('\n')[0]));
