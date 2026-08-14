// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test} from "forge-std/Test.sol";
import {TesseraDeck} from "../src/TesseraDeck.sol";
import {DeployTessera} from "./helpers/DeployTessera.sol";
import {MegapotLegacyAdapter} from "../src/adapters/MegapotLegacyAdapter.sol";
import {IMegapot} from "../src/interfaces/IMegapot.sol";
import {Fork} from "./helpers/Fork.sol";

/// Where the bonus tickets come from.
///
/// The player's dollar goes whole into Megapot and buys a real ticket. What the
/// game gets back is the referral commission alone, ten cents, and that is the
/// ONLY money it has at all. Part of it settles into the vaults, the rest buys
/// bonus tickets.
///
/// So a deck has no right to promise more in prizes than the treasury share of
/// its own opens will bring in. The old limit counted the full ten cents and
/// forgot about the vault, so a deck at the limit promised exactly twice as much
/// as there was to pay with. The error failed neither at the cut nor at the open,
/// it waited for the first person to come and exchange a prize.
contract TesseraBudgetTest is Test {
    IMegapot constant MEGAPOT = IMegapot(0x6f03c7BCaDAdBf5E6F5900DA3d56AdD8FbDac5De);

    TesseraDeck game;
    address owner = makeAddr("owner");

    function setUp() public {
        vm.createSelectFork(vm.envOr("BASE_SEPOLIA_RPC_URL", Fork.BASE_SEPOLIA));
        MegapotLegacyAdapter adapter = new MegapotLegacyAdapter(MEGAPOT);
        game = DeployTessera.behindProxy(adapter, owner);
        vm.deal(owner, 10 ether);
    }

    /// A deck of weight `w` over `n` slots. Returns true if it was cut.
    function _cut(uint16 n, uint16 w) internal returns (bool) {
        uint16[] memory upTo = new uint16[](2);
        uint16[] memory weight = new uint16[](2);
        upTo[0] = 1;
        weight[0] = 0;
        upTo[1] = 1 + w;
        weight[1] = 1;
        uint256 fee = game.deckFee(n);
        vm.prank(owner);
        try game.createDeck{value: fee}(n, upTo, weight, 1) {
            return true;
        } catch {
            return false;
        }
    }

    /// Half the commission in the vaults means half is left for prizes.
    ///
    /// This is the same limit the old version let through: 100 weight over 200
    /// slots promises $20, and the treasury share of those two hundred opens
    /// gives $10.
    function test_deckAtOldCeilingIsRefused() public {
        assertEq(game.vaultShareBps(), 5000, "the usual vault share is a half");
        assertFalse(_cut(200, 100), "a deck that promises twice the money is not cut");
        assertTrue(_cut(200, 50), "a deck within the treasury half is cut");
    }

    /// The limit moves along with the vault share rather than standing still.
    function test_ceilingFollowsTheVaultShare() public {
        vm.prank(owner);
        game.setVaultShare(0);
        assertTrue(_cut(200, 100), "with no vault the prizes get all ten cents");

        // From here the board already holds weight 100 over 200 slots, that is,
        // exactly the ceiling at a zero vault. There is nowhere left to raise
        // the vault share to.
        assertEq(game.maxVaultShare(), 0, "there is no room left for the vault");
    }

    /// The vault share cannot be raised retroactively: that takes money away
    /// from prizes the decks have already promised.
    function test_vaultShareCannotStarvePromisedPrizes() public {
        vm.prank(owner);
        game.setVaultShare(0);
        assertTrue(_cut(100, 50), "the deck is exactly at the limit with a zero vault");

        vm.prank(owner);
        vm.expectRevert(TesseraDeck.ShareStarvesPrizes.selector);
        game.setVaultShare(5000);

        assertEq(game.vaultShareBps(), 0, "the share did not change");
    }

    /// Lowering the share is always allowed: it only leaves more for prizes.
    function test_vaultShareCanAlwaysGoDown() public {
        assertTrue(_cut(200, 50), "the deck is within half");

        vm.prank(owner);
        game.setVaultShare(2000);
        assertEq(game.vaultShareBps(), 2000, "lowering it is allowed");

        // And now more weight has been freed up for decks than there was.
        assertTrue(_cut(200, 80), "with the vault at 20% the limit is 80 weight over 200 slots");
    }

    /// maxVaultShare says the same thing setVaultShare checks.
    ///
    /// A test of its own, because those two can diverge silently: the hint would
    /// show one number and the transaction would fail on that very number.
    function test_maxVaultShareMatchesTheGuard() public {
        _cut(200, 50);
        uint16 max = game.maxVaultShare();

        vm.prank(owner);
        game.setVaultShare(max);
        assertEq(game.vaultShareBps(), max, "exactly at the limit, it passes");

        if (max < 10_000) {
            vm.prank(owner);
            vm.expectRevert(TesseraDeck.ShareStarvesPrizes.selector);
            game.setVaultShare(max + 1);
        }
    }
}

