import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError } from "viem";
import type { TESSERA_DECK_ABI } from "@/lib/abi";

/**
 * The names of errors the contract can actually throw.
 *
 * A type rather than a list: the ABI is generated from `contracts/out` and
 * declared `as const`, so the names come out of it by themselves. An entry under
 * a name the contract does not have no longer compiles, which is exactly how
 * `NotAShard` and `WrongShardCount` lived here for months without anyone ever
 * throwing them.
 *
 * `import type` keeps the ABI out of the bundle when all we want is the check.
 */
type DeckError = Extract<(typeof TESSERA_DECK_ABI)[number], { type: "error" }>["name"];

export type Fault =
  | "rejected"
  | "no-money"
  | "no-allowance"
  | "deck-empty"
  | "no-such-deck"
  | "purchasing-disabled"
  | "ticket-not-credited"
  | "worthless-slot"
  | "shard-spent"
  | "treasury-empty"
  | "bad-attestation"
  | "not-enough-weight"
  | "budget-exhausted"
  | "slot-in-battle"
  | "battle-taken"
  | "battle-gone"
  | "battle-waiting"
  | "no-such-battle"
  | "own-battle"
  | "not-your-battle"
  | "too-early"
  | "stake-open"
  | "no-stake"
  | "stake-unsettled"
  | "nothing-banked"
  | "vault-empty"
  | "not-the-vault"
  | "no-vault"
  | "claim-failed"
  | "token-failed"
  | "stale"
  | "no-funds"
  | "reveal-timeout"
  | "unknown";

export interface Explained {
  fault: Fault;
  /** What happened, in human words. */
  title: string;
  /** What to do about it. Empty when there is nothing to do. */
  next?: string;
  /** Whether simply trying again makes sense. */
  retryable: boolean;
}

/**
 * The names are checked against the deck ABI rather than written from memory.
 *
 * `NotAShard` and `WrongShardCount` sat here for a long time, errors the contract
 * does not have and never had. They never fired once, and instead the player got
 * a raw "The contract function reverted". Hence the rule: an entry in this table
 * may exist only if `TESSERA_DECK_ABI` knows that name, otherwise it quietly
 * lies about the case being handled.
 */
