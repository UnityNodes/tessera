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

/// Risk it or take it.
///
/// The main thing checked here is not "it works" but "it cannot do harm": a
/// player never loses money, somebody else's stake cannot be closed, a stake
/// cannot be settled with an already known slot, and the game cannot pay out more
/// than it set aside in the decks.
contract TesseraStakeTest is Test {
    IMegapot constant MEGAPOT = IMegapot(0x6f03c7BCaDAdBf5E6F5900DA3d56AdD8FbDac5De);
    IERC20 constant MPUSDC = IERC20(0xA4253E7C13525287C56550b8708100f93E60509f);

    uint16 constant DECK = 80;
    uint16 constant PRIZE_MAX = 20; // values 1 to 20 weigh one each

    TesseraDeck deck;
    address owner = makeAddr("owner");
    address player = makeAddr("player");
    address other = makeAddr("other");
    address verifier;

    function setUp() public {
        vm.createSelectFork(vm.envOr("BASE_SEPOLIA_RPC_URL", Fork.BASE_SEPOLIA));

        MegapotLegacyAdapter adapter = new MegapotLegacyAdapter(MEGAPOT);
        deck = DeployTessera.behindProxy(adapter, owner);

        vm.deal(owner, 1 ether);
        uint256 fee = deck.deckFee(DECK);
        uint16[] memory upTo = new uint16[](1);
        uint16[] memory weight = new uint16[](1);
        upTo[0] = PRIZE_MAX;
        weight[0] = 1;
        vm.prank(owner);
        deck.createDeck{value: fee}(DECK, upTo, weight, 0);

        // These tests are about ordinary prizes, so the vault is switched off
        // explicitly: otherwise half the commission would go past them and the
        // arithmetic would drift.
        vm.prank(owner);
        deck.setVaultShare(0);

        IMintable(address(MPUSDC)).mint(player, 1000e6);
        IMintable(address(MPUSDC)).mint(other, 1000e6);
        verifier = address(inco.incoVerifier());
    }

    function _attest(bool valid) internal {
        vm.mockCall(
            verifier,
            abi.encodeWithSignature("isValidDecryptionAttestation((bytes32,bytes32),bytes[])"),
            abi.encode(valid)
        );
    }

    function _open(address who, uint256 n) internal {
        vm.startPrank(who);
        MPUSDC.approve(address(deck), type(uint256).max);
        for (uint256 i = 0; i < n; i++) {
            deck.openCase(0);
        }
        vm.stopPrank();
    }

    /// A stake on n of the player's slots, each with value 1 (weight 1).
    function _stakeArgs(uint256 n)
        internal
        pure
        returns (uint256[] memory idx, uint256[] memory vals, bytes[][] memory sigs)
    {
        idx = new uint256[](n);
        vals = new uint256[](n);
        sigs = new bytes[][](n);
        for (uint256 i = 0; i < n; i++) {
            idx[i] = i;
            vals[i] = 1;
            sigs[i] = new bytes[](2);
        }
    }

    function _sigs() internal pure returns (bytes[] memory s) {
        s = new bytes[](2);
    }

    // -- the basic path ---------------------------------------------------------

    function test_stake_burnsSlotsAndOpensAStake() public {
        _open(player, 12);
        _attest(true);
        (uint256[] memory idx, uint256[] memory vals, bytes[][] memory sigs) = _stakeArgs(5);

        bytes32 h0 = deck.handleOf(player, 0);
        vm.prank(player);
        (uint256 weight, uint64 deciding) = deck.stake(idx, vals, sigs);

        assertEq(weight, 5);
        assertEq(deciding, 12, "the next slot decides it, and there is none yet");
        assertTrue(deck.shardSpent(h0), "the staked slots burned at once");
        (,, bool open) = deck.stakeOf(player);
        assertTrue(open);
    }

    /// Won, so the weight doubled.
    function test_settle_winDoublesTheWeight() public {
        _open(player, 12);
        _attest(true);
        (uint256[] memory idx, uint256[] memory vals, bytes[][] memory sigs) = _stakeArgs(5);
        vm.prank(player);
        deck.stake(idx, vals, sigs);

        _open(player, 1); // slot 12 is the deciding one

        vm.prank(player);
        (bool won, uint256 banked) = deck.settleStake(3, _sigs()); // 3 <= PRIZE_MAX, so a prize

        assertTrue(won);
        assertEq(banked, 10, "five staked became ten");
        assertEq(deck.bankedWeight(player), 10);
        (,, bool open) = deck.stakeOf(player);
        assertFalse(open);
    }

    /// Lost, so the weight burned, but the tickets bought with dollars stayed.
    function test_settle_lossBurnsWeightButKeepsTickets() public {
        _open(player, 12);
        (uint256 ticketsBefore,,) = MEGAPOT.usersInfo(player);
        _attest(true);
        (uint256[] memory idx, uint256[] memory vals, bytes[][] memory sigs) = _stakeArgs(5);
        vm.prank(player);
        deck.stake(idx, vals, sigs);

        _open(player, 1);

        vm.prank(player);
        (bool won, uint256 banked) = deck.settleStake(PRIZE_MAX + 1, _sigs()); // empty

        assertFalse(won);
        assertEq(banked, 0);
        assertEq(deck.bankedWeight(player), 0);

        (uint256 ticketsAfter,,) = MEGAPOT.usersInfo(player);
        assertGt(ticketsAfter, ticketsBefore, "the tickets for the dollars paid went nowhere");
    }

    /// A vault card wins a stake too, it is not empty either.
    ///
    /// A vault slot weighs zero, because its payout is money rather than tickets.
    /// While settlement looked only at weight, the best card in the deck BURNED
    /// the stake: a player found the vault and lost what they had staked at the
    /// same time. A battle had known this exception for a long time (`_power`),
    /// stake settlement had not, and no test caught it, because there is no vault
    /// in the other tests at all.
    function test_settle_theVaultCardWinsTheStake() public {
        // A deck with a vault: value 1 opens the vault and weighs zero, 2 to 21
        // weigh one each.
        uint16[] memory upTo = new uint16[](2);
        uint16[] memory weight = new uint16[](2);
        upTo[0] = 1;
        weight[0] = 0;
        upTo[1] = 21;
        weight[1] = 1;

        uint256 fee = deck.deckFee(DECK);
        vm.deal(owner, 1 ether);
        vm.prank(owner);
        uint32 vaulted = deck.createDeck{value: fee}(DECK, upTo, weight, 1);

        vm.startPrank(player);
        MPUSDC.approve(address(deck), type(uint256).max);
        for (uint256 i = 0; i < 6; i++) deck.openCase(vaulted);
        vm.stopPrank();

        // We stake five ordinary prizes of the same deck, value 2.
        _attest(true);
        uint256[] memory idx = new uint256[](5);
        uint256[] memory vals = new uint256[](5);
        bytes[][] memory sigs = new bytes[][](5);
        for (uint256 i = 0; i < 5; i++) {
            idx[i] = i;
            vals[i] = 2;
            sigs[i] = new bytes[](2);
        }
        vm.prank(player);
        (uint256 staked, uint64 deciding) = deck.stake(idx, vals, sigs);
        assertEq(staked, 5);
        assertEq(deciding, 6);

        vm.prank(player);
        deck.openCase(vaulted); // slot 6 is the deciding one

        vm.prank(player);
        (bool won, uint256 banked) = deck.settleStake(1, _sigs()); // 1 is the vault card

        assertTrue(won, "a vault card is not empty");
        assertEq(banked, 10, "five staked became ten");
        assertFalse(
            deck.shardSpent(deck.handleOf(player, 6)),
            "settling a stake does not burn the vault itself, it is still to be claimed"
        );
    }

    function test_claimBanked_buysRealTickets() public {
        // 25 opens is $2.50 of commission, and two tickets cost $2.
        _open(player, 25);
        _attest(true);
        (uint256[] memory idx, uint256[] memory vals, bytes[][] memory sigs) = _stakeArgs(5);
        vm.prank(player);
        deck.stake(idx, vals, sigs);
        _open(player, 1);
        vm.prank(player);
        deck.settleStake(3, _sigs());

        (uint256 before,,) = MEGAPOT.usersInfo(player);
        assertEq(deck.bankedWeight(player), 10);
        vm.prank(player);
        (uint256 tickets, uint256 paid) = deck.claimBanked();
        (uint256 later,,) = MEGAPOT.usersInfo(player);

        assertEq(tickets, 2, "ten weight is two tickets");
        assertEq(paid, 2_000_000);
        assertEq(later - before, 2 * 8500);
        assertEq(deck.bankedWeight(player), 0);
    }

    // -- what cannot be done -----------------------------------------------------

    /// A stake cannot be settled with a slot the player has already seen.
    function test_settle_revertsBeforeTheDecidingSlotExists() public {
        _open(player, 12);
        _attest(true);
        (uint256[] memory idx, uint256[] memory vals, bytes[][] memory sigs) = _stakeArgs(5);
        vm.prank(player);
        deck.stake(idx, vals, sigs);

        vm.prank(player);
        vm.expectRevert(TesseraDeck.StakeNotSettled.selector);
        deck.settleStake(3, _sigs());
    }

    function test_stake_onlyOneAtATime() public {
        _open(player, 12);
        _attest(true);
        (uint256[] memory idx, uint256[] memory vals, bytes[][] memory sigs) = _stakeArgs(5);
        vm.prank(player);
        deck.stake(idx, vals, sigs);

        (uint256[] memory idx2, uint256[] memory vals2, bytes[][] memory sigs2) = _stakeArgs(5);
        idx2[0] = 5;
        idx2[1] = 6;
        idx2[2] = 7;
        idx2[3] = 8;
        idx2[4] = 9;
        vm.prank(player);
        vm.expectRevert(TesseraDeck.StakeAlreadyOpen.selector);
        deck.stake(idx2, vals2, sigs2);
    }

    function test_settle_revertsWithoutStake() public {
        _open(player, 2);
        _attest(true);
        vm.prank(player);
        vm.expectRevert(TesseraDeck.NoStakeOpen.selector);
        deck.settleStake(1, _sigs());
    }

    /// Somebody else's stake cannot be closed: a stake lives at the address of
    /// whoever staked it.
    function test_settle_isPerPlayer() public {
        _open(player, 12);
        _attest(true);
        (uint256[] memory idx, uint256[] memory vals, bytes[][] memory sigs) = _stakeArgs(5);
        vm.prank(player);
        deck.stake(idx, vals, sigs);
        _open(player, 1);

        vm.prank(other);
        vm.expectRevert(TesseraDeck.NoStakeOpen.selector);
        deck.settleStake(3, _sigs());
    }

    /// Staking what is already staked will not work.
    function test_stake_rejectsSpentSlot() public {
        _open(player, 12);
        _attest(true);
        (uint256[] memory idx, uint256[] memory vals, bytes[][] memory sigs) = _stakeArgs(5);
        vm.prank(player);
        deck.stake(idx, vals, sigs);
        _open(player, 1);
        vm.prank(player);
        deck.settleStake(3, _sigs());

        bytes32 h0 = deck.handleOf(player, 0);
        (uint256[] memory again, uint256[] memory v2, bytes[][] memory s2) = _stakeArgs(5);
        vm.prank(player);
        vm.expectRevert(abi.encodeWithSelector(TesseraDeck.ShardAlreadySpent.selector, h0));
        deck.stake(again, v2, s2);
    }

    /// Without the covalidators' signature a stake is not accepted.
    function test_stake_rejectsBadAttestation() public {
        _open(player, 12);
        _attest(false);
        (uint256[] memory idx, uint256[] memory vals, bytes[][] memory sigs) = _stakeArgs(5);
        bytes32 h0 = deck.handleOf(player, 0);
        vm.prank(player);
        vm.expectRevert(abi.encodeWithSelector(TesseraDeck.BadAttestation.selector, h0));
        deck.stake(idx, vals, sigs);
    }

    function test_claimBanked_revertsWithNothing() public {
        vm.prank(player);
        vm.expectRevert(TesseraDeck.NothingBanked.selector);
        deck.claimBanked();
    }

    /// Doubling can outrun the treasury: the budget is measured in weight, and
    /// the dollars come in ten cents at a time per open. Then the payout has to
    /// refuse honestly and wait rather than issue a ticket on credit.
    function test_claimBanked_waitsForTheTreasuryToCatchUp() public {
        _open(player, 12); // only $1.20
        _attest(true);
        (uint256[] memory idx, uint256[] memory vals, bytes[][] memory sigs) = _stakeArgs(5);
        vm.prank(player);
        deck.stake(idx, vals, sigs);
        _open(player, 1);
        vm.prank(player);
        deck.settleStake(3, _sigs());

        vm.prank(player);
        vm.expectRevert(abi.encodeWithSelector(TesseraDeck.TreasuryEmpty.selector, 1_300_000, 2_000_000));
        deck.claimBanked();

        // The game catches up, and the same weight is taken with no changes at all.
        _open(player, 10);
        vm.prank(player);
        (uint256 tickets,) = deck.claimBanked();
        assertEq(tickets, 2, "the weight went nowhere, it simply waited");
    }

    // -- the solvency limit --------------------------------------------------------

    /// The main guarantee: however much anyone doubles, the game cannot hand out
    /// more weight than it set aside in the decks.
    function test_budget_cannotPayMoreThanTheDecksHold() public {
        assertEq(deck.budgetWeight(), PRIZE_MAX, "budget equals the deck's total weight");
        assertEq(deck.budgetLeft(), PRIZE_MAX);

        _open(player, 40);
        _attest(true);

        // Double until we hit the ceiling.
        uint256 guard = 0;
        while (deck.budgetLeft() > 0 && guard < 6) {
            guard++;
            (uint256[] memory idx, uint256[] memory vals, bytes[][] memory sigs) = _stakeArgs(5);
            for (uint256 i = 0; i < 5; i++) idx[i] = guard * 5 + i;
            vm.prank(player);
            deck.stake(idx, vals, sigs);
            _open(player, 1);
            vm.prank(player);
            deck.settleStake(1, _sigs());
            vm.prank(player);
            try deck.claimBanked() {} catch {}
        }

        assertLe(deck.paidWeight(), deck.budgetWeight(), "the payouts did not exceed the budget");
        console.log("paid:", deck.paidWeight(), "budget:", deck.budgetWeight());
    }

    /// When the budget is exhausted the payout refuses honestly rather than
    /// quietly printing.
    function test_claimBanked_stopsAtTheCeiling() public {
        _open(player, 40);
        _attest(true);

        // Eat the budget away with ordinary exchanges.
        for (uint256 round = 0; round < 4; round++) {
            (uint256[] memory idx, uint256[] memory vals, bytes[][] memory sigs) = _stakeArgs(5);
            for (uint256 i = 0; i < 5; i++) idx[i] = round * 5 + i;
            vm.prank(player);
            try deck.redeem(idx, vals, sigs) {} catch {}
        }

        assertEq(deck.budgetLeft(), 0, "the budget is exhausted");

        // Now no stake is able to pull out more.
        (uint256[] memory idx2, uint256[] memory vals2, bytes[][] memory sigs2) = _stakeArgs(5);
        for (uint256 i = 0; i < 5; i++) idx2[i] = 20 + i;
        vm.prank(player);
        deck.stake(idx2, vals2, sigs2);
        _open(player, 1);
        vm.prank(player);
        deck.settleStake(1, _sigs());

        assertEq(deck.bankedWeight(player), 10, "the weight is won");
        vm.prank(player);
        vm.expectRevert(abi.encodeWithSelector(TesseraDeck.NotEnoughWeight.selector, 0, 5));
        deck.claimBanked();
    }
}