/// The same check, but on the LIVE board.
///
/// The numbers here are not invented: six decks that have already been cut, are
/// already on sale and have already promised players their weight. There is one
/// question, will the commission be enough when the first of them comes to
/// exchange.
contract TesseraLiveBudgetTest is Test {
    address payable constant LIVE = payable(0x985520De2A14BD443d06DcA07A57Ef4F349bd8B1);

    function setUp() public {
        vm.createSelectFork(vm.envOr("BASE_SEPOLIA_RPC_URL", Fork.BASE_SEPOLIA));
    }

    /// How much the live game promises and how much the commission will bring.
    ///
    /// The test was written when it did not add up: six decks promised $79.20 and
    /// the commission at a vault share of half gave $50, and it asserted exactly
    /// that, together with a recipe ("lower the share and everything is
    /// covered"). The recipe was applied: the logic was upgraded and the share in
    /// the chain was lowered.
    ///
    /// So the assertion is inverted. Leaving the old one was not possible: it
    /// would fail exactly when the board is fine, and would require whoever saw
    /// it to guess that the failure means success. What stands here now is a
    /// property that has to hold always, and it will break exactly when the board
    /// breaks.
    function test_liveBoard_coversWhatItPromised() public view {
        TesseraDeck game = TesseraDeck(LIVE);

        // Slots are counted WITH the reshuffles: every fresh cut both promises
        // its weight anew and sells its slots anew. Counting the sizes alone
        // would mean comparing the promise of two cuts against the commission of
        // one, and raising an alarm where everything adds up.
        uint256 slots;
        for (uint32 i = 0; i < game.deckCount(); i++) {
            slots += uint256(game.deckAt(i).size) * (1 + game.reseals(i));
        }

        // Promised: weight / 5 tickets at a dollar each.
        uint256 promised = (game.budgetWeight() * 1e6) / 5;
        // Will bring in: slot x 10 cents x the treasury share.
        uint256 funded = (slots * 1e5 * (10_000 - game.vaultShareBps())) / 10_000;

        assertGe(funded, promised, "the commission will not cover what is already promised");

        // And the same limit from the share side: setVaultShare will no longer
        // allow the vault share to be raised above this figure.
        assertGe(
            game.maxVaultShare(),
            game.vaultShareBps(),
            "the vault share stands above its own ceiling"
        );
    }

    /// Decks that promise beyond the budget are not copied after the fix.
    ///
    /// Only the REFUSAL is checked, and that is deliberate: in `_createDeck` the
    /// limit stands BEFORE `e.shuffledRange`, so a refusal costs one call while a
    /// successful cut costs a real shuffle on a fork. The successful side is
    /// proved by the neighbouring test_liveBoard_cutsCopiesItCanFund.
    ///
    /// The "cut a copy" button on the site asks the same rule. Those two answers
    /// can diverge silently: the screen draws the button, the chain rejects it,
    /// and the owner finds out about it in their wallet.
    function test_liveBoard_refusesCopiesItCannotFund() public {
        TesseraDeck game = TesseraDeck(LIVE);

        TesseraDeck next = new TesseraDeck();
        vm.startPrank(game.owner());
        game.upgradeToAndCall(address(next), "");
        game.setVaultShare(game.maxVaultShare());
        vm.stopPrank();

        uint16 share = game.vaultShareBps();
        uint256 refused;

        for (uint32 id = 0; id < game.deckCount(); id++) {
            TesseraDeck.Deck memory d = game.deckAt(id);
            TesseraDeck.Tier[] memory t = game.tiers(id);

            uint16[] memory upTo = new uint16[](t.length);
            uint16[] memory weight = new uint16[](t.length);
            uint256 w;
            uint16 prev;
            for (uint256 i = 0; i < t.length; i++) {
                upTo[i] = t[i].upTo;
                weight[i] = t[i].weight;
                w += uint256(t[i].upTo - prev) * t[i].weight;
                prev = t[i].upTo;
            }
            if (w * 2 * 10_000 <= uint256(d.size) * (10_000 - share)) continue;

            address boss = game.owner();
            vm.deal(boss, 1 ether);
            vm.prank(boss);
            vm.expectRevert(TesseraDeck.TooManyShardSlots.selector);
            game.createDeck{value: 0}(d.size, upTo, weight, d.vaultUpTo);
            refused++;
        }

        assertGt(refused, 0, "the board really does have decks beyond budget");
    }

    /// And the ones that do fit are cut.
    ///
    /// Half of an answer, without which the other half is worth nothing: a rule
    /// that rejects everything also "does not let anything too large through".
    /// So here a real copy of a real deck from the live board is cut.
    ///
    /// The call is direct, without try/catch, and that is not a detail. The first
    /// version of this check wrapped createDeck in a try, and the shuffle of 200
    /// cards ate a billion gas and seventy minutes before failing. It looked like
    /// a fault in the rule and was a fault in the scaffolding: try leaves the
    /// callee 63/64 of the gas and swallows the reason.
    function test_liveBoard_cutsCopiesItCanFund() public {
        TesseraDeck game = TesseraDeck(LIVE);

        TesseraDeck next = new TesseraDeck();
        vm.startPrank(game.owner());
        game.upgradeToAndCall(address(next), "");
        game.setVaultShare(game.maxVaultShare());
        vm.stopPrank();

        uint16 share = game.vaultShareBps();
        uint256 cut;

        for (uint32 id = 0; id < game.deckCount() && cut == 0; id++) {
            TesseraDeck.Deck memory d = game.deckAt(id);
            if (d.creator != address(0)) continue;

            TesseraDeck.Tier[] memory t = game.tiers(id);
            uint16[] memory upTo = new uint16[](t.length);
            uint16[] memory weight = new uint16[](t.length);
            uint256 w;
            uint16 prev;
            for (uint256 i = 0; i < t.length; i++) {
                upTo[i] = t[i].upTo;
                weight[i] = t[i].weight;
                w += uint256(t[i].upTo - prev) * t[i].weight;
                prev = t[i].upTo;
            }
            if (w * 2 * 10_000 > uint256(d.size) * (10_000 - share)) continue;

            uint256 fee = game.deckFee(d.size);
            address boss = game.owner();
            vm.deal(boss, fee + 1 ether);
            vm.prank(boss);
            uint32 made = game.createDeck{value: fee}(d.size, upTo, weight, d.vaultUpTo);

            assertEq(game.deckAt(made).size, d.size, "the copy is the same size");
            assertEq(game.deckAt(made).drawn, 0, "the copy is full");
            cut++;
        }

        assertEq(cut, 1, "at least one deck of the board is still fit to copy");
    }
}
