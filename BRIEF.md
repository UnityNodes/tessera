# Tessera

Inco Summer Game Jam. .

`openCase()` Megapot
. Base . ,
, . tessera2,
'. 118 -Base Sepolia Base mainnet
.

```
TesseraDeck (ERC-1967)  0x985520De2A14BD443d06DcA07A57Ef4F349bd8B1  45283259
MegapotLegacyAdapter           0x5Ac6bB03e8Fb6435A46EEb70b2f1F692a108030e
```

: -,
,
. -, ,
. : `deckAt`,
`tiers`, `remaining`, `reseals`.

, .
, :
, `scripts/audit-chain.cjs` .

: -() -.

⚠️ , .
,
`web/lib/chain.ts` . .

. tessera .
, .

### ,

`next start -p 3080` `.next` '.
,
`npm run build`. , ':

```bash
cd /root/tessera/web && npm run build && sudo systemctl restart tessera-web
```

`web/DEPLOY.md`.

, → , → , , .
`OPENS=3 ./audit.sh`
, .

: `audit-chain.cjs` ,
. , ,
, .

, `web/app/api/opens`. . ,
, 429 RPC 500
.

---

## 1.

Base Sepolia.

$1 → **Megapot** ****.
Inco:
, . 5 →
.

: .
, .
, .

---

## 2.

| | |
|---|---|
| | 29 14 2026 |
| | 14 18:00 EDT = **01:00 15 ** |
| | Inco ($5000) **** Megapot ($3000 / $1500 / $500, ) |
| Telegram | https://t.me/summergamejam |

:
- ,
-
- -
-
- ****

Megapot (Inco ):
- 30%
- 25%
- 25% UX
- 20%

---

## 3.

RPC, .

### Megapot Base Sepolia (chain 84532)

```
Jackpot (EIP-1967)  0x6f03c7BCaDAdBf5E6F5900DA3d56AdD8FbDac5De
MPUSDC      0xA4253E7C13525287C56550b8708100f93E60509f
```

| | |
|---|---|
| `ticketPrice()` | `1000000` (= $1, 6 ) |
| `roundDurationInSeconds()` | `300` 5 |
| `referralFeeBps()` | `1000` 10% |
| `feeBps()` | `1500` |
| `allowPurchasing()` | `true` |
| `decimals()` MPUSDC | `6`, `TestTokenUSDC` |

- **`mint(address,uint256)` MPUSDC .** .
- : `purchaseTickets(address referrer, uint256 value, address recipient)`
- `withdrawReferralFees()` `referralFeesClaimable(address)`
- `ERC20InsufficientAllowance` , `approve`

### ⚠️ Cannot refer yourself

Legacy-`Cannot refer yourself`,
`referrer == msg.sender`. **
**. , .

(`test/MegapotRules.t.sol`):

| msg.sender | referrer | recipient | |
|---|---|---|---|
| X | X | | ❌ `Cannot refer yourself` |
| X | X | X | ❌ `Cannot refer yourself` |
| X | Y | | ✅ $0.10 Y |
| X | | | ✅ |
| X | `address(0)` | | ✅ |
| | X | | ✅ |

➡️ ****, . :
(), (`TesseraDeck`), ().
, `withdrawReferralFees()`
`TesseraDeck`, calldata ABI .

, ,
, .

###

CREATE2): executor `0x4b99…8624`, verifier `0x8677…0f09`.
.
.


| | Base Sepolia `0x6f03c7…c5De` | Base mainnet `0xbEDd4F…1B95` | Base mainnet `0x3bAe6430…42a2` |
|---|---|---|---|
| ABI | legacy | **legacy, ** | |
| | 1e6 | 1e6 | 1e6 |
| | 300 | 86280 | 86400 |
| | 1000 bps | 1000 bps | 1e17 (=10%) |
| | `purchaseTickets` | `purchaseTickets` | `buyTickets` |
| | | | **NFT** |
| | 1500 bps | 3000 bps | `protocolFee()` = 0 |
| | | **, ** | **, #132** |

Sepolia `0xbEDd4F` **, 62**
.

, `referralFeeBps()`
`lastJackpotEndTime()` , `purchaseTickets` .
`0x3bAe6430…42a2` : `0xbEDd4F…1B95`
.

(`test/MegapotV2Rules.t.sol`), :

- '**** `[1, normalBallMax]` (30)
- **** ()
- **`getDrawingState(id)[10]`**, 10.
  `bonusballMin` (5), `bonusballSoftCap` (65),
  `bonusballHardCap` (80).
-
-
- **** legacy
- `1e17` = **10%**, 8%

➡️ **'**: `IMegapotAdapter`, ,
`MegapotLegacyAdapter` `MegapotV2Adapter`.
.

➡️ **Sepolia.** , :
5 ,
. ,
.


178 , :
anvil-`status 0x1`, 187k .

$1 , :

| | |
|---|---|
| (`userPoolTotal`) | $0.85 |
| **()** | **$0.10** |
| | $0.05 |

(`0x2FD38a17489f9d038321F26cB821AA718cDc0bac`, ).
, .
Pyth-, ,
.

