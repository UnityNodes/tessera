// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test} from "forge-std/Test.sol";
import {TesseraDeck} from "../src/TesseraDeck.sol";
import {DeployTessera} from "./helpers/DeployTessera.sol";
import {MegapotLegacyAdapter} from "../src/adapters/MegapotLegacyAdapter.sol";
import {IMegapot} from "../src/interfaces/IMegapot.sol";
import {Fork} from "./helpers/Fork.sol";

/// Renewing a deck.
///
/// A copy of a deck is a NEW deck beside it, with its own vault and its own pool.
/// Not to be confused with a reshuffle (`TesseraReseal.t.sol`): that renews the
/// same deck with the same contents, this one makes a second deck.
///
/// The tests here prove two opposite things, and both are needed: an old deck can
/// neither be refilled nor reshuffled, and a new copy repeats its terms to the
/// last number.
contract TesseraRecutTest is Test {
    IMegapot constant MEGAPOT = IMegapot(0x6f03c7BCaDAdBf5E6F5900DA3d56AdD8FbDac5De);

    uint16 constant SIZE = 120;

    TesseraDeck game;
    address owner = makeAddr("owner");
    address stranger = makeAddr("stranger");

    function setUp() public {
        vm.createSelectFork(vm.envOr("BASE_SEPOLIA_RPC_URL", Fork.BASE_SEPOLIA));

        MegapotLegacyAdapter adapter = new MegapotLegacyAdapter(MEGAPOT);
        game = DeployTessera.behindProxy(adapter, owner);

        vm.deal(owner, 10 ether);
        vm.deal(stranger, 10 ether);

        (uint16[] memory upTo, uint16[] memory weight) = _table();
        // The fee is computed BEFORE the prank: a call inside the arguments would
        // eat the sender substitution, and createDeck would go from the test
        // contract rather than from the owner.
        uint256 fee = game.deckFee(SIZE);
        vm.prank(owner);
        game.createDeck{value: fee}(SIZE, upTo, weight, 1);
    }

    /// Slot 1 is the vault, 2 to 5 a ticket each, 6 to 15 shards, the rest empty.
    ///
    /// The total weight 4*5 + 10*1 = 30, that is, exactly the break even limit for
    /// sixty slots. A deck at the limit is deliberate here: a copy of such a deck
    /// also checks that the budget ceiling rises along with it.
    function _table() internal pure returns (uint16[] memory upTo, uint16[] memory weight) {
        upTo = new uint16[](3);
        weight = new uint16[](3);
        upTo[0] = 1;
        weight[0] = 0;
        upTo[1] = 5;
        weight[1] = 5;
        upTo[2] = 15;
        weight[2] = 1;
    }

    function _recut(uint32 from) internal returns (uint32 id) {
        TesseraDeck.Deck memory d = game.deckAt(from);
        TesseraDeck.Tier[] memory t = game.tiers(from);

        uint16[] memory upTo = new uint16[](t.length);
        uint16[] memory weight = new uint16[](t.length);
        for (uint256 i = 0; i < t.length; i++) {
            upTo[i] = t[i].upTo;
            weight[i] = t[i].weight;
        }

        uint256 fee = game.deckFee(d.size);
        address boss = game.owner();
        vm.prank(boss);
        id = game.createDeck{value: fee}(d.size, upTo, weight, d.vaultUpTo);
    }

    /// The copy repeats the original's terms, and this is the same check the
    /// owner makes with their eyes before signing.
    function test_copyRepeatsTheDropTable() public {
        TesseraDeck.Deck memory before = game.deckAt(0);
        TesseraDeck.Tier[] memory oldTiers = game.tiers(0);

        uint32 copyId = _recut(0);
        assertEq(copyId, 1, "the copy is the next deck, not the same one");

        TesseraDeck.Deck memory copyDeck = game.deckAt(copyId);
        TesseraDeck.Tier[] memory newTiers = game.tiers(copyId);

        assertEq(copyDeck.size, before.size, "the size is the same");
        assertEq(copyDeck.vaultUpTo, before.vaultUpTo, "the vault opens with the same slot");
        assertEq(newTiers.length, oldTiers.length, "the same number of tiers");
        for (uint256 i = 0; i < oldTiers.length; i++) {
            assertEq(newTiers[i].upTo, oldTiers[i].upTo, "the tier boundary is the same");
            assertEq(newTiers[i].weight, oldTiers[i].weight, "the tier weight is the same");
        }
    }

    /// A copy is a new deck rather than a continuation of the old one.
    ///
    /// The most expensive mistake here would look harmless: a copy that inherited
    /// `drawn` would hand over its first slots as already drawn, and a player
    /// would pay for cards that are not in it.
    function test_copyStartsFull() public {
        uint32 copyId = _recut(0);

        assertEq(game.deckAt(copyId).drawn, 0, "nothing has been drawn from the copy yet");
        assertEq(game.remaining(copyId), SIZE, "the copy is full");
        assertEq(game.deckAt(copyId).vault, 0, "the copy's vault is empty: it is its own, not shared");
    }

    /// The original has not moved by a single slot after a copy was cut.
    function test_originalIsUntouched() public {
        TesseraDeck.Deck memory before = game.deckAt(0);
        uint16 leftBefore = game.remaining(0);

        _recut(0);

        TesseraDeck.Deck memory now_ = game.deckAt(0);
        assertEq(now_.drawn, before.drawn, "the old deck was not moved");
        assertEq(now_.size, before.size, "the old one's size did not change");
        assertEq(now_.vaultUpTo, before.vaultUpTo, "the old one's vault did not change");
        assertEq(game.remaining(0), leftBefore, "the old one has as much left");
        assertEq(
            keccak256(abi.encode(game.deckAt(0).cards)),
            keccak256(abi.encode(before.cards)),
            "the old deck's cards were NOT reshuffled"
        );
    }

    /// A copy raises the prize ceiling by exactly its own weight.
    ///
    /// Without this a new deck would promise prizes the budget is not sized for,
    /// and `_spendBudget` would cut payouts after the sale.
    function test_copyRaisesTheBudgetCeiling() public {
        uint256 before = game.budgetWeight();
        _recut(0);
        // 4 slots at 5 plus 10 slots at 1 = 30
        assertEq(game.budgetWeight(), before + 30, "the ceiling grew by exactly the copy's weight");
    }

    /// Only the owner can cut a house deck.
    function test_strangerCannotCut() public {
        (uint16[] memory upTo, uint16[] memory weight) = _table();
        uint256 fee = game.deckFee(SIZE);
        vm.prank(stranger);
        vm.expectRevert();
        game.createDeck{value: fee}(SIZE, upTo, weight, 1);
    }

    /// Nobody can refill or reshuffle an existing deck.
    ///
    /// This is not "there is no button", it is not in the ABI at all, which is
    /// exactly why the check compares selectors rather than behaviour.
    function test_noRefillOrReshuffleExists() public view {
        string[6] memory names = [
            "refill(uint32,uint16)",
            "reshuffle(uint32)",
            "resetDeck(uint32)",
            "setDeckSize(uint32,uint16)",
            "setTiers(uint32,uint16[],uint16[])",
            "restock(uint32)"
        ];
        for (uint256 i = 0; i < names.length; i++) {
            (bool ok,) = address(game).staticcall(abi.encodeWithSignature(names[i]));
            assertFalse(ok, "a deck cannot be changed retroactively");
        }
    }
}
