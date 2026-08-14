// A live battle on Base Sepolia, with two wallets.
//
// The creator opens a battle and their card is locked. We check that it really
// stays silent: the covalidators hand it over to nobody, the owner included.
// Then the opponent comes in, both cards become public, and the battle is closed
// with an attestation.
//
//   DECK=3 node e2e-battle.cjs <deck> <privateKeyA> <privateKeyB>
//
// DECK is the deck number. The script went stale silently: it called openBattle()
// with no arguments and weightNow(value), while the contract has
// openBattle(deckId) and weightOf(deckId, value) ever since there was more than
// one deck.

const { Lightning } = require("@inco/lightning-js/lite");
const {
  createWalletClient, createPublicClient, http, defineChain, parseGwei, parseAbi, toHex,
  keccak256,
} = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { baseSepolia } = require("viem/chains");

const fs = require("fs");
const path = require("path");

// We take the address the same way audit-chain does: as text out of
// web/lib/chain.ts rather than by import. A check assembled from the code it
// checks would agree with every mistake in it; the same reason applies here, and
// fewer arguments into the bargain.
const chainSrc = fs.readFileSync(
  path.join(__dirname, "..", "web", "lib", "chain.ts"),
  "utf8",
);
const ADDR =
  process.argv[2] ||
  (chainSrc.match(/DECK_ADDRESS[^"']*["'](0x[0-9a-fA-F]{40})["']/) || [])[1];
const PK_A = process.argv[3] || process.env.DEPLOYER_PRIVATE_KEY;
const RPC = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
const TOKEN = "0xA4253E7C13525287C56550b8708100f93E60509f";
const MEGAPOT = "0x6f03c7BCaDAdBf5E6F5900DA3d56AdD8FbDac5De";

const abi = parseAbi([
  "function openBattle(uint32 deckId) returns (uint256 id, uint64 slotIndex)",
  "function joinBattle(uint256 id) returns (uint64 slotIndex)",
  "function resolveBattle(uint256 id, uint256 valueA, bytes[] signaturesA, uint256 valueB, bytes[] signaturesB) returns (address winner, uint256 banked)",
  "function abandonBattle(uint256 id)",
  // The field order has to match the contract to the letter: deckId was missing
  // here, and everything after it decoded shifted. The script survived that only
  // because it read the first few fields.
  "function battleAt(uint256 id) view returns ((address a, uint64 slotA, bool resolved, address b, uint64 slotB, uint32 deckId, uint16 indexA, uint64 openedAt, uint128 paidA))",
  "function deckAt(uint32) view returns ((bytes32 cards, uint16 size, uint16 drawn, uint16 vaultUpTo, uint128 vault, uint64 unsweptOpens, address creator, uint16 creatorBps))",
  "function openBattleIds(uint256 max) view returns (uint256[])",
  "function sealedSlotsOf(address) view returns (uint64[])",
  "function handleOf(address, uint256) view returns (bytes32)",
  "function weightOf(uint32, uint256) view returns (uint16)",
  "function bankedWeight(address) view returns (uint256)",
  "function battleEscrow() view returns (uint256)",
])
const megapot = parseAbi([
  "function usersInfo(address) view returns (uint256 ticketsPurchasedTotalBps, uint256 winningsClaimable, bool active)",
  "function ticketPrice() view returns (uint256)",
]);
const erc20 = parseAbi([
  "function mint(address,uint256)",
  "function approve(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
]);

