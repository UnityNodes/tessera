// Measuring the real reveal to attestedDecrypt latency on Base Sepolia.
// Run: node measure.cjs <handle> <privateKey>
const { Lightning } = require('@inco/lightning-js/lite');
const { createWalletClient, http, defineChain, parseGwei } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { baseSepolia } = require('viem/chains');

const handle = process.argv[2];
const pk = process.argv[3];
if (!handle || !pk) {
  console.error('usage: node measure.cjs <handle> <privateKey>');
  process.exit(1);
}

const ms = (t) => `${Date.now() - t} ms`;

(async () => {
  const tInit = Date.now();
  const zap = await Lightning.baseSepoliaTestnet();
  console.log(`SDK initialisation: ${ms(tInit)}`);

  console.log('available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(zap))
    .filter((m) => !m.startsWith('_') && m !== 'constructor').join(', '));

  const account = privateKeyToAccount(pk);
  const chain = defineChain({ ...baseSepolia, fees: { maxPriorityFeePerGas: parseGwei('10') } });
  const walletClient = createWalletClient({ chain, transport: http('https://sepolia.base.org'), account });

  for (const method of ['attestedReveal', 'attestedDecrypt']) {
    if (typeof zap[method] !== 'function') {
      console.log(`\n${method}: not in the SDK, skipping`);
      continue;
    }
    console.log(`\n=== ${method} ===`);
    const tStart = Date.now();
    let attempt = 0;

    while (Date.now() - tStart < 120_000) {
      attempt++;
      const tTry = Date.now();
      try {
        const args = method === 'attestedReveal' ? [[handle]] : [walletClient, [handle]];
        const res = await zap[method](...args);
        const value = res?.[0]?.plaintext?.value ?? res?.[0]?.value ?? JSON.stringify(res).slice(0, 120);
        console.log(`  ok, attempt ${attempt} in ${ms(tTry)}`);
        console.log(`  time from start: ${ms(tStart)}`);
        console.log(`  value: ${value}`);
        break;
      } catch (err) {
        const m = (err && err.message ? err.message : String(err)).split('\n')[0].slice(0, 110);
        console.log(`  attempt ${attempt} failed in ${ms(tTry)}: ${m}`);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }
})().catch((e) => console.error('FATAL:', e.message));
