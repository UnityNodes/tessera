//
//   cd contracts && forge build && cd ../scripts && node sync-abi.cjs
//
//

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "contracts", "out", "TesseraDeck.sol", "TesseraDeck.json");
const OUT = path.join(ROOT, "web", "lib", "abi.ts");

const { abi } = JSON.parse(fs.readFileSync(SRC, "utf8"));

const body = JSON.stringify(abi, null, 2)
  .split("\n")
  .map((line) => `  ${line}`)
  .join("\n");

const text = `// contracts/out scripts/sync-abi.cjs .
export const TESSERA_DECK_ABI =
${body} as const;
`;

const before = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
fs.writeFileSync(OUT, text);
console.log(
  before === text
    ? "ABI "
    : `ABI : ${abi.length} , ${text.length} `,
);
