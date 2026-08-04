"use client";

import { readContract, simulateContract, writeContract, waitForTransactionReceipt } from "wagmi/actions";
import type { Config } from "wagmi";
import { maxUint256 } from "viem";
import { DECK_ADDRESS, TICKET_TOKEN, TOKEN_ABI } from "./chain";

/**
 *
 *
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
