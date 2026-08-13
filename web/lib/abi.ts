export const TESSERA_DECK_ABI =
  [
    {
      "type": "constructor",
      "inputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "receive",
      "stateMutability": "payable"
    },
    {
      "type": "function",
      "name": "BATTLE_TIMEOUT",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint64",
          "internalType": "uint64"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "MAX_BATCH",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint8",
          "internalType": "uint8"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "UPGRADE_INTERFACE_VERSION",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "string",
          "internalType": "string"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "WEIGHT_PER_TICKET",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "abandonBattle",
      "inputs": [
        {
          "name": "id",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "adapter",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "contract IMegapotAdapter"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "bankedWeight",
      "inputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "battleAt",
      "inputs": [
        {
          "name": "id",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "tuple",
          "internalType": "struct TesseraDeck.Battle",
          "components": [
            {
              "name": "a",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "slotA",
              "type": "uint64",
              "internalType": "uint64"
            },
            {
              "name": "resolved",
              "type": "bool",
              "internalType": "bool"
            },
            {
              "name": "b",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "slotB",
              "type": "uint64",
              "internalType": "uint64"
            },
            {
              "name": "deckId",
              "type": "uint32",
              "internalType": "uint32"
            },
            {
              "name": "indexA",
              "type": "uint16",
              "internalType": "uint16"
            },
            {
              "name": "openedAt",
              "type": "uint64",
              "internalType": "uint64"
            },
            {
              "name": "paidA",
              "type": "uint128",
              "internalType": "uint128"
            }
          ]
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "battleCount",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "battleEscrow",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "battlePaidB",
      "inputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "uint128",
          "internalType": "uint128"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "battlesOf",
      "inputs": [
        {
          "name": "player",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "uint256[]",
          "internalType": "uint256[]"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "budgetLeft",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "budgetWeight",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "claimBanked",
      "inputs": [],
      "outputs": [
        {
          "name": "tickets",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "paid",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "claimCreator",
      "inputs": [],
      "outputs": [
        {
          "name": "amount",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "claimVault",
      "inputs": [
        {
          "name": "slotIndex",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "value",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "signatures",
          "type": "bytes[]",
          "internalType": "bytes[]"
        }
      ],
      "outputs": [
        {
          "name": "paid",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "countOf",
      "inputs": [
        {
          "name": "player",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "createCustomDeck",
      "inputs": [
        {
          "name": "n",
          "type": "uint16",
          "internalType": "uint16"
        },
        {
          "name": "upTo",
          "type": "uint16[]",
          "internalType": "uint16[]"
        },
        {
          "name": "weight",
          "type": "uint16[]",
          "internalType": "uint16[]"
        },
        {
          "name": "vaultSlots",
          "type": "uint16",
          "internalType": "uint16"
        },
        {
          "name": "creatorBps",
          "type": "uint16",
          "internalType": "uint16"
        },
        {
          "name": "cid",
          "type": "string",
          "internalType": "string"
        }
      ],
      "outputs": [
        {
          "name": "deckId",
          "type": "uint32",
          "internalType": "uint32"
        }
      ],
      "stateMutability": "payable"
    },
    {
      "type": "function",
      "name": "createDeck",
      "inputs": [
        {
          "name": "n",
          "type": "uint16",
          "internalType": "uint16"
        },
        {
          "name": "upTo",
          "type": "uint16[]",
          "internalType": "uint16[]"
        },
        {
          "name": "weight",
          "type": "uint16[]",
          "internalType": "uint16[]"
        },
        {
          "name": "vaultSlots",
          "type": "uint16",
          "internalType": "uint16"
        }
      ],
      "outputs": [
        {
          "name": "deckId",
          "type": "uint32",
          "internalType": "uint32"
        }
      ],
      "stateMutability": "payable"
    },
    {
      "type": "function",
      "name": "creatorClaimable",
      "inputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "creatorOwed",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "customDeckFee",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "deckAt",
      "inputs": [
        {
          "name": "deckId",
          "type": "uint32",
          "internalType": "uint32"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "tuple",
          "internalType": "struct TesseraDeck.Deck",
          "components": [
            {
              "name": "cards",
              "type": "bytes32",
              "internalType": "elist"
            },
            {
              "name": "size",
              "type": "uint16",
              "internalType": "uint16"
            },
            {
              "name": "drawn",
              "type": "uint16",
              "internalType": "uint16"
            },
            {
              "name": "vaultUpTo",
              "type": "uint16",
              "internalType": "uint16"
            },
            {
              "name": "vault",
              "type": "uint128",
              "internalType": "uint128"
            },
            {
              "name": "unsweptOpens",
              "type": "uint64",
              "internalType": "uint64"
            },
            {
              "name": "creator",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "creatorBps",
              "type": "uint16",
              "internalType": "uint16"
            }
          ]
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "deckCount",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "deckFee",
      "inputs": [
        {
          "name": "n",
          "type": "uint16",
          "internalType": "uint16"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "deckMeta",
      "inputs": [
        {
          "name": "",
          "type": "uint32",
          "internalType": "uint32"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "string",
          "internalType": "string"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "feesClaimable",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "handleOf",
      "inputs": [
        {
          "name": "player",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "i",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "initialize",
      "inputs": [
        {
          "name": "_adapter",
          "type": "address",
          "internalType": "contract IMegapotAdapter"
        },
        {
          "name": "_owner",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "joinBattle",
      "inputs": [
        {
          "name": "id",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "slotIndex",
          "type": "uint64",
          "internalType": "uint64"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "maxCreatorBps",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint16",
          "internalType": "uint16"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "maxVaultShare",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint16",
          "internalType": "uint16"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "minCustomSize",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint16",
          "internalType": "uint16"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "openBattle",
      "inputs": [
        {
          "name": "deckId",
          "type": "uint32",
          "internalType": "uint32"
        }
      ],
      "outputs": [
        {
          "name": "id",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "slotIndex",
          "type": "uint64",
          "internalType": "uint64"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "openBattleIds",
      "inputs": [
        {
          "name": "max",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "ids",
          "type": "uint256[]",
          "internalType": "uint256[]"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "openCase",
      "inputs": [
        {
          "name": "deckId",
          "type": "uint32",
          "internalType": "uint32"
        }
      ],
      "outputs": [
        {
          "name": "index",
          "type": "uint16",
          "internalType": "uint16"
        },
        {
          "name": "handle",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "openMany",
      "inputs": [
        {
          "name": "deckId",
          "type": "uint32",
          "internalType": "uint32"
        },
        {
          "name": "n",
          "type": "uint8",
          "internalType": "uint8"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "owner",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "paidWeight",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "proxiableUUID",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "redeem",
      "inputs": [
        {
          "name": "slotIndexes",
          "type": "uint256[]",
          "internalType": "uint256[]"
        },
        {
          "name": "values",
          "type": "uint256[]",
          "internalType": "uint256[]"
        },
        {
          "name": "signatures",
          "type": "bytes[][]",
          "internalType": "bytes[][]"
        }
      ],
      "outputs": [
        {
          "name": "tickets",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "paid",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "remaining",
      "inputs": [
        {
          "name": "deckId",
          "type": "uint32",
          "internalType": "uint32"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "uint16",
          "internalType": "uint16"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "reseals",
      "inputs": [
        {
          "name": "",
          "type": "uint32",
          "internalType": "uint32"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "uint32",
          "internalType": "uint32"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "resolveBattle",
      "inputs": [
        {
          "name": "id",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "valueA",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "signaturesA",
          "type": "bytes[]",
          "internalType": "bytes[]"
        },
        {
          "name": "valueB",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "signaturesB",
          "type": "bytes[]",
          "internalType": "bytes[]"
        }
      ],
      "outputs": [
        {
          "name": "winner",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "banked",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "revealMine",
      "inputs": [
        {
          "name": "i",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "sealedSlotsOf",
      "inputs": [
        {
          "name": "player",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "out",
          "type": "uint64[]",
          "internalType": "uint64[]"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "setCustomDeckRules",
      "inputs": [
        {
          "name": "fee",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "maxBps",
          "type": "uint16",
          "internalType": "uint16"
        },
        {
          "name": "minSize",
          "type": "uint16",
          "internalType": "uint16"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "setVaultShare",
      "inputs": [
        {
          "name": "bps",
          "type": "uint16",
          "internalType": "uint16"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "settleStake",
      "inputs": [
        {
          "name": "value",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "signatures",
          "type": "bytes[]",
          "internalType": "bytes[]"
        }
      ],
      "outputs": [
        {
          "name": "won",
          "type": "bool",
          "internalType": "bool"
        },
        {
          "name": "banked",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "shardSpent",
      "inputs": [
        {
          "name": "",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "slotDeck",
      "inputs": [
        {
          "name": "player",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "i",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "uint32",
          "internalType": "uint32"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "slotIsRisk",
      "inputs": [
        {
          "name": "player",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "i",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "spendable",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "stake",
      "inputs": [
        {
          "name": "slotIndexes",
          "type": "uint256[]",
          "internalType": "uint256[]"
        },
        {
          "name": "values",
          "type": "uint256[]",
          "internalType": "uint256[]"
        },
        {
          "name": "signatures",
          "type": "bytes[][]",
          "internalType": "bytes[][]"
        }
      ],
      "outputs": [
        {
          "name": "weight",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "decidingSlot",
          "type": "uint64",
          "internalType": "uint64"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "stakeOf",
      "inputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "weight",
          "type": "uint128",
          "internalType": "uint128"
        },
        {
          "name": "slotIndex",
          "type": "uint64",
          "internalType": "uint64"
        },
        {
          "name": "open",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "sweepFees",
      "inputs": [],
      "outputs": [
        {
          "name": "claimed",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "ticketToken",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "address",
          "internalType": "contract IERC20"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "tiers",
      "inputs": [
        {
          "name": "deckId",
          "type": "uint32",
          "internalType": "uint32"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "tuple[]",
          "internalType": "struct TesseraDeck.Tier[]",
          "components": [
            {
              "name": "upTo",
              "type": "uint16",
              "internalType": "uint16"
            },
            {
              "name": "weight",
              "type": "uint16",
              "internalType": "uint16"
            }
          ]
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "transferOwnership",
      "inputs": [
        {
          "name": "to",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "function",
      "name": "treasury",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "unsweptOpens",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint64",
          "internalType": "uint64"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "upgradeToAndCall",
      "inputs": [
        {
          "name": "newImplementation",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "data",
          "type": "bytes",
          "internalType": "bytes"
        }
      ],
      "outputs": [],
      "stateMutability": "payable"
    },
    {
      "type": "function",
      "name": "vault",
      "inputs": [],
      "outputs": [
        {
          "name": "total",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "vaultOf",
      "inputs": [
        {
          "name": "deckId",
          "type": "uint32",
          "internalType": "uint32"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "vaultShareBps",
      "inputs": [],
      "outputs": [
        {
          "name": "",
          "type": "uint16",
          "internalType": "uint16"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "weightOf",
      "inputs": [
        {
          "name": "deckId",
          "type": "uint32",
          "internalType": "uint32"
        },
        {
          "name": "value",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "uint16",
          "internalType": "uint16"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "weightOfSlot",
      "inputs": [
        {
          "name": "player",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "i",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "value",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "event",
      "name": "BattleAbandoned",
      "inputs": [
        {
          "name": "id",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "a",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "BattleJoined",
      "inputs": [
        {
          "name": "id",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "b",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "slotB",
          "type": "uint64",
          "indexed": false,
          "internalType": "uint64"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "BattleOpened",
      "inputs": [
        {
          "name": "id",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "a",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "slotA",
          "type": "uint64",
          "indexed": false,
          "internalType": "uint64"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "BattleResolved",
      "inputs": [
        {
          "name": "id",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "winner",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "weight",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "tickets",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "CaseOpened",
      "inputs": [
        {
          "name": "player",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "deckId",
          "type": "uint32",
          "indexed": true,
          "internalType": "uint32"
        },
        {
          "name": "index",
          "type": "uint16",
          "indexed": false,
          "internalType": "uint16"
        },
        {
          "name": "handle",
          "type": "bytes32",
          "indexed": false,
          "internalType": "bytes32"
        },
        {
          "name": "paid",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "CreatorClaimed",
      "inputs": [
        {
          "name": "creator",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "amount",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "CreatorPaid",
      "inputs": [
        {
          "name": "deckId",
          "type": "uint32",
          "indexed": true,
          "internalType": "uint32"
        },
        {
          "name": "creator",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "amount",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "DeckCreated",
      "inputs": [
        {
          "name": "deckId",
          "type": "uint32",
          "indexed": true,
          "internalType": "uint32"
        },
        {
          "name": "size",
          "type": "uint16",
          "indexed": false,
          "internalType": "uint16"
        },
        {
          "name": "totalWeight",
          "type": "uint16",
          "indexed": false,
          "internalType": "uint16"
        },
        {
          "name": "feePaid",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "creator",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "creatorBps",
          "type": "uint16",
          "indexed": false,
          "internalType": "uint16"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "DeckResealed",
      "inputs": [
        {
          "name": "deckId",
          "type": "uint32",
          "indexed": true,
          "internalType": "uint32"
        },
        {
          "name": "cut",
          "type": "uint32",
          "indexed": true,
          "internalType": "uint32"
        },
        {
          "name": "size",
          "type": "uint16",
          "indexed": false,
          "internalType": "uint16"
        },
        {
          "name": "why",
          "type": "uint8",
          "indexed": false,
          "internalType": "uint8"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "FeesSwept",
      "inputs": [
        {
          "name": "amount",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "Initialized",
      "inputs": [
        {
          "name": "version",
          "type": "uint64",
          "indexed": false,
          "internalType": "uint64"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "OwnerChanged",
      "inputs": [
        {
          "name": "from",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "to",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "RiskTaken",
      "inputs": [
        {
          "name": "player",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "deckId",
          "type": "uint32",
          "indexed": true,
          "internalType": "uint32"
        },
        {
          "name": "index",
          "type": "uint16",
          "indexed": false,
          "internalType": "uint16"
        },
        {
          "name": "handle",
          "type": "bytes32",
          "indexed": false,
          "internalType": "bytes32"
        },
        {
          "name": "toVault",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "ShardsRedeemed",
      "inputs": [
        {
          "name": "player",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "handles",
          "type": "bytes32[]",
          "indexed": false,
          "internalType": "bytes32[]"
        },
        {
          "name": "weight",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "tickets",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "paid",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "SlotRevealed",
      "inputs": [
        {
          "name": "player",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "index",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "StakeSettled",
      "inputs": [
        {
          "name": "player",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "staked",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "won",
          "type": "bool",
          "indexed": false,
          "internalType": "bool"
        },
        {
          "name": "banked",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "Staked",
      "inputs": [
        {
          "name": "player",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "weight",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "decidingSlot",
          "type": "uint64",
          "indexed": false,
          "internalType": "uint64"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "Upgraded",
      "inputs": [
        {
          "name": "implementation",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "VaultGrew",
      "inputs": [
        {
          "name": "deckId",
          "type": "uint32",
          "indexed": true,
          "internalType": "uint32"
        },
        {
          "name": "added",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "total",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "VaultOpened",
      "inputs": [
        {
          "name": "player",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "deckId",
          "type": "uint32",
          "indexed": true,
          "internalType": "uint32"
        },
        {
          "name": "handle",
          "type": "bytes32",
          "indexed": false,
          "internalType": "bytes32"
        },
        {
          "name": "paid",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "error",
      "name": "AddressEmptyCode",
      "inputs": [
        {
          "name": "target",
          "type": "address",
          "internalType": "address"
        }
      ]
    },
    {
      "type": "error",
      "name": "BadAttestation",
      "inputs": [
        {
          "name": "handle",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ]
    },
    {
      "type": "error",
      "name": "BadBatch",
      "inputs": [
        {
          "name": "n",
          "type": "uint8",
          "internalType": "uint8"
        }
      ]
    },
    {
      "type": "error",
      "name": "BadTierTable",
      "inputs": []
    },
    {
      "type": "error",
      "name": "BattleGone",
      "inputs": []
    },
    {
      "type": "error",
      "name": "BattleTaken",
      "inputs": []
    },
    {
      "type": "error",
      "name": "BattleWaiting",
      "inputs": []
    },
    {
      "type": "error",
      "name": "BudgetExhausted",
      "inputs": [
        {
          "name": "left",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "need",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    },
    {
      "type": "error",
      "name": "CannotFightYourself",
      "inputs": []
    },
    {
      "type": "error",
      "name": "ClaimFailed",
      "inputs": [
        {
          "name": "reason",
          "type": "bytes",
          "internalType": "bytes"
        }
      ]
    },
    {
      "type": "error",
      "name": "DeckEmpty",
      "inputs": []
    },
    {
      "type": "error",
      "name": "DeckHasNoVault",
      "inputs": []
    },
    {
      "type": "error",
      "name": "DeckTooSmall",
      "inputs": [
        {
          "name": "size",
          "type": "uint16",
          "internalType": "uint16"
        },
        {
          "name": "min",
          "type": "uint16",
          "internalType": "uint16"
        }
      ]
    },
    {
      "type": "error",
      "name": "ERC1967InvalidImplementation",
      "inputs": [
        {
          "name": "implementation",
          "type": "address",
          "internalType": "address"
        }
      ]
    },
    {
      "type": "error",
      "name": "ERC1967NonPayable",
      "inputs": []
    },
    {
      "type": "error",
      "name": "FailedCall",
      "inputs": []
    },
    {
      "type": "error",
      "name": "InvalidInitialization",
      "inputs": []
    },
    {
      "type": "error",
      "name": "NoStakeOpen",
      "inputs": []
    },
    {
      "type": "error",
      "name": "NoSuchBattle",
      "inputs": []
    },
    {
      "type": "error",
      "name": "NoSuchDeck",
      "inputs": []
    },
    {
      "type": "error",
      "name": "NotEnoughWeight",
      "inputs": [
        {
          "name": "weight",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "need",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    },
    {
      "type": "error",
      "name": "NotInitializing",
      "inputs": []
    },
    {
      "type": "error",
      "name": "NotOwner",
      "inputs": []
    },
    {
      "type": "error",
      "name": "NotTheVault",
      "inputs": [
        {
          "name": "handle",
          "type": "bytes32",
          "internalType": "bytes32"
        },
        {
          "name": "value",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    },
    {
      "type": "error",
      "name": "NotYourBattle",
      "inputs": []
    },
    {
      "type": "error",
      "name": "NothingBanked",
      "inputs": []
    },
    {
      "type": "error",
      "name": "NothingToClaim",
      "inputs": []
    },
    {
      "type": "error",
      "name": "PurchasingDisabled",
      "inputs": []
    },
    {
      "type": "error",
      "name": "ReentrancyGuardReentrantCall",
      "inputs": []
    },
    {
      "type": "error",
      "name": "SafeERC20FailedOperation",
      "inputs": [
        {
          "name": "token",
          "type": "address",
          "internalType": "address"
        }
      ]
    },
    {
      "type": "error",
      "name": "ShardAlreadySpent",
      "inputs": [
        {
          "name": "handle",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ]
    },
    {
      "type": "error",
      "name": "ShareStarvesPrizes",
      "inputs": []
    },
    {
      "type": "error",
      "name": "ShareTooBig",
      "inputs": []
    },
    {
      "type": "error",
      "name": "SlotInBattle",
      "inputs": [
        {
          "name": "id",
          "type": "uint64",
          "internalType": "uint64"
        }
      ]
    },
    {
      "type": "error",
      "name": "StakeAlreadyOpen",
      "inputs": []
    },
    {
      "type": "error",
      "name": "StakeNotSettled",
      "inputs": []
    },
    {
      "type": "error",
      "name": "TicketNotCredited",
      "inputs": []
    },
    {
      "type": "error",
      "name": "TooEarlyToAbandon",
      "inputs": [
        {
          "name": "openAt",
          "type": "uint64",
          "internalType": "uint64"
        }
      ]
    },
    {
      "type": "error",
      "name": "TooManyShardSlots",
      "inputs": []
    },
    {
      "type": "error",
      "name": "TreasuryEmpty",
      "inputs": [
        {
          "name": "have",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "need",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    },
    {
      "type": "error",
      "name": "UUPSUnauthorizedCallContext",
      "inputs": []
    },
    {
      "type": "error",
      "name": "UUPSUnsupportedProxiableUUID",
      "inputs": [
        {
          "name": "slot",
          "type": "bytes32",
          "internalType": "bytes32"
        }
      ]
    },
    {
      "type": "error",
      "name": "VaultEmpty",
      "inputs": []
    },
    {
      "type": "error",
      "name": "WorthlessSlot",
      "inputs": [
        {
          "name": "handle",
          "type": "bytes32",
          "internalType": "bytes32"
        },
        {
          "name": "value",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    }
  ] as const;