const BY_NAME: Partial<Record<DeckError, Explained>> = {
  DeckEmpty: {
    fault: "deck-empty",
    title: "This season's pool is fully opened",
    next: "Every slot has been drawn. A new deck starts the next season.",
    retryable: false,
  },
  NoSuchDeck: {
    fault: "no-such-deck",
    title: "There is no such deck",
    next: "Only the decks listed on the cases page exist.",
    retryable: false,
  },
  PurchasingDisabled: {
    fault: "purchasing-disabled",
    title: "Megapot has paused ticket sales",
    next: "Nothing was charged. Sales usually resume within a round.",
    retryable: true,
  },
  TicketNotCredited: {
    fault: "ticket-not-credited",
    title: "The ticket did not land, so nothing was charged",
    next: "The contract refuses to open a case without a real ticket behind it.",
    retryable: true,
  },
  WorthlessSlot: {
    fault: "worthless-slot",
    title: "One of those slots is empty",
    next: "Only slots worth at least 1 TESA can be redeemed. Grout stays on the shelf.",
    retryable: false,
  },
  ShardAlreadySpent: {
    fault: "shard-spent",
    title: "One of those slots is already spent",
    next: "A slot burns when it is redeemed. Pick ones you have not spent.",
    retryable: false,
  },
  TreasuryEmpty: {
    fault: "treasury-empty",
    title: "The game has not earned a ticket yet",
    // "Half of that fee" had stood here since the days when vaults really took
    // half. The share lives on chain (`vaultShareBps`) and is no longer a half;
    // on the live board it is a tenth. Naming it as a number in a static table
    // is wrong in principle: the line would lie the next time the owner changes
    // it. The exact figure is shown by the budget panel, which reads the chain.
    next: "Prizes are funded by the referral fee the game earns, and part of that fee settles into the vaults. Nothing expires, the ticket lands once enough cases have been opened, by anyone.",
    retryable: false,
  },
  BadAttestation: {
    fault: "bad-attestation",
    title: "The covalidator signatures did not verify",
    next: "Reload and try again, the attestation may have gone stale.",
    retryable: true,
  },
  NotEnoughWeight: {
    fault: "not-enough-weight",
    title: "That is not a full ticket's worth yet",
    next: "Five TESA make a ticket. A TESA slot is worth one, a top-tier slot twenty-five.",
    retryable: false,
  },
  BudgetExhausted: {
    fault: "budget-exhausted",
    title: "This season has paid out everything it was built to pay",
    next: "The contract cannot hand out more TESA than its decks were cut with. That ceiling is code, not policy.",
    retryable: false,
  },

  // ── battles ───────────────────────────────────────────────────────────────
  //
  // A card staked in a battle is locked until the resolution: for redemption,
  // for a stake and for the vault alike. The inventory already accounts for
  // that, so a player only reaches here by racing: two tabs, or a battle
  // resolved while they were reading the screen.
  SlotInBattle: {
    fault: "slot-in-battle",
    title: "That card is committed to a battle",
    next: "It comes back the moment the battle is settled, anyone can settle it.",
    retryable: false,
  },
  BattleTaken: {
    fault: "battle-taken",
    title: "Somebody joined that battle first",
    next: "Nothing was charged. Open your own or take another seat.",
    retryable: false,
  },
  BattleGone: {
    fault: "battle-gone",
    title: "That battle is already settled",
    next: "Reload to see how it ended.",
    retryable: false,
  },
  BattleWaiting: {
    fault: "battle-waiting",
    title: "That battle is still waiting for a challenger",
    next: "There is nothing to settle until both cards are on the table.",
    retryable: false,
  },
  NoSuchBattle: {
    fault: "no-such-battle",
    title: "There is no such battle",
    next: "The arena lists every battle that exists.",
    retryable: false,
  },
  CannotFightYourself: {
    fault: "own-battle",
    title: "That seat is yours already",
    next: "Nothing was charged. A battle needs two different wallets.",
    retryable: false,
  },
  NotYourBattle: {
    fault: "not-your-battle",
    title: "Only the player who opened that battle can take the card back",
    retryable: false,
  },
  TooEarlyToAbandon: {
    fault: "too-early",
    title: "The battle can still find a challenger",
    next: "The card comes back once the waiting window runs out.",
    retryable: false,
  },

  // ── stake and vault ───────────────────────────────────────────────────────
  StakeAlreadyOpen: {
    fault: "stake-open",
    title: "You already have a stake riding",
    next: "Your next case decides it. Settle that one before staking again.",
    retryable: false,
  },
  NoStakeOpen: {
    fault: "no-stake",
    title: "Nothing is staked right now",
    retryable: false,
  },
  StakeNotSettled: {
    fault: "stake-unsettled",
    title: "The deciding case is not open yet",
    next: "Open one more case, that is what settles the stake.",
    retryable: false,
  },
  NothingBanked: {
    fault: "nothing-banked",
    title: "There is nothing banked to take",
    retryable: false,
  },
  VaultEmpty: {
    fault: "vault-empty",
    title: "The vault is empty",
    next: "It fills from the referral fee every open earns. Nothing was charged.",
    retryable: false,
  },
  NotTheVault: {
    fault: "not-the-vault",
    title: "That slot is not the vault",
    next: "Exactly one case in the deck opens it, and it is not this one.",
    retryable: false,
  },
  DeckHasNoVault: {
    fault: "no-vault",
    title: "This deck was cut without a vault",
    next: "Decks with a vault say so on the case page.",
    retryable: false,
  },

  // ── other people's ────────────────────────────────────────────────────────
  ClaimFailed: {
    fault: "claim-failed",
    title: "Megapot refused the withdrawal",
    next: "Nothing was charged. The winnings stay claimable, try again in a moment.",
    retryable: true,
  },
  SafeERC20FailedOperation: {
    fault: "token-failed",
    title: "The dollar did not move",
    next: "Nothing was charged. Check the balance and the allowance, then try again.",
    retryable: true,
  },
  // The array lengths disagree, which is our mistake rather than the player's.
  // The only honest thing to say is that the screen is out of date.
  BadTierTable: {
    fault: "stale",
    title: "This page is out of step with the chain",
    next: "Reload and try again.",
    retryable: true,
  },
};

