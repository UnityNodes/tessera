// Copy the ABI from contracts/out into web/lib/abi.ts.
//
//   cd contracts && forge build && cd ../scripts && node sync-abi.cjs
//
// The file is signed "generated, do not edit by hand", but there was no generator
// in the repository, and the ABI silently fell behind the contract: it kept a
// constructor with an argument for a long time that no longer exists after the
// move to a proxy. A divergence does not fail the build, the call simply goes to
// the wrong place.
//
// It is not only the pages that read this file: audit-chain and browser-e2e take
// the ABI from exactly here, deliberately not importing the site code.

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "contracts", "out", "TesseraDeck.sol", "TesseraDeck.json");
const OUT = path.join(ROOT, "web", "lib", "abi.ts");

const { abi } = JSON.parse(fs.readFileSync(SRC, "utf8"));

// The same indentation as before: two spaces under export, the rest from JSON.
const body = JSON.stringify(abi, null, 2)
  .split("\n")
  .map((line) => `  ${line}`)
  .join("\n");

const text = `// Generated from contracts/out by scripts/sync-abi.cjs, do not edit by hand.
export const TESSERA_DECK_ABI =
${body} as const;
`;

const before = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
fs.writeFileSync(OUT, text);
console.log(
  before === text
    ? "the ABI did not change"
    : `ABI updated: ${abi.length} entries, ${text.length} bytes`,
);
