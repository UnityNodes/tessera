//
//
//   node browser-e2e.cjs <url> <privateKey>

const { chromium } = require("playwright-core");
const { createWalletClient, createPublicClient, http, defineChain, parseGwei } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { baseSepolia } = require("viem/chains");

const URL = process.argv[2] || "https://tessera.unitynodes.com/";
const PK = process.argv[3];
const RPC = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
const CHROME = process.env.CHROME_BIN;
const SHOTS = process.env.SHOT_DIR || "/tmp";

const account = privateKeyToAccount(PK);
const chain = defineChain({ ...baseSepolia, fees: { maxPriorityFeePerGas: parseGwei("2") } });
const wallet = createWalletClient({ chain, transport: http(RPC), account });
const pub = createPublicClient({ chain, transport: http(RPC) });

async function handle(method, params = []) {
  switch (method) {
    case "eth_requestAccounts":
    case "eth_accounts":
      return [account.address];
    case "eth_chainId":
      return "0x14a34"; // 84532
    case "net_version":
      return "84532";
    case "wallet_switchEthereumChain":
    case "wallet_addEthereumChain":
      return null;
    case "eth_sendTransaction": {
      const t = params[0];
      return wallet.sendTransaction({
        to: t.to,
        data: t.data,
        value: t.value ? BigInt(t.value) : undefined,
        gas: t.gas ? BigInt(t.gas) : undefined,
      });
    }
    case "personal_sign":
      return wallet.signMessage({ message: { raw: params[0] } });
    default:
      return pub.request({ method, params });
  }
}

const PROVIDER = `
(() => {
  const listeners = {};
  const provider = {
    isMetaMask: true,
    request: ({ method, params }) => window.__rpc(method, params ?? []),
    on: (e, fn) => { (listeners[e] ||= []).push(fn); return provider; },
    removeListener: (e, fn) => {
      listeners[e] = (listeners[e] || []).filter((f) => f !== fn);
      return provider;
    },
  };
  window.ethereum = provider;
  const info = {
    uuid: "00000000-0000-4000-8000-000000000000",
    name: "Test Wallet",
    rdns: "dev.tessera.test",
    icon: "data:image/svg+xml;base64,PHN2Zy8+",
  };
  const announce = () =>
    window.dispatchEvent(
      new CustomEvent("eip6963:announceProvider", {
        detail: Object.freeze({ info, provider }),
      }),
    );
  window.addEventListener("eip6963:requestProvider", announce);
  announce();
})();
`;

const shot = (page, name) => page.screenshot({ path: `${SHOTS}/${name}.png` });

/**
 *
 */
async function ensureConnected(page) {
  const connected = page.getByRole("button", { name: /Disconnect/ });
  const connect = page.getByRole("button", { name: /Test Wallet|Injected/ }).first();

  const auto = await connected.waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
  if (auto) return "already";
  try {
    await connect.click({ timeout: 25000 });
  } catch (e) {
    console.error(`  : ${JSON.stringify(await page.getByRole("button").allTextContents())}`);
    console.error(`  : ${await page.evaluate(() => typeof window.ethereum)}`);
    await page.screenshot({ path: `${SHOTS}/e2e-connect-failed.png` });
    throw e;
  }
  await connected.waitFor({ timeout: 25000 });
  return "connected";
}


(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await ctx.exposeFunction("__rpc", (method, params) =>
    handle(method, params).catch((e) => {
      throw new Error(e.shortMessage || e.message);
    }),
  );
  await ctx.addInitScript(PROVIDER);
  const page = await ctx.newPage();

  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  const failed = [];
  page.on("response", (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.request().method()} ${r.url().slice(0, 110)}`);
  });
  page.on("pageerror", (e) => errors.push(String(e.message)));

  console.log(`${account.address}`);
  await page.goto(URL, { waitUntil: "domcontentloaded" });

  console.log(`✓ ${await ensureConnected(page)}`);

  const dollars = await page.getByText(/^\$\d/).first().textContent();
  if (dollars === "$0" || dollars === "$0.0") {
    await page.getByRole("button", { name: /Get \$20 test/ }).click();
    await page.getByRole("button", { name: /Minting/ }).waitFor({ state: "detached", timeout: 60000 });
    console.log("✓ ");
  }

  const openBtn = page.getByRole("button", { name: /Open a case|Approve once/ });
  await openBtn.waitFor({ timeout: 20000 });
  const label = await openBtn.textContent();
  console.log(`▶ ${label.trim()}`);

  const t0 = Date.now();
  await openBtn.click();

  await page.getByText(/covalidators are decrypting/).waitFor({ timeout: 90000 });
  const tWait = Date.now() - t0;
  console.log(`  , : ${tWait} ms`);
  await shot(page, "e2e-waiting");

  await page.getByRole("button", { name: /Open another/ }).waitFor({ timeout: 120000 });
  console.log(`⏱ : ${Date.now() - t0} ms`);

  const prize = await page.locator("main").getByText(/You bought/).first().textContent();
  console.log(`  ${prize.trim()}`);
  await shot(page, "e2e-revealed");

  if (process.env.TEST_RESUME) {
    const second = await ctx.newPage();
    await second.goto(URL, { waitUntil: "domcontentloaded" });
    await ensureConnected(second);
    const btn = second.getByRole("button", { name: /Open a case|Approve once/ });
    await btn.waitFor({ timeout: 30000 });
    await btn.click();
    await second.getByText(/covalidators are decrypting/).waitFor({ timeout: 90000 });
    console.log("▶ ");
    await second.close();

    const back = await ctx.newPage();
    await back.goto(URL, { waitUntil: "domcontentloaded" });
    await ensureConnected(back);
    await back.getByText(/Welcome back/).waitFor({ timeout: 30000 });
    console.log("✓ '");
    await back.getByText(/slot \d+ of \d+/).waitFor({ timeout: 90000 });
    const got = await back.getByText(/slot \d+ of \d+/).first().textContent();
    console.log(`✓ : ${got.trim()}`);
    await back.screenshot({ path: `${SHOTS}/e2e-resumed.png` });
    await back.close();
  }

  const redeem = page.getByRole("button", { name: /Take \d+ ticket/ });
  if (await redeem.count()) {
    console.log("▶ ");
    await redeem.click();
    await page.getByText(/bought you \d+ more real ticket/).waitFor({ timeout: 90000 });
    console.log("✓ ");
    await shot(page, "e2e-redeemed");
  } else {
    const held = await page.getByText(/No bonus tickets yet|real ticket/).first().textContent();
    console.log(`  ${held.trim()}`);
  }

  if (failed.length) {
    const byUrl = {};
    for (const f of failed) byUrl[f] = (byUrl[f] || 0) + 1;
    console.log(":");
    for (const [k, n] of Object.entries(byUrl)) console.log(`  ×${n}  ${k}`);
  }
  console.log(errors.length ? `⚠ : ${errors.length}` : "✓ ");
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(async (e) => {
  console.error(":", String(e.message).split("\n")[0]);
  process.exit(1);
});
