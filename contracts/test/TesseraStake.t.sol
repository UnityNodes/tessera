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
contract TesseraStakeTest is Test {
    IMegapot constant MEGAPOT = IMegapot(0x6f03c7BCaDAdBf5E6F5900DA3d56AdD8FbDac5De);
    IERC20 constant MPUSDC = IERC20(0xA4253E7C13525287C56550b8708100f93E60509f);

    uint16 constant DECK = 60;
    uint16 constant PRIZE_MAX = 20; // 1..20

    TesseraDeck deck;
    address owner = makeAddr("owner");
    address player = makeAddr("player");
    address other = makeAddr("other");
    address verifier;

    function setUp() public {
        vm.createSelectFork(vm.envOr("BASE_SEPOLIA_RPC_URL", string("https://sepolia.base.org")));

        MegapotLegacyAdapter adapter = new MegapotLegacyAdapter(MEGAPOT);
        vm.prank(owner);
        deck = new TesseraDeck(adapter);

        vm.deal(owner, 1 ether);
        uint256 fee = deck.deckFee(DECK);
        uint16[] memory upTo = new uint16[](1);
        uint16[] memory weight = new uint16[](1);
        upTo[0] = PRIZE_MAX;
        weight[0] = 1;
        vm.prank(owner);
        deck.createDeck{value: fee}(DECK, upTo, weight, 0);

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


    function test_stake_burnsSlotsAndOpensAStake() public {
        _open(player, 12);
        _attest(true);
        (uint256[] memory idx, uint256[] memory vals, bytes[][] memory sigs) = _stakeArgs(5);

        bytes32 h0 = deck.handleOf(player, 0);
        vm.prank(player);
        (uint256 weight, uint64 deciding) = deck.stake(idx, vals, sigs);

        assertEq(weight, 5);
        assertEq(deciding, 12, unicode", ");
        assertTrue(deck.shardSpent(h0), unicode"");
        (,, bool open) = deck.stakeOf(player);
        assertTrue(open);
    }

    function test_settle_winDoublesTheWeight() public {
        _open(player, 12);
        _attest(true);
        (uint256[] memory idx, uint256[] memory vals, bytes[][] memory sigs) = _stakeArgs(5);
        vm.prank(player);
        deck.stake(idx, vals, sigs);

        _open(player, 1); // 12 ,

        vm.prank(player);
        (bool won, uint256 banked) = deck.settleStake(3, _sigs()); // 3 <= PRIZE_MAX,

        assertTrue(won);
        assertEq(banked, 10, unicode"'");
        assertEq(deck.bankedWeight(player), 10);
        (,, bool open) = deck.stakeOf(player);
        assertFalse(open);
    }

    function test_settle_lossBurnsWeightButKeepsTickets() public {
        _open(player, 12);
        (uint256 ticketsBefore,,) = MEGAPOT.usersInfo(player);
        _attest(true);
        (uint256[] memory idx, uint256[] memory vals, bytes[][] memory sigs) = _stakeArgs(5);
        vm.prank(player);
        deck.stake(idx, vals, sigs);

        _open(player, 1);

        vm.prank(player);
        (bool won, uint256 banked) = deck.settleStake(PRIZE_MAX + 1, _sigs()); //

        assertFalse(won);
        assertEq(banked, 0);
        assertEq(deck.bankedWeight(player), 0);

        (uint256 ticketsAfter,,) = MEGAPOT.usersInfo(player);
        assertGt(ticketsAfter, ticketsBefore, unicode"");
    }

    function test_claimBanked_buysRealTickets() public {
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

        assertEq(tickets, 2, unicode"");
        assertEq(paid, 2_000_000);
        assertEq(later - before, 2 * 8500);
        assertEq(deck.bankedWeight(player), 0);
    }


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

    function test_claimBanked_waitsForTheTreasuryToCatchUp() public {
        _open(player, 12); // $1.20
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

        _open(player, 10);
        vm.prank(player);
        (uint256 tickets,) = deck.claimBanked();
        assertEq(tickets, 2, unicode", ");
    }


    function test_budget_cannotPayMoreThanTheDecksHold() public {
        assertEq(deck.budgetWeight(), PRIZE_MAX, unicode"= ");
        assertEq(deck.budgetLeft(), PRIZE_MAX);

        _open(player, 40);
        _attest(true);

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

        assertLe(deck.paidWeight(), deck.budgetWeight(), unicode"");
        console.log("paid:", deck.paidWeight(), "budget:", deck.budgetWeight());
    }

    function test_claimBanked_stopsAtTheCeiling() public {
        _open(player, 40);
        _attest(true);

        for (uint256 round = 0; round < 4; round++) {
            (uint256[] memory idx, uint256[] memory vals, bytes[][] memory sigs) = _stakeArgs(5);
            for (uint256 i = 0; i < 5; i++) idx[i] = round * 5 + i;
            vm.prank(player);
            try deck.redeem(idx, vals, sigs) {} catch {}
        }

        assertEq(deck.budgetLeft(), 0, unicode"");

        (uint256[] memory idx2, uint256[] memory vals2, bytes[][] memory sigs2) = _stakeArgs(5);
        for (uint256 i = 0; i < 5; i++) idx2[i] = 20 + i;
        vm.prank(player);
        deck.stake(idx2, vals2, sigs2);
        _open(player, 1);
        vm.prank(player);
        deck.settleStake(1, _sigs());

        assertEq(deck.bankedWeight(player), 10, unicode"");
        vm.prank(player);
        vm.expectRevert(abi.encodeWithSelector(TesseraDeck.NotEnoughWeight.selector, 0, 5));
        deck.claimBanked();
    }
}
