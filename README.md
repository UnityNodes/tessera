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

Research complete, core verified on live Base Sepolia. Megapot integration and
frontend are next. See [BRIEF.md](BRIEF.md) for the full technical record.

## How it works

1. Player pays **1 USDC**
2. The contract buys a real Megapot ticket, with itself as referrer
3. The same transaction draws one slot from the encrypted pool and reveals it
4. Most slots are cosmetics; rare ones are **fractional ticket shards**
5. Five shards redeem for another real Megapot ticket, funded entirely by the
   10% referral fee the game earns on every purchase

No external funding. The prize pool pays for itself out of its own turnover.

## Verified numbers

Measured with live transactions on Base Sepolia, not taken from documentation.

| | |
|---|---|
| Click → prize | **7.7 – 9.2 s** (avg 8.4 s) |
| Of which: covalidator | 6.2 – 8.0 s |
| Of which: transaction | 0.9 – 1.4 s |
| Gas per open | 161 377 |
| Inco fee per open | **0** |
| Inco fee per deck (1000 slots) | 0.002 ETH, once per season |

The covalidator wait dominates and is outside our control. The roulette animation
is therefore **adaptive**, it loops until the result lands rather than running a
fixed duration.

## Layout

```
contracts/   Solidity. Own confidential deck on raw @inco/lightning primitives.
scripts/     Latency measurement against live Base Sepolia.
BRIEF.md     Full technical record: addresses, measurements, decisions, traps.
```

## Deployed (Base Sepolia)

| | |
|---|---|
| Inco executor | `0x4b9911b0191B0b6a6eA8F2Ed562e20Cff5AC8624` |
| Megapot jackpot | `0x6f03c7BCaDAdBf5E6F5900DA3d56AdD8FbDac5De` |
| MPUSDC (test) | `0xA4253E7C13525287C56550b8708100f93E60509f` |

## Running

```bash
cd contracts && npm install && forge build
```

```bash
cd scripts && npm install && node e2e-open.cjs <contract> <privateKey>
```

Requires `.env`, copy `.env.example` and fill it in. Base Sepolia only;
MPUSDC mints freely, so nothing here costs real money.

## Note on ConfidentialDeck

Inco's docs point at a `confidential-deck-template` repository that is not
publicly available. This project does not use it. The deck is built directly on
`e.shuffledRange` and the `elist` primitives that ship in `@inco/lightning`.

## License

MIT
