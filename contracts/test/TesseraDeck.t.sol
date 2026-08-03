// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test, console} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TesseraDeck} from "../src/TesseraDeck.sol";
import {MegapotLegacyAdapter} from "../src/adapters/MegapotLegacyAdapter.sol";
import {IMegapot} from "../src/interfaces/IMegapot.sol";

interface IMintable {
    function mint(address to, uint256 amount) external;
}

contract TesseraDeckForkTest is Test {
    IMegapot constant MEGAPOT = IMegapot(0x6f03c7BCaDAdBf5E6F5900DA3d56AdD8FbDac5De);
    IERC20 constant MPUSDC = IERC20(0xA4253E7C13525287C56550b8708100f93E60509f);

    TesseraDeck deck;
    MegapotLegacyAdapter adapter;
    address owner = makeAddr("owner");
    address player = makeAddr("player");

    function setUp() public {
        vm.createSelectFork(vm.envOr("BASE_SEPOLIA_RPC_URL", string("https://sepolia.base.org")));

        adapter = new MegapotLegacyAdapter(MEGAPOT);
        vm.prank(owner);
        deck = new TesseraDeck(adapter);

        vm.deal(owner, 1 ether);
        uint256 fee = deck.deckFee(20);
        vm.prank(owner);
        deck.createDeck{value: fee}(20, 8);

        IMintable(address(MPUSDC)).mint(player, 100e6);
    }

    function test_deckWasCreated() public view {
        assertEq(deck.size(), 20);
        assertEq(deck.drawn(), 0);
        assertEq(deck.remaining(), 20);
        assertEq(address(deck.ticketToken()), address(MPUSDC));
    }

    function test_openCase_buysRealTicketAndDrawsSlot() public {
        uint256 price = MEGAPOT.ticketPrice();
        (uint256 boughtBefore,,) = MEGAPOT.usersInfo(player);
        uint256 balBefore = MPUSDC.balanceOf(player);

        vm.startPrank(player);
        MPUSDC.approve(address(deck), price);
        uint256 gasBefore = gasleft();
        (uint16 index, bytes32 handle) = deck.openCase();
        uint256 gasUsed = gasBefore - gasleft();
        vm.stopPrank();

        (uint256 boughtAfter,,) = MEGAPOT.usersInfo(player);

        assertEq(index, 0, unicode"");
        assertTrue(handle != bytes32(0), unicode"");
        assertEq(deck.drawn(), 1);
        assertEq(deck.remaining(), 19);
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
        deck.openCase();
        vm.stopPrank();

        uint256 claimable = deck.feesClaimable();
        assertEq(claimable, price * feeBps / 10_000, unicode"10% ");
        console.log("referral claimable:", claimable);
    }

    function test_openCase_selfReferralAccepted() public {
        vm.startPrank(player);
        MPUSDC.approve(address(deck), type(uint256).max);
        deck.openCase();
        deck.openCase();
        deck.openCase();
        vm.stopPrank();

        assertEq(deck.drawn(), 3);
        assertEq(deck.countOf(player), 3);
        assertEq(deck.feesClaimable(), 3 * MEGAPOT.ticketPrice() * MEGAPOT.referralFeeBps() / 10_000);
    }

    function test_openCase_handlesAreDistinct() public {
        vm.startPrank(player);
        MPUSDC.approve(address(deck), type(uint256).max);
        (, bytes32 h0) = deck.openCase();
        (, bytes32 h1) = deck.openCase();
        (, bytes32 h2) = deck.openCase();
        vm.stopPrank();

        assertTrue(h0 != h1 && h1 != h2 && h0 != h2, unicode"");
        assertEq(deck.handleOf(player, 1), h1);
    }

    function test_sweepFees_movesReferralMoneyIntoTreasury() public {
        vm.startPrank(player);
        MPUSDC.approve(address(deck), type(uint256).max);
        deck.openCase();
        deck.openCase();
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
        deck.openCase();
        uint256 g = gasleft();
        deck.openCase();
        uint256 warm = g - gasleft();
        vm.stopPrank();
        console.log("openCase gas (warm):", warm);
    }

    function test_openCase_revertsWithoutApproval() public {
        vm.prank(player);
        vm.expectRevert();
        deck.openCase();
    }

    function test_openCase_revertsWhenDeckEmpty() public {
        vm.startPrank(player);
        MPUSDC.approve(address(deck), type(uint256).max);
        for (uint256 i = 0; i < 20; i++) {
            deck.openCase();
        }
        assertEq(deck.remaining(), 0);
        vm.expectRevert(TesseraDeck.DeckEmpty.selector);
        deck.openCase();
        vm.stopPrank();
    }

    function test_createDeck_onlyOwner() public {
        vm.deal(player, 1 ether);
        uint256 fee = deck.deckFee(10);
        vm.prank(player);
        vm.expectRevert(TesseraDeck.NotOwner.selector);
        deck.createDeck{value: fee}(10, 4);
    }

    function test_createDeck_revertsWhileDeckInPlay() public {
        uint256 fee = deck.deckFee(10);
        vm.prank(owner);
        vm.expectRevert(TesseraDeck.DeckInPlay.selector);
        deck.createDeck{value: fee}(10, 4);
    }

    function test_createDeck_allowedAfterDeckExhausted() public {
        vm.startPrank(player);
        MPUSDC.approve(address(deck), type(uint256).max);
        for (uint256 i = 0; i < 20; i++) {
            deck.openCase();
        }
        vm.stopPrank();

        uint256 fee = deck.deckFee(10);
        vm.prank(owner);
        deck.createDeck{value: fee}(10, 4);
        assertEq(deck.size(), 10);
        assertEq(deck.drawn(), 0);
    }
}
