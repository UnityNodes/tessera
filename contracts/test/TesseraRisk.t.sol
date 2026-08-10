// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {inco} from "@inco/lightning/src/Lib.sol";
import {TesseraDeck} from "../src/TesseraDeck.sol";
import {DeployTessera} from "./helpers/DeployTessera.sol";
import {MegapotLegacyAdapter} from "../src/adapters/MegapotLegacyAdapter.sol";
import {IMegapot} from "../src/interfaces/IMegapot.sol";

interface IMintable {
    function mint(address to, uint256 amount) external;
}

///
contract TesseraRiskTest is Test {
    IMegapot constant MEGAPOT = IMegapot(0x6f03c7BCaDAdBf5E6F5900DA3d56AdD8FbDac5De);
    IERC20 constant MPUSDC = IERC20(0xA4253E7C13525287C56550b8708100f93E60509f);

    uint16 constant DECK = 40;
    uint16 constant SHARD_MAX = 11;

    TesseraDeck deck;
    address owner = makeAddr("owner");
    address player = makeAddr("player");
    address verifier;

    function setUp() public {
        vm.createSelectFork(vm.envOr("BASE_SEPOLIA_RPC_URL", string("https://sepolia.base.org")));

        MegapotLegacyAdapter adapter = new MegapotLegacyAdapter(MEGAPOT);
        deck = DeployTessera.behindProxy(adapter, owner);

        vm.deal(owner, 1 ether);
        uint256 fee = deck.deckFee(DECK);

        uint16[] memory upTo = new uint16[](2);
        uint16[] memory weight = new uint16[](2);
        upTo[0] = 1;
        weight[0] = 0;
        upTo[1] = SHARD_MAX;
        weight[1] = 1;
        vm.prank(owner);
        deck.createDeck{value: fee}(DECK, upTo, weight, 1);

        IMintable(address(MPUSDC)).mint(player, 1000e6);
        verifier = address(inco.incoVerifier());
    }

    function _attest(bool valid) internal {
        vm.mockCall(
            verifier,
            abi.encodeWithSignature("isValidDecryptionAttestation((bytes32,bytes32),bytes[])"),
            abi.encode(valid)
        );
    }

    function _risk(uint256 n) internal {
        vm.startPrank(player);
        MPUSDC.approve(address(deck), type(uint256).max);
        for (uint256 i = 0; i < n; i++) {
            deck.openRisk(0);
        }
        vm.stopPrank();
    }

    function _open(uint256 n) internal {
        vm.startPrank(player);
        MPUSDC.approve(address(deck), type(uint256).max);
        for (uint256 i = 0; i < n; i++) {
            deck.openCase(0);
        }
        vm.stopPrank();
    }

    function _one(uint256 index, uint256 value)
        internal
        pure
        returns (uint256[] memory idx, uint256[] memory vals, bytes[][] memory sigs)
    {
        idx = new uint256[](1);
        vals = new uint256[](1);
        sigs = new bytes[][](1);
        idx[0] = index;
        vals[0] = value;
        sigs[0] = new bytes[](2);
    }


    function test_risk_buysNoTicket() public {
        (uint256 before,,) = MEGAPOT.usersInfo(player);
        _risk(1);
        (uint256 afterOpen,,) = MEGAPOT.usersInfo(player);
        assertEq(afterOpen, before, unicode"");
    }

    function test_risk_dollarSplitsBetweenVaultAndTreasury() public {
        uint256 price = MEGAPOT.ticketPrice();
        uint256 keep = price / deck.WEIGHT_PER_TICKET();

        _risk(1);

        assertEq(deck.vaultOf(0), price - keep, unicode"'");
        assertEq(deck.treasury(), keep, unicode"");
        assertEq(MPUSDC.balanceOf(address(deck)), price, unicode"");
    }

    function test_risk_budgetGrowsByExactlyOneWeight() public {
        uint256 before = deck.budgetWeight();
        _risk(3);
        assertEq(deck.budgetWeight(), before + 3, unicode"");
    }

    function test_risk_doesNotClaimShareOfOtherDecksFees() public {
        _risk(4);
        assertEq(deck.unsweptOpens(), 0, unicode"");
        _open(1);
        assertEq(deck.unsweptOpens(), 1, unicode"");
    }

    function test_risk_revertsOnDeckWithoutVault() public {
        uint16[] memory upTo = new uint16[](1);
        uint16[] memory weight = new uint16[](1);
        upTo[0] = 10;
        weight[0] = 1;
        vm.deal(owner, 1 ether);
        uint256 fee = deck.deckFee(DECK);
        vm.prank(owner);
        deck.createDeck{value: fee}(DECK, upTo, weight, 0);

        vm.startPrank(player);
        MPUSDC.approve(address(deck), type(uint256).max);
        vm.expectRevert(TesseraDeck.DeckHasNoVault.selector);
        deck.openRisk(1);
        vm.stopPrank();
    }


    function test_risk_slotWeighsDouble() public {
        _risk(1);
        _open(1);

        assertTrue(deck.slotIsRisk(player, 0), unicode"");
        assertFalse(deck.slotIsRisk(player, 1), unicode"");
        assertEq(deck.weightOfSlot(player, 0, 5), 2, unicode"");
        assertEq(deck.weightOfSlot(player, 1, 5), 1, unicode"");
    }

    function test_risk_emptySlotStaysEmpty() public {
        _risk(1);
        assertEq(deck.weightOfSlot(player, 0, SHARD_MAX + 1), 0, unicode"");

        _attest(true);
        (uint256[] memory idx, uint256[] memory vals, bytes[][] memory sigs) =
            _one(0, SHARD_MAX + 1);
        bytes32 handle = deck.handleOf(player, 0);

        vm.prank(player);
        vm.expectRevert(
            abi.encodeWithSelector(TesseraDeck.WorthlessSlot.selector, handle, SHARD_MAX + 1)
        );
        deck.redeem(idx, vals, sigs);
    }

    ///
    function test_risk_doubledWeightPaysRealTicket() public {
        _open(20);
        _risk(3);
        _attest(true);

        uint256[] memory idx = new uint256[](3);
        uint256[] memory vals = new uint256[](3);
        bytes[][] memory sigs = new bytes[][](3);
        for (uint256 i = 0; i < 3; i++) {
            idx[i] = 20 + i;
            vals[i] = 2 + i; // ,
            sigs[i] = new bytes[](2);
        }

        (uint256 boughtBefore,,) = MEGAPOT.usersInfo(player);
        vm.prank(player);
        (uint256 tickets, uint256 paid) = deck.redeem(idx, vals, sigs);
        (uint256 boughtAfter,,) = MEGAPOT.usersInfo(player);

        assertEq(tickets, 1, unicode", ");
        assertEq(paid, MEGAPOT.ticketPrice());
        assertGt(boughtAfter, boughtBefore, unicode"");
    }


    ///
    function test_risk_cannotDrainBudgetBeyondWhatItAdded() public {
        uint256 budgetBefore = deck.budgetWeight();
        _risk(10);
        assertEq(deck.budgetWeight(), budgetBefore + 10);

        assertEq(deck.budgetLeft(), budgetBefore + 10, unicode"");

        assertEq(deck.treasury(), 10 * (MEGAPOT.ticketPrice() / deck.WEIGHT_PER_TICKET()));
    }

    function test_risk_vaultGoesToWhoeverOpensIt() public {
        uint256 price = MEGAPOT.ticketPrice();
        _risk(5);
        _attest(true);

        uint256 grown = 5 * (price - price / deck.WEIGHT_PER_TICKET());
        assertEq(deck.vaultOf(0), grown, unicode"'");

        uint256 before = MPUSDC.balanceOf(player);
        bytes[] memory sigs = new bytes[](2);
        vm.prank(player);
        uint256 paid = deck.claimVault(0, 1, sigs); // 1

        assertEq(paid, grown, unicode", ");
        assertEq(MPUSDC.balanceOf(player) - before, grown);
        assertEq(deck.vaultOf(0), 0);
    }
}
