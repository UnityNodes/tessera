// An end to end check of the front end in a real browser.
//
// An EIP-1193 provider is injected into the page that sends every read to the RPC
// and answers signature requests with our development key. That makes it possible
// to run the full path, connect, approve, open, wait for the covalidators,
// exchange shards, without clicking through MetaMask by hand.
//
// The key is taken from the DEPLOYER_PRIVATE_KEY environment variable or, as
// before, from the third argument. The variable is better: argv is visible in ps
// to anyone on the machine.
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
  console.error("no key: DEPLOYER_PRIVATE_KEY in the environment or as the third argument");
  process.exit(2);
}
const account = privateKeyToAccount(PK.startsWith("0x") ? PK : `0x${PK}`);
const chain = defineChain({ ...baseSepolia, fees: { maxPriorityFeePerGas: parseGwei("2") } });
const wallet = createWalletClient({ chain, transport: http(RPC), account });
const pub = createPublicClient({ chain, transport: http(RPC) });

// The address and the ABI are taken from the site code, the same way audit-chain
// does it: by the NAME of the variable rather than by the first address in the
// file. Above DECK_ADDRESS lies a comment listing the old deploys, and a "first
// 0x..." regex once already led me into a dead contract.
const WEB = require("path").join(__dirname, "..", "web");
const chainSrc = require("fs").readFileSync(require("path").join(WEB, "lib", "chain.ts"), "utf8");
const DECK = chainSrc.match(/DECK_ADDRESS[^"']*["'](0x[0-9a-fA-F]{40})["']/)[1];
const abiSrc = require("fs").readFileSync(require("path").join(WEB, "lib", "abi.ts"), "utf8");
const DECK_ABI = JSON.parse(abiSrc.slice(abiSrc.indexOf("["), abiSrc.lastIndexOf("]") + 1));

/** What the provider answers itself; everything else goes straight to the RPC. */
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
  // EIP-6963, this is how modern connectors look for a wallet
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
 * Connect the wallet if it is not connected already.
 *
 * wagmi keeps the connection in localStorage, so a second page in the same
 * context opens already connected and has no Connect button on it. The step has
 * to be idempotent, otherwise the test fails exactly where it checks a returning
 * player.
 */
