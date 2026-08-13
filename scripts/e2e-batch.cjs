//
//   DECK=3 node e2e-batch.cjs
//
//
//
//

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
  const MULTS = (process.env.MULTS ?? "1,2,3,4,5,10").split(",").map(Number).filter(Boolean);
  for (const n of MULTS) {
    const before = await pub.readContract({ address: P, abi: deckAbi, functionName: "countOf", args: [acc.address] });

    await p.getByRole("button", { name: `x${n}`, exact: true }).click();
    await p.waitForTimeout(300);
    const openBtn = p.getByRole("button", { name: n > 1 ? new RegExp(`Open ${n}`) : /^Open\b(?!\s*\d)/ }).first();
    await openBtn.click();

    await p.locator(".fixed[role=dialog]").waitFor({ timeout: 60000 });

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
          return { expected: roll.dataset.landed || "", under: hit ? hit.dataset.tierName : null, idx: roll.dataset.idx, len: roll.dataset.len, want: roll.dataset.want, reach: roll.dataset.reach, vel: roll.dataset.vel, endx: roll.dataset.endx, mounts: roll.dataset.mounts, drifts: roll.dataset.drifts, settles: roll.dataset.settles, cut: roll.dataset.cut, nowx: (() => { const m = roll.querySelector("[style*='translate']"); const t = m && getComputedStyle(m).transform; const mm = t && t.match(/matrix.*?\(([^)]+)\)/); return mm ? Math.round(parseFloat(mm[1].split(',')[4]) / 182) : null; })() };
        });
      });
      if (rows.length) seen = rows;
      if (rows.length && rows.every((r) => r.expected)) {
        //
        //
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
                  reach: roll.dataset.reach, vel: roll.dataset.vel, endx: roll.dataset.endx,
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
      const done = await p.evaluate(() => Boolean(document.querySelector(".fixed [data-card]")));
      if (done) break;
    }

    const single = n === 1;
    const okCount = single ? rows.length <= 1 : rows.length === n;
    const okLanded = rows.length > 0 && rows.every((r) => r.expected && r.expected === r.under);
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
      `x${String(n).padEnd(2)} → ${rows.length}${single ? " ()" : `/${n}`}` +
      ` ${okCount ? "✓" : "✗"} | ${single ? "" : okLanded ? "✓" : "✗"}` +
      ` | +${Number(after - before)} ${okSlots ? "✓" : "✗"}`
    );

    if (rows.length && !single) {
      for (const [i, r] of rows.entries()) {
        const mark = r.expected === r.under ? "✓" : "✗";
        console.log(`      ${i + 1}: ${r.expected}, ${r.under ?? ""}${mark}  [${r.idx}/${r.len}, ${r.vel}, ${r.reach}, ${r.want}| ${r.mounts}, ${r.drifts}, ${r.settles}, ${r.cut ?? 0}, ${r.endx}]`);
      }
    }

    for (let i = 0; i < 20; i++) {
      if (!(await p.locator(".fixed[role=dialog]").count())) break;
      await p.keyboard.press("Escape");
      await p.mouse.click(30, 30);
      await p.waitForTimeout(700);
    }
    await p.waitForTimeout(2500);
  }
  console.log(errs.length ? `: ${errs.slice(0, 3).join(" | ")}` : "");
  console.log(bad === 0 ? "\n✓" : `\n: ${bad}`);
  await b.close();
})().catch((e) => { console.error(":", e.message.split("\n")[0]); process.exit(1); });
