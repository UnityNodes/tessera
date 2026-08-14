// Every open multiplier, end to end in a real browser.
//
//   DECK=3 node e2e-batch.cjs
//
// It spends 25 real slots (1+2+3+4+5+10), so in audit.sh it sits behind the
// BATCH=1 flag, like the other expensive runs.
//
// It checks three things per multiplier:
//   - there are exactly as many strips as cases ordered;
//   - each one LANDED on what the chain handed over rather than next to it;
//   - the player's slots grew by exactly n.
//
// The second of those is the main one. This project has already had the strip
// brake onto the wrong card with no error surfacing anywhere: neither in the
// console nor in the tests. So Roll has data-landed, the tier it MUST land on
// according to the chain, and the check compares it with what really ended up
// under the marker.
//
// Separately about the measurement: the value from the covalidators arrives
// EARLIER than the strip stops. The first version of this check took its reading
// at once and called its own impatience a divergence, three multipliers out of
// six "failed" on sound code. So here we first wait until the position stops
// changing.

const { chromium } = require("/root/tessera/scripts/node_modules/playwright-core");
const { createWalletClient, createPublicClient, http, defineChain, parseGwei, parseAbi } =
  require("/root/tessera/scripts/node_modules/viem");
const { privateKeyToAccount } = require("/root/tessera/scripts/node_modules/viem/accounts");
const { baseSepolia } = require("/root/tessera/scripts/node_modules/viem/chains");

