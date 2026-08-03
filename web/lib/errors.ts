import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError } from "viem";

export type Fault =
  | "rejected"
  | "deck-empty"
  | "purchasing-disabled"
  | "ticket-not-credited"
  | "not-a-shard"
  | "shard-spent"
  | "treasury-empty"
  | "bad-attestation"
  | "wrong-shard-count"
  | "no-funds"
  | "reveal-timeout"
  | "unknown";

export interface Explained {
  fault: Fault;
  title: string;
  next?: string;
  retryable: boolean;
}

const BY_NAME: Record<string, Explained> = {
  DeckEmpty: {
    fault: "deck-empty",
    title: "This season's pool is fully opened",
    next: "Every slot has been drawn. A new deck starts the next season.",
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
  NotAShard: {
    fault: "not-a-shard",
    title: "One of those slots is not a shard",
    next: "Only shards can be redeemed. Cosmetics stay in the inventory.",
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
  WrongShardCount: {
    fault: "wrong-shard-count",
    title: "Redeeming takes exactly five shards",
    retryable: false,
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
      const name = reverted.data?.errorName;
      if (name && BY_NAME[name]) return BY_NAME[name];
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
    if (/not found, it might not have been processed/i.test(err.message)) {
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
