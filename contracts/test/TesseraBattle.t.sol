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

/// Battles.
///
/// Two people each open a case, and the higher one takes both bonuses. What is
/// checked first of all is the thing the battle is arranged this way and not
/// otherwise for: the creator's card stays silent until the opponent has paid.
contract TesseraBattleTest is Test {
    IMegapot constant MEGAPOT = IMegapot(0x6f03c7BCaDAdBf5E6F5900DA3d56AdD8FbDac5De);
    IERC20 constant MPUSDC = IERC20(0xA4253E7C13525287C56550b8708100f93E60509f);

    uint16 constant DECK = 200;

    TesseraDeck deck;
    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    address verifier;

    function setUp() public {
        vm.createSelectFork(vm.envOr("BASE_SEPOLIA_RPC_URL", Fork.BASE_SEPOLIA));

        MegapotLegacyAdapter adapter = new MegapotLegacyAdapter(MEGAPOT);
        deck = DeployTessera.behindProxy(adapter, owner);

        vm.deal(owner, 1 ether);
        uint256 fee = deck.deckFee(DECK);

        // slot 1 is the vault (weight 0), 2 is five tickets, 3 to 6 a ticket each
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

        address[3] memory players = [alice, bob, carol];
        for (uint256 i = 0; i < players.length; i++) {
            address who = players[i];
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

    /// Put money in the treasury as if opens had already brought it in.
    /// The fee is ten cents to the dollar, so collecting a five dollar ticket
    /// with live opens would mean spending half a deck on scenery.
    function _fund(uint256 amount) internal {
        IMintable(address(MPUSDC)).mint(address(deck), amount);
    }

    /// How many tickets Megapot credited to a player, in bps.
    function _tickets(address who) internal view returns (uint256 bps) {
        (bps,,) = MEGAPOT.usersInfo(who);
    }

    /// How many bps Megapot credits for ONE ticket.
    ///
    /// Measured with a control open in the same fork rather than written as a
    /// number. A constant out of our head would quietly drift along with Megapot,
    /// and "the winner gets two tickets" would turn into a check of our memory.
    function _ticketBps() internal returns (uint256) {
        uint256 before = _tickets(carol);
        vm.prank(carol);
        deck.openCase(0);
        return _tickets(carol) - before;
    }

    /// A battle to the finish: both are in, and we supply the values ourselves.
    function _joined() internal returns (uint256 id) {
        vm.prank(alice);
        (id,) = deck.openBattle(0);
        vm.prank(bob);
        deck.joinBattle(id);
    }

    // -- what it is all for --------------------------------------------------

    /// The creator's card is locked until an opponent has arrived.
    ///
    /// This is not a detail but the whole construction: if the card could be
    /// seen, nobody would enter a battle against a good card and everyone would
    /// enter against an empty one. A market for battles would not exist.
    function test_battle_creatorCardStaysSealed() public {
        vm.prank(alice);
        (uint256 id, uint64 slotIndex) = deck.openBattle(0);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(TesseraDeck.SlotInBattle.selector, uint64(id)));
        deck.revealMine(slotIndex);
    }

    /// And it cannot be exchanged either, even with an attestation in hand.
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

    /// Nor staked.
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

    /// Nor used to open the vault.
    function test_battle_sealedSlotCannotOpenTheVault() public {
        vm.prank(alice);
        (uint256 id,) = deck.openBattle(0);
        _attest(true);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(TesseraDeck.SlotInBattle.selector, uint64(id)));
        deck.claimVault(0, 1, _sigs());
    }

    /// "Sealed" and "locked" are different things, and here is exactly where
    /// they part.
    ///
    /// `sealedSlotsOf` speaks about silence: as soon as the opponent has paid,
    /// both cards become public and disappear from the list. Locked, however,
    /// they stay until settlement, and a battle is settled by a person, not by
    /// a machine.
    ///
    /// Whoever decides that an empty `sealedSlotsOf` means "the card is free"
    /// will build an interface that offers to exchange it and gets a revert.
    /// That is exactly what happened.
    function test_battle_joinedCardIsNoLongerSealedButStillLocked() public {
        uint256 id = _joined();

        assertEq(deck.sealedSlotsOf(alice).length, 0, "the creator's card is no longer silent");
        assertEq(deck.sealedSlotsOf(bob).length, 0, "the opponent's card too");

        TesseraDeck.Battle memory bt = deck.battleAt(id);
        assertFalse(bt.resolved, "the battle is not settled yet");
        assertEq(bt.a, alice);
        assertEq(bt.b, bob);

        // The only way to learn about the lock from outside the chain is this
        // pair of calls: the player's battle list plus the battle itself. The
        // client counts the same way.
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

    /// And after settlement the lock falls from both.
    function test_battle_settlingReleasesBothCards() public {
        uint256 id = _joined();
        _attest(true);
        deck.resolveBattle(id, 3, _sigs(), 4, _sigs());

        assertTrue(deck.battleAt(id).resolved, "the battle is settled");

        uint256[] memory mine = deck.battlesOf(alice);
        for (uint256 i = 0; i < mine.length; i++) {
            assertTrue(deck.battleAt(mine[i]).resolved, "nothing holds the creator's card");
        }
        mine = deck.battlesOf(bob);
        for (uint256 i = 0; i < mine.length; i++) {
            assertTrue(deck.battleAt(mine[i]).resolved, "the opponent's card too");
        }
    }

    // -- the course of a battle ----------------------------------------------

    /// The dollars are paid but neither has a ticket yet, they ARE the stake.
    ///
    /// This is what makes a battle a battle. While the ticket is bought up
    /// front, losing a battle is impossible: both have already received
    /// everything the game promised for their dollar, and only the bonus is
    /// split.
    function test_battle_neitherHasATicketUntilItIsSettled() public {
        uint256 aliceBefore = _tickets(alice);
        uint256 bobBefore = _tickets(bob);
        uint256 escrowBefore = deck.battleEscrow();

        _joined();

        assertEq(_tickets(alice), aliceBefore, "no ticket has been bought for the creator yet");
        assertEq(_tickets(bob), bobBefore, "the opponent's too");
        assertEq(deck.deckAt(0).drawn, 2, "two slots left the deck");

        uint256 price = MEGAPOT.ticketPrice();
        assertEq(deck.battleEscrow() - escrowBefore, price * 2, "both dollars are set aside");
    }

    /// Stakes cannot be spent on other people's prizes.
    ///
    /// A battle's money sits on the same balance as the treasury. If it counted
    /// as free, a TESA exchange would hand it out to others, and the very first
    /// settled battle would not be able to buy the winner their tickets.
    function test_battle_stakeIsNotSpendableTreasury() public {
        uint256 spendableBefore = deck.spendable();
        _joined();

        assertEq(deck.spendable(), spendableBefore, "the stakes were not added to the treasury");
    }

    function test_battle_winnerTakesBothBonuses() public {
        uint256 id = _joined();
        _attest(true);

        // 2 -> weight 25, 3 -> weight 5
        (address winner, uint256 banked) = deck.resolveBattle(id, 2, _sigs(), 3, _sigs());

        assertEq(winner, alice);
        assertEq(banked, 30, "the bank is the sum of both weights");
        assertEq(deck.bankedWeight(alice), 30);
        assertEq(deck.bankedWeight(bob), 0, "the loser got nothing");
    }

    /// The winner takes BOTH tickets, the loser none.
    ///
    /// Here is the price of the stake. The loser's dollar did not vanish from
    /// the game: it became the winner's second ticket and brought in the same
    /// referral commission as always.
    function test_battle_winnerTakesBothTicketsAndLoserGetsNone() public {
        uint256 aliceBefore = _tickets(alice);
        uint256 bobBefore = _tickets(bob);

        uint256 id = _joined();
        _attest(true);
        // 2 -> weight 25 for alice, 3 -> weight 5 for bob
        (address winner,) = deck.resolveBattle(id, 2, _sigs(), 3, _sigs());
        assertEq(winner, alice);

        uint256 one = _ticketBps();
        assertEq(_tickets(alice) - aliceBefore, one * 2, "two tickets to the winner");
        assertEq(_tickets(bob), bobBefore, "the one who lost was left with nothing");
        assertEq(deck.battleEscrow(), 0, "what was set aside is spent in full");
    }

    /// Equal weight: the rarer slot wins, that is, the lower value.
    ///
    /// The first of the two rules that make a battle a battle. Without it the
    /// most frequent outcome is a draw in which nothing happens.
    function test_battle_equalWeightIsDecidedByTheRarerSlot() public {
        uint256 id = _joined();
        _attest(true);

        // 3 and 4 weigh the same (5 each), but 3 is rarer
        (address winner, uint256 banked) = deck.resolveBattle(id, 3, _sigs(), 4, _sigs());

        assertEq(winner, alice, "the lower value wins");
        assertEq(banked, 10, "the bank is both weights");
        assertEq(deck.bankedWeight(alice), 10);
        assertEq(deck.bankedWeight(bob), 0, "there are no draws any more");
    }

    /// The same the other way round, so the check catches the comparison rather
    /// than alice.
    function test_battle_rarerSlotWinsForTheJoinerToo() public {
        uint256 id = _joined();
        _attest(true);

        (address winner,) = deck.resolveBattle(id, 4, _sigs(), 3, _sigs());

        assertEq(winner, bob, "the opponent has the rarer slot, so they win");
    }

    /// A battle costs the game exactly as much as two ordinary opens.
    ///
    /// This is the game's main constraint, and a stake has no right to move it.
    /// What changes is WHO gets the two tickets, not how many were bought and
    /// how much commission they brought in. Otherwise battles would become a
    /// hole through which more flows out of the game than it earns.
    function test_battle_costsTheGameExactlyTwoOpens() public {
        uint256 feeBefore = deck.feesClaimable();

        // Control: two ordinary opens.
        vm.startPrank(carol);
        deck.openCase(0);
        deck.openCase(0);
        vm.stopPrank();
        uint256 feeFromTwoOpens = deck.feesClaimable() - feeBefore;
        assertGt(feeFromTwoOpens, 0, "opens do bring something in");

        // The same volume, but as a battle.
        uint256 mid = deck.feesClaimable();
        uint256 id = _joined();
        _attest(true);
        deck.resolveBattle(id, 2, _sigs(), 3, _sigs());

        assertEq(
            deck.feesClaimable() - mid, feeFromTwoOpens, "the battle brought the same commission"
        );
    }

    /// Both empty, the most frequent case, and there is a winner in it too.
    ///
    /// This is exactly where the old mechanic broke: a 0:0 draw in which nothing
    /// happens. Now the tickets themselves are the prize, and they have an
    /// addressee.
    function test_battle_bothEmptyStillHasAWinner() public {
        uint256 aliceBefore = _tickets(alice);
        uint256 id = _joined();
        _attest(true);

        (address winner, uint256 banked) = deck.resolveBattle(id, 40, _sigs(), 41, _sigs());

        assertEq(winner, alice, "40 is rarer than 41");
        assertEq(banked, 0, "neither of them has any weight");
        assertEq(_tickets(alice) - aliceBefore, _ticketBps() * 2, "but there are two tickets");
    }

    /// The vault weighs zero but outranks everything in a battle, and does not burn.
    function test_battle_vaultSlotWinsAndSurvives() public {
        uint256 id = _joined();
        _attest(true);

        // 1 is the vault for the creator, 2 is five tickets for the opponent
        (address winner, uint256 banked) = deck.resolveBattle(id, 1, _sigs(), 2, _sigs());

        assertEq(winner, alice, "the vault beats even porphyry");
        assertEq(banked, 25, "the bank is the opponent's weight, the vault weighs zero");

        bytes32 handle = deck.handleOf(alice, 0);
        assertFalse(deck.shardSpent(handle), "the vault slot is not burned");

        vm.prank(alice);
        uint256 paid = deck.claimVault(0, 1, _sigs());
        assertGt(paid, 0, "the vault opens all the same");
    }

    /// A won bank is exchanged for real tickets through claimBanked.
    function test_battle_bankedTurnsIntoTickets() public {
        uint256 id = _joined();
        _attest(true);
        deck.resolveBattle(id, 2, _sigs(), 3, _sigs());

        _fund(6e6);

        uint256 before = _tickets(alice);
        vm.prank(alice);
        (uint256 tickets,) = deck.claimBanked();

        assertEq(tickets, 6, "thirty weight is six tickets");
        // Megapot counts tickets in bps and takes its 15% before crediting, so
        // a dollar is 8500 rather than 10000.
        assertEq(_tickets(alice) - before, 6 * 8500, "six real tickets");
    }

    // -- the rules of entry --------------------------------------------------

    function test_battle_cannotFightYourself() public {
        vm.prank(alice);
        (uint256 id,) = deck.openBattle(0);

        vm.prank(alice);
        vm.expectRevert(TesseraDeck.CannotFightYourself.selector);
        deck.joinBattle(id);
    }

    function test_battle_cannotJoinTwice() public {
        uint256 id = _joined();
        address third = makeAddr("third");
        IMintable(address(MPUSDC)).mint(third, 100e6);
        vm.startPrank(third);
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

    // -- an abandoned battle -------------------------------------------------

    /// The opponent never came, and the dollar becomes a ticket all the same.
    ///
    /// There was no battle, so there was no stake: the player should get exactly
    /// what an ordinary open would have given. The money cannot be returned, the
    /// slot has already been drawn from the deck, and a refund would make it
    /// free.
    function test_battle_abandonBuysTheTicketAfterAll() public {
        uint256 before = _tickets(alice);
        vm.prank(alice);
        (uint256 id,) = deck.openBattle(0);
        assertEq(_tickets(alice), before, "while the battle hangs there is no ticket");

        vm.warp(block.timestamp + deck.BATTLE_TIMEOUT());
        vm.prank(alice);
        deck.abandonBattle(id);

        assertEq(_tickets(alice) - before, _ticketBps(), "exactly one ticket");
        assertEq(deck.battleEscrow(), 0, "what was set aside holds nothing");
    }

    function test_battle_abandonReturnsTheCard() public {
        vm.prank(alice);
        (uint256 id, uint64 slotIndex) = deck.openBattle(0);

        vm.warp(block.timestamp + deck.BATTLE_TIMEOUT());
        vm.prank(alice);
        deck.abandonBattle(id);

        // the card is free now, so it can be both revealed and exchanged
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

    // -- views for the interface -----------------------------------------------

    function test_battle_openListShowsWaitingOnly() public {
        vm.prank(alice);
        (uint256 first,) = deck.openBattle(0);
        vm.prank(alice);
        (uint256 second,) = deck.openBattle(0);

        uint256[] memory open = deck.openBattleIds(10);
        assertEq(open.length, 2);
        assertEq(open[0], second, "newest first");
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

    // -- a stake waiting on a battle -------------------------------------------

    /// A stake is decided by the next card. If that card went into a battle the
    /// stake waits, and the player sees why rather than failing on signatures
    /// that do not exist.
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