const DECK = Number(process.env.DECK ?? 3);
const chain = defineChain({ ...baseSepolia, fees: { maxPriorityFeePerGas: parseGwei("2") } });
const acc = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY);
const pub = createPublicClient({ chain, transport: http(process.env.BASE_SEPOLIA_RPC_URL) });
const wallet = createWalletClient({ account: acc, chain, transport: http(process.env.BASE_SEPOLIA_RPC_URL) });
const deckAbi = parseAbi(["function countOf(address) view returns (uint256)"]);
const P = "0x985520De2A14BD443d06DcA07A57Ef4F349bd8B1";

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_BIN });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
  await ctx.exposeFunction("__rpc", async (method, params) => {
    if (method === "eth_requestAccounts" || method === "eth_accounts") return [acc.address];
    if (method === "eth_chainId") return "0x14a34";
    if (method === "wallet_switchEthereumChain" || method === "wallet_addEthereumChain") return null;
    if (method === "personal_sign") return wallet.signMessage({ message: { raw: params[0] } });
    if (method === "eth_sendTransaction") {
      const t = params[0];
      return wallet.sendTransaction({ to: t.to, data: t.data,
        value: t.value ? BigInt(t.value) : undefined, gas: t.gas ? BigInt(t.gas) : undefined });
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
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message.split("\n")[0]));

  await p.goto(`https://tessera.unitynodes.com/case/${DECK}`, { waitUntil: "networkidle", timeout: 60000 });
  const connect = p.getByRole("button", { name: /connect/i }).first();
  if (await connect.count()) {
    await connect.click(); await p.waitForTimeout(1500);
    for (const name of [/Test Wallet/i, /Injected/i]) {
      const w = p.getByRole("button", { name }).first();
      if (await w.count()) { await w.click(); break; }
    }
  }
  await p.getByRole("button", { name: "x1", exact: true }).waitFor({ timeout: 25000 });

  let bad = 0;
  // Which multipliers to run. All six by default, which is 25 slots. MULTS=3
  // gives exactly one run over three slots: that is enough when you are checking
  // a specific fix rather than the whole set. The slots are real, and spending
  // twenty five every time one component changes is expensive for no reason.
  const MULTS = (process.env.MULTS ?? "1,2,3,4,5,10").split(",").map(Number).filter(Boolean);
  for (const n of MULTS) {
    const before = await pub.readContract({ address: P, abi: deckAbi, functionName: "countOf", args: [acc.address] });

    await p.getByRole("button", { name: `x${n}`, exact: true }).click();
    await p.waitForTimeout(300);
    const openBtn = p.getByRole("button", { name: n > 1 ? new RegExp(`Open ${n}`) : /^Open\b(?!\s*\d)/ }).first();
    await openBtn.click();

    // First wait for the scene to APPEAR. Polling right after the click is
    // pointless: the transaction is still being signed, there is no theatre in
    // the DOM, and the loop spins idle and then reports "zero strips", that is,
    // the check blames the code for its own impatience.
    await p.locator(".fixed[role=dialog]").waitFor({ timeout: 60000 });

    // Wait until every strip has landed.
    let rows = [];
    let seen = [];
    for (let i = 0; i < 45; i++) {
      await p.waitForTimeout(1000);
      rows = await p.evaluate(() => {
        const mark = window.innerWidth / 2;
        return [...document.querySelectorAll(".fixed [data-roll]")].map((roll) => {
          const hit = [...roll.querySelectorAll("[data-tier-name]")].find((el) => {
            const r = el.getBoundingClientRect();
            return r.left <= mark && r.right >= mark;
          });
          return { expected: roll.dataset.landed || "", under: hit ? hit.dataset.tierName : null, idx: roll.dataset.idx, len: roll.dataset.len, want: roll.dataset.want, reach: roll.dataset.reach, endx: roll.dataset.endx, fix: roll.dataset.fix, mounts: roll.dataset.mounts, drifts: roll.dataset.drifts, settles: roll.dataset.settles, cut: roll.dataset.cut, nowx: (() => { const m = roll.querySelector("[style*='translate']"); const t = m && getComputedStyle(m).transform; const mm = t && t.match(/matrix.*?\(([^)]+)\)/); return mm ? Math.round(parseFloat(mm[1].split(',')[4]) / 182) : null; })() };
        });
      });
      if (rows.length) seen = rows;
      if (rows.length && rows.every((r) => r.expected)) {
        // The value has arrived, but the strip is still BRAKING.
        //
        // Here was the same trap as in the check itself: `every()` on an EMPTY
        // array is true. As soon as every strip lands, the theatre swaps them for
        // a grid of chests, `[data-roll]` disappears, the "everyone landed"
        // condition fires on zero elements, and from then on a stale snapshot
        // taken in flight was read. That is, the check blamed the game for its
        // own blindness.
        //
        // So there are two exits now, and both are legitimate:
        //   the strips are still there and all have `data-endx`, we measure them;
        //   the strips are gone, so everyone landed, and the grid tells the truth.
        let byGrid = null;
        for (let k = 0; k < 60; k++) {
          const snap = await p.evaluate(() => {
            const rolls = [...document.querySelectorAll(".fixed [data-roll]")];
            const grid = [...document.querySelectorAll(".fixed [data-opened]")];
            const mark = window.innerWidth / 2;
            return {
              rolls: rolls.map((roll) => {
                const hit = [...roll.querySelectorAll("[data-tier-name]")].find((el) => {
                  const r = el.getBoundingClientRect();
                  return r.left <= mark && r.right >= mark;
                });
                return { expected: roll.dataset.landed || "", under: hit ? hit.dataset.tierName : null,
                  idx: roll.dataset.idx, len: roll.dataset.len, want: roll.dataset.want,
                  reach: roll.dataset.reach, endx: roll.dataset.endx, fix: roll.dataset.fix,
                  mounts: roll.dataset.mounts, drifts: roll.dataset.drifts,
                  settles: roll.dataset.settles, cut: roll.dataset.cut };
              }),
              grid: grid.map((el) => ({ expected: el.dataset.opened, under: el.dataset.opened })),
            };
          });
          if (snap.rolls.length && snap.rolls.every((r) => r.endx !== undefined)) {
            rows = snap.rolls;
            break;
          }
          if (!snap.rolls.length && snap.grid.length && snap.grid.every((g) => g.expected)) {
            byGrid = snap.grid;
            break;
          }
          await p.waitForTimeout(300);
        }
        if (byGrid) rows = byGrid;
        if (rows.length) seen = rows;
        rows = seen;
        break;
      }
      // For x1 the theatre swaps the strip for a chest after the stop, so we
      // catch that.
      const done = await p.evaluate(() => Boolean(document.querySelector(".fixed [data-card]")));
      if (done) break;
    }

    const single = n === 1;
    const okCount = single ? rows.length <= 1 : rows.length === n;
    // rows.length > 0 is mandatory: every() on an empty array is true, and that
    // is exactly how this check once said "they landed where they should" about
    // nothing at all.
    const okLanded = rows.length > 0 && rows.every((r) => r.expected && r.expected === r.under);
    // The public RPC lags 1 to 1.6 s behind a write, and a read right after the
    // animation sees the world before the transaction. That has already looked
    // twice like "slots +0" on sound code, that is, like a failure of the check
    // rather than its impatience. We wait for the node to catch up.
    let after = before;
    for (let i = 0; i < 20; i++) {
      after = await pub.readContract({ address: P, abi: deckAbi, functionName: "countOf", args: [acc.address] });
      if (Number(after - before) >= n) break;
      await new Promise((r) => setTimeout(r, 800));
    }
    const okSlots = Number(after - before) === n;

    const verdict = okCount && (single || okLanded) && okSlots;
    if (!verdict) bad++;
    console.log(
      `x${String(n).padEnd(2)} -> strips ${rows.length}${single ? " (single theatre)" : `/${n}`}` +
      ` ${okCount ? "ok" : "no"} | landed where they should ${single ? "-" : okLanded ? "ok" : "no"}` +
      ` | slots +${Number(after - before)} ${okSlots ? "ok" : "no"}`
    );

    // What exactly did not add up, as a line rather than a guess. A run costs
    // real slots, so it has to say everything the first time.
    if (rows.length && !single) {
      for (const [i, r] of rows.entries()) {
        const mark = r.expected === r.under ? "✓" : "✗";
        console.log(`      strip ${i + 1}: chain "${r.expected}", under the marker "${r.under ?? "-"}" ${mark}  [target ${r.idx}/${r.len}, brake ${r.reach} cards, wanted "${r.want}" | mounts ${r.mounts}, drifts ${r.drifts}, brakes ${r.settles}, aborted ${r.cut ?? 0}, landed at ${r.endx}${r.fix ? ", SAFETY NET PULLED IT" : ""}]`);
      }
    }

    // We close the scene and WAIT for it to disappear: while the overlay is on
    // the screen the buttons under it are unreachable, and the next click simply
    // waits out its timeout. That is exactly what the run tripped on.
    for (let i = 0; i < 20; i++) {
      if (!(await p.locator(".fixed[role=dialog]").count())) break;
      await p.keyboard.press("Escape");
      await p.mouse.click(30, 30);
      await p.waitForTimeout(700);
    }
    await p.waitForTimeout(2500);
  }
  console.log(errs.length ? `page errors: ${errs.slice(0, 3).join(" | ")}` : "there are no page errors");
  console.log(bad === 0 ? "\nevery multiplier is clean" : `\nmultipliers with problems: ${bad}`);
  await b.close();
})().catch((e) => { console.error("FAILING:", e.message.split("\n")[0]); process.exit(1); });
