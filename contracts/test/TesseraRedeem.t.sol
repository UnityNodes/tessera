// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test, console} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {inco} from "@inco/lightning/src/Lib.sol";
import {TesseraDeck} from "../src/TesseraDeck.sol";
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
    uint16 constant SHARDS = 16; // 40%

    TesseraDeck deck;
    address owner = makeAddr("owner");
    address player = makeAddr("player");
    address verifier;

    function setUp() public {
        vm.createSelectFork(vm.envOr("BASE_SEPOLIA_RPC_URL", string("https://sepolia.base.org")));

        MegapotLegacyAdapter adapter = new MegapotLegacyAdapter(MEGAPOT);
        vm.prank(owner);
        deck = new TesseraDeck(adapter);

        vm.deal(owner, 1 ether);
        uint256 fee = deck.deckFee(DECK);
        vm.prank(owner);
        deck.createDeck{value: fee}(DECK, SHARDS);

        IMintable(address(MPUSDC)).mint(player, 1000e6);
        verifier = address(inco.incoVerifier());
    }

    function _attest(bool valid) internal {
        vm.mockCall(verifier, abi.encodeWithSignature("isValidDecryptionAttestation((bytes32,bytes32),bytes[])"), abi.encode(valid));
    }

    function _open(uint256 n) internal {
        vm.startPrank(player);
        MPUSDC.approve(address(deck), type(uint256).max);
        for (uint256 i = 0; i < n; i++) {
            deck.openCase();
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
        uint256 paid = deck.redeem(idx, vals, sigs);

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
        uint256 cosmetic = uint256(SHARDS) + 1;
        (uint256[] memory idx, uint256[] memory vals, bytes[][] memory sigs) =
            _args([uint256(0), 1, 2, 3, 4], [uint256(1), 2, 3, 4, cosmetic]);

        bytes32 h4 = deck.handleOf(player, 4);
        vm.prank(player);
        vm.expectRevert(abi.encodeWithSelector(TesseraDeck.NotAShard.selector, h4, cosmetic));
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

    function test_redeem_rejectsWrongShardCount() public {
        _open(12);
        _attest(true);
        uint256[] memory idx = new uint256[](4);
        uint256[] memory vals = new uint256[](4);
        bytes[][] memory sigs = new bytes[][](4);

        vm.prank(player);
        vm.expectRevert(TesseraDeck.WrongShardCount.selector);
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

    function test_isShardValue_matchesDropTable() public view {
        assertFalse(deck.isShardValue(0));
        assertTrue(deck.isShardValue(1));
        assertTrue(deck.isShardValue(SHARDS));
        assertFalse(deck.isShardValue(uint256(SHARDS) + 1));
        assertFalse(deck.isShardValue(DECK));
    }

    function test_economics_dropRateStaysBelowBreakEven() public view {
        uint256 feePerOpen = MEGAPOT.ticketPrice() * MEGAPOT.referralFeeBps() / 10_000;
        uint256 earnedPerDeck = uint256(DECK) * feePerOpen;
        uint256 ticketsOwed = uint256(SHARDS) / deck.SHARDS_PER_TICKET();
        uint256 spentPerDeck = ticketsOwed * MEGAPOT.ticketPrice();
        assertGe(earnedPerDeck, spentPerDeck, unicode"");
        console.log("earned per deck:", earnedPerDeck, "spent:", spentPerDeck);
    }

    //

    function _exhaust() internal {
        vm.startPrank(player);
        MPUSDC.approve(address(deck), type(uint256).max);
        for (uint256 i = deck.drawn(); i < DECK; i++) {
            deck.openCase();
        }
        vm.stopPrank();
    }

    function _newSeason(uint16 n, uint16 shards) internal {
        uint256 fee = deck.deckFee(n);
        vm.prank(owner);
        deck.createDeck{value: fee}(n, shards);
    }

    function test_season_incrementsAndRecordsItsDropTable() public {
        assertEq(deck.season(), 1);
        assertEq(deck.shardSlotsOfSeason(1), SHARDS);

        _exhaust();
        _newSeason(20, 10);

        assertEq(deck.season(), 2);
        assertEq(deck.shardSlotsOfSeason(1), SHARDS, unicode"1 ");
        assertEq(deck.shardSlotsOfSeason(2), 10);
        assertEq(deck.slotSeason(player, 0), 1, unicode"1");
    }

    function test_redeem_oldCosmeticStaysCosmeticAfterGenerousSeason() public {
        _exhaust();
        _newSeason(20, 10); // 1..10 1..16

        _attest(true);
        uint256 cosmeticInSeasonOne = uint256(SHARDS) + 1;
        (uint256[] memory idx, uint256[] memory vals, bytes[][] memory sigs) =
            _args([uint256(0), 1, 2, 3, 4], [uint256(1), 2, 3, 4, cosmeticInSeasonOne]);

        bytes32 h4 = deck.handleOf(player, 4);
        vm.prank(player);
        vm.expectRevert(
            abi.encodeWithSelector(TesseraDeck.NotAShard.selector, h4, cosmeticInSeasonOne)
        );
        deck.redeem(idx, vals, sigs);
    }

    function test_redeem_oldShardSurvivesStingierSeason() public {
        _exhaust();
        _newSeason(20, 2); // 1..2

        _attest(true);
        (uint256[] memory idx, uint256[] memory vals, bytes[][] memory sigs) =
            _args([uint256(0), 1, 2, 3, 4], [uint256(5), 6, 7, 8, 9]);

        assertFalse(deck.isShardValue(5), unicode"");
        assertEq(deck.shardMaxFor(player, 0), SHARDS, unicode"");

        vm.prank(player);
        uint256 paid = deck.redeem(idx, vals, sigs);
        assertEq(paid, 1_000_000);
    }

    function test_createDeck_rejectsShardsAboveBreakEven() public {
        _exhaust();
        uint256 fee = deck.deckFee(20);
        vm.prank(owner);
        vm.expectRevert(TesseraDeck.TooManyShardSlots.selector);
        deck.createDeck{value: fee}(20, 11);

        vm.prank(owner);
        deck.createDeck{value: fee}(20, 10);
        assertEq(deck.shardSlots(), 10);
    }
}
