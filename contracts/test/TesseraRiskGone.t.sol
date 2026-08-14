// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TesseraDeck} from "../src/TesseraDeck.sol";
import {DeployTessera} from "./helpers/DeployTessera.sol";
import {MegapotLegacyAdapter} from "../src/adapters/MegapotLegacyAdapter.sol";
import {IMegapot} from "../src/interfaces/IMegapot.sol";
import {Fork} from "./helpers/Fork.sol";

interface IMintable {
    function mint(address to, uint256 amount) external;
}

/// The "give up your ticket" mode has been removed from the game.
///
/// It offered to open a case without a Megapot ticket: the dollar went into the
/// deck vault and the slot weighed double. Removed at the owner's request, the
/// button stood on every deck and yet with a multiplier it opened a single case
/// all the same, and there is no way to explain that discrepancy.
///
/// What is checked here is the ABSENCE: the old selector is no longer accepted.
/// The check is needed because a removed function is easy to bring back by
/// accident, through a branch merge, a file revert, a careless refactor, and no
/// other check would say a word about it.
contract TesseraRiskGoneTest is Test {
    IMegapot constant MEGAPOT = IMegapot(0x6f03c7BCaDAdBf5E6F5900DA3d56AdD8FbDac5De);
    IERC20 constant MPUSDC = IERC20(0xA4253E7C13525287C56550b8708100f93E60509f);

    TesseraDeck deck;
    address owner = makeAddr("owner");
    address player = makeAddr("player");

    function setUp() public {
        vm.createSelectFork(vm.envOr("BASE_SEPOLIA_RPC_URL", Fork.BASE_SEPOLIA));

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

    /// The old openRisk(uint32) selector can no longer be called.
    function test_riskMode_isGone() public {
        // 0xb9f33c84 is the openRisk(uint32) selector from the old build.
        (bool ok,) = address(deck).call(abi.encodeWithSelector(0xb9f33c84, uint32(0)));
        assertFalse(ok, "the give up the ticket mode has to be removed");
    }

    /// An ordinary open did not suffer from it.
    function test_ordinaryOpenStillWorks() public {
        vm.prank(player);
        deck.openCase(0);
        assertEq(deck.countOf(player), 1, "a case opens as always");
        assertFalse(deck.slotIsRisk(player, 0), "and the slot is not marked as risked");
    }

    /// The deck vault stays where it was, filled by the commission.
    ///
    /// This is what removing the mode REALLY changes: until now the vault also
    /// grew from the dollars of those who gave up their ticket. Now there is one
    /// source.
    function test_vaultStillExists() public view {
        assertGt(deck.deckAt(0).vaultUpTo, 0, "the deck's vault went nowhere");
    }
}
