# Tessera

Onchain case-opening game on Base, built for the **Inco Summer Game Jam 2026**.

One dollar buys a **real Megapot lottery ticket**, and the case comes on top of it.
What's inside the case lives in an encrypted, finite pool on **Inco Lightning**:
the contents exist and are committed before anyone opens anything, but nobody, including us, can see them until a slot is drawn and revealed.

Because the pool is drawn without replacement, the counter *"3 legendaries left
out of 400 slots"* is verifiable rather than a marketing claim.

> In Rome, a *tessera* was a token that granted entry, to the games, to the grain
> dole. It was also a single piece of a mosaic. The name is about both the ticket
> and the shards that assemble into one.

## Status

Live and playable at **[tessera.unitynodes.com](https://tessera.unitynodes.com)**.

One transaction buys a real Megapot ticket and draws a case; five weight
redeems for another ticket, paid out of the game's own referral income.
Redeeming, staking, the vault and the battle arena all work on chain. 118 fork
tests run against live Base Sepolia and Base mainnet.

Still open: the mainnet deploy, and Megapot's testnet draw, `runJackpot()`
reverts on Base Sepolia even for its owner, so no jackpot ever settles there.
The same contract runs daily on mainnet. See [BRIEF.md](BRIEF.md) for the full
technical record.

## How it works

1. Player pays **1 USDC**
2. The contract buys a real Megapot ticket, with itself as referrer
3. The same transaction draws one slot from the encrypted pool and reveals it
4. Most slots are Grout, nothing. The rare ones carry **weight**
5. Five weight redeems for another real Megapot ticket, funded entirely by the
   10% referral fee the game earns on every purchase

Weight is the only unit the contract counts in. A Shard is weight 1, so five of
them make a ticket; a heavier slot can be worth a ticket, two, or five on its
own. Each deck is judged by the table it was cut with, so a slot bought under
last season's rules neither gains nor loses value when new rules arrive.

Half of that commission does not get handed out a ticket at a time. It piles
up in **the vault**, and exactly one case in the deck opens it, all of it, at
once. Same money, but a pot you can watch grow while the number of remaining
cases falls.

Or don't take the ticket: **stake what you won** instead. Your next case
decides it, anything at all doubles the stake, an empty slot burns it. You
never risk money, only the bonus; the dollar already bought a real ticket
either way.

Or play it against someone: **the arena**. Two players open a case each, the
heavier card takes both bonuses, equal weight is a draw and each keeps their
own. The loser still keeps the real ticket their dollar bought, the bonus is
all that moves.

The card of whoever opens the battle stays sealed until a challenger pays.
That is the whole reason the arena works: if the card were visible, nobody
would ever take a bad matchup and there would be no market. A battle nobody
joins can be abandoned after fifteen minutes, and anyone at all can settle a
joined one, the loser cannot freeze it by staying away.

No external funding. The prize pool pays for itself out of its own turnover,
and the contract cannot pay out more weight than its decks were built with, that ceiling is enforced in code, not policy.

## Verified numbers

Measured with live transactions on Base Sepolia, not taken from documentation.

| | |
|---|---|
| Click → prize, ticket included | **7.1 – 9.4 s** (avg 8.4 s) |
| Of which: covalidator | 5.9 – 8.6 s |
| Of which: transaction | 0.8 – 1.6 s |
| Gas per open, ticket included | 282 604 (383 450 first) |
| Gas per redeem | 409 152 |
| Referral earned per open | $0.10 of every $1 |
| Inco fee per open | **0** |
| Inco fee per deck (1000 slots) | 0.002 ETH, once per season |

The whole loop closed on chain: ten paid opens, five shards redeemed, and the
player ends up holding **eleven** real tickets. The eleventh was bought by the
game out of the referral fees the first ten produced.

The covalidator wait dominates and is outside our control. The roulette animation
is therefore **adaptive**, it loops until the result lands rather than running a
fixed duration.

## Layout

```
contracts/src/            TesseraDeck: the game, the deck, shards, treasury.
contracts/src/adapters/   One interface, two Megapot ABIs.
contracts/test/           Fork tests against live Base Sepolia and Base mainnet.
web/                      The site: Next.js 16, Tailwind v4, wagmi/viem.
web/app/api/opens/        Chain history, read once on the server for everyone.
scripts/                  Latency measurement and the audit suite.
BRIEF.md                  Full technical record: addresses, measurements, traps.
```

Chain history lives on the server rather than in each browser on purpose: the
public RPC caps `getLogs` at 2000 blocks, so every new visitor used to walk
the whole season a window at a time before the drop feed said anything.

## Live on Base Sepolia

| | |
|---|---|
| TesseraDeck | `0x7BD35cF4ddA6fd8f5c2C7Ca4337c3cA863c97887` |
| MegapotLegacyAdapter | `0xcEFd98581bb131a505e9De53d7f9b191fe94E074` |

Three decks, 400 slots between them. Five weight makes one real ticket.

| deck | slots | what is in it |
|---|---|---|
| #0 | 100 | 10 slots at weight 5, one ticket each. No vault. |
| #1 | 200 | the vault, and 1 slot at weight 25, five tickets at once. |
| #2 | 100 | the vault, and 2 slots at weight 10, two tickets each. |

Everything else is Grout: nothing. The shape of a deck is fixed when it is cut
and cannot be edited afterwards, so the table above is a property of the chain,
not a claim on this page.

How much is left is deliberately *not* written here, it changes with every
open, and a number frozen in a README is exactly the marketing claim this
project exists to avoid. The counters on the site are read from the chain, and
`scripts/audit-chain.cjs` recomputes them independently to check.

Because every opened slot is publicly revealed, anyone can count whether the
heavy slot is still in the pool. That is the game: not a stated probability,
but a finite pile you can watch empty.

## Addresses in use

| | |
|---|---|
| Inco executor (both chains) | `0x4b9911b0191B0b6a6eA8F2Ed562e20Cff5AC8624` |
| Megapot, Base Sepolia | `0x6f03c7BCaDAdBf5E6F5900DA3d56AdD8FbDac5De` |
| MPUSDC (test, free mint) | `0xA4253E7C13525287C56550b8708100f93E60509f` |
| Megapot legacy, Base mainnet | `0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95` |
| Megapot new, Base mainnet | `0x3bAe643002069dBCbcd62B1A4eb4C4A397d042a2` |

Base has two live Megapot contracts with different ABIs. Both are supported;
the mainnet deploy is one constructor argument, not a rewrite.

## Running

```bash
cd contracts && npm install && forge build && forge test
```

```bash
cd web && npm install && npm run dev
```

```bash
cd scripts && npm install && node e2e-open.cjs <contract> <privateKey>
```

```bash
cd scripts && node e2e-redeem.cjs <contract> <privateKey>
```

Requires `.env`, copy `.env.example` and fill it in. Base Sepolia only;
MPUSDC mints freely, so nothing here costs real money.

## Checking it

```bash
cd scripts && set -a && . ../.env && set +a && ./audit.sh
```

Five levels, in this order: the contracts, then the chain against the server,
then the server against what is actually painted on the screen, then load and
cold-visit timing. `OPENS=3 ./audit.sh` adds a real browser run with a stubbed
wallet, that one spends real slots out of a deck.

`audit-chain.cjs` deliberately does **not** import any site code. It reads the
chain with its own client and compares. A check assembled from the same code it
is checking would agree with every one of that code's mistakes.

## Note on ConfidentialDeck

Inco's docs point at a `confidential-deck-template` repository that is not
publicly available. This project does not use it. The deck is built directly on
`e.shuffledRange` and the `elist` primitives that ship in `@inco/lightning`.

## License

MIT
