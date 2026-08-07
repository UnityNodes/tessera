import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError } from "viem";
import type { TESSERA_DECK_ABI } from "@/lib/abi";

/**
 *
 *
 */
type DeckError = Extract<(typeof TESSERA_DECK_ABI)[number], { type: "error" }>["name"];

export type Fault =
  | "rejected"
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
  title: string;
  next?: string;
  retryable: boolean;
}

/**
 *
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
    next: "Only slots that carry weight can be redeemed. Grout stays in the inventory.",
    retryable: false,
  },
  ShardAlreadySpent: {
    fault: "shard-spent",
    title: "One of those shards is already spent",
    next: "A shard burns when redeemed. Pick five unspent ones.",
    retryable: false,
  },
  TreasuryEmpty: {
    fault: "treasury-empty",
    title: "The game has not earned a ticket yet",
    next: "Prizes come out of referral fees. It takes ten opens to fund one ticket.",
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
    next: "Five weight makes a ticket. A shard is one, a top-tier slot is twenty-five.",
    retryable: false,
  },
  BudgetExhausted: {
    fault: "budget-exhausted",
    title: "This season has paid out everything it was built to pay",
    next: "The contract cannot hand out more weight than its decks were cut with. That ceiling is code, not policy.",
    retryable: false,
  },

  //
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
  BadTierTable: {
    fault: "stale",
    title: "This page is out of step with the chain",
    next: "Reload and try again.",
    retryable: true,
  },
};

/**
 *
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
