// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Script, console} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {TesseraDeck} from "../src/TesseraDeck.sol";
import {MegapotLegacyAdapter} from "../src/adapters/MegapotLegacyAdapter.sol";
import {IMegapot} from "../src/interfaces/IMegapot.sol";
import {IMegapotAdapter} from "../src/interfaces/IMegapotAdapter.sol";

///
///   forge script script/Deploy.s.sol:Deploy \
///     --rpc-url "$BASE_SEPOLIA_RPC_URL" --broadcast
///
///
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

        TesseraDeck impl = new TesseraDeck();

        ERC1967Proxy proxy =
            new ERC1967Proxy(address(impl), abi.encodeCall(TesseraDeck.initialize, (adapter, owner)));

        vm.stopBroadcast();

        console.log("adapter       ", address(adapter));
        console.log("implementation", address(impl));
        console.log("PROXY (DECK_ADDRESS)", address(proxy));
        console.log("owner         ", TesseraDeck(payable(address(proxy))).owner());
    }
}

///
///   forge script script/Deploy.s.sol:DeployImpl \
///     --rpc-url "$BASE_SEPOLIA_RPC_URL" --broadcast
///
///
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

///
///   forge script script/Deploy.s.sol:Upgrade \
///     --rpc-url "$BASE_SEPOLIA_RPC_URL" --broadcast
///
///
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

        require(game.deckCount() == decksBefore, "state lost");

        console.log("implementation", address(impl));
        console.log("decks kept    ", decksBefore);
    }
}