: , ****.
, .

### (3 , Telegram )

should the product be on testnet or mainnet?Sam Diamond :
**«For Inco, either is fine»**.

Inco Sepolia , .
**Megapot **, a functional
Megapot integration on Base. :
() ,
.

### Inco Lightning Base Sepolia

SDK (`Lightning.baseSepoliaTestnet()`), :

```
Executor ()   0x4b9911b0191B0b6a6eA8F2Ed562e20Cff5AC8624
Verifier            0x867758FFe098fB0D74826A8DCf60127696440f09
Executor impl       0x853C0Fc64FEbC97DA6dFB4256F3EEAFf71d7DF87
Verifier impl       0xB8Afb191f58Db7Be49689c88BEF777aBCBA34fd8
```

`incoLightning_12_0_3__473307884`, 16 2026, pepper `mainnet`.

: `@inco/lightning` **1.0.2** (Solidity), `@inco/lightning-js` **1.0.2** ().
`Lightning.baseMainnet()` SDK **Inco **.

:
```solidity
import {elist, ETypes, euint256, ebool, eaddress, e, inco} from "@inco/lightning/src/Lib.sol";
```

⚠️ **ESM-`@inco/lightning-js` 1.0.2 **
, Node `ERR_MODULE_NOT_FOUND`. CJS-
. Next.js , .

### ⚠️ ConfidentialDeck

`github.com/Inco-fhevm/confidential-deck-template`
**404**. `@inco/lightning` .
49 : .

`Lib.sol` `newEList`, `range`, `shuffle`, **`shuffledRange`**, `slice`,
`concat`, `getEListFee`.

(Lib.sol:1188) :
```solidity
function shuffledRange(uint16 start, uint16 end, ETypes listType) internal returns (elist ret) {
    uint256 fee = inco.getEListFee(end - start, listType);
    elist rangeList = inco.listRange{value: fee}(start, end, listType);
    return inco.listShuffle{value: fee}(rangeList);
}
```

: `uint16` → 65535 .

anvil-Base Sepolia, :

| | | | Inco |
|---|---|---|---|
| `createDeck(400)` | ✅ | 143 247 | 0.0008 ETH |
| `drawSlot()` | ✅ | 151 034 | **0** |
| `drawSlot()` | ✅ | 133 934 | **0** |
| `revealMine(0)` | ✅ | 74 371 | **0** |

: `drawn=3`, `remaining=397`, .

🔑 **Inco.**
, ().
.

⚠️ **, :** **
**. `e.shuffledRange()` '`e.allowThis(deck)`,
`SenderNotAllowedForHandle(bytes32,address)`.

executor:

| | |
|---|---|
| 100 | 0.0002 ETH |
| 400 | 0.0008 ETH |
| 1000 | 0.002 ETH |
| 5000 | 0.01 ETH |

### Inco

**ETH, **:
- `rand()`, `newEuint256()` 0.000001 ETH
- EList `× × (0.000001 / 256)`
- `shuffledRange()` (`getEListFee`)
- 1000 `euint256` ≈ **0.002 ETH**
- ,

-, .

### ✅ BASE SEPOLIA

`prototype/TesseraDeck.sol` Sepolia,
7 . : **26, 19, 8, 34** ,
, .


| | | | **** |
|---|---|---|---|
| 1 | 914 ms | 8033 ms | **8.9 ** |
| 2 | 1311 ms | 7865 ms | **9.2 ** |
| 3 | 902 ms | 6985 ms | **7.9 ** |
| 4 | 1429 ms | 6224 ms | **7.7 ** |


(`drawSlot` + `revealMine`) 8.610.2 .
~1.5 .

🔑 **, 68 .** 80%
. .
`ciphertext for handle … not found, it might not have been processed yet`.

~8 , **'**. 5
. :
, .
~7 , .

: `0xb01c3c4b31992899993dcde758cae6297f8457746d491d108cd10998237a0800`
(45, `0xDB7a5d5BD1908Ca5a4eE2DdC65c25Cf74299c1da`).
: `0xC997b7c9B3A3b3706A0CE6779aa3f24fE454FD87`.

⚠️ **RPC `sepolia.base.org` 11.6 .**
`array out-of-bounds`.
, (`simulateContract`)
, , .

###

(, ), Attested Compute, Attested Reveal.

**2 2**, , reveal :
```
https://0x106af6fe8ec4ef20fd4dc43d284489058d1c0f8b.12.covalidator.basesep.mainnet.inco.org
https://0x2f857d1c29ca52309ef41ddb33abbe0ab336c00b.12.covalidator.basesep.mainnet.inco.org
```

:

| | |
|---|---|
| | 0.13 0.40 , |
| SDK, **** | **49 ** |
| SDK, | 0.9 |

Inco:

| | |
|---|---|
| `lightning-rod/lib/inco.ts` | 2 + 10 , backoff 1.5× ≈ **77 ** |
| `mines`, `retryReveal` | 15 × 3 = **45 ** |
| e2e-| `timeout: 50_000` |

,
, .

⚠️ ****
7.79.2 . , .
, .

SDK 49 :
, .

###

