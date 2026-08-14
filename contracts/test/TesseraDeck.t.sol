// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test, console} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TesseraDeck} from "../src/TesseraDeck.sol";
import {DeployTessera} from "./helpers/DeployTessera.sol";
import {MegapotLegacyAdapter} from "../src/adapters/MegapotLegacyAdapter.sol";
import {IMegapot} from "../src/interfaces/IMegapot.sol";
import {Fork} from "./helpers/Fork.sol";

interface IMintable {
    function mint(address to, uint256 amount) external;
}

/// A Base Sepolia fork. We run against the real Megapot and Inco and mock
/// nothing, which is exactly where divergences from the documentation are caught.
contract TesseraDeckForkTest is Test {
    IMegapot constant MEGAPOT = IMegapot(0x6f03c7BCaDAdBf5E6F5900DA3d56AdD8FbDac5De);
    IERC20 constant MPUSDC = IERC20(0xA4253E7C13525287C56550b8708100f93E60509f);

    /// The size of the test deck.
    ///
    /// The weight of the table is 7 (a ticket plus two shards), and the break even
    /// limit counts only the treasury share of the commission: with the vault at
    /// half, the deck has to be at least four times heavier than its own weight.
    /// The numbers below are expressed through this constant on purpose,
    /// otherwise changing the size breaks half the file silently.
    uint16 constant DECK = 40;

    TesseraDeck deck;
    MegapotLegacyAdapter adapter;
    address owner = makeAddr("owner");
    address player = makeAddr("player");

    /// The drop table for the tests: one slot for a ticket, two shards.
    function _ticketsOf(address who) internal view returns (uint256 bps) {
        (bps,,) = MEGAPOT.usersInfo(who);
    }

    function _tiers() internal pure returns (uint16[] memory upTo, uint16[] memory weight) {
        upTo = new uint16[](2);
        weight = new uint16[](2);
        upTo[0] = 1;
        weight[0] = 5; // slot 1 is a whole ticket
        upTo[1] = 3;
        weight[1] = 1; // slots 2 and 3 are shards
    }

    function setUp() public {
        vm.createSelectFork(vm.envOr("BASE_SEPOLIA_RPC_URL", Fork.BASE_SEPOLIA));

        adapter = new MegapotLegacyAdapter(MEGAPOT);
        deck = DeployTessera.behindProxy(adapter, owner);

        vm.deal(owner, 1 ether);
        // deckFee() is a call too, so we compute it BEFORE vm.prank, otherwise
        // the prank is eaten on it and createDeck goes from the test.
        uint256 fee = deck.deckFee(DECK);
        vm.prank(owner);
        (uint16[] memory upTo, uint16[] memory weight) = _tiers();
        deck.createDeck{value: fee}(DECK, upTo, weight, 0);

        // These tests are about ordinary prizes, so the vault is switched off
        // explicitly: otherwise half the commission would go past them and the
        // arithmetic would drift.
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

    /// The project's main claim: a ticket and a case in one transaction.
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

        assertEq(index, 0, "the first slot");
        assertTrue(handle != bytes32(0), "the handle is empty");
        assertEq(deck.deckAt(0).drawn, 1);
        assertEq(deck.remaining(0), DECK - 1);
        assertEq(MPUSDC.balanceOf(player), balBefore - price, "exactly the ticket price was charged to the player");
        assertGt(boughtAfter, boughtBefore, "the ticket is recorded to the player, not to the contract");
        assertEq(MPUSDC.balanceOf(address(deck)), 0, "the contract does not hold the player's money");

        console.log("openCase gas:", gasUsed);
        console.log("tickets bps for player:", boughtAfter - boughtBefore);
    }

    /// The referral commission has to be credited to the contract itself,
    /// this is what funds the prizes.
    function test_openCase_accruesReferralFeeToContract() public {
        uint256 price = MEGAPOT.ticketPrice();
        uint256 feeBps = MEGAPOT.referralFeeBps();

        vm.startPrank(player);
        MPUSDC.approve(address(deck), price);
        deck.openCase(0);
        vm.stopPrank();

        uint256 claimable = deck.feesClaimable();
        assertEq(claimable, price * feeBps / 10_000, "10% of the dollar");
        console.log("referral claimable:", claimable);
    }

    /// A ticket writes itself as its own referrer, and Megapot must not forbid
    /// that. If it ever does, the test fails here rather than in production.
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

    /// Every open has to hand over its own handle, otherwise the pool is not finite.
    function test_openCase_handlesAreDistinct() public {
        vm.startPrank(player);
        MPUSDC.approve(address(deck), type(uint256).max);
        (, bytes32 h0) = deck.openCase(0);
        (, bytes32 h1) = deck.openCase(0);
        (, bytes32 h2) = deck.openCase(0);
        vm.stopPrank();

        assertTrue(h0 != h1 && h1 != h2 && h0 != h2, "the handles repeated");
        assertEq(deck.handleOf(player, 1), h1);
    }

    /// The commission has to actually reach the treasury rather than merely be counted.
    function test_sweepFees_movesReferralMoneyIntoTreasury() public {
        vm.startPrank(player);
        MPUSDC.approve(address(deck), type(uint256).max);
        deck.openCase(0);
        deck.openCase(0);
        vm.stopPrank();

        uint256 expected = deck.feesClaimable();
        assertEq(expected, 200_000, "two opens equal $0.20");
        assertEq(deck.treasury(), 0, "before the sweep the treasury is empty");

        uint256 claimed = deck.sweepFees();

        assertEq(claimed, expected);
        assertEq(deck.treasury(), expected, "the money sits on the contract");
        assertEq(deck.feesClaimable(), 0, "Megapot owes nothing more");
    }

    /// What an open costs after the stores are warm, the figure for the README.
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

    // -- batch opening -----------------------------------------------------------

    /// Ten cases in one transaction are the same ten opens.
    ///
    /// What is checked is not "the function exists" but that the batch cuts
    /// nothing: as many slots, as many tickets, as much taken out of the deck. The
    /// temptation to make a batch cheaper than ten separate opens is the
    /// temptation to sell ten cases and buy fewer tickets.
    function test_openMany_isExactlyNSeparateOpens() public {
        uint256 ticketsBefore = _ticketsOf(player);
        uint256 balBefore = MPUSDC.balanceOf(player);
        uint256 price = MEGAPOT.ticketPrice();

        vm.startPrank(player);
        MPUSDC.approve(address(deck), type(uint256).max);
        deck.openMany(0, 4);
        vm.stopPrank();

        assertEq(deck.countOf(player), 4, "four slots");
        assertEq(deck.deckAt(0).drawn, 4, "four left the deck");
        assertEq(balBefore - MPUSDC.balanceOf(player), price * 4, "paid for four");
        assertGt(_ticketsOf(player) - ticketsBefore, 0, "the tickets are bought");
        assertEq(
            _ticketsOf(player) - ticketsBefore,
            (_ticketsOf(player) - ticketsBefore) / 4 * 4,
            "exactly a multiple of four"
        );
    }

    /// The slots in a batch differ, rather than being one and the same four times.
    function test_openMany_drawsDistinctSlots() public {
        vm.startPrank(player);
        MPUSDC.approve(address(deck), type(uint256).max);
        deck.openMany(0, 3);
        vm.stopPrank();

        bytes32 a = deck.handleOf(player, 0);
        bytes32 b = deck.handleOf(player, 1);
        bytes32 c = deck.handleOf(player, 2);
        assertTrue(a != b && b != c && a != c, "three different cards");
    }

    /// Zero and above the ceiling: a refusal rather than silent behaviour.
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

    /// A batch runs into the deck's limit rather than drawing extra.
    function test_openMany_stopsAtTheEndOfTheDeck() public {
        vm.startPrank(player);
        MPUSDC.approve(address(deck), type(uint256).max);
        for (uint256 i = 0; i < DECK - 2; i++) deck.openCase(0);
        assertEq(deck.remaining(0), 2);

        // We ask for more than is left, and the whole transaction has to roll back.
        vm.expectRevert(TesseraDeck.DeckEmpty.selector);
        deck.openMany(0, 3);
        assertEq(deck.remaining(0), 2, "nothing has been drawn");
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
        weight[0] = 1; // weight 3 against a limit of 10/2
        deck.createDeck{value: fee}(20, upTo, weight, 0);
    }

    /// A new deck does not touch the old one.
    ///
    /// The rule used to be weaker: reshuffling was allowed, but only after the old
    /// deck was exhausted. Now a deck cannot be reshuffled at all, it only ends,
    /// and a new one stands beside it. The pool players paid into stays the same
    /// one to the last slot.
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

        assertEq(second, 1, "the second deck stood beside it rather than in its place");
        assertEq(deck.deckCount(), 2);
        assertEq(deck.deckAt(0).size, DECK, "the first one did not change");
        assertEq(deck.deckAt(0).drawn, 2, "and remembers its own opens");
        assertEq(deck.deckAt(1).size, 20);
        assertEq(deck.deckAt(1).drawn, 0);
    }

    /// Every deck judges its own slots only.
    function test_decks_haveTheirOwnDropTable() public {
        uint256 fee = deck.deckFee(20);
        uint16[] memory upTo = new uint16[](1);
        uint16[] memory weight = new uint16[](1);
        upTo[0] = 3;
        weight[0] = 1;
        vm.prank(owner);
        uint32 second = deck.createDeck{value: fee}(20, upTo, weight, 0);

        // Value 1 in the first deck is worth a whole ticket and in the second a
        // shard. That is exactly why a slot remembers its own deck rather than
        // "the current one".
        assertEq(deck.weightOf(0, 1), 5);
        assertEq(deck.weightOf(second, 1), 1);
    }

    /// Decks know nothing about each other's opens.
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
        assertEq(deck.slotDeck(player, 0), second, "the slot remembers its own deck");
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
