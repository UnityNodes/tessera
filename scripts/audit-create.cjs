// Level 6: does what the form offers actually cut.
//
// The creation form shows three characters over three sizes and computes the
// table itself. The contract has a limit of its own: a deck has no right to
// promise more in prizes than it will earn in commission, and only the share that
// really reaches the prizes counts towards that limit, that is, without the vault
// share. The share lives IN THE CHAIN and is variable.
//
// They diverged once. The form split the size in half, as it did before the share
// existed, and offered tables of 100 weight where the chain allowed 90. Noticing
// this on the site was impossible: the page rendered, the button worked, the
// wallet asked for a signature, and the transaction failed. EVERY one of them, on
// all nine combinations.
//
// So this is not arithmetic but cutting. A fork of the live chain, the real
// contract, real money from a faucet, and every shape the form offers is really
// cut.
//
// The tables are computed by THE SITE ITSELF: shapes.ts is compiled right here
// and called as it is. Rewriting its logic into this file would mean checking a
// copy, and only the original can diverge from the chain. Independence is not
// lost in the process: the verdict is passed by the contract, not by our
// arithmetic.
//
//   node audit-create.cjs

const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { createPublicClient, createWalletClient, http, getAddress, parseAbi } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { baseSepolia } = require("viem/chains");

const PORT = Number(process.env.FORK_PORT || 8547);
const RPC = `http://127.0.0.1:${PORT}`;
const UPSTREAM = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
const WEB = path.join(__dirname, "..", "web");

// The first anvil account, the same one on every run, the key is public.
const account = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
);

const rows = [];
const fails = [];
function check(name, ok, detail) {
  rows.push(ok);
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? `  - ${detail}` : ""}`);
  if (!ok) fails.push(`${name}: ${detail}`);
}

// -- addresses and the ABI from the site code: a description of the contract,
// not our logic -----------------------------------------------------------
const chainSrc = fs.readFileSync(path.join(WEB, "lib", "chain.ts"), "utf8");
const pick = (name) =>
  getAddress(chainSrc.match(new RegExp(`${name}[^"']*["'](0x[0-9a-fA-F]{40})["']`))[1]);
const DECK = pick("DECK_ADDRESS");
const TOKEN = pick("TICKET_TOKEN");
const abiSrc = fs.readFileSync(path.join(WEB, "lib", "abi.ts"), "utf8");
const ABI = JSON.parse(abiSrc.slice(abiSrc.indexOf("["), abiSrc.lastIndexOf("]") + 1));
const ERC20 = parseAbi([
  "function approve(address,uint256) returns (bool)",
  "function mint(address,uint256)",
]);

/**
 * The live `shapes.ts`, compiled on the spot.
 *
 * The compiler is the same one that builds the site. The module's only import is
 * the `WEIGHT_PER_TICKET` constant from `deck.ts`, and it is substituted from
 * there rather than written as a number: only the chain and the site have the
 * right to diverge, not the site and the check.
 */
function loadShapes() {
  const ts = require(path.join(WEB, "node_modules", "typescript"));
  const deckSrc = fs.readFileSync(path.join(WEB, "lib", "deck.ts"), "utf8");
  const perTicket = Number(deckSrc.match(/WEIGHT_PER_TICKET\s*=\s*(\d+)/)[1]);

  const src = fs
    .readFileSync(path.join(WEB, "lib", "shapes.ts"), "utf8")
    .replace(/^import[^;]+;/m, `const WEIGHT_PER_TICKET = ${perTicket};`);
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;

  const mod = { exports: {} };
  new Function("exports", "module", js)(mod.exports, mod);
  return { ...mod.exports, perTicket };
}

/** The sizes the page really offers. Read as data. */
function offeredSizes() {
  const src = fs.readFileSync(path.join(WEB, "app", "create", "page.tsx"), "utf8");
  return JSON.parse(src.match(/const SIZES = (\[[^\]]+\])/)[1]);
}

function startFork() {
  const anvil = spawn(
    "anvil",
    ["--fork-url", UPSTREAM, "--silent", "--port", String(PORT), "--host", "127.0.0.1"],
    { stdio: "ignore", detached: true },
  );
  return anvil;
}

async function waitForFork(client) {
  for (let i = 0; i < 40; i++) {
    try {
      await client.getBlockNumber();
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return false;
}

(async () => {
  const shapes = loadShapes();
  const SIZES = offeredSizes();
  const KINDS = shapes.SHAPES.map((s) => s.kind);

  const anvil = startFork();
  const pub = createPublicClient({ chain: baseSepolia, transport: http(RPC) });
  const wal = createWalletClient({ account, chain: baseSepolia, transport: http(RPC) });
  const c = { address: DECK, abi: ABI };

  const cut = async (size, table) => {
    const fee = await pub.readContract({ ...c, functionName: "deckFee", args: [size] });
    const { request } = await pub.simulateContract({
      ...c,
      functionName: "createCustomDeck",
      args: [size, table.upTo, table.weight, table.vaultSlots, 2500, "audit:333"],
      value: fee,
      account,
    });
    const hash = await wal.writeContract(request);
    const receipt = await pub.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("reverted in the block");
  };

  try {
    if (!(await waitForFork(pub))) {
      check("the fork of the live chain came up", false, "anvil did not answer within 20 s");
      throw new Error("no fork");
    }

    const share = Number(await pub.readContract({ ...c, functionName: "vaultShareBps" }));
    console.log(`\n-- the creation form on a fork (vault share ${share / 100}%) --`);

    await wal.writeContract({
      address: TOKEN,
      abi: ERC20,
      functionName: "mint",
      args: [account.address, 10_000_000_000n],
    });
    await wal.writeContract({
      address: TOKEN,
      abi: ERC20,
      functionName: "approve",
      args: [DECK, 10_000_000_000n],
    });

    let offered = 0;
    for (const size of SIZES) {
      for (const kind of KINDS) {
        const table = shapes.shapeFor(kind, size, share);
        if (!table) continue;
        offered++;
        try {
          await cut(size, table);
          check(`${kind} over ${size}`, true, `weight ${shapes.totalWeight(table)}`);
        } catch (e) {
          check(`${kind} over ${size}`, false, String(e.shortMessage || e.message).split("\n")[0]);
        }
      }
    }

    check("the form offers something at all", offered > 0, `${offered} combinations`);

    // The other side: the limit has to be alive. Without this, the check above
    // would pass on a contract that checks nothing at all.
    const size = SIZES[SIZES.length - 1];
    const over = shapes.budgetFor(size, share) + 1;
    let refused = false;
    try {
      await cut(size, { upTo: [over], weight: [1], vaultSlots: 0 });
    } catch {
      refused = true;
    }
    check("excess weight is still refused", refused, `${over} over ${size} cases`);
  } catch (e) {
    if (String(e.message) !== "no fork") {
      check("the check reached the end", false, String(e.message).split("\n")[0]);
    }
  } finally {
    // The child specifically, not the group. `process.kill(-pid)` once took the
    // script down along with the fork, the report never printed, and the check
    // exited silently with an incomprehensible code. Anvil bears no children, so
    // the group has nothing to do with it.
    anvil.kill("SIGKILL");
  }

  console.log("\n" + "═".repeat(62));
  console.log(`passed ${rows.filter(Boolean).length}, failed ${fails.length}`);
  for (const f of fails) console.log("  ✗", f);
  process.exit(fails.length ? 1 : 0);
})();
