// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test, console} from "forge-std/Test.sol";
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
contract TesseraRedeemTest is Test {
    IMegapot constant MEGAPOT = IMegapot(0x6f03c7BCaDAdBf5E6F5900DA3d56AdD8FbDac5De);
    IERC20 constant MPUSDC = IERC20(0xA4253E7C13525287C56550b8708100f93E60509f);

    uint16 constant DECK = 40;
    uint16 constant SHARD_MAX = 10;

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
        (uint16[] memory upTo, uint16[] memory weight) = _flat(SHARD_MAX);
        vm.prank(owner);
        deck.createDeck{value: fee}(DECK, upTo, weight, 0);

        vm.prank(owner);
        deck.setVaultShare(0);

        IMintable(address(MPUSDC)).mint(player, 1000e6);
        verifier = address(inco.incoVerifier());
    }

    function _flat(uint16 max) internal pure returns (uint16[] memory upTo, uint16[] memory weight) {
        upTo = new uint16[](1);
        weight = new uint16[](1);
        upTo[0] = max;
        weight[0] = 1;
    }

    function _attest(bool valid) internal {
        vm.mockCall(verifier, abi.encodeWithSignature("isValidDecryptionAttestation((bytes32,bytes32),bytes[])"), abi.encode(valid));
    }

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
            sigs[i] = new bytes[](2); // 2 2
        }
    }

    function test_redeem_buysTicketFromTreasury() public {
        _open(12); // $1.20
        _attest(true);

        (uint256[] memory idx, uint256[] memory vals, bytes[][] memory sigs) =
            _args([uint256(0), 1, 2, 3, 4], [uint256(1), 2, 3, 4, 5]);

        uint256 ticketsBefore = MEGAPOT.referralFeesClaimable(address(deck));
        (uint256 boughtBefore,,) = MEGAPOT.usersInfo(player);
        assertEq(deck.treasury(), 0, unicode"Megapot");
        assertEq(ticketsBefore, 1_200_000);

        vm.prank(player);
        (uint256 tickets, uint256 paid) = deck.redeem(idx, vals, sigs);

        (uint256 boughtAfter,,) = MEGAPOT.usersInfo(player);
        assertEq(paid, 1_000_000);
        assertGt(boughtAfter, boughtBefore, unicode"");
        assertEq(deck.treasury(), 200_000, unicode"");
        assertEq(deck.feesClaimable(), 100_000, unicode"");
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

        assertTrue(deck.shardSpent(h0), unicode"");
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

    function test_redeem_cannotSpendAnotherPlayersSlot() public {
        _open(12);
        _attest(true);
        (uint256[] memory idx, uint256[] memory vals, bytes[][] memory sigs) =
            _args([uint256(0), 1, 2, 3, 4], [uint256(1), 2, 3, 4, 5]);

        address thief = makeAddr("thief");
        vm.prank(thief);
        vm.expectRevert(); //
        deck.redeem(idx, vals, sigs);
    }

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

    function test_redeem_revertsWhenTreasuryTooThin() public {
        _open(5); // $0.50
        _attest(true);
        (uint256[] memory idx, uint256[] memory vals, bytes[][] memory sigs) =
            _args([uint256(0), 1, 2, 3, 4], [uint256(1), 2, 3, 4, 5]);

        vm.prank(player);
        vm.expectRevert(abi.encodeWithSelector(TesseraDeck.TreasuryEmpty.selector, 500_000, 1_000_000));
        deck.redeem(idx, vals, sigs);
    }

    function test_weightNow_matchesDropTable() public view {
        assertEq(deck.weightIn(0, 0), 1, unicode"");
        assertEq(deck.weightIn(0, 1), 1);
        assertEq(deck.weightIn(0, SHARD_MAX), 1);
        assertEq(deck.weightIn(0, uint256(SHARD_MAX) + 1), 0);
        assertEq(deck.weightIn(0, DECK), 0);
    }

    function test_economics_dropRateStaysBelowBreakEven() public view {
        uint256 feePerOpen = MEGAPOT.ticketPrice() * MEGAPOT.referralFeeBps() / 10_000;
        uint256 earnedPerDeck = uint256(DECK) * feePerOpen;
        uint256 ticketsOwed = uint256(SHARD_MAX) / deck.WEIGHT_PER_TICKET();
        uint256 spentPerDeck = ticketsOwed * MEGAPOT.ticketPrice();
        assertGe(earnedPerDeck, spentPerDeck, unicode"");
        console.log("earned per deck:", earnedPerDeck, "spent:", spentPerDeck);
    }

    //

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
        assertEq(deck.weightOf(0, SHARD_MAX), 1, unicode"");
        assertEq(deck.weightOf(1, 10), 1);
        assertEq(deck.slotDeck(player, 0), 0, unicode"");
    }

    function test_redeem_oldCosmeticStaysCosmeticAfterGenerousSeason() public {
        _exhaust();
        _newSeason(20, 10); // 1..10 1..16

        _attest(true);
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

    function test_redeem_oldShardSurvivesStingierSeason() public {
        _exhaust();
        _newSeason(20, 2); // 1..2

        _attest(true);
        (uint256[] memory idx, uint256[] memory vals, bytes[][] memory sigs) =
            _args([uint256(0), 1, 2, 3, 4], [uint256(5), 6, 7, 8, 9]);

        assertEq(deck.weightIn(_latest(), 5), 0, unicode"");
        assertEq(deck.weightOfSlot(player, 0, 5), 1, unicode"");

        vm.prank(player);
        (uint256 tickets, uint256 paid) = deck.redeem(idx, vals, sigs);
        assertEq(paid, 1_000_000);
    }

    function test_createDeck_rejectsWeightAboveBreakEven() public {
        _exhaust();
        uint256 fee = deck.deckFee(20);

        (uint16[] memory tooMuch, uint16[] memory w1) = _flat(11); // 11 > 20/2
        vm.prank(owner);
        vm.expectRevert(TesseraDeck.TooManyShardSlots.selector);
        deck.createDeck{value: fee}(20, tooMuch, w1, 0);

        (uint16[] memory exact, uint16[] memory w2) = _flat(10);
        vm.prank(owner);
        deck.createDeck{value: fee}(20, exact, w2, 0);
        assertEq(deck.weightIn(_latest(), 10), 1);
        assertEq(deck.weightIn(_latest(), 11), 0);
    }

    function test_redeem_topTierPaysFiveTicketsAtOnce() public {
        _exhaust();

        uint256 fee = deck.deckFee(100);
        uint16[] memory upTo = new uint16[](3);
        uint16[] memory weight = new uint16[](3);
        upTo[0] = 1;
        weight[0] = 25; // '
        upTo[1] = 4;
        weight[1] = 5; //
        upTo[2] = 12;
        weight[2] = 1; //
        vm.prank(owner);
        deck.createDeck{value: fee}(100, upTo, weight, 0);
        assertEq(deck.weightIn(_latest(), 1), 25);
        assertEq(deck.weightIn(_latest(), 4), 5);
        assertEq(deck.weightIn(_latest(), 12), 1);
        assertEq(deck.weightIn(_latest(), 13), 0);

        uint256 firstNew = deck.countOf(player);
        _open(60); // '
        _attest(true);

        uint256[] memory idx = new uint256[](1);
        uint256[] memory vals = new uint256[](1);
        bytes[][] memory sigs = new bytes[][](1);
        idx[0] = firstNew;
        vals[0] = 1; //
        sigs[0] = new bytes[](2);

        (uint256 boughtBefore,,) = MEGAPOT.usersInfo(player);
        vm.prank(player);
        (uint256 tickets, uint256 paid) = deck.redeem(idx, vals, sigs);
        (uint256 boughtAfter,,) = MEGAPOT.usersInfo(player);

        assertEq(tickets, 5, unicode"'");
        assertEq(paid, 5_000_000);
        assertEq(boughtAfter - boughtBefore, 5 * 8500, unicode"'");
    }
}
