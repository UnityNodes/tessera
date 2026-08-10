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
contract TesseraBattleTest is Test {
    IMegapot constant MEGAPOT = IMegapot(0x6f03c7BCaDAdBf5E6F5900DA3d56AdD8FbDac5De);
    IERC20 constant MPUSDC = IERC20(0xA4253E7C13525287C56550b8708100f93E60509f);

    uint16 constant DECK = 100;

    TesseraDeck deck;
    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address verifier;

    function setUp() public {
        vm.createSelectFork(vm.envOr("BASE_SEPOLIA_RPC_URL", string("https://sepolia.base.org")));

        MegapotLegacyAdapter adapter = new MegapotLegacyAdapter(MEGAPOT);
        deck = DeployTessera.behindProxy(adapter, owner);

        vm.deal(owner, 1 ether);
        uint256 fee = deck.deckFee(DECK);

        uint16[] memory upTo = new uint16[](3);
        uint16[] memory weight = new uint16[](3);
        upTo[0] = 1;
        weight[0] = 0;
        upTo[1] = 2;
        weight[1] = 25;
        upTo[2] = 6;
        weight[2] = 5;
        vm.prank(owner);
        deck.createDeck{value: fee}(DECK, upTo, weight, 1);

        for (uint256 i = 0; i < 2; i++) {
            address who = i == 0 ? alice : bob;
            IMintable(address(MPUSDC)).mint(who, 1000e6);
            vm.prank(who);
            MPUSDC.approve(address(deck), type(uint256).max);
        }
        verifier = address(inco.incoVerifier());
    }

    function _attest(bool valid) internal {
        vm.mockCall(
            verifier,
            abi.encodeWithSignature("isValidDecryptionAttestation((bytes32,bytes32),bytes[])"),
            abi.encode(valid)
        );
    }

    function _sigs() internal pure returns (bytes[] memory s) {
        s = new bytes[](2);
    }

    function _fund(uint256 amount) internal {
        IMintable(address(MPUSDC)).mint(address(deck), amount);
    }

    function _tickets(address who) internal view returns (uint256 bps) {
        (bps,,) = MEGAPOT.usersInfo(who);
    }

    function _joined() internal returns (uint256 id) {
        vm.prank(alice);
        (id,) = deck.openBattle(0);
        vm.prank(bob);
        deck.joinBattle(id);
    }


    ///
    function test_battle_creatorCardStaysSealed() public {
        vm.prank(alice);
        (uint256 id, uint64 slotIndex) = deck.openBattle(0);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(TesseraDeck.SlotInBattle.selector, uint64(id)));
        deck.revealMine(slotIndex);
    }

    function test_battle_sealedSlotCannotBeRedeemed() public {
        vm.prank(alice);
        (uint256 id,) = deck.openBattle(0);
        _attest(true);

        uint256[] memory idx = new uint256[](1);
        uint256[] memory vals = new uint256[](1);
        bytes[][] memory sigs = new bytes[][](1);
        idx[0] = 0;
        vals[0] = 3;
        sigs[0] = _sigs();

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(TesseraDeck.SlotInBattle.selector, uint64(id)));
        deck.redeem(idx, vals, sigs);
    }

    function test_battle_sealedSlotCannotBeStaked() public {
        vm.prank(alice);
        (uint256 id,) = deck.openBattle(0);
        _attest(true);

        uint256[] memory idx = new uint256[](1);
        uint256[] memory vals = new uint256[](1);
        bytes[][] memory sigs = new bytes[][](1);
        idx[0] = 0;
        vals[0] = 3;
        sigs[0] = _sigs();

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(TesseraDeck.SlotInBattle.selector, uint64(id)));
        deck.stake(idx, vals, sigs);
    }

    function test_battle_sealedSlotCannotOpenTheVault() public {
        vm.prank(alice);
        (uint256 id,) = deck.openBattle(0);
        _attest(true);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(TesseraDeck.SlotInBattle.selector, uint64(id)));
        deck.claimVault(0, 1, _sigs());
    }

    ///
    ///
    function test_battle_joinedCardIsNoLongerSealedButStillLocked() public {
        uint256 id = _joined();

        assertEq(deck.sealedSlotsOf(alice).length, 0, unicode"");
        assertEq(deck.sealedSlotsOf(bob).length, 0, unicode"");

        TesseraDeck.Battle memory bt = deck.battleAt(id);
        assertFalse(bt.resolved, unicode"");
        assertEq(bt.a, alice);
        assertEq(bt.b, bob);

        assertEq(deck.battlesOf(alice)[0], id);
        assertEq(deck.battlesOf(bob)[0], id);

        _attest(true);
        uint256[] memory idx = new uint256[](1);
        uint256[] memory vals = new uint256[](1);
        bytes[][] memory sigs = new bytes[][](1);
        vals[0] = 3;
        sigs[0] = _sigs();

        idx[0] = bt.slotA;
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(TesseraDeck.SlotInBattle.selector, uint64(id)));
        deck.redeem(idx, vals, sigs);

        idx[0] = bt.slotB;
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(TesseraDeck.SlotInBattle.selector, uint64(id)));
        deck.redeem(idx, vals, sigs);
    }

    function test_battle_settlingReleasesBothCards() public {
        uint256 id = _joined();
        _attest(true);
        deck.resolveBattle(id, 3, _sigs(), 4, _sigs());

        assertTrue(deck.battleAt(id).resolved, unicode"");

        uint256[] memory mine = deck.battlesOf(alice);
        for (uint256 i = 0; i < mine.length; i++) {
            assertTrue(deck.battleAt(mine[i]).resolved, unicode"");
        }
        mine = deck.battlesOf(bob);
        for (uint256 i = 0; i < mine.length; i++) {
            assertTrue(deck.battleAt(mine[i]).resolved, unicode"");
        }
    }


    function test_battle_bothPayAndBothGetARealTicket() public {
        uint256 aliceBefore = _tickets(alice);
        uint256 bobBefore = _tickets(bob);

        _joined();

        assertGt(_tickets(alice) - aliceBefore, 0, unicode"");
        assertGt(_tickets(bob) - bobBefore, 0, unicode"");
        assertEq(deck.deckAt(0).drawn, 2, unicode"");
    }

    function test_battle_winnerTakesBothBonuses() public {
        uint256 id = _joined();
        _attest(true);

        (address winner, uint256 banked) = deck.resolveBattle(id, 2, _sigs(), 3, _sigs());

        assertEq(winner, alice);
        assertEq(banked, 30, unicode"");
        assertEq(deck.bankedWeight(alice), 30);
        assertEq(deck.bankedWeight(bob), 0, unicode"");
    }

    function test_battle_loserKeepsTheTicketTheyPaidFor() public {
        uint256 before = _tickets(bob);
        uint256 id = _joined();
        _attest(true);
        deck.resolveBattle(id, 2, _sigs(), 3, _sigs());

        assertGt(_tickets(bob) - before, 0, unicode"");
    }

    function test_battle_equalWeightIsADraw() public {
        uint256 id = _joined();
        _attest(true);

        (address winner, uint256 banked) = deck.resolveBattle(id, 3, _sigs(), 4, _sigs());

        assertEq(winner, address(0));
        assertEq(banked, 0);
        assertEq(deck.bankedWeight(alice), 5, unicode"");
        assertEq(deck.bankedWeight(bob), 5);
    }

    function test_battle_bothEmpty() public {
        uint256 id = _joined();
        _attest(true);

        (address winner, uint256 banked) = deck.resolveBattle(id, 40, _sigs(), 41, _sigs());

        assertEq(winner, address(0));
        assertEq(banked, 0);
        assertEq(deck.bankedWeight(alice), 0);
        assertEq(deck.bankedWeight(bob), 0);
    }

    function test_battle_vaultSlotWinsAndSurvives() public {
        uint256 id = _joined();
        _attest(true);

        (address winner, uint256 banked) = deck.resolveBattle(id, 1, _sigs(), 2, _sigs());

        assertEq(winner, alice, unicode"'");
        assertEq(banked, 25, unicode", ");

        bytes32 handle = deck.handleOf(alice, 0);
        assertFalse(deck.shardSpent(handle), unicode"");

        vm.prank(alice);
        uint256 paid = deck.claimVault(0, 1, _sigs());
        assertGt(paid, 0, unicode"");
    }

    function test_battle_bankedTurnsIntoTickets() public {
        uint256 id = _joined();
        _attest(true);
        deck.resolveBattle(id, 2, _sigs(), 3, _sigs());

        _fund(6e6);

        uint256 before = _tickets(alice);
        vm.prank(alice);
        (uint256 tickets,) = deck.claimBanked();

        assertEq(tickets, 6, unicode"");
        assertEq(_tickets(alice) - before, 6 * 8500, unicode"");
    }


    function test_battle_cannotFightYourself() public {
        vm.prank(alice);
        (uint256 id,) = deck.openBattle(0);

        vm.prank(alice);
        vm.expectRevert(TesseraDeck.CannotFightYourself.selector);
        deck.joinBattle(id);
    }

    function test_battle_cannotJoinTwice() public {
        uint256 id = _joined();
        address carol = makeAddr("carol");
        IMintable(address(MPUSDC)).mint(carol, 100e6);
        vm.startPrank(carol);
        MPUSDC.approve(address(deck), type(uint256).max);
        vm.expectRevert(TesseraDeck.BattleTaken.selector);
        deck.joinBattle(id);
        vm.stopPrank();
    }

    function test_battle_cannotResolveTwice() public {
        uint256 id = _joined();
        _attest(true);
        deck.resolveBattle(id, 2, _sigs(), 3, _sigs());

        vm.expectRevert(TesseraDeck.BattleGone.selector);
        deck.resolveBattle(id, 2, _sigs(), 3, _sigs());
    }

    function test_battle_cannotResolveBeforeAnOpponent() public {
        vm.prank(alice);
        (uint256 id,) = deck.openBattle(0);
        _attest(true);

        vm.expectRevert(TesseraDeck.BattleWaiting.selector);
        deck.resolveBattle(id, 2, _sigs(), 3, _sigs());
    }

    function test_battle_rejectsBadAttestation() public {
        uint256 id = _joined();
        _attest(false);

        bytes32 handle = deck.handleOf(alice, 0);
        vm.expectRevert(abi.encodeWithSelector(TesseraDeck.BadAttestation.selector, handle));
        deck.resolveBattle(id, 2, _sigs(), 3, _sigs());
    }

    function test_battle_unknownId() public {
        _attest(true);
        vm.expectRevert(TesseraDeck.NoSuchBattle.selector);
        deck.resolveBattle(99, 2, _sigs(), 3, _sigs());
    }


    function test_battle_abandonReturnsTheCard() public {
        vm.prank(alice);
        (uint256 id, uint64 slotIndex) = deck.openBattle(0);

        vm.warp(block.timestamp + deck.BATTLE_TIMEOUT());
        vm.prank(alice);
        deck.abandonBattle(id);

        vm.prank(alice);
        deck.revealMine(slotIndex);

        _attest(true);
        uint256[] memory idx = new uint256[](1);
        uint256[] memory vals = new uint256[](1);
        bytes[][] memory sigs = new bytes[][](1);
        idx[0] = slotIndex;
        vals[0] = 2;
        sigs[0] = _sigs();

        _fund(5e6);
        vm.prank(alice);
        (uint256 tickets,) = deck.redeem(idx, vals, sigs);
        assertEq(tickets, 5);
    }

    function test_battle_cannotAbandonEarly() public {
        vm.prank(alice);
        (uint256 id,) = deck.openBattle(0);
        uint64 openedAt = uint64(block.timestamp);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(TesseraDeck.TooEarlyToAbandon.selector, openedAt));
        deck.abandonBattle(id);
    }

    function test_battle_onlyCreatorAbandons() public {
        vm.prank(alice);
        (uint256 id,) = deck.openBattle(0);
        vm.warp(block.timestamp + deck.BATTLE_TIMEOUT());

        vm.prank(bob);
        vm.expectRevert(TesseraDeck.NotYourBattle.selector);
        deck.abandonBattle(id);
    }

    function test_battle_cannotAbandonOnceJoined() public {
        uint256 id = _joined();
        vm.warp(block.timestamp + deck.BATTLE_TIMEOUT());

        vm.prank(alice);
        vm.expectRevert(TesseraDeck.BattleTaken.selector);
        deck.abandonBattle(id);
    }


    function test_battle_openListShowsWaitingOnly() public {
        vm.prank(alice);
        (uint256 first,) = deck.openBattle(0);
        vm.prank(alice);
        (uint256 second,) = deck.openBattle(0);

        uint256[] memory open = deck.openBattleIds(10);
        assertEq(open.length, 2);
        assertEq(open[0], second, unicode"");
        assertEq(open[1], first);

        vm.prank(bob);
        deck.joinBattle(first);

        open = deck.openBattleIds(10);
        assertEq(open.length, 1);
        assertEq(open[0], second);
    }

    function test_battle_openListRespectsTheCap() public {
        vm.startPrank(alice);
        deck.openBattle(0);
        deck.openBattle(0);
        deck.openBattle(0);
        vm.stopPrank();

        assertEq(deck.openBattleIds(2).length, 2);
    }

    function test_battle_playerSeesTheirOwn() public {
        uint256 id = _joined();

        uint256[] memory mine = deck.battlesOf(alice);
        assertEq(mine.length, 1);
        assertEq(mine[0], id);
        assertEq(deck.battlesOf(bob)[0], id);
    }


    function test_battle_stakeWaitsForTheBattle() public {
        vm.startPrank(alice);
        deck.openCase(0);
        vm.stopPrank();

        _attest(true);
        uint256[] memory idx = new uint256[](1);
        uint256[] memory vals = new uint256[](1);
        bytes[][] memory sigs = new bytes[][](1);
        idx[0] = 0;
        vals[0] = 3;
        sigs[0] = _sigs();

        vm.prank(alice);
        deck.stake(idx, vals, sigs);

        vm.prank(alice);
        (uint256 id,) = deck.openBattle(0);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(TesseraDeck.SlotInBattle.selector, uint64(id)));
        deck.settleStake(3, _sigs());
    }
}
