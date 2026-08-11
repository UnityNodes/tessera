// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test, console} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TesseraDeck} from "../src/TesseraDeck.sol";
import {DeployTessera} from "./helpers/DeployTessera.sol";
import {MegapotLegacyAdapter} from "../src/adapters/MegapotLegacyAdapter.sol";
import {IMegapot} from "../src/interfaces/IMegapot.sol";

interface IMintable {
    function mint(address to, uint256 amount) external;
}

contract TesseraDeckForkTest is Test {
    IMegapot constant MEGAPOT = IMegapot(0x6f03c7BCaDAdBf5E6F5900DA3d56AdD8FbDac5De);
    IERC20 constant MPUSDC = IERC20(0xA4253E7C13525287C56550b8708100f93E60509f);

    ///
    uint16 constant DECK = 40;

    TesseraDeck deck;
    MegapotLegacyAdapter adapter;
    address owner = makeAddr("owner");
    address player = makeAddr("player");

    function _ticketsOf(address who) internal view returns (uint256 bps) {
        (bps,,) = MEGAPOT.usersInfo(who);
    }

    function _tiers() internal pure returns (uint16[] memory upTo, uint16[] memory weight) {
        upTo = new uint16[](2);
        weight = new uint16[](2);
        upTo[0] = 1;
        weight[0] = 5; // 1
        upTo[1] = 3;
        weight[1] = 1; // 2-3
    }

    function setUp() public {
        vm.createSelectFork(vm.envOr("BASE_SEPOLIA_RPC_URL", string("https://sepolia.base.org")));

        adapter = new MegapotLegacyAdapter(MEGAPOT);
        deck = DeployTessera.behindProxy(adapter, owner);

        vm.deal(owner, 1 ether);
        uint256 fee = deck.deckFee(DECK);
        vm.prank(owner);
        (uint16[] memory upTo, uint16[] memory weight) = _tiers();
        deck.createDeck{value: fee}(DECK, upTo, weight, 0);

        vm.prank(owner);
        deck.setVaultShare(0);

        IMintable(address(MPUSDC)).mint(player, 100e6);
    }

    function test_deckWasCreated() public view {
        assertEq(deck.deckAt(0).size, DECK);
        assertEq(deck.deckAt(0).drawn, 0);
        assertEq(deck.remaining(0), DECK);
        assertEq(address(deck.ticketToken()), address(MPUSDC));
    }

    function test_openCase_buysRealTicketAndDrawsSlot() public {
        uint256 price = MEGAPOT.ticketPrice();
        (uint256 boughtBefore,,) = MEGAPOT.usersInfo(player);
        uint256 balBefore = MPUSDC.balanceOf(player);

        vm.startPrank(player);
        MPUSDC.approve(address(deck), price);
        uint256 gasBefore = gasleft();
        (uint16 index, bytes32 handle) = deck.openCase(0);
        uint256 gasUsed = gasBefore - gasleft();
        vm.stopPrank();

        (uint256 boughtAfter,,) = MEGAPOT.usersInfo(player);

        assertEq(index, 0, unicode"");
        assertTrue(handle != bytes32(0), unicode"");
        assertEq(deck.deckAt(0).drawn, 1);
        assertEq(deck.remaining(0), DECK - 1);
        assertEq(MPUSDC.balanceOf(player), balBefore - price, unicode"");
        assertGt(boughtAfter, boughtBefore, unicode", ");
        assertEq(MPUSDC.balanceOf(address(deck)), 0, unicode"");

        console.log("openCase gas:", gasUsed);
        console.log("tickets bps for player:", boughtAfter - boughtBefore);
    }

    function test_openCase_accruesReferralFeeToContract() public {
        uint256 price = MEGAPOT.ticketPrice();
        uint256 feeBps = MEGAPOT.referralFeeBps();

        vm.startPrank(player);
        MPUSDC.approve(address(deck), price);
        deck.openCase(0);
        vm.stopPrank();

        uint256 claimable = deck.feesClaimable();
        assertEq(claimable, price * feeBps / 10_000, unicode"10% ");
        console.log("referral claimable:", claimable);
    }

    function test_openCase_selfReferralAccepted() public {
        vm.startPrank(player);
        MPUSDC.approve(address(deck), type(uint256).max);
        deck.openCase(0);
        deck.openCase(0);
        deck.openCase(0);
        vm.stopPrank();

        assertEq(deck.deckAt(0).drawn, 3);
        assertEq(deck.countOf(player), 3);
        assertEq(deck.feesClaimable(), 3 * MEGAPOT.ticketPrice() * MEGAPOT.referralFeeBps() / 10_000);
    }

    function test_openCase_handlesAreDistinct() public {
        vm.startPrank(player);
        MPUSDC.approve(address(deck), type(uint256).max);
        (, bytes32 h0) = deck.openCase(0);
        (, bytes32 h1) = deck.openCase(0);
        (, bytes32 h2) = deck.openCase(0);
        vm.stopPrank();

        assertTrue(h0 != h1 && h1 != h2 && h0 != h2, unicode"");
        assertEq(deck.handleOf(player, 1), h1);
    }

    function test_sweepFees_movesReferralMoneyIntoTreasury() public {
        vm.startPrank(player);
        MPUSDC.approve(address(deck), type(uint256).max);
        deck.openCase(0);
        deck.openCase(0);
        vm.stopPrank();

        uint256 expected = deck.feesClaimable();
        assertEq(expected, 200_000, unicode"= $0.20");
        assertEq(deck.treasury(), 0, unicode"sweep ");

        uint256 claimed = deck.sweepFees();

        assertEq(claimed, expected);
        assertEq(deck.treasury(), expected, unicode"");
        assertEq(deck.feesClaimable(), 0, unicode"Megapot ");
    }

    function test_gas_openCaseWarm() public {
        vm.startPrank(player);
        MPUSDC.approve(address(deck), type(uint256).max);
        deck.openCase(0);
        uint256 g = gasleft();
        deck.openCase(0);
        uint256 warm = g - gasleft();
        vm.stopPrank();
        console.log("openCase gas (warm):", warm);
    }


    ///
    function test_openMany_isExactlyNSeparateOpens() public {
        uint256 ticketsBefore = _ticketsOf(player);
        uint256 balBefore = MPUSDC.balanceOf(player);
        uint256 price = MEGAPOT.ticketPrice();

        vm.startPrank(player);
        MPUSDC.approve(address(deck), type(uint256).max);
        deck.openMany(0, 4);
        vm.stopPrank();

        assertEq(deck.countOf(player), 4, unicode"");
        assertEq(deck.deckAt(0).drawn, 4, unicode"");
        assertEq(balBefore - MPUSDC.balanceOf(player), price * 4, unicode"");
        assertGt(_ticketsOf(player) - ticketsBefore, 0, unicode"");
        assertEq(
            _ticketsOf(player) - ticketsBefore,
            (_ticketsOf(player) - ticketsBefore) / 4 * 4,
            unicode""
        );
    }

    function test_openMany_drawsDistinctSlots() public {
        vm.startPrank(player);
        MPUSDC.approve(address(deck), type(uint256).max);
        deck.openMany(0, 3);
        vm.stopPrank();

        bytes32 a = deck.handleOf(player, 0);
        bytes32 b = deck.handleOf(player, 1);
        bytes32 c = deck.handleOf(player, 2);
        assertTrue(a != b && b != c && a != c, unicode"");
    }

    function test_openMany_refusesZeroAndTooMany() public {
        vm.startPrank(player);
        MPUSDC.approve(address(deck), type(uint256).max);

        vm.expectRevert(abi.encodeWithSelector(TesseraDeck.BadBatch.selector, uint8(0)));
        deck.openMany(0, 0);

        uint8 over = deck.MAX_BATCH() + 1;
        vm.expectRevert(abi.encodeWithSelector(TesseraDeck.BadBatch.selector, over));
        deck.openMany(0, over);
        vm.stopPrank();
    }

    function test_openMany_stopsAtTheEndOfTheDeck() public {
        vm.startPrank(player);
        MPUSDC.approve(address(deck), type(uint256).max);
        for (uint256 i = 0; i < DECK - 2; i++) deck.openCase(0);
        assertEq(deck.remaining(0), 2);

        vm.expectRevert(TesseraDeck.DeckEmpty.selector);
        deck.openMany(0, 3);
        assertEq(deck.remaining(0), 2, unicode"");
        vm.stopPrank();
    }

    function test_openCase_revertsWithoutApproval() public {
        vm.prank(player);
        vm.expectRevert();
        deck.openCase(0);
    }

    function test_openCase_revertsWhenDeckEmpty() public {
        vm.startPrank(player);
        MPUSDC.approve(address(deck), type(uint256).max);
        for (uint256 i = 0; i < DECK; i++) {
            deck.openCase(0);
        }
        assertEq(deck.remaining(0), 0);
        vm.expectRevert(TesseraDeck.DeckEmpty.selector);
        deck.openCase(0);
        vm.stopPrank();
    }

    function test_createDeck_onlyOwner() public {
        vm.deal(player, 1 ether);
        uint256 fee = deck.deckFee(20);
        vm.prank(player);
        vm.expectRevert(TesseraDeck.NotOwner.selector);
        uint16[] memory upTo = new uint16[](1);
        uint16[] memory weight = new uint16[](1);
        upTo[0] = 3;
        weight[0] = 1; // 3 10/2
        deck.createDeck{value: fee}(20, upTo, weight, 0);
    }

    ///
    function test_createDeck_addsAnotherAndLeavesTheFirstAlone() public {
        vm.startPrank(player);
        MPUSDC.approve(address(deck), type(uint256).max);
        deck.openCase(0);
        deck.openCase(0);
        vm.stopPrank();

        uint256 fee = deck.deckFee(20);
        uint16[] memory upTo = new uint16[](1);
        uint16[] memory weight = new uint16[](1);
        upTo[0] = 3;
        weight[0] = 1;
        vm.prank(owner);
        uint32 second = deck.createDeck{value: fee}(20, upTo, weight, 0);

        assertEq(second, 1, unicode", ");
        assertEq(deck.deckCount(), 2);
        assertEq(deck.deckAt(0).size, DECK, unicode"");
        assertEq(deck.deckAt(0).drawn, 2, unicode"'");
        assertEq(deck.deckAt(1).size, 20);
        assertEq(deck.deckAt(1).drawn, 0);
    }

    function test_decks_haveTheirOwnDropTable() public {
        uint256 fee = deck.deckFee(20);
        uint16[] memory upTo = new uint16[](1);
        uint16[] memory weight = new uint16[](1);
        upTo[0] = 3;
        weight[0] = 1;
        vm.prank(owner);
        uint32 second = deck.createDeck{value: fee}(20, upTo, weight, 0);

        assertEq(deck.weightOf(0, 1), 5);
        assertEq(deck.weightOf(second, 1), 1);
    }

    function test_decks_drawIndependently() public {
        uint256 fee = deck.deckFee(20);
        uint16[] memory upTo = new uint16[](1);
        uint16[] memory weight = new uint16[](1);
        upTo[0] = 3;
        weight[0] = 1;
        vm.prank(owner);
        uint32 second = deck.createDeck{value: fee}(20, upTo, weight, 0);

        vm.startPrank(player);
        MPUSDC.approve(address(deck), type(uint256).max);
        deck.openCase(second);
        deck.openCase(second);
        deck.openCase(0);
        vm.stopPrank();

        assertEq(deck.deckAt(0).drawn, 1);
        assertEq(deck.deckAt(second).drawn, 2);
        assertEq(deck.slotDeck(player, 0), second, unicode"'");
        assertEq(deck.slotDeck(player, 2), 0);
    }

    function test_openCase_revertsOnUnknownDeck() public {
        vm.startPrank(player);
        MPUSDC.approve(address(deck), type(uint256).max);
        vm.expectRevert(TesseraDeck.NoSuchDeck.selector);
        deck.openCase(7);
        vm.stopPrank();
    }
}