/**
 * Token errors, by selector rather than by name.
 *
 * The game's ABI does not contain them, so viem cannot name them and leaves a
 * raw "0xe450d38c" in the text. And this is the most common refusal of all: the
 * player pressed x10 with less than ten dollars. Showing them a hexadecimal
 * string in red on black is accusing them of doing an ordinary thing.
 */
const TOKEN_ERRORS: Record<string, Explained> = {
  "0xe450d38c": {
    fault: "no-money",
    title: "Not enough dollars for that many cases",
    next: "Nothing was charged. Pick a smaller number, or top up and try again.",
    retryable: true,
  },
  "0xfb8f41b2": {
    fault: "no-allowance",
    title: "The game is not allowed to spend that much yet",
    next: "Nothing was charged. Approve once more and the number will go through.",
    retryable: true,
  },
};

/**
 * A chain error to what is worth showing the player.
 *
 * The distinction that matters is between "nothing happened" and "the money is
 * gone". The contract is built so that any revert rolls the whole transaction
 * back, payment included, so almost everywhere the honest answer is "nothing was
 * charged".
 */
export function explain(err: unknown): Explained {
  if (err instanceof UserRejectedRequestError) {
    return {
      fault: "rejected",
      title: "You dismissed the wallet",
      next: "Nothing was charged.",
      retryable: true,
    };
  }

  if (err instanceof BaseError) {
    const reverted = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError) {
      const known = reverted.data?.errorName
        ? BY_NAME[reverted.data.errorName as DeckError]
        : undefined;
      if (known) return known;
    }

    // viem cannot name token errors: they are declared in ERC-20 rather than in
    // the game's ABI, and the decoder simply has no description for them. What
    // is left is a selector in the text, and this is the most common refusal of
    // all ("not enough dollars"), which must not be shown as a raw "0xe450d38c"
    // in red on black.
    const text0 = err.shortMessage ?? err.message ?? "";
    for (const [sel, explained] of Object.entries(TOKEN_ERRORS)) {
      if (text0.includes(sel)) return explained;
    }

    const text = err.shortMessage ?? err.message;
    if (/User rejected|denied|rejected the request/i.test(text)) {
      return {
        fault: "rejected",
        title: "You dismissed the wallet",
        next: "Nothing was charged.",
        retryable: true,
      };
    }
    if (/insufficient funds|exceeds the balance/i.test(text)) {
      return {
        fault: "no-funds",
        title: "Not enough gas in this wallet",
        next: "Base Sepolia ETH is free from any faucet.",
        retryable: true,
      };
    }
    return { fault: "unknown", title: text, retryable: true };
  }

  if (err instanceof Error) {
    // The second branch is our own: the covalidator answered 200 but without a
    // value, and a minute later still had not produced one. For the player that
    // is the same as silence, so the answer is the same too.
    if (
      /not found, it might not have been processed/i.test(err.message) ||
      /covalidators? (did not|have not)/i.test(err.message)
    ) {
      return {
        fault: "reveal-timeout",
        title: "The covalidators are taking longer than usual",
        next: "Your slot is drawn and paid for. It will show up, nothing is lost.",
        retryable: true,
      };
    }
    return { fault: "unknown", title: err.message, retryable: true };
  }

  return { fault: "unknown", title: "Something went wrong", retryable: true };
}
