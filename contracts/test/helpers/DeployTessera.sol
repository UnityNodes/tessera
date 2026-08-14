// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {TesseraDeck} from "../../src/TesseraDeck.sol";
import {IMegapotAdapter} from "../../src/interfaces/IMegapotAdapter.sol";

/// Bring the game up the same way it comes up on the network.
///
/// The tests go through the proxy rather than straight at the implementation,
/// otherwise they would be checking a contract that does not exist on the network,
/// and the most expensive mistake (a value set in the constructor that never
/// reaches the proxy storage) would stay invisible right up to the deploy.
library DeployTessera {
    function behindProxy(IMegapotAdapter adapter, address owner) internal returns (TesseraDeck) {
        TesseraDeck impl = new TesseraDeck();
        ERC1967Proxy proxy =
            new ERC1967Proxy(address(impl), abi.encodeCall(TesseraDeck.initialize, (adapter, owner)));
        return TesseraDeck(payable(address(proxy)));
    }
}
