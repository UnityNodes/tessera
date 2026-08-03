const { Lightning } = require('@inco/lightning-js/lite');
const { createWalletClient, http, defineChain, parseGwei } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { baseSepolia } = require('viem/chains');

const handle = process.argv[2];
const pk = process.argv[3];
if (!handle || !pk) {
  console.error(': node measure.cjs <handle> <privateKey>');
  process.exit(1);
}

const ms = (t) => `${Date.now() - t} ms`;

(async () => {
  const tInit = Date.now();
  const zap = await Lightning.baseSepoliaTestnet();
  console.log(`SDK: ${ms(tInit)}`);

  console.log(':', Object.getOwnPropertyNames(Object.getPrototypeOf(zap))
    .filter((m) => !m.startsWith('_') && m !== 'constructor').join(', '));

  const account = privateKeyToAccount(pk);
  const chain = defineChain({ ...baseSepolia, fees: { maxPriorityFeePerGas: parseGwei('10') } });
  const walletClient = createWalletClient({ chain, transport: http('https://sepolia.base.org'), account });

  for (const method of ['attestedReveal', 'attestedDecrypt']) {
    if (typeof zap[method] !== 'function') {
      console.log(`\n${method}: SDK, `);
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
        console.log(`  ✅ ${attempt} ${ms(tTry)}`);
        console.log(`  ⏱  : ${ms(tStart)}`);
        console.log(`  : ${value}`);
        break;
      } catch (err) {
        const m = (err && err.message ? err.message : String(err)).split('\n')[0].slice(0, 110);
        console.log(`  ${attempt} ${ms(tTry)} ${m}`);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }
})().catch((e) => console.error(':', e.message));
