# Tessera

chain case-opening game on Base, built for the **Inco Summer Game Jam 2026**.

One dollar buys a **real Megapot lottery ticket**, and the case comes on top of it.
What's inside the case lives in an encrypted, finite pool on **Inco Lightning**:
the contents exist and are committed before anyone opens anything, but nobody, including us, can see them until a slot is drawn and revealed.

Because the pool is drawn without replacement, the counter *"3 legendaries left
out of 400 slots"* is verifiable rather than a marketing claim.

> In Rome, a *tessera* was a token that granted entry, to the games, to the grain
> dole. It was also a single piece of a mosaic. The name is about both the ticket
> and the shards that assemble into one.

## Status

Contracts done and covered. One transaction buys a real Megapot ticket and
draws a case; five shards redeem for another ticket, paid out of the game's own
referral income. 44 fork tests run against live Base Sepolia and Base mainnet.
Frontend is next. See [BRIEF.md](BRIEF.md) for the full technical record.

## How it works

1. Player pays **1 USDC**
2. The contract buys a real Megapot ticket, with itself as referrer
3. The same transaction draws one slot from the encrypted pool and reveals it
4. Most slots are cosmetics; rare ones are **fractional ticket shards**
5. Five shards redeem for another real Megapot ticket, funded entirely by the
   10% referral fee the game earns on every purchase

Half of that commission does not get handed out a ticket at a time. It piles
up in **the vault**, and exactly one case in the deck opens it, all of it, at
once. Same money, but a pot you can watch grow while the number of remaining
cases falls.

Or don't take the ticket: **stake what you won** instead. Your next case
decides it, anything at all doubles the stake, an empty slot burns it. You
never risk money, only the bonus; the dollar already bought a real ticket
either way.

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
scripts/                  Latency measurement against live Base Sepolia.
BRIEF.md                  Full technical record: addresses, measurements, traps.
```

## Live on Base Sepolia

| | |
|---|---|
| TesseraDeck | `0x773b44eDe2D5454336F98b1DBA3d0c2484cB6579` |
| MegapotLegacyAdapter | `0xcEFd98581bb131a505e9De53d7f9b191fe94E074` |

Season 1, 100 slots: **1 Porphyry** (five real tickets at once), 3 Aureus
(one ticket each), 8 Shards (five make a ticket), 88 Grout (nothing).

Because every opened slot is publicly revealed, anyone can count whether the
Porphyry is still in the pool. That is the game: not a stated probability, but
a finite pile you can watch empty.

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
cd scripts && npm install && node e2e-open.cjs <contract> <privateKey>
```

```bash
cd scripts && node e2e-redeem.cjs <contract> <privateKey>
```

Requires `.env`, copy `.env.example` and fill it in. Base Sepolia only;
MPUSDC mints freely, so nothing here costs real money.

## Note on ConfidentialDeck

Inco's docs point at a `confidential-deck-template` repository that is not
publicly available. This project does not use it. The deck is built directly on
`e.shuffledRange` and the `elist` primitives that ship in `@inco/lightning`.

## License

MIT