`Inco-fhevm/lightning-rod` (DDK, e2e-Base Sepolia), `Inco-fhevm/skills`,
`mines`, `incasino`, `hangman`. : https://docs.inco.org/llms.txt

###


---

## 4.

1. **** . `createDeck(n)`
   `e.shuffledRange`, `openCase()` .
   3 .
2. **Megapot** $1 = + . .
   .
3. **** (), **
   **. 5 = 1 .
4. **** 10% . $0.10 .
   10 = , = .
5. **** Base Sepolia, MPUSDC .
   1213 ****
   $1020 Base Sepolia Base?
   Megapot, .
6. **.** . .
   Attested Decrypt.
7. **ERC-721** , .
   ERC-721 stretch , .
8. **10-** , .
   , '.
9. **.** , .

###

- , , mines Inco,
- / -
- **** USDC (, )
-

---

## 5.

: `ConfidentialDeck` (. ).

```
TesseraDeck ──$1──> MegapotAdapter ──purchaseTickets/buyTickets──> Megapot
     ▲   referrer=TesseraDeck ──────────────────────────┘  │
     │                                                     ▼
     └──────── sweepFees() ◄──── 10% ───┘
```

:

| | |
|---|---|
| `src/TesseraDeck.sol` | : , `openCase()`, `redeem()`, |
| `src/interfaces/IMegapotAdapter.sol` | Megapot |
| `src/adapters/MegapotLegacyAdapter.sol` | Sepolia `0x6f03c7…` + mainnet `0xbEDd4F…` |
| `src/adapters/MegapotV2Adapter.sol` | mainnet `0x3bAe6430…`, quick-pick |

| | |
|---|---|
| `createDeck(n, shards)` | ✅ , |
| `openCase()` | ✅ Megapot + + `reveal`, |
| `redeem(idx[5], values[5], sigs[5])` | ✅ 5 → |
| `sweepFees()` | ✅ Megapot , |
| `deckFee(n)`, `myHandle`, `remaining`, `treasury` | ✅ |

.
,
`e.verifyDecryption` (Inco, `Lib.sol:840`). ,
, '.
: `1..shardSlots` .

### ✅ Base Sepolia (3 , )

```
TesseraDeck           0x773b44eDe2D5454336F98b1DBA3d0c2484cB6579
MegapotLegacyAdapter  0xcEFd98581bb131a505e9De53d7f9b191fe94E074
100 , 40
```


| | | | **** | |
|---|---|---|---|---|
| 1 | 1638 ms | 7706 ms | **9.3 ** | 25 |
| 2 | 1251 ms | 6376 ms | **7.6 ** | 12 |
| 3 | 1562 ms | 6805 ms | **8.4 ** | 88 |
| 4 | 1170 ms | 5941 ms | **7.1 ** | 79 |
| 5 | 763 ms | 8624 ms | **9.4 ** | 17 |

, , .

(25, 12, 17, 33, 36), `redeem()`
$1 , Megapot .
1549 ms, 409 152, `status 1`.

: $10, **11 ** (93 500 bps).

.
,
;
. ,
`test_redeem_oldCosmeticStaysCosmeticAfterGenerousSeason`
`test_redeem_oldShardSurvivesStingierSeason`.

`createDeck` ,
, .


| | |
|---|---|
| `openCase()` | 383 450 |
| `openCase()` | **282 604** |
| `redeem()` -sweep | 409 152 |
| `createDeck(100)` | 146 145 |

⚠️ -211 914 `openCase()`
. forge-
, .
. **282 604.**

- (, , )
- (, , )
- (3 400 )

: , `translateX`. ****,
`Math.random()`. **7.79.2 **:
, , .
.

`simulateContract` ****
RPC .

`Lightning.baseSepoliaTestnet()`
: 49 , 0.9 .

---

## 6.

. :

1. **-** .
   , : .
2. **-.**
3. Sepolia ETH :
   0.002 ETH, 0.022.

: `@inco/lightning-js` Next.js
(CJS, ESM), , .

⚠️ **`0xAe389544FBb71850e32d20829f48F6c26B5c46ad`**,
`.env`, 0.022 ETH Sepolia (7 ).
`0x0D84EDCa486E3724b9f5AAb529edB141176c661e` : 0.046 ETH
, .

SDK, : `covalidatorSignatures`
'`{0: , 1: , …}`, `Uint8Array`.
`toHex(Uint8Array.from(Object.values(sig)))`.

## 7.

- -: `0xbEDd4F…` (
  , ABI, Sepolia) `0x3bAe6430…`,
  . ,
  12-

: (100 / 200 / 100, ),
(
`test_createDeck_rejectsWeightAboveBreakEven`
, '), (tessera2).

---

## 8.

| | | |
|---|---|---|
| 3 | , , | ✅ |
| 3 | Megapot `openCase()`, , , `redeem()` | ✅ , 3 |
| 46 | Sepolia, e2e, | ✅ |
| 78 | , , | ✅ |
| 911 | , | ✅ |
| 1213 | Sepolia + , -, README | Sepolia ✅, README ✅; |
| 14 | , ****, | |

,
. -.
