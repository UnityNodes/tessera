import { createPublicClient } from "viem";
import { TESSERA_DECK_ABI } from "@/lib/abi";
import { CHAIN, chainTransport, DECK_ADDRESS } from "@/lib/chain";

const client = createPublicClient({ chain: CHAIN, transport: chainTransport() });

/**
 * Whether this really is the contract's owner.
 *
 * The owner is read from the CHAIN every time rather than from a config: the
 * right to moderate travels with transferOwnership, and a list in a file would
 * fall silently out of date.
 *
 * The signature is verified by a chain client rather than viem's pure function,
 * and that is not pedantry: the owner here is an EIP-7702 wallet, that is, an
 * address with delegated code. Those sign sometimes with plain ECDSA and
 * sometimes through ERC-1271, and the pure verifyMessage knows only the first
 * way. The client knows both.
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
