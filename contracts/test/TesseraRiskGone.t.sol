// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TesseraDeck} from "../src/TesseraDeck.sol";
import {DeployTessera} from "./helpers/DeployTessera.sol";
import {MegapotLegacyAdapter} from "../src/adapters/MegapotLegacyAdapter.sol";
import {IMegapot} from "../src/interfaces/IMegapot.sol";

interface IMintable {
    function mint(address to, uint256 amount) external;
}

///
///
contract TesseraRiskGoneTest is Test {
    IMegapot constant MEGAPOT = IMegapot(0x6f03c7BCaDAdBf5E6F5900DA3d56AdD8FbDac5De);
    IERC20 constant MPUSDC = IERC20(0xA4253E7C13525287C56550b8708100f93E60509f);

    TesseraDeck deck;
    address owner = makeAddr("owner");
    address player = makeAddr("player");

    function setUp() public {
        vm.createSelectFork(vm.envOr("BASE_SEPOLIA_RPC_URL", string("https://sepolia.base.org")));

        MegapotLegacyAdapter adapter = new MegapotLegacyAdapter(MEGAPOT);
        deck = DeployTessera.behindProxy(adapter, owner);

        vm.deal(owner, 1 ether);
        uint16[] memory upTo = new uint16[](2);
        uint16[] memory weight = new uint16[](2);
        upTo[0] = 1;
        weight[0] = 0;
        upTo[1] = 3;
        weight[1] = 5;

        uint256 fee = deck.deckFee(100);
        vm.prank(owner);
        deck.createDeck{value: fee}(100, upTo, weight, 1);

        IMintable(address(MPUSDC)).mint(player, 100e6);
        vm.prank(player);
        MPUSDC.approve(address(deck), type(uint256).max);
    }

    function test_riskMode_isGone() public {
        (bool ok,) = address(deck).call(abi.encodeWithSelector(0xb9f33c84, uint32(0)));
        assertFalse(ok, unicode"");
    }

    function test_ordinaryOpenStillWorks() public {
        vm.prank(player);
        deck.openCase(0);
        assertEq(deck.countOf(player), 1, unicode"");
        assertFalse(deck.slotIsRisk(player, 0), unicode"");
    }

    ///
    function test_vaultStillExists() public view {
        assertGt(deck.deckAt(0).vaultUpTo, 0, unicode"");
    }
}
