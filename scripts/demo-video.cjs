// The demo film: a real run of the live site, recorded by a browser.
//
//   node demo-video.cjs            -> a .webm in DEMO_DIR (/tmp/tessera-demo by default)
//
// This is not an edit and not a mockup. The wallet is injected (the same way as
// in the end to end checks), but every open here is a real transaction: it buys a
// ticket from Megapot and draws a card from Inco's encrypted list. So the run
// SPENDS slots out of the deck, like any other player.
//
// The pauses are set for a viewer rather than for a machine: where a check waits
// exactly as long as it must, a film has to let the eye finish reading.

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

  // -- 1. The catalogue -------------------------------------------------------
  say("the catalogue");
  await p.goto(SITE, { waitUntil: "networkidle", timeout: 60000 });
  await wait(4500);
  await p.evaluate(() => window.scrollBy({ top: 620, behavior: "smooth" }));
  await wait(4000);

  // -- 2. The drain curve: a deck is a finite pile ------------------------------
  // This is the project's main claim, and it is shown by a CARD rather than by
  // words: on the back of every deck is drawn how it was taken apart.
  say("how the deck drained");
  const flip = p.locator("button[aria-label*='Show how this deck emptied']").first;
  try {
    await p.locator("button[aria-label*='emptied']").first().click({ timeout: 4000 });
    await wait(4500);
    await p.locator("button[aria-label*='Show the case']").first().click({ timeout: 4000 });
    await wait(1500);
  } catch {
    say("  (no flip button, skipping)");
  }

  // -- 3. The deck page: what exactly lies in it --------------------------------
  say(`deck #${DECK}`);
  await p.goto(`${SITE}/case/${DECK}`, { waitUntil: "networkidle", timeout: 60000 });
  await wait(4000);
  await p.evaluate(() => window.scrollBy({ top: 700, behavior: "smooth" }));
  await wait(4500);
  await p.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await wait(1500);

  // -- 4. The wallet -----------------------------------------------------------
  say("the wallet");
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

  // -- 5. One open -------------------------------------------------------------
  say("one open");
  await p.getByRole("button", { name: /^Open\b(?!\s*\d)/ }).first().click();
  // The theatre runs by itself: the signature, the confirmation, 6 to 9 seconds
  // of covalidators, the strip braking, the chest. We do not hurry it, this IS
  // the film.
  await p.locator(".fixed[role=dialog]").waitFor({ timeout: 90000 });
  await wait(22000);
  await p.keyboard.press("Escape");
  await p.mouse.click(30, 30);
  await wait(2500);

  // -- 6. A batch of five --------------------------------------------------------
  say("a batch of 5");
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

  // -- 7. The pool counter went down ----------------------------------------------
  say("the pool after the opens");
  await p.reload({ waitUntil: "networkidle" });
  await wait(5000);

  // -- 8. Anyone can cut their own deck ---------------------------------------------
  say("cutting your own deck");
  await p.goto(`${SITE}/create`, { waitUntil: "networkidle", timeout: 60000 });
  await wait(5000);
  await p.evaluate(() => window.scrollBy({ top: 500, behavior: "smooth" }));
  await wait(4000);

  const video = p.video();
  await ctx.close();
  await b.close();
  console.log(`\ndone: ${await video.path()}`);
})().catch((e) => {
  console.error("FAILING:", e.message.split("\n")[0]);
  process.exit(1);
});
