import { createPublicClient } from "viem";
import { TESSERA_DECK_ABI } from "@/lib/abi";
import { CHAIN, chainTransport, DECK_ADDRESS } from "@/lib/chain";

const client = createPublicClient({ chain: CHAIN, transport: chainTransport() });

/**
 *
 *
 */
export async function isOwner(address: string, message: string, signature: string) {
  const owner = (await client.readContract({
    address: DECK_ADDRESS,
    abi: TESSERA_DECK_ABI,
    functionName: "owner",
  })) as `0x${string}`;

  if (address.toLowerCase() !== owner.toLowerCase()) return false;

  return client
    .verifyMessage({
      address: owner,
      message,
      signature: signature as `0x${string}`,
    })
    .catch(() => false);
}