const toBytes = (sig) => toHex(Uint8Array.from(Object.values(sig)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const chain = defineChain({ ...baseSepolia, fees: { maxPriorityFeePerGas: parseGwei("2") } });
  const pub = createPublicClient({ chain, transport: http(RPC) });
  const zap = await Lightning.baseSepoliaTestnet();

  const player = (pk) => {
    const account = privateKeyToAccount(pk);
    const wallet = createWalletClient({ chain, transport: http(RPC), account });
    return {
      account,
      address: account.address,
      async send(address, contractAbi, functionName, args = []) {
        const { request, result } = await pub.simulateContract({
          address, abi: contractAbi, functionName, args, account, gasPrice: parseGwei("2"),
        });
        const hash = await wallet.writeContract(request);
        const rcpt = await pub.waitForTransactionReceipt({ hash });
        if (rcpt.status !== "success") throw new Error(`${functionName} reverted`);
        return result;
      },
    };
  };

  const read = (functionName, args = []) =>
    pub.readContract({ address: ADDR, abi, functionName, args });

  // The public RPC lags 1 to 1.6 s behind a write, so a read right after the
  // transaction sees the world before it. We wait for the state to catch up.
  const until = async (what, ok) => {
    for (let i = 0; i < 25; i++) {
      const v = await read(...what).catch(() => null);
      if (v && ok(v)) return v;
      await sleep(400);
    }
    throw new Error(`the node never caught up on ${what[0]}`);
  };

  const a = player(PK_A);

  // The opponent is derived from the deployer key rather than generated every
  // time.
  //
  // A battle needs two different addresses, and there is nowhere to get a second
  // key: it is not in .env, and a fresh wallet per run would leave a penny of gas
  // at an address nobody will ever come back to. A derived one is the same every
  // time, so it is topped up once and lives.
  //
  // The key is a test key and a disposable one specifically: nothing is kept on
  // it, and it can only enter a battle for a dollar it pays itself.
  const PK_B =
    process.argv[4] ||
    process.env.OPPONENT_PRIVATE_KEY ||
    keccak256(toHex(`tessera-opponent:${PK_A}`));
  const b = player(PK_B);

  // Gas for the opponent, only when it has run out.
  const GAS_FLOOR = 3_000_000_000_000_000n; // 0.003 ETH
  if ((await pub.getBalance({ address: b.address })) < GAS_FLOOR) {
    const wallet = createWalletClient({ chain, transport: http(RPC), account: a.account });
    const hash = await wallet.sendTransaction({
      to: b.address,
      value: 10_000_000_000_000_000n, // 0.01 ETH
    });
    await pub.waitForTransactionReceipt({ hash });

    // There is a receipt and the node still shows zero: the public RPC balances
    // requests and lags behind a write. Gas estimation on an empty balance fails,
    // and the opponent's very next transaction breaks, which is exactly what
    // happened.
    for (let i = 0; i < 30; i++) {
      if ((await pub.getBalance({ address: b.address })) >= GAS_FLOOR) break;
      await sleep(400);
    }
    console.log(`topped up the opponent ${b.address}`);
  }

  // -- the money --------------------------------------------------------------
  for (const p of [a, b]) {
    const balance = await pub.readContract({
      address: TOKEN, abi: erc20, functionName: "balanceOf", args: [p.address],
    });
    if (balance < 2_000_000n) await p.send(TOKEN, erc20, "mint", [p.address, 20_000_000n]);
    const allowance = await pub.readContract({
      address: TOKEN, abi: erc20, functionName: "allowance", args: [p.address, ADDR],
    });
    if (allowance < 2_000_000n) {
      await p.send(TOKEN, erc20, "approve", [ADDR, (1n << 256n) - 1n]);
    }
    console.log(`funded ${p.address}`);
  }

  // How many tickets Megapot recorded to the player. Those are now the stake of
  // the battle, so we take the reading BEFORE anyone has paid.
  const tickets = async (who) => {
    const [bps] = await pub.readContract({
      address: MEGAPOT, abi: megapot, functionName: "usersInfo", args: [who],
    });
    return bps;
  };

  const ticketsA = await tickets(a.address);
  const ticketsB = await tickets(b.address);
  const escrowBefore = await read("battleEscrow");

  // -- the creator opens a battle -----------------------------------------------
  const DECK = Number(process.env.DECK ?? 0);
  const [id] = await a.send(ADDR, abi, "openBattle", [DECK]);
  console.log(`\nbattle #${id} opened by ${a.address} on deck #${DECK}`);

  // There is no ticket yet, and that is the whole stake. If it were bought on
  // entry, losing a battle would be impossible: both would already have received
  // everything the game promised for their dollar, and only the bonus would be
  // split.
  if ((await tickets(a.address)) !== ticketsA) {
    throw new Error("the ticket was bought on entry, there is nothing to stake");
  }

  await until(["battleAt", [id]], (bt) => bt.a.toLowerCase() === a.address.toLowerCase());

  const sealed = await read("sealedSlotsOf", [a.address]);
  console.log(`sealed slots of the creator: [${sealed.join(", ")}]`);
  if (sealed.length === 0) throw new Error("the creator's card should be sealed");

  const bt0 = await read("battleAt", [id]);
  const handleA = await read("handleOf", [a.address, bt0.slotA]);

  // The most important check of the whole battle: the creator's card is
  // unavailable to anyone until the opponent has paid. We ask the covalidators
  // for it deliberately.
  const t0 = Date.now();
  let leaked = false;
  try {
    await zap.attestedReveal([handleA]);
    leaked = true;
  } catch {
    console.log(`sealed card refused by the covalidators after ${Date.now() - t0} ms, correct`);
  }
  if (leaked) throw new Error("SEALED CARD LEAKED, the creator could pick easy fights");

  const open = await read("openBattleIds", [10n]);
  console.log(`open battles visible to everyone: [${open.join(", ")}]`);

  // -- the opponent comes in -----------------------------------------------------
  const joined = Date.now();
  await b.send(ADDR, abi, "joinBattle", [id]);
  console.log(`\n${b.address} joined in ${Date.now() - joined} ms`);

  const bt = await until(["battleAt", [id]], (x) => x.b.toLowerCase() === b.address.toLowerCase());
  const handleB = await read("handleOf", [bt.b, bt.slotB]);

  // -- both cards ------------------------------------------------------------------
  const started = Date.now();
  let cards;
  for (let i = 0; i < 40; i++) {
    try {
      cards = await zap.attestedReveal([handleA, handleB]);
      break;
    } catch {
      await sleep(400);
    }
  }
  if (!cards) throw new Error("the covalidators never turned the cards over");
  console.log(`both cards decrypted in ${Date.now() - started} ms`);

  const byHandle = new Map(cards.map((c) => [c.handle.toLowerCase(), c]));
  const cardA = byHandle.get(handleA.toLowerCase());
  const cardB = byHandle.get(handleB.toLowerCase());
  const valueA = Number(cardA.plaintext.value);
  const valueB = Number(cardB.plaintext.value);
  const weightA = await read("weightOf", [DECK, BigInt(valueA)]);
  const weightB = await read("weightOf", [DECK, BigInt(valueB)]);
  console.log(`creator  weight ${weightA}`);
  console.log(`opponent weight ${weightB}`);

  // -- the finish -------------------------------------------------------------------
  const [winner, banked] = await a.send(ADDR, abi, "resolveBattle", [
    id,
    BigInt(valueA), cardA.covalidatorSignatures.map(toBytes),
    BigInt(valueB), cardB.covalidatorSignatures.map(toBytes),
  ]);

  // There always has to be a winner. The most frequent battle is the one where
  // both cards are empty, and that is exactly the one that used to end in a 0:0
  // draw in which nothing happened. So we check not "somebody won" but the same
  // rule as in the contract: on equal weight the lower value wins.
  const zero = "0x0000000000000000000000000000000000000000";
  if (winner === zero) throw new Error("a draw, and there always has to be a winner");

  // Power rather than weight: a vault slot weighs zero but outranks everything in
  // a battle. We compute it by the same rule as `_power` in the contract.
  const vaultUpTo = (await read("deckAt", [DECK])).vaultUpTo;
  const power = (value, weight) =>
    vaultUpTo > 0 && value >= 1 && value <= vaultUpTo ? Number.MAX_SAFE_INTEGER : Number(weight);
  const powerA = power(valueA, weightA);
  const powerB = power(valueB, weightB);

  const expected =
    powerA === powerB ? (valueA < valueB ? a.address : b.address)
      : powerA > powerB ? a.address : b.address;
  if (winner.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(`the wrong side won: ${winner}, it should have been ${expected}`);
  }

  // And the stake itself: two tickets to the winner, none to the loser.
  const nowA = await tickets(a.address);
  const nowB = await tickets(b.address);
  const gotWinner = winner.toLowerCase() === a.address.toLowerCase() ? nowA - ticketsA : nowB - ticketsB;
  const gotLoser = winner.toLowerCase() === a.address.toLowerCase() ? nowB - ticketsB : nowA - ticketsA;
  // The exact count, exactly two tickets, is checked by the fork test
  // test_battle_winnerTakesBothTicketsAndLoserGetsNone: there is a control open
  // there that measures how many bps one ticket costs. What is checked here is
  // what the test cannot see: that on the live chain the money really moved, and
  // moved in one direction.
  if (gotLoser !== 0n) throw new Error(`the loser received something: ${gotLoser} bps`);
  if (gotWinner <= 0n) throw new Error("the winner received no tickets");

  const escrowAfter = await read("battleEscrow");
  if (escrowAfter !== escrowBefore) {
    throw new Error(`the stake was not released: it was ${escrowBefore}, it became ${escrowAfter}`);
  }

  console.log(`\nwinner ${winner} takes both tickets and ${banked} weight`);
  console.log(`loser walks away with nothing, that is the point`);
  console.log(`click to verdict: ${Date.now() - joined} ms from the join`);
})().catch((err) => {
  console.error(err.shortMessage || err.message || err);
  process.exit(1);
});
