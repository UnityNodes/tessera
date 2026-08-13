//
//
//

const { chromium } = require("/root/tessera/scripts/node_modules/playwright-core");
const { createWalletClient, createPublicClient, http, defineChain, parseGwei } =
  require("/root/tessera/scripts/node_modules/viem");
const { privateKeyToAccount } = require("/root/tessera/scripts/node_modules/viem/accounts");
const { baseSepolia } = require("/root/tessera/scripts/node_modules/viem/chains");

const SITE = process.env.SITE ?? "https://tessera.unitynodes.com";
const DECK = Number(process.env.DECK ?? 1);
const DIR = process.env.DEMO_DIR ?? "/tmp/tessera-demo";
const W = 1600;
const H = 900;

const chain = defineChain({ ...baseSepolia, fees: { maxPriorityFeePerGas: parseGwei("2") } });
const acc = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY);
const pub = createPublicClient({ chain, transport: http(process.env.BASE_SEPOLIA_RPC_URL) });
const wallet = createWalletClient({ account: acc, chain, transport: http(process.env.BASE_SEPOLIA_RPC_URL) });

const say = (s) => console.log(`  ${s}`);

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_BIN });
  const ctx = await b.newContext({
    viewport: { width: W, height: H },
    recordVideo: { dir: DIR, size: { width: W, height: H } },
  });

  await ctx.exposeFunction("__rpc", async (method, params) => {
    if (method === "eth_requestAccounts" || method === "eth_accounts") return [acc.address];
    if (method === "eth_chainId") return "0x14a34";
    if (method === "wallet_switchEthereumChain" || method === "wallet_addEthereumChain") return null;
    if (method === "personal_sign") return wallet.signMessage({ message: { raw: params[0] } });
    if (method === "eth_sendTransaction") {
      const t = params[0];
      return wallet.sendTransaction({
        to: t.to,
        data: t.data,
        value: t.value ? BigInt(t.value) : undefined,
        gas: t.gas ? BigInt(t.gas) : undefined,
      });
    }
    return pub.request({ method, params });
  });

  await ctx.addInitScript(`(() => {
    const L = {};
    const provider = { isMetaMask: true,
      request: ({method, params}) => window.__rpc(method, params ?? []),
      on: (e, fn) => { (L[e] ||= []).push(fn); return provider; }, removeListener: () => provider };
    window.ethereum = provider;
    const info = { uuid:"00000000-0000-4000-8000-000000000000", name:"Test Wallet",
                   rdns:"dev.tessera.test", icon:"data:image/svg+xml;base64,PHN2Zy8+" };
    const a = () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider",
      { detail: Object.freeze({ info, provider }) }));
    window.addEventListener("eip6963:requestProvider", a); a();
  })()`);

  const p = await ctx.newPage();
  const wait = (ms) => p.waitForTimeout(ms);

  say("");
  await p.goto(SITE, { waitUntil: "networkidle", timeout: 60000 });
  await wait(4500);
  await p.evaluate(() => window.scrollBy({ top: 620, behavior: "smooth" }));
  await wait(4000);

  say("");
  const flip = p.locator("button[aria-label*='Show how this deck emptied']").first;
  try {
    await p.locator("button[aria-label*='emptied']").first().click({ timeout: 4000 });
    await wait(4500);
    await p.locator("button[aria-label*='Show the case']").first().click({ timeout: 4000 });
    await wait(1500);
  } catch {
    say("  ()");
  }

  say(`#${DECK}`);
  await p.goto(`${SITE}/case/${DECK}`, { waitUntil: "networkidle", timeout: 60000 });
  await wait(4000);
  await p.evaluate(() => window.scrollBy({ top: 700, behavior: "smooth" }));
  await wait(4500);
  await p.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await wait(1500);

  say("");
  const connect = p.getByRole("button", { name: /connect/i }).first();
  if (await connect.count()) {
    await connect.click();
    await wait(1800);
    for (const name of [/Test Wallet/i, /Injected/i]) {
      const w = p.getByRole("button", { name }).first();
      if (await w.count()) {
        await w.click();
        break;
      }
    }
  }
  await wait(3500);

  say("");
  await p.getByRole("button", { name: /^Open\b(?!\s*\d)/ }).first().click();
  await p.locator(".fixed[role=dialog]").waitFor({ timeout: 90000 });
  await wait(22000);
  await p.keyboard.press("Escape");
  await p.mouse.click(30, 30);
  await wait(2500);

  say("×5");
  const x5 = p.getByRole("button", { name: "x5", exact: true });
  if (await x5.count()) {
    await x5.click();
    await wait(1200);
    await p.getByRole("button", { name: /Open 5/ }).first().click();
    await p.locator(".fixed[role=dialog]").waitFor({ timeout: 90000 });
    await wait(26000);
    await p.keyboard.press("Escape");
    await p.mouse.click(30, 30);
    await wait(2500);
  }

  say("");
  await p.reload({ waitUntil: "networkidle" });
  await wait(5000);

  say("");
  await p.goto(`${SITE}/create`, { waitUntil: "networkidle", timeout: 60000 });
  await wait(5000);
  await p.evaluate(() => window.scrollBy({ top: 500, behavior: "smooth" }));
  await wait(4000);

  const video = p.video();
  await ctx.close();
  await b.close();
  console.log(`\n: ${await video.path()}`);
})().catch((e) => {
  console.error(":", e.message.split("\n")[0]);
  process.exit(1);
});
