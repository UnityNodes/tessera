//
//
//
//
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

const account = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
);

const rows = [];
const fails = [];
function check(name, ok, detail) {
  rows.push(ok);
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? `, ${detail}` : ""}`);
  if (!ok) fails.push(`${name}: ${detail}`);
}

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
 *
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
    if (receipt.status !== "success") throw new Error("");
  };

  try {
    if (!(await waitForFork(pub))) {
      check("", false, "anvil 20 ");
      throw new Error("no fork");
    }

    const share = Number(await pub.readContract({ ...c, functionName: "vaultShareBps" }));
    console.log(`\n── (${share / 100}%) ──`);

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
          check(`${kind} ${size}`, true, `${shapes.totalWeight(table)}`);
        } catch (e) {
          check(`${kind} ${size}`, false, String(e.shortMessage || e.message).split("\n")[0]);
        }
      }
    }

    check("", offered > 0, `${offered} `);

    const size = SIZES[SIZES.length - 1];
    const over = shapes.budgetFor(size, share) + 1;
    let refused = false;
    try {
      await cut(size, { upTo: [over], weight: [1], vaultSlots: 0 });
    } catch {
      refused = true;
    }
    check("", refused, `${over} ${size} `);
  } catch (e) {
    if (String(e.message) !== "no fork") {
      check("", false, String(e.message).split("\n")[0]);
    }
  } finally {
    anvil.kill("SIGKILL");
  }

  console.log("\n" + "═".repeat(62));
  console.log(`${rows.filter(Boolean).length}, ${fails.length}`);
  for (const f of fails) console.log("  ✗", f);
  process.exit(fails.length ? 1 : 0);
})();
