//
//
//
//   set -a; . .env; set +a; node browser-e2e.cjs <url>

const { chromium } = require("playwright-core");
const { createWalletClient, createPublicClient, http, defineChain, parseGwei } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { baseSepolia } = require("viem/chains");

const URL = process.argv[2] || "https://tessera.unitynodes.com/";
const PK = process.argv[3] || process.env.DEPLOYER_PRIVATE_KEY;
const RPC = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
const CHROME = process.env.CHROME_BIN;
const SHOTS = process.env.SHOT_DIR || "/tmp";

if (!PK) {
  console.error(": DEPLOYER_PRIVATE_KEY ");
  process.exit(2);
}
const account = privateKeyToAccount(PK.startsWith("0x") ? PK : `0x${PK}`);
const chain = defineChain({ ...baseSepolia, fees: { maxPriorityFeePerGas: parseGwei("2") } });
const wallet = createWalletClient({ chain, transport: http(RPC), account });
const pub = createPublicClient({ chain, transport: http(RPC) });

const WEB = require("path").join(__dirname, "..", "web");
const chainSrc = require("fs").readFileSync(require("path").join(WEB, "lib", "chain.ts"), "utf8");
const DECK = chainSrc.match(/DECK_ADDRESS[^"']*["'](0x[0-9a-fA-F]{40})["']/)[1];
const abiSrc = require("fs").readFileSync(require("path").join(WEB, "lib", "abi.ts"), "utf8");
const DECK_ABI = JSON.parse(abiSrc.slice(abiSrc.indexOf("["), abiSrc.lastIndexOf("]") + 1));

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
  const connected = page.locator("summary", { hasText: /^0x[a-fA-F0-9]{4}/ });
  const opener = page.locator("summary", { hasText: /Connect wallet/ });

  const auto = await connected.waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
  if (auto) return "already";

  try {
    await opener.click({ timeout: 20000 });
    await page.getByRole("button", { name: /Test Wallet|Injected|MetaMask/ }).first().click({ timeout: 20000 });
    await connected.waitFor({ timeout: 25000 });
  } catch (e) {
    console.error(`  : ${JSON.stringify(await page.getByRole("button").allTextContents())}`);
    console.error(`  : ${await page.evaluate(() => typeof window.ethereum)}`);
    await page.screenshot({ path: `${SHOTS}/e2e-connect-failed.png` });
    throw e;
  }
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

  //
  {
    const chip = page.locator("summary", { hasText: /^0x[a-fA-F0-9]{4}/ }).first();
    if (await chip.count()) {
      await chip.click();
      await page.waitForTimeout(400);
      await shot(page, "e2e-wallet-panel");
      await page.mouse.click(250, 520);
      await page.waitForTimeout(400);
      const byClick = await page.evaluate(() =>
        [...document.querySelectorAll("details")].some((d) => d.open),
      );
      await chip.click();
      await page.waitForTimeout(300);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      const byEsc = await page.evaluate(() =>
        [...document.querySelectorAll("details")].some((d) => d.open),
      );
      if (byClick || byEsc) {
        throw new Error(
          `: ${byClick ? "" : ""}, ` +
            `Escape ${byEsc ? "" : ""}`,
        );
      }
      console.log("✓ Escape");
    }
  }

  //
  const wallet = page.locator("summary", { hasText: /^0x[a-fA-F0-9]{4}/ }).first();
  await wallet.click();
  await page.waitForTimeout(600);
  const dollars = await page.evaluate(() => {
    for (const el of document.querySelectorAll("*")) {
      if (!el.children.length && (el.textContent || "").trim() === "test dollars") {
        const m = (el.closest("div")?.parentElement?.textContent || "").match(/\$([\d.,]+)/);
        if (m) return Number(m[1].replace(/,/g, ""));
      }
    }
    return 0;
  });
  console.log(`  $${dollars.toFixed(2)}`);
  if (dollars < 1) {
    await page.locator("button", { hasText: /Get \$20 in test dollars/ }).first().click();
    await page.waitForFunction(
      () => ![...document.querySelectorAll("button")].some((b) => /Minting/.test(b.textContent || "")),
      { timeout: 90000 },
    );
    console.log("✓ ");
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  const firstCase = process.env.DECK
    ? `/case/${process.env.DECK}`
    : await page.locator("a[href^='/case/']").first().getAttribute("href");
  await page.goto(URL.replace(/\/+$/, "") + firstCase, { waitUntil: "domcontentloaded" });
  console.log(`  ${firstCase}`);

  const ROUNDS = Number(process.env.OPENS || 1);
  let gotPrize = false;

  for (let round = 1; round <= ROUNDS && !gotPrize; round++) {
    const openBtn = page.getByRole("button", { name: /Open a case|Open another|Approve once/ });
    await openBtn.waitFor({ timeout: 20000 });
    //
    await page.evaluate(() => {
      window.__reach = [];
      new MutationObserver((recs) => {
        for (const r of recs) {
          const v = Number(r.target.getAttribute("data-reach"));
          if (Number.isFinite(v)) window.__reach.push(v);
        }
      }).observe(document.body, {
        subtree: true,
        attributes: true,
        attributeFilter: ["data-reach"],
      });
    });

    const label = (await openBtn.textContent()).trim();
    console.log(`▶ ${round}/${ROUNDS}  ${label}`);

    const t0 = Date.now();
    await openBtn.click();

    const failed = page.getByText(/RPC Request failed|Try again/);
    try {
      await Promise.race([
        page.getByText(/covalidators/).first().waitFor({ timeout: 90000 }),
        //
        page.getByText(/click anywhere to continue/).first().waitFor({ timeout: 90000 }),
        failed.first().waitFor({ timeout: 90000 }).then(() => {
          throw new Error("RPC ");
        }),
      ]);
    } catch (e) {
      if (String(e.message).includes("RPC ")) {
        console.log("  ⟳ RPC , 20 ");
        await page.waitForTimeout(20000);
        round--;
        continue;
      }
      await shot(page, `e2e-stuck-${round}`);
      const seen = await page.locator("main").innerText();
      console.error(`  . :\n${seen.slice(0, 500)}`);
      throw e;
    }
    console.log(`  , : ${Date.now() - t0} ms`);

    //
    for (const at of [800, 2000, 4000, 6000, 8000]) {
      await page.waitForTimeout(at === 800 ? 800 : 2000);
      const { inDom, seen } = await page.evaluate(() => {
        const all = [...document.querySelectorAll("[data-roll-item]")];
        const vw = window.innerWidth;
        return {
          inDom: all.length,
          seen: all.filter((el) => {
            const r = el.getBoundingClientRect();
            return r.right > 0 && r.left < vw;
          }).length,
        };
      });
      if (inDom === 0) break;
      if (process.env.WATCH) {
        console.log(`   +${at} : ${seen} ${inDom}`);
        await shot(page, `watch-${at}`);
      }
      if (seen < 3) {
        await shot(page, "e2e-strip-gone");
        throw new Error(
          `${at} : ${seen} ${inDom} DOM`,
        );
      }
    }

    await page.getByText(/click anywhere to continue/).waitFor({ timeout: 150000 });
    const ms = Date.now() - t0;

    const scene = (
      await page
        .getByRole("dialog", { name: /Opening a case/ })
        .getByText(/^(Grout|TESA|Denarius|Aureus|Porphyry|The Vault|empty|\+1 real ticket)$/)
        .first()
        .textContent()
    ).trim();
    gotPrize = !["empty", "Grout", "+1 real ticket"].includes(scene);
    console.log(`⏱ ${ms} ms  →  ${scene}${gotPrize ? "  ★" : ""}`);
    await page.waitForTimeout(2200);
    await shot(page, gotPrize ? "e2e-prize" : `e2e-empty-${round}`);

    const onPage = await page.getByText(/You own|found the vault|No ticket/).first().textContent();
    console.log(`  : ${onPage.trim()}`);

    const reach = await page.evaluate(() => Math.max(0, ...(window.__reach || [])));
    if (reach > 40) {
      throw new Error(`${reach} , `);
    }
    console.log(`  : ${reach} `);

    await page.getByRole("dialog", { name: /Opening a case/ }).click({ position: { x: 8, y: 8 } });
    await page.getByRole("button", { name: /Open a case/ }).waitFor({ timeout: 30000 });
  }
  if (!gotPrize) console.log(`  ${ROUNDS} `);

  if (process.env.TEST_RESUME) {
    const second = await ctx.newPage();
    await second.goto(URL, { waitUntil: "domcontentloaded" });
    await ensureConnected(second);
    const btn = second.getByRole("button", { name: /Open a case|Approve once/ });
    await btn.waitFor({ timeout: 30000 });
    await btn.click();
    await second.getByText(/covalidators decrypt/).waitFor({ timeout: 90000 });
    console.log("▶ ");
    await second.close();

    const back = await ctx.newPage();
    await back.goto(URL, { waitUntil: "domcontentloaded" });
    await ensureConnected(back);
    await back.getByText(/Welcome back/).waitFor({ timeout: 30000 });
    console.log("✓ '");
    await back.getByText(/You own|found the vault|No ticket/).waitFor({ timeout: 120000 });
    const got = await back.getByText(/You own|found the vault|No ticket/).first().textContent();
    console.log(`✓ : ${got.trim()}`);
    await back.screenshot({ path: `${SHOTS}/e2e-resumed.png` });
    await back.close();
  }

  //
  //
  const redeem = page.getByRole("button", { name: /^Take \d+ ticket/ });
  const unfunded = page.getByRole("button", { name: /^Not funded yet$/ });
  if (await redeem.count()) {
    console.log("▶ ");
    await redeem.click();
    await page.getByText(/bought you \d+ more real ticket/).waitFor({ timeout: 90000 });
    console.log("✓ ");
    await shot(page, "e2e-redeemed");
  } else if (await unfunded.count()) {
    const why = await page.getByText(/short\./).first().textContent();
    if (!/\$\d+\.\d\d/.test(why)) throw new Error(`Not funded yet: ${why}`);
    console.log(`✓ , ${why.trim().slice(0, 90)}`);
  } else {
    const chip = page.getByText(/\d+ TESA/).first();
    if (await chip.count()) console.log(`  ${(await chip.textContent()).trim()}`);
    else console.log("  ");
  }

  //
  //
  //
  if (process.env.BATTLE_UI) {
    console.log("▶ ");
    await page.goto(URL.replace(/\/+$/, "") + "/battles", { waitUntil: "domcontentloaded" });
    const start = page.getByRole("button", { name: /^Start battle$/ });
    await start.waitFor({ timeout: 40000 }).catch(() => {});

    if (!(await start.count())) {
      //
      //
      const reasons = [
        /You already have a battle on the table/,
        /Every deck in this season is empty/,
        /Reading the chain/,
      ];
      let why = null;
      for (const r of reasons) {
        const hit = page.locator("main").getByText(r).first();
        if (await hit.count()) {
          why = (await hit.textContent()).trim();
          break;
        }
      }
      console.log(`  Start battle: ${why ?? ""}`);
    } else {
      let id = null;
      for (let tries = 1; tries <= 3 && !id; tries++) {
        await start.click();
        try {
          await page.waitForURL(/\/battles\/\d+$/, { timeout: 120000 });
          id = page.url().match(/\/battles\/(\d+)$/)[1];
        } catch {
          const said = await page
            .locator("main")
            .innerText()
            .catch(() => "");
          const banner = said.split("\n").find((l) => /revert|fail|error|reject|denied/i.test(l));
          if (banner && /rpc|network|timeout/i.test(banner) && tries < 3) {
            console.log(`  ⟳ ${banner.trim()} 20 `);
            await page.waitForTimeout(20000);
            continue;
          }
          await shot(page, "e2e-battle-stuck");
          throw new Error(
            `Start battle, ${page.url()}. ` +
              `: ${banner ?? ""}`,
          );
        }
      }
      console.log(`✓ #${id}`);

      //
      await page.getByText(new RegExp(`Battle #${id}\\b`)).first().waitFor({ timeout: 30000 });
      await page
        .getByText("sealed until someone pays", { exact: true })
        .waitFor({ timeout: 30000 });
      console.log("✓ ");
      await shot(page, "e2e-battle-opened");
    }
  }

  //
  //
  // CREATE_UI=1.
  if (process.env.CREATE_UI) {
    console.log("▶ ");
    await page.goto(URL.replace(/\/+$/, "") + "/create", { waitUntil: "domcontentloaded" });

    const name = `e2e${Date.now().toString(36).slice(-5)}`;
    await page.locator("#deck-name").fill(name);
    await page.locator("button[aria-label^='hue ']").nth(1).click();
    const hue = Number(
      (await page.locator("button[aria-label^='hue ']").nth(1).getAttribute("aria-label")).replace(
        "hue ",
        "",
      ),
    );

    const cut = page.getByRole("button", { name: /^Cut the deck$/ });
    await cut.waitFor({ timeout: 40000 });
    await cut.click();
    await page.waitForURL(/\/case\/\d+$/, { timeout: 180000 });
    const id = page.url().match(/\/case\/(\d+)$/)[1];
    console.log(`✓ #${id} `);

    //
    const readMeta = async () => {
      for (let i = 0; i < 8; i++) {
        const got = await pub.readContract({
          address: DECK,
          abi: DECK_ABI,
          functionName: "deckMeta",
          args: [Number(id)],
        });
        if (got) return got;
        await page.waitForTimeout(2500);
      }
      return "";
    };
    const meta = await readMeta();
    if (meta !== `${name}:${hue}`) {
      throw new Error(`${meta}, ${name}:${hue}`);
    }
    const info = await pub.readContract({
      address: DECK,
      abi: DECK_ABI,
      functionName: "deckAt",
      args: [Number(id)],
    });
    if (info.creator.toLowerCase() !== account.address.toLowerCase()) {
      throw new Error(`${info.creator}, ${account.address}`);
    }
    console.log(`✓ ${meta}, , `);
    await shot(page, "e2e-created");
  }

  //
  await page.goto(URL.replace(/\/+$/, "") + "/profile", { waitUntil: "domcontentloaded" });
  await page.getByText("every slot you drew", { exact: true }).waitFor({ timeout: 30000 });
  await page.waitForLoadState("networkidle", { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(4000);
  const shelf = await page.locator("main").innerText();
  const read = async (label) =>
    page.evaluate((needle) => {
      for (const el of document.querySelectorAll("main *")) {
        if (!el.children.length && (el.textContent || "").trim().toUpperCase().startsWith(needle)) {
          const box = el.parentElement;
          const m = (box?.textContent || "").match(/(\d+)/);
          if (m) return Number(m[1]);
        }
      }
      return 0;
    }, label);
  const held = await read("TESA");
  const owed = await read("BONUS TICKETS");
  console.log(`✓ TESA ${held}, ${owed}`);
  if ((held > 0 || owed > 0) && !/what you can claim/i.test(shelf)) {
    throw new Error(", ");
  }
  await shot(page, "e2e-shelf");

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
