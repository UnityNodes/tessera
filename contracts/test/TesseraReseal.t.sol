// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {elist, inco} from "@inco/lightning/src/Lib.sol";
import {TesseraDeck} from "../src/TesseraDeck.sol";
import {DeployTessera} from "./helpers/DeployTessera.sol";
import {MegapotLegacyAdapter} from "../src/adapters/MegapotLegacyAdapter.sol";
import {IMegapot} from "../src/interfaces/IMegapot.sol";
import {Fork} from "./helpers/Fork.sol";

interface IMintable {
    function mint(address to, uint256 amount) external;
}

/// A deck deals itself again.
///
/// Until now a played out deck became a dead card in the catalogue, and the only
/// way to "renew" it was a button in moderation that cut a NEW deck beside it.
/// That is, the game depended on somebody watching it.
///
/// Now there are exactly two triggers, and the contract really knows both: the
/// last card was drawn, or the vault was carried out. A third, "all the big prizes
/// have been taken", cannot exist: the cards are encrypted, and how much of what
/// is left the contract does not know and cannot know.
///
/// The important thing here is not that the deck renews itself but what does NOT
/// break when it does: already bought slots, the budget ceiling and solvency.
contract TesseraResealTest is Test {
    IMegapot constant MEGAPOT = IMegapot(0x6f03c7BCaDAdBf5E6F5900DA3d56AdD8FbDac5De);
    IERC20 constant MPUSDC = IERC20(0xA4253E7C13525287C56550b8708100f93E60509f);

    /// Deliberately small: the test has to play it out to the end with real
    /// opens, and every one of them buys a real ticket from Megapot.
    uint16 constant SIZE = 12;

    TesseraDeck deck;
    address owner = makeAddr("owner");
    address player = makeAddr("player");
    address verifier;

    function setUp() public {
        vm.createSelectFork(vm.envOr("BASE_SEPOLIA_RPC_URL", Fork.BASE_SEPOLIA));

        MegapotLegacyAdapter adapter = new MegapotLegacyAdapter(MEGAPOT);
        deck = DeployTessera.behindProxy(adapter, owner);

        vm.deal(owner, 1 ether);
        uint256 fee = deck.deckFee(SIZE);

        // slot 1 is the vault (weight 0), slots 2 to 4 are shards of one each
        (uint16[] memory upTo, uint16[] memory weight) = _table();
        vm.prank(owner);
        deck.createDeck{value: fee}(SIZE, upTo, weight, 1);

        IMintable(address(MPUSDC)).mint(player, 1000e6);
        verifier = address(inco.incoVerifier());

        // The reshuffle fund. A shuffle pays Inco covalidators in native ETH, and
        // without that money the deck would simply play out to the end, which is
        // checked separately below.
        vm.deal(address(deck), 1 ether);
    }

    function _table() internal pure returns (uint16[] memory upTo, uint16[] memory weight) {
        upTo = new uint16[](2);
        weight = new uint16[](2);
        upTo[0] = 1;
        weight[0] = 0;
        upTo[1] = 4;
        weight[1] = 1;
    }

    function _open(uint256 n) internal {
        vm.startPrank(player);
        MPUSDC.approve(address(deck), type(uint256).max);
        for (uint256 i = 0; i < n; i++) {
            deck.openCase(0);
        }
        vm.stopPrank();
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

    // -- played to the end ---------------------------------------------------

    /// The main thing: the deck does not die.
    ///
    /// Until now the twelfth open went through and the thirteenth failed with
    /// DeckEmpty, and the deck stayed that way forever.
    function test_reseal_deckDrawnToTheEndKeepsPlaying() public {
        _open(SIZE);
        assertEq(deck.remaining(0), 0, "played to the end");
        assertEq(deck.reseals(0), 0, "no shuffle yet");

        _open(1);

        assertEq(deck.reseals(0), 1, "reshuffled itself");
        assertEq(deck.deckAt(0).drawn, 1, "one card has been taken from the new cut");
        assertEq(deck.remaining(0), SIZE - 1, "the pool is full, minus this card");
    }

    /// A fresh cut really is fresh rather than the same list continuing.
    function test_reseal_dealsANewList() public {
        bytes32 before = elist.unwrap(deck.deckAt(0).cards);
        _open(SIZE);
        _open(1);
        assertTrue(elist.unwrap(deck.deckAt(0).cards) != before, "the card list is different");
    }

    // -- the vault -------------------------------------------------------------

    /// The vault was carried out, so the deck renews without waiting to be played
    /// out.
    ///
    /// This is what it was all done for: without its vault a deck is no longer the
    /// one that was promised, and selling its unplayed cards under the old sign
    /// would mean selling an untruth.
    function test_reseal_vaultTakenResealsAtOnce() public {
        _open(4);
        deck.sweepFees();
        assertGt(deck.vaultOf(0), 0, "there is something in the vault");

        _attest(true);
        vm.prank(player);
        deck.claimVault(0, 1, _sigs());

        assertEq(deck.reseals(0), 1, "reshuffled at once");
        assertEq(deck.deckAt(0).drawn, 0, "a new cut, nothing taken yet");
        assertEq(deck.remaining(0), SIZE, "the pool is full");
        assertEq(deck.vaultOf(0), 0, "the vault was taken, a new one fills from the commission");
    }

    // -- what must NOT break -----------------------------------------------------

    /// A shuffle does not touch an already bought slot.
    ///
    /// A card's handle lives apart from the list it was drawn from, and is judged
    /// by the table of ITS OWN deck, which never changes. A slot bought before a
    /// reshuffle is worth exactly the same after it.
    function test_reseal_doesNotTouchSlotsAlreadyBought() public {
        _open(1);
        uint256 weightBefore = deck.weightOfSlot(player, 0, 2);

        _open(SIZE); // plays out the remainder and shuffles
        assertEq(deck.reseals(0), 1);

        assertEq(deck.weightOfSlot(player, 0, 2), weightBefore, "the old slot weighs the same");
        assertEq(weightBefore, 1, "and it weighs by the table of its own deck");
    }

    /// A fresh cut promises its own weight, so the budget ceiling grows with it.
    ///
    /// Without this line the game would hand out prizes beyond what it set aside,
    /// and the limit would be noticed only by whoever came to exchange a win.
    function test_reseal_raisesThePrizeBudget() public {
        uint256 before = deck.budgetWeight();
        _open(SIZE);
        _open(1);
        assertEq(deck.budgetWeight(), before * 2, "a cut promises its weight anew");
    }

    /// An empty fund does not break the game, it simply behaves as it used to.
    ///
    /// This matters more than it seems. A shuffle depends on outside money, and
    /// everything that depends on the outside is one day without it. Then the deck
    /// has to end honestly and understandably rather than failing an open with an
    /// unknown error from the depths of somebody else's library.
    function test_reseal_withoutTheFundTheDeckSimplyEnds() public {
        vm.deal(address(deck), 0);
        _open(SIZE);

        vm.startPrank(player);
        vm.expectRevert(TesseraDeck.DeckEmpty.selector);
        deck.openCase(0);
        vm.stopPrank();

        assertEq(deck.reseals(0), 0, "there was nothing to pay with, so no shuffle");
    }

    /// And an empty fund does not fail a vault claim either.
    ///
    /// There is no choice between "renew the deck" and "pay out the win": the
    /// winner's money matters more than a fresh cut.
    function test_reseal_emptyFundNeverBlocksTheVault() public {
        _open(4);
        deck.sweepFees();
        uint256 pot = deck.vaultOf(0);
        assertGt(pot, 0);

        vm.deal(address(deck), 0);
        _attest(true);
        vm.prank(player);
        uint256 paid = deck.claimVault(0, 1, _sigs());

        assertEq(paid, pot, "the vault was paid out in full");
        assertEq(deck.reseals(0), 0, "and the shuffle simply did not happen");
    }

    /// Solvency is not eaten by reshuffles.
    ///
    /// budgetWeight grows with every cut, and if the vault share ceiling counted
    /// deck sizes alone, then after a few reshuffles the game would look as if it
    /// had promised ten times more than it sold, and setVaultShare would start
    /// refusing for no reason.
    function test_reseal_keepsTheVaultShareCeilingHonest() public {
        uint16 ceilingBefore = deck.maxVaultShare();
        _open(SIZE);
        _open(1);
        assertEq(deck.maxVaultShare(), ceilingBefore, "the ceiling is the same: slots and weight grew equally");

        vm.prank(owner);
        deck.setVaultShare(ceilingBefore);
        assertEq(deck.vaultShareBps(), ceilingBefore, "and it can still be staked");
    }
}
