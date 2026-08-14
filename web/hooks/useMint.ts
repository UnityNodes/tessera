"use client";

import { useState } from "react";
import { useAccount, useConfig } from "wagmi";
import { writeContract, waitForTransactionReceipt } from "wagmi/actions";
import { TICKET_TOKEN, TOKEN_ABI } from "@/lib/chain";

/**
 * The test dollar faucet.
 *
 * The network is a testnet, the coin mints free and by anyone, and without it
 * nobody plays. It lives in its own hook because the faucet hangs in two places:
 * the plus beside the balance in the header, and the wallet menu.
 */
export function useMint(onMinted?: () => void) {
  const { address } = useAccount();
  const config = useConfig();
  const [minting, setMinting] = useState(false);

  const mint = async () => {
    if (!address || minting) return;
    setMinting(true);
    try {
      const hash = await writeContract(config, {
        address: TICKET_TOKEN,
        abi: TOKEN_ABI,
        functionName: "mint",
        args: [address, 20_000_000n],
      });
      await waitForTransactionReceipt(config, { hash });
      onMinted?.();
    } finally {
      setMinting(false);
    }
  };

  return { mint, minting, canMint: Boolean(address) };
}