async function ensureConnected(page) {
  // A connected wallet in the header is a <summary> with the address; the
  // connector list lies in the same <details>, and while it is closed the
  // connector buttons do not exist for accessibility. So we open it first.
  const connected = page.locator("summary", { hasText: /^0x[a-fA-F0-9]{4}/ });
  const opener = page.locator("summary", { hasText: /Connect wallet/ });

  // First we give autoconnect a chance. A race is not allowed here: wagmi draws
  // "Connect wallet" and a moment later reconnects by itself and replaces it with
  // the address, and the click lands on an element that no longer exists.
  const auto = await connected.waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
  if (auto) return "already";

  try {
    await opener.click({ timeout: 20000 });
    await page.getByRole("button", { name: /Test Wallet|Injected|MetaMask/ }).first().click({ timeout: 20000 });
    await connected.waitFor({ timeout: 25000 });
  } catch (e) {
    console.error(`  buttons: ${JSON.stringify(await page.getByRole("button").allTextContents())}`);
    console.error(`  provider: ${await page.evaluate(() => typeof window.ethereum)}`);
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

  console.log(`wallet ${account.address}`);
  await page.goto(URL, { waitUntil: "domcontentloaded" });

  // -- connecting ---------------------------------------------------------
  console.log(`wallet ${await ensureConnected(page)}`);

  // -- the header menus close ----------------------------------------------
  //
  // A native <details> closes NEITHER on a click outside NOR on Escape, that is
  // what <dialog> and popover can do. A comment saying it does close stood here
  // for a long time, and an open wallet menu hung over the page until you poked
  // it a second time. The check holds the <Disclosure> wrapper that finally does
  // it.
  {
    const chip = page.locator("summary", { hasText: /^0x[a-fA-F0-9]{4}/ }).first();
    if (await chip.count()) {
      await chip.click();
      await page.waitForTimeout(400);
      // The wallet panel is the one screen nobody sees without a connected
      // wallet, the snapshot check included. We capture it while it is open.
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
          `the header menu does not close: a click outside ${byClick ? "did NOT close it" : "ok"}, ` +
            `Escape ${byEsc ? "did NOT close it" : "ok"}`,
        );
      }
      console.log("the header menus close on a click outside and on Escape");
    }
  }

  // -- test dollars if empty ------------------------------------------------
  //
  // The balance moved from a header chip into the wallet panel: what is left in
  // the header is only what concerns the WORLD (the sum of the vaults), and
  // everything "yours" lives under the address. So we open the panel first and
  // only then read.
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
  console.log(`  balance $${dollars.toFixed(2)}`);
  if (dollars < 1) {
    // The faucet is a labelled action in the wallet panel rather than a wordless
    // plus sign.
    await page.locator("button", { hasText: /Get \$20 in test dollars/ }).first().click();
    await page.waitForFunction(
      () => ![...document.querySelectorAll("button")].some((b) => /Minting/.test(b.textContent || "")),
      { timeout: 90000 },
    );
    console.log("minted test dollars");
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // -- opening ---------------------------------------------------------------
  // The action lives on the case page: on the home page "Open - $1" is a link in
  // the hero rather than a button.
  // DECK=3 aims at a particular season. Without it the first deck on the page is
  // taken, and that is #0, the oldest and most expensive: the runs ate it, while
  // the demo has to go on a fresh one.
  const firstCase = process.env.DECK
    ? `/case/${process.env.DECK}`
    : await page.locator("a[href^='/case/']").first().getAttribute("href");
  await page.goto(URL.replace(/\/+$/, "") + firstCase, { waitUntil: "domcontentloaded" });
  console.log(`  deck ${firstCase}`);

  // Keep opening until something not empty drops or the attempts run out. Nine
  // cases out of ten are empty, so one open says nothing about the prize frame,
  // and it is the prize frame that has to be seen.
  const ROUNDS = Number(process.env.OPENS || 1);
  let gotPrize = false;

  for (let round = 1; round <= ROUNDS && !gotPrize; round++) {
    const openBtn = page.getByRole("button", { name: /^Open\b|Open another|Approve once/ });
    await openBtn.waitFor({ timeout: 20000 });
    // How many cards braking orders, the one number that shows the "the strip
    // does not brake, it shoots" fault. The observer is attached BEFORE the open:
    // the strip lives only while the reveal is running, and after the result
    // there is nothing left to read from it.
    //
    // It was: 2264 cards over 950 ms, that is, 2384 cards per second. It became
    // 19. On screen both cases simply look like "fast", which is why the number
    // has to be taken from the DOM rather than by eye.
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

    // The public sepolia.base.org throttles under load, and then an open fails
    // with "RPC Request failed". That is not a fault of the game: the slot is not
    // drawn and no money is charged, so a retry is the right response rather than
    // a cover up.
    const failed = page.getByText(/RPC Request failed|Try again/);
    try {
      await Promise.race([
        page.getByText(/covalidators/).first().waitFor({ timeout: 90000 }),
        // The decryption might not have been visible at all.
        //
        // Slot values are now revealed by the server and handed over together
        // with the history, so when a value is already cached the "covalidators"
        // phase lasts less than one polling round. Measured: the theatre managed
        // to reach the end while the check was still waiting for a caption that
        // would never come, and it failed on an open that had gone perfectly.
        page.getByText(/click anywhere to continue/).first().waitFor({ timeout: 90000 }),
        failed.first().waitFor({ timeout: 90000 }).then(() => {
          throw new Error("the RPC refused");
        }),
      ]);
    } catch (e) {
      if (String(e.message).includes("the RPC refused")) {
        console.log("  the RPC refused, waiting 20 s and retrying");
        await page.waitForTimeout(20000);
        round--;
        continue;
      }
      await shot(page, `e2e-stuck-${round}`);
      const seen = await page.locator("main").innerText();
      console.error(`  stuck. on screen:\n${seen.slice(0, 500)}`);
      throw e;
    }
    console.log(`  the transaction went through, waiting for covalidators : ${Date.now() - t0} ms`);

    // The strip during the wait is a check of its own rather than a snapshot to
    // be eyeballed.
    //
    // It has already disappeared once: the position ran past the tail of the
    // strip, and the player looked at an empty screen with the marker alone and
    // then suddenly saw a chest. The cards stayed in the DOM all the while, so
    // what has to be counted is not them but how many of them really land in the
    // window.
    for (const at of [800, 2000, 4000, 6000, 8000]) {
      await page.waitForTimeout(at === 800 ? 800 : 2000);
      // The signature of the fault is exactly this: there are cards in the DOM
      // and none on the screen. Asking "is the prize up yet" separately will not
      // do, between the strip being removed and the caption appearing under the
      // chest there is a frame where neither is visible.
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
        console.log(`   +${at} ms: cards in the window ${seen} of ${inDom}`);
        await shot(page, `watch-${at}`);
      }
      if (seen < 3) {
        await shot(page, "e2e-strip-gone");
        throw new Error(
          `the strip disappeared from the screen at ${at} ms: ${seen} in the window out of ${inDom} cards in the DOM`,
        );
      }
    }

    // The full screen scene IS the frame this was all done for, so we capture
    // IT, and only then close.
    await page.getByText(/click anywhere to continue/).waitFor({ timeout: 150000 });
    const ms = Date.now() - t0;

    const scene = (
      await page
        .getByRole("dialog", { name: /Opening a case/ })
        // "+1 real ticket" is the heading of an ORDINARY open with no bonus.
        // There is no empty case there: the dollar bought a real Megapot ticket,
        // and that is what stands full screen. "empty" is left to a risk only,
        // where there really is no ticket.
        .getByText(/^(Grout|TESA|Denarius|Aureus|Porphyry|The Vault|empty|\+1 real ticket)$/)
        .first()
        .textContent()
    ).trim();
    gotPrize = !["empty", "Grout", "+1 real ticket"].includes(scene);
    console.log(`⏱ ${ms} ms  →  ${scene}${gotPrize ? "  ★" : ""}`);
    // The prize comes out of the chest with a delay: the caption is already on
    // screen while the item itself is still travelling. A snapshot taken at once
    // caught an empty chest without it.
    await page.waitForTimeout(2200);
    await shot(page, gotPrize ? "e2e-prize" : `e2e-empty-${round}`);

    // We read the prize on the page itself BEFORE closing: after the reset the
    // panel goes back to its ordinary text and there will be nothing left to
    // read.
    const onPage = await page.getByText(/You own|found the vault|No ticket/).first().textContent();
    console.log(`  on the page: ${onPage.trim()}`);

    const reach = await page.evaluate(() => Math.max(0, ...(window.__reach || [])));
    // The ceiling on the gesture: braking lasts less than a second, and honest
    // inertia does not carry more than two dozen cards past the marker in that
    // time.
    if (reach > 40) {
      throw new Error(`braking ordered ${reach} cards in under a second, which is a jump rather than inertia`);
    }
    console.log(`  braking: ${reach} cards`);

    await page.getByRole("dialog", { name: /Opening a case/ }).click({ position: { x: 8, y: 8 } });
    // After the reset the button says "Open - $1" again rather than "Open
    // another", which is exactly why waiting for "Open another" here would be a
    // mistake.
    await page.getByRole("button", { name: /^Open\b/ }).waitFor({ timeout: 30000 });
  }
  if (!gotPrize) console.log(`  no prize in ${ROUNDS} opens, which is normal`);

  // -- closed the tab mid wait ------------------------------------------------
  // The riskiest state: the transaction has gone through, the slot is paid for,
  // and the player is gone. We check that the prize is found on their return.
  if (process.env.TEST_RESUME) {
    const second = await ctx.newPage();
    await second.goto(URL, { waitUntil: "domcontentloaded" });
    await ensureConnected(second);
    const btn = second.getByRole("button", { name: /^Open\b|Approve once/ });
    await btn.waitFor({ timeout: 30000 });
    await btn.click();
    await second.getByText(/covalidators decrypt/).waitFor({ timeout: 90000 });
    console.log("> left mid wait");
    await second.close();

    const back = await ctx.newPage();
    await back.goto(URL, { waitUntil: "domcontentloaded" });
    await ensureConnected(back);
    await back.getByText(/Welcome back/).waitFor({ timeout: 30000 });
    console.log("came back, and the game remembers the unfinished open");
    await back.getByText(/You own|found the vault|No ticket/).waitFor({ timeout: 120000 });
    const got = await back.getByText(/You own|found the vault|No ticket/).first().textContent();
    console.log(`the prize is shown: ${got.trim()}`);
    await back.screenshot({ path: `${SHOTS}/e2e-resumed.png` });
    await back.close();
  }

  // -- the exchange, if enough has been collected ------------------------------
  //
  // The exchange panel has three states, and they must not be confused:
  //   "Take N tickets"  they can be collected;
  //   "Not funded yet"  there are enough shards, but the treasury has not yet
  //                     earned a ticket. Then the panel IS OBLIGED to say how
  //                     much is missing and how many opens will cover it;
  //   no panel at all   five have not been collected yet.
  //
  // There used to be one branch here for the first state, and for the rest a
  // search for the text "No bonus tickets", which appears NOWHERE in the code. So
  // a run either passed silently on an accidental match of the word "ticket" or
  // failed with a thirty second timeout on a working site.
  const redeem = page.getByRole("button", { name: /^Take \d+ ticket/ });
  const unfunded = page.getByRole("button", { name: /^Not funded yet$/ });
  if (await redeem.count()) {
    console.log("> exchanging shards");
    await redeem.click();
    await page.getByText(/bought you \d+ more real ticket/).waitFor({ timeout: 90000 });
    console.log("the exchange went through");
    await shot(page, "e2e-redeemed");
  } else if (await unfunded.count()) {
    // The button is disabled, and that is the only case where the player has
    // nothing to press. So an explanation with a number has to stand next to it,
    // otherwise a dead button explains nothing.
    const why = await page.getByText(/short\./).first().textContent();
    if (!/\$\d+\.\d\d/.test(why)) throw new Error(`'Not funded yet' without an amount: ${why}`);
    console.log(`the exchange is waiting for the treasury, and it says why: ${why.trim().slice(0, 90)}`);
  } else {
    const chip = page.getByText(/\d+ TESA/).first();
    if (await chip.count()) console.log(`  the exchange is not available yet: ${(await chip.textContent()).trim()}`);
    else console.log("  no shards yet");
  }

  // -- a battle opens and IMMEDIATELY OPENS --------------------------------
  //
  // The arena's most expensive mistake was not in the contract: a person pressed
  // "Start battle", paid a dollar, drew a sealed card, and stayed on the list of
  // rooms where one more row appeared somewhere near the top. They had to find
  // their own battle themselves.
  //
  // What is checked is exactly what breaks silently: the ADDRESS after the click.
  // The battle number in it has to match the number the contract handed over in
  // the BattleOpened event, otherwise we lead a person into somebody else's room,
  // and that is worse than leading them nowhere.
  //
  // It costs a slot and a dollar, so on request only: BATTLE_UI=1.
  if (process.env.BATTLE_UI) {
    console.log("> opening a battle");
    await page.goto(URL.replace(/\/+$/, "") + "/battles", { waitUntil: "domcontentloaded" });
    // The button appears only once BOTH the decks and the balance have been
    // read. On a public RPC with 429s that is noticeably longer than any fixed
    // pause, so we wait for the button itself rather than for a stopwatch.
    const start = page.getByRole("button", { name: /^Start battle$/ });
    await start.waitFor({ timeout: 40000 }).catch(() => {});

    if (!(await start.count())) {
      // We do NOT invent the reason: there are several, your own battle is
      // already on the table, there is no money, the decks are empty, and each of
      // them looks the same ("there is no button"). We show what the panel says
      // itself.
      //
      // The contract allows exactly one unfinished battle per wallet at the
      // table, so after a successful run the next one is honestly skipped until
      // that battle is settled. That is a skip rather than a green tick: the line
      // gives the reason in the page's own words, and it is never silent.
      //
      // We look inside main and by the panel's specific wordings. A broader
      // locator caught "Get $20 in test dollars" from the wallet panel, that is,
      // reported a reason that did not exist.
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
      console.log(`  skipping, there is no 'Start battle': ${why ?? "the page names no reason"}`);
    } else {
      // Without new URL(): in this file URL is the site address from argv, and
      // the global constructor is shadowed by it.
      // The public Base Sepolia returns 429s in bursts, and the transaction fails
      // with "unknown RPC error". That is not our fault, so we retry the same way
      // as on the case open above, otherwise the check measures not the site but
      // the weather on a free node.
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
            console.log(`  ${banner.trim()}, waiting 20 s and retrying`);
            await page.waitForTimeout(20000);
            continue;
          }
          // We do not leave a "timeout" without a reason: on the page lies
          // exactly the message the player received.
          await shot(page, "e2e-battle-stuck");
          throw new Error(
            `pressed 'Start battle' but stayed on ${page.url()}. ` +
              `The page says: ${banner ?? "nothing"}`,
          );
        }
      }
      console.log(`straight into battle #${id} after payment`);

      // And it really is YOUR battle rather than somebody else's: the page names
      // the same number as the address and shows a sealed card.
      //
      // The caption under the chest rather than the sentence in the header: the
      // words "sealed until someone pays" stand on the page twice, in the state
      // description and on the card itself, and a loose locator caught both.
      await page.getByText(new RegExp(`Battle #${id}\\b`)).first().waitFor({ timeout: 30000 });
      await page
        .getByText("sealed until someone pays", { exact: true })
        .waitFor({ timeout: 30000 });
      console.log("the card is on the table and sealed");
      await shot(page, "e2e-battle-opened");
    }
  }

  // -- your own deck ---------------------------------------------------------
  //
  // The creation form is the only place on the site that writes a NEW deck into
  // the chain. Being wrong here is expensive and permanent: the drop table, the
  // name and the creator share are immutable after the cut, and the deck stays in
  // the catalogue forever. So what is checked is not "the button was pressed" but
  // that a deck appeared in the chain with the same name and colour that were
  // entered.
  //
  // It costs gas, a fee to the game and a slot in the catalogue, so on request
  // only: CREATE_UI=1.
  if (process.env.CREATE_UI) {
    console.log("> cutting your own deck");
    await page.goto(URL.replace(/\/+$/, "") + "/create", { waitUntil: "domcontentloaded" });

    const name = `e2e${Date.now().toString(36).slice(-5)}`;
    await page.locator("#deck-name").fill(name);
    // The second colour in the row: the first is the default, so picking a
    // different one proves the click really changes something.
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
    console.log(`deck #${id} was cut through the form`);

    // What was entered and what is now in the chain are one and the same.
    //
    // We read with a retry, and that is not about network reliability. The public
    // Base Sepolia node hands over state a few seconds behind block inclusion:
    // today both deckCount after a cut and deckMeta here were caught by it. The
    // transaction is already in a block, the page has already moved to the new
    // case, and the read still shows empty. One request instead of a retry turns
    // this check into a generator of random failures.
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
      throw new Error(`the chain says "${meta}" while "${name}:${hue}" was entered`);
    }
    const info = await pub.readContract({
      address: DECK,
      abi: DECK_ABI,
      functionName: "deckAt",
      args: [Number(id)],
    });
    if (info.creator.toLowerCase() !== account.address.toLowerCase()) {
      throw new Error(`${info.creator} is recorded as the creator, but ${account.address} did the cutting`);
    }
    console.log(`the chain says "${meta}", and the creator is whoever cut it`);
    await shot(page, "e2e-created");
  }

  // -- the connected player's shelf --------------------------------------------
  //
  // A page that exists ONLY for a connected player: without a wallet it shows one
  // paragraph, so no other check sees its contents. And it now holds the same
  // exchange panel as the case page, that is, it runs transactions, and a silent
  // error here would cost the player their only path to what they collected.
  await page.goto(URL.replace(/\/+$/, "") + "/profile", { waitUntil: "domcontentloaded" });
  // An exact match rather than a substring: the wallet panel holds a label with
  // the same words, and a loose locator caught both.
  await page.getByText("every slot you drew", { exact: true }).waitFor({ timeout: 30000 });
  // The inventory is read from the chain and arrives later than the markup.
  // Without a wait the check took zeros off a page that had not loaded yet and
  // reported "TESA 0" when the header already said three.
  // The shelf is a SEPARATE navigation, that is, a cold cache: the inventory is
  // read from the chain anew, and three seconds are not enough for it. Measured:
  // at the third second the page showed "TESA 0", at the ninth the correct three.
  // We wait for the network to go quiet, and a little more on top.
  await page.waitForLoadState("networkidle", { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(4000);
  const shelf = await page.locator("main").innerText();
  // The numbers are taken from the MARKUP rather than by a regex over solid
  // text: the caption and the value are neighbouring elements, and taking them by
  // their common parent is more reliable than guessing which of the four counters
  // a regex will meet first. It used to report "TESA 0" when the screen said
  // three.
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
  console.log(`the shelf opened: TESA ${held}, bonus tickets ${owed}`);
  if ((held > 0 || owed > 0) && !/what you can claim/i.test(shelf)) {
    throw new Error("there is something to take on the shelf but no exchange panel, a dead end");
  }
  await shot(page, "e2e-shelf");

  if (failed.length) {
    const byUrl = {};
    for (const f of failed) byUrl[f] = (byUrl[f] || 0) + 1;
    console.log("failed requests:");
    for (const [k, n] of Object.entries(byUrl)) console.log(`  ×${n}  ${k}`);
  }
  console.log(errors.length ? `! console errors: ${errors.length}` : "the console is clean");
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(async (e) => {
  console.error("FATAL:", String(e.message).split("\n")[0]);
  process.exit(1);
});
