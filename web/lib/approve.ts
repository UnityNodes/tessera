"use client";

import { readContract, simulateContract, writeContract, waitForTransactionReceipt } from "wagmi/actions";
import type { Config } from "wagmi";
import { maxUint256 } from "viem";
import { DECK_ADDRESS, TICKET_TOKEN, TOKEN_ABI } from "./chain";

/**
 * A one time approval for the maximum.
 *
 * Deliberately the maximum: an approve transaction per open would mean two
 * signatures for one case, and the whole idea of the game is one click.
 *
 * Then we wait until the approval is actually visible on a read. The public RPC
 * lags 1 to 1.6 seconds behind a write, and without that wait the simulation of
 * the next step would still see the old allowance, which means the first open of
 * every player's life would fail.
 */
export async function approveOnce(config: Config, owner: `0x${string}`, signal?: AbortSignal) {
  const { request } = await simulateContract(config, {
    address: TICKET_TOKEN,
    abi: TOKEN_ABI,
    functionName: "approve",
    args: [DECK_ADDRESS, maxUint256],
    account: owner,
  });
  const hash = await writeContract(config, request);
  await waitForTransactionReceipt(config, { hash });
  await waitForAllowance(config, owner, signal);
}

async function waitForAllowance(config: Config, owner: `0x${string}`, signal?: AbortSignal) {
  for (let i = 0; i < 25; i++) {
    if (signal?.aborted) return;
    const allowance = (await readContract(config, {
      address: TICKET_TOKEN,
      abi: TOKEN_ABI,
      functionName: "allowance",
      args: [owner, DECK_ADDRESS],
    })) as bigint;
    if (allowance > 0n) return;
    await new Promise((r) => setTimeout(r, 300));
  }
}
