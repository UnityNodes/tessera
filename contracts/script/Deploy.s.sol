// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Script, console} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {TesseraDeck} from "../src/TesseraDeck.sol";
import {MegapotLegacyAdapter} from "../src/adapters/MegapotLegacyAdapter.sol";
import {IMegapot} from "../src/interfaces/IMegapot.sol";
import {IMegapotAdapter} from "../src/interfaces/IMegapotAdapter.sol";

/// The first and last deploy of the game.
///
///   forge script script/Deploy.s.sol:Deploy \
///     --rpc-url "$BASE_SEPOLIA_RPC_URL" --broadcast
///
/// After this only the logic changes, see Upgrade below. The address the site
/// knows never changes again: it is the address of the PROXY.
///
/// Variables: DEPLOYER_PRIVATE_KEY, OWNER (who owns the game), MEGAPOT,
/// ADAPTER (optional, otherwise we bring up a new one).
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address owner = vm.envAddress("OWNER");
        address megapot = vm.envAddress("MEGAPOT");
        address existingAdapter = vm.envOr("ADAPTER", address(0));

        vm.startBroadcast(pk);

        IMegapotAdapter adapter = existingAdapter != address(0)
            ? IMegapotAdapter(existingAdapter)
            : IMegapotAdapter(address(new MegapotLegacyAdapter(IMegapot(megapot))));

        // The implementation is code only. It holds neither money nor slots, so
        // its address does not have to be written down anywhere.
        TesseraDeck impl = new TesseraDeck();

        // Initialisation happens IN THE SAME transaction as the proxy creation.
        // As a separate call, somebody else's wallet could get in first and
        // become the owner of the game between the two transactions.
        ERC1967Proxy proxy =
            new ERC1967Proxy(address(impl), abi.encodeCall(TesseraDeck.initialize, (adapter, owner)));

        vm.stopBroadcast();

        console.log("adapter       ", address(adapter));
        console.log("implementation", address(impl));
        console.log("PROXY (DECK_ADDRESS)", address(proxy));
        console.log("owner         ", TesseraDeck(payable(address(proxy))).owner());
    }
}

/// Deploy a new implementation and show what the OWNER has to sign.
///
///   forge script script/Deploy.s.sol:DeployImpl \
///     --rpc-url "$BASE_SEPOLIA_RPC_URL" --broadcast
///
/// Needed because the wallet that deploys and the wallet that owns the game are
/// not the same: the right to upgrade deliberately follows ownership. Anyone can
/// deploy an implementation, it is code only, with no money and no slots; only
/// the owner can switch the game onto it, and it is their signature that is
/// prepared here.
///
/// Variables: DEPLOYER_PRIVATE_KEY, PROXY.
contract DeployImpl is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address payable proxy = payable(vm.envAddress("PROXY"));

        vm.startBroadcast(pk);
        TesseraDeck impl = new TesseraDeck();
        vm.stopBroadcast();

        console.log("implementation", address(impl));
        console.log("owner must call upgradeToAndCall on", proxy);
        console.log("to    ", proxy);
        console.logBytes(
            abi.encodeWithSignature("upgradeToAndCall(address,bytes)", address(impl), "")
        );
    }
}

/// Changing the rules of the game. The board stays where it is.
///
///   forge script script/Deploy.s.sol:Upgrade \
///     --rpc-url "$BASE_SEPOLIA_RPC_URL" --broadcast
///
/// Variables: DEPLOYER_PRIVATE_KEY (the OWNER's wallet), PROXY.
///
/// Before every upgrade: in a new implementation storage fields may only be
/// APPENDED at the end. A reordered or deleted field will not revert, it will
/// quietly start reading somebody else's bytes of already sold slots.
contract Upgrade is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address payable proxy = payable(vm.envAddress("PROXY"));

        TesseraDeck game = TesseraDeck(proxy);
        uint256 decksBefore = game.deckCount();

        vm.startBroadcast(pk);
        TesseraDeck impl = new TesseraDeck();
        game.upgradeToAndCall(address(impl), "");
        vm.stopBroadcast();

        // The cheapest check that the storage is in place: the decks have not
        // gone anywhere. If we had accidentally deployed a proxy instead of an
        // upgrade, this would be zero.
        require(game.deckCount() == decksBefore, "state lost");

        console.log("implementation", address(impl));
        console.log("decks kept    ", decksBefore);
    }
}
