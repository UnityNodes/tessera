// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test, console} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {inco} from "@inco/lightning/src/Lib.sol";
import {TesseraDeck} from "../src/TesseraDeck.sol";
import {DeployTessera} from "./helpers/DeployTessera.sol";
import {MegapotLegacyAdapter} from "../src/adapters/MegapotLegacyAdapter.sol";
import {IMegapot} from "../src/interfaces/IMegapot.sol";
import {Fork} from "./helpers/Fork.sol";

interface IMintable {
    function mint(address to, uint256 amount) external;
}

/// Exchanging shards for a real ticket.
///
/// A covalidator attestation cannot be forged in a fork test, the keys are not
/// ours. So the Inco verifier is mocked and what is checked is everything around
/// it: whose slot it is, whether it is a shard by the drop table, whether it has
/// already been spent, and where the money for the ticket comes from.
contract TesseraRedeemTest is Test {
    IMegapot constant MEGAPOT = IMegapot(0x6f03c7BCaDAdBf5E6F5900DA3d56AdD8FbDac5De);
    IERC20 constant MPUSDC = IERC20(0xA4253E7C13525287C56550b8708100f93E60509f);

    uint16 constant DECK = 40;
    /// Values 1 to 10 weigh one each, those are the shards. The rest are worth
    /// nothing.
    uint16 constant SHARD_MAX = 10;

    TesseraDeck deck;
    address owner = makeAddr("owner");
    address player = makeAddr("player");
    address verifier;

    function setUp() public {
        vm.createSelectFork(vm.envOr("BASE_SEPOLIA_RPC_URL", Fork.BASE_SEPOLIA));

        MegapotLegacyAdapter adapter = new MegapotLegacyAdapter(MEGAPOT);
        deck = DeployTessera.behindProxy(adapter, owner);

        vm.deal(owner, 1 ether);
        uint256 fee = deck.deckFee(DECK);
        (uint16[] memory upTo, uint16[] memory weight) = _flat(SHARD_MAX);
        vm.prank(owner);
        deck.createDeck{value: fee}(DECK, upTo, weight, 0);

        // These tests are about ordinary prizes, so the vault is switched off
        // explicitly: otherwise half the commission would go past them and the
        // arithmetic would drift.
        vm.prank(owner);
        deck.setVaultShare(0);

        IMintable(address(MPUSDC)).mint(player, 1000e6);
        verifier = address(inco.incoVerifier());
    }

    /// A flat table: values 1 to max weigh one each.
    function _flat(uint16 max) internal pure returns (uint16[] memory upTo, uint16[] memory weight) {
        upTo = new uint16[](1);
        weight = new uint16[](1);
        upTo[0] = max;
        weight[0] = 1;
    }

    function _attest(bool valid) internal {
        vm.mockCall(verifier, abi.encodeWithSignature("isValidDecryptionAttestation((bytes32,bytes32),bytes[])"), abi.encode(valid));
    }

    /// The newest deck. Tests that create a second one are talking about it.
    function _latest() internal view returns (uint32) {
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint32(deck.deckCount() - 1);
    }

    function _open(uint256 n) internal {
        _openIn(_latest(), n);
    }

    function _openIn(uint32 deckId, uint256 n) internal {
        vm.startPrank(player);
        MPUSDC.approve(address(deck), type(uint256).max);
        for (uint256 i = 0; i < n; i++) {
            deck.openCase(deckId);
        }
        vm.stopPrank();
    }

    function _args(uint256[5] memory idx, uint256[5] memory vals)
        internal
        pure
        returns (uint256[] memory indexes, uint256[] memory values, bytes[][] memory sigs)
    {
        indexes = new uint256[](5);
        values = new uint256[](5);
        sigs = new bytes[][](5);
        for (uint256 i = 0; i < 5; i++) {
            indexes[i] = idx[i];
            values[i] = vals[i];
            sigs[i] = new bytes[](2); // the covalidator quorum is 2 of 2
        }
    }

    /// The main scenario: the game earned a ticket itself and bought it itself.
    function test_redeem_buysTicketFromTreasury() public {
        _open(12); // $1.20 of referral commission
        _attest(true);

        (uint256[] memory idx, uint256[] memory vals, bytes[][] memory sigs) =
            _args([uint256(0), 1, 2, 3, 4], [uint256(1), 2, 3, 4, 5]);

        uint256 ticketsBefore = MEGAPOT.referralFeesClaimable(address(deck));
        (uint256 boughtBefore,,) = MEGAPOT.usersInfo(player);
        assertEq(deck.treasury(), 0, "the treasury has not been claimed from Megapot yet");
        assertEq(ticketsBefore, 1_200_000);

        vm.prank(player);
        (uint256 tickets, uint256 paid) = deck.redeem(idx, vals, sigs);

        (uint256 boughtAfter,,) = MEGAPOT.usersInfo(player);
        assertEq(paid, 1_000_000);
        assertGt(boughtAfter, boughtBefore, "the ticket went to the player");
        // 1.20 taken, 1.00 spent, 0.10 came back as the commission on this very
        // purchase
        assertEq(deck.treasury(), 200_000, "the rest stayed in the treasury");
        assertEq(deck.feesClaimable(), 100_000, "an exchange brings in commission too");
    }

    function test_redeem_marksShardsSpent() public {
        _open(12);
        _attest(true);
        (uint256[] memory idx, uint256[] memory vals, bytes[][] memory sigs) =
            _args([uint256(0), 1, 2, 3, 4], [uint256(1), 2, 3, 4, 5]);

        bytes32 h0 = deck.handleOf(player, 0);
        assertFalse(deck.shardSpent(h0));

        vm.prank(player);
        deck.redeem(idx, vals, sigs);

        assertTrue(deck.shardSpent(h0), "the shard burned");
    }

    function test_redeem_rejectsSpentShard() public {
        _open(24);
        _attest(true);
        (uint256[] memory idx, uint256[] memory vals, bytes[][] memory sigs) =
            _args([uint256(0), 1, 2, 3, 4], [uint256(1), 2, 3, 4, 5]);

        vm.prank(player);
        deck.redeem(idx, vals, sigs);

        bytes32 h0 = deck.handleOf(player, 0);
        vm.prank(player);
        vm.expectRevert(abi.encodeWithSelector(TesseraDeck.ShardAlreadySpent.selector, h0));
        deck.redeem(idx, vals, sigs);
    }

    /// The same slot five times, the cheapest attempt to cheat the accounting.
    function test_redeem_rejectsSameSlotFiveTimes() public {
        _open(12);
        _attest(true);
        (uint256[] memory idx, uint256[] memory vals, bytes[][] memory sigs) =
            _args([uint256(0), 0, 0, 0, 0], [uint256(1), 1, 1, 1, 1]);

        bytes32 h0 = deck.handleOf(player, 0);
        vm.prank(player);
        vm.expectRevert(abi.encodeWithSelector(TesseraDeck.ShardAlreadySpent.selector, h0));
        deck.redeem(idx, vals, sigs);
    }

    /// Cosmetics are not a shard, however many of them you bring.
    function test_redeem_rejectsNonShardValue() public {
        _open(12);
        _attest(true);
        uint256 cosmetic = uint256(SHARD_MAX) + 1;
        (uint256[] memory idx, uint256[] memory vals, bytes[][] memory sigs) =
            _args([uint256(0), 1, 2, 3, 4], [uint256(1), 2, 3, 4, cosmetic]);

        bytes32 h4 = deck.handleOf(player, 4);
        vm.prank(player);
        vm.expectRevert(abi.encodeWithSelector(TesseraDeck.WorthlessSlot.selector, h4, cosmetic));
        deck.redeem(idx, vals, sigs);
    }

    /// Without the covalidators' signature a slot value is just a number out of
    /// thin air.
    function test_redeem_rejectsBadAttestation() public {
        _open(12);
        _attest(false);
        (uint256[] memory idx, uint256[] memory vals, bytes[][] memory sigs) =
            _args([uint256(0), 1, 2, 3, 4], [uint256(1), 2, 3, 4, 5]);

        bytes32 first = deck.handleOf(player, 0);
        vm.prank(player);
        vm.expectRevert(abi.encodeWithSelector(TesseraDeck.BadAttestation.selector, first));
        deck.redeem(idx, vals, sigs);
    }

    /// Somebody else's slot is not yours: the indices are read from the caller's
    /// own array.
    function test_redeem_cannotSpendAnotherPlayersSlot() public {
        _open(12);
        _attest(true);
        (uint256[] memory idx, uint256[] memory vals, bytes[][] memory sigs) =
            _args([uint256(0), 1, 2, 3, 4], [uint256(1), 2, 3, 4, 5]);

        address thief = makeAddr("thief");
        vm.prank(thief);
        vm.expectRevert(); // the thief has no slots, so this is out of array bounds
        deck.redeem(idx, vals, sigs);
    }

    /// An empty exchange, nothing to talk about.
    function test_redeem_rejectsEmptyCall() public {
        _open(12);
        _attest(true);
        uint256[] memory idx = new uint256[](0);
        uint256[] memory vals = new uint256[](0);
        bytes[][] memory sigs = new bytes[][](0);

        vm.prank(player);
        vm.expectRevert(TesseraDeck.BadTierTable.selector);
        deck.redeem(idx, vals, sigs);
    }

    /// Four shards are not enough for a ticket, and now that is visible from the
    /// weight rather than from the array length.
    function test_redeem_rejectsNotEnoughWeight() public {
        _open(12);
        _attest(true);
        uint256[] memory idx = new uint256[](4);
        uint256[] memory vals = new uint256[](4);
        bytes[][] memory sigs = new bytes[][](4);
        for (uint256 i = 0; i < 4; i++) {
            idx[i] = i;
            vals[i] = i + 1;
            sigs[i] = new bytes[](2);
        }

        vm.prank(player);
        vm.expectRevert(abi.encodeWithSelector(TesseraDeck.NotEnoughWeight.selector, 4, 5));
        deck.redeem(idx, vals, sigs);
    }

    /// Until the game has earned a ticket there is nothing to exchange for.
    function test_redeem_revertsWhenTreasuryTooThin() public {
        _open(5); // only $0.50
        _attest(true);
        (uint256[] memory idx, uint256[] memory vals, bytes[][] memory sigs) =
            _args([uint256(0), 1, 2, 3, 4], [uint256(1), 2, 3, 4, 5]);

        vm.prank(player);
        vm.expectRevert(abi.encodeWithSelector(TesseraDeck.TreasuryEmpty.selector, 500_000, 1_000_000));
        deck.redeem(idx, vals, sigs);
    }

    function test_weightNow_matchesDropTable() public view {
        assertEq(deck.weightOf(0, 0), 1, "zero falls into the first tier");
        assertEq(deck.weightOf(0, 1), 1);
        assertEq(deck.weightOf(0, SHARD_MAX), 1);
        assertEq(deck.weightOf(0, uint256(SHARD_MAX) + 1), 0);
        assertEq(deck.weightOf(0, DECK), 0);
    }

    /// Break even: a shard is cheaper than a ticket only while there are fewer
    /// than half a deck of them. The test pins that limit so it is not moved by
    /// accident.
    function test_economics_dropRateStaysBelowBreakEven() public view {
        uint256 feePerOpen = MEGAPOT.ticketPrice() * MEGAPOT.referralFeeBps() / 10_000;
        uint256 earnedPerDeck = uint256(DECK) * feePerOpen;
        uint256 ticketsOwed = uint256(SHARD_MAX) / deck.WEIGHT_PER_TICKET();
        uint256 spentPerDeck = ticketsOwed * MEGAPOT.ticketPrice();
        assertGe(earnedPerDeck, spentPerDeck, "a deck has to pay for its own prizes");
        console.log("earned per deck:", earnedPerDeck, "spent:", spentPerDeck);
    }

    // -- seasons ----------------------------------------------------------------
    //
    // A slot is judged by the drop table of ITS OWN season. Without this a more
    // generous new season would retroactively turn last year's cosmetics into
    // shards and pay for them from a treasury that never earned those commissions,
    // while a stingier one would devalue shards that had already been bought.

    /// Exhaust a deck so that a new season can begin.
    function _exhaust() internal {
        vm.startPrank(player);
        MPUSDC.approve(address(deck), type(uint256).max);
        for (uint256 i = deck.deckAt(0).drawn; i < DECK; i++) {
            deck.openCase(0);
        }
        vm.stopPrank();
    }

    function _newSeason(uint16 n, uint16 shardMax) internal {
        uint256 fee = deck.deckFee(n);
        (uint16[] memory upTo, uint16[] memory weight) = _flat(shardMax);
        vm.prank(owner);
        deck.createDeck{value: fee}(n, upTo, weight, 0);
    }

    function test_season_incrementsAndRecordsItsDropTable() public {
        assertEq(deck.deckCount(), 1);
        assertEq(deck.weightOf(0, SHARD_MAX), 1);

        _exhaust();
        _newSeason(20, 10);

        assertEq(deck.deckCount(), 2);
        assertEq(deck.weightOf(0, SHARD_MAX), 1, "the first deck's table did not change");
        assertEq(deck.weightOf(1, 10), 1);
        assertEq(deck.slotDeck(player, 0), 0, "the old slot stayed in its own deck");
    }

    /// A more generous new season does NOT turn last year's cosmetics into a shard.
    function test_redeem_oldCosmeticStaysCosmeticAfterGenerousSeason() public {
        _exhaust();
        _newSeason(20, 10); // the shards are now 1 to 10 instead of 1 to 16

        _attest(true);
        // 20 was cosmetics in season 1 and in season 2 as well, but what we are
        // checking is the boundary: value 17 was not a shard and will not become
        // one.
        uint256 cosmeticInSeasonOne = uint256(SHARD_MAX) + 1;
        (uint256[] memory idx, uint256[] memory vals, bytes[][] memory sigs) =
            _args([uint256(0), 1, 2, 3, 4], [uint256(1), 2, 3, 4, cosmeticInSeasonOne]);

        bytes32 h4 = deck.handleOf(player, 4);
        vm.prank(player);
        vm.expectRevert(
            abi.encodeWithSelector(TesseraDeck.WorthlessSlot.selector, h4, cosmeticInSeasonOne)
        );
        deck.redeem(idx, vals, sigs);
    }

    /// A stingier new season does NOT devalue a shard that was already bought.
    function test_redeem_oldShardSurvivesStingierSeason() public {
        _exhaust();
        _newSeason(20, 2); // in the new season the shards are only 1 to 2

        _attest(true);
        // 5 was a shard in season 1 and has to stay one forever, even though such
        // a value is already cosmetics in the current season.
        (uint256[] memory idx, uint256[] memory vals, bytes[][] memory sigs) =
            _args([uint256(0), 1, 2, 3, 4], [uint256(5), 6, 7, 8, 9]);

        assertEq(deck.weightOf(_latest(), 5), 0, "in the new deck this is no longer a shard");
        assertEq(deck.weightOfSlot(player, 0, 5), 1, "and in its own, a shard");

        vm.prank(player);
        (uint256 tickets, uint256 paid) = deck.redeem(idx, vals, sigs);
        assertEq(paid, 1_000_000);
    }

    /// A total weight greater than half the deck means the prizes do not pay for
    /// themselves.
    function test_createDeck_rejectsWeightAboveBreakEven() public {
        _exhaust();
        uint256 fee = deck.deckFee(20);

        (uint16[] memory tooMuch, uint16[] memory w1) = _flat(11); // weight 11 > 20/2
        vm.prank(owner);
        vm.expectRevert(TesseraDeck.TooManyShardSlots.selector);
        deck.createDeck{value: fee}(20, tooMuch, w1, 0);

        // exactly half still passes
        (uint16[] memory exact, uint16[] memory w2) = _flat(10);
        vm.prank(owner);
        deck.createDeck{value: fee}(20, exact, w2, 0);
        assertEq(deck.weightOf(_latest(), 10), 1);
        assertEq(deck.weightOf(_latest(), 11), 0);
    }

    /// A steep table: one slot for five tickets at once, with no collecting.
    /// This is what the differing weights are for.
    function test_redeem_topTierPaysFiveTicketsAtOnce() public {
        _exhaust();

        uint256 fee = deck.deckFee(100);
        uint16[] memory upTo = new uint16[](3);
        uint16[] memory weight = new uint16[](3);
        upTo[0] = 1;
        weight[0] = 25; // one slot is five tickets
        upTo[1] = 4;
        weight[1] = 5; // three slots, a ticket each
        upTo[2] = 12;
        weight[2] = 1; // eight shards
        vm.prank(owner);
        deck.createDeck{value: fee}(100, upTo, weight, 0);
        // 1*25 + 3*5 + 8*1 = 48, the limit for 100 slots is 50
        assertEq(deck.weightOf(_latest(), 1), 25);
        assertEq(deck.weightOf(_latest(), 4), 5);
        assertEq(deck.weightOf(_latest(), 12), 1);
        assertEq(deck.weightOf(_latest(), 13), 0);

        uint256 firstNew = deck.countOf(player);
        _open(60); // earn a treasury worth five tickets
        _attest(true);

        uint256[] memory idx = new uint256[](1);
        uint256[] memory vals = new uint256[](1);
        bytes[][] memory sigs = new bytes[][](1);
        idx[0] = firstNew;
        vals[0] = 1; // the top tier
        sigs[0] = new bytes[](2);

        (uint256 boughtBefore,,) = MEGAPOT.usersInfo(player);
        vm.prank(player);
        (uint256 tickets, uint256 paid) = deck.redeem(idx, vals, sigs);
        (uint256 boughtAfter,,) = MEGAPOT.usersInfo(player);

        assertEq(tickets, 5, "one slot is five tickets");
        assertEq(paid, 5_000_000);
        assertEq(boughtAfter - boughtBefore, 5 * 8500, "all five are credited to the player");
    }
}
