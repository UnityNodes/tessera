// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TesseraDeck} from "../src/TesseraDeck.sol";
import {DeployTessera} from "./helpers/DeployTessera.sol";
import {MegapotLegacyAdapter} from "../src/adapters/MegapotLegacyAdapter.sol";
import {IMegapot} from "../src/interfaces/IMegapot.sol";
import {Fork} from "./helpers/Fork.sol";

interface IMintable {
    function mint(address to, uint256 amount) external;
}

/// A custom deck, one cut by a player rather than by the house.
///
/// What is checked is not "does the button work" but the ways this ability could
/// harm the game:
///
///   1. can a deck be cut that is more generous than its own earnings;
///   2. does the creator take a share of the player's DOLLAR instead of the
///      commission;
///   3. does their share eat the treasury the exchanges are paid from;
///   4. can that same share be taken twice.
///
/// The first three are ways to pull more out of the game than it earned. The
/// fourth is simply theft.
contract TesseraCustomDeckTest is Test {
    IMegapot constant MEGAPOT = IMegapot(0x6f03c7BCaDAdBf5E6F5900DA3d56AdD8FbDac5De);
    IERC20 constant MPUSDC = IERC20(0xA4253E7C13525287C56550b8708100f93E60509f);

    uint16 constant SIZE = 200;

    TesseraDeck deck;
    address owner = makeAddr("owner");
    address maker = makeAddr("maker");
    address player = makeAddr("player");

    function setUp() public {
        vm.createSelectFork(vm.envOr("BASE_SEPOLIA_RPC_URL", Fork.BASE_SEPOLIA));

        MegapotLegacyAdapter adapter = new MegapotLegacyAdapter(MEGAPOT);
        deck = DeployTessera.behindProxy(adapter, owner);

        vm.deal(owner, 10 ether);
        vm.deal(maker, 10 ether);
        IMintable(address(MPUSDC)).mint(player, 1000e6);
        IMintable(address(MPUSDC)).mint(maker, 1000e6);

        // The Inco fee is computed BEFORE the prank: the call in the brackets is
        // external too, and it is what would eat the prank instead of createDeck.
        uint256 fee = deck.deckFee(SIZE);
        // The house deck: slots 1 to 10 a ticket each, the rest empty.
        vm.prank(owner);
        deck.createDeck{value: fee}(SIZE, _upTo(10), _weight(5), 0);
    }

    function _upTo(uint16 v) internal pure returns (uint16[] memory a) {
        a = new uint16[](1);
        a[0] = v;
    }

    function _weight(uint16 v) internal pure returns (uint16[] memory a) {
        a = new uint16[](1);
        a[0] = v;
    }

    /// A custom deck of the same shape as the house one, with a creator share in bps.
    function _custom(uint16 bps) internal returns (uint32 id) {
        uint256 fee = deck.deckFee(SIZE);
        vm.startPrank(maker);
        MPUSDC.approve(address(deck), type(uint256).max);
        id = deck.createCustomDeck{value: fee}(SIZE, _upTo(10), _weight(5), 0, bps, "bafyCID");
        vm.stopPrank();
    }

    function _open(uint32 id, uint256 n) internal {
        vm.startPrank(player);
        MPUSDC.approve(address(deck), type(uint256).max);
        for (uint256 i = 0; i < n; i++) {
            deck.openCase(id);
        }
        vm.stopPrank();
    }

    // -- who can cut one at all ----------------------------------------------

    function test_custom_anyoneCanCut() public {
        uint32 id = _custom(2000);
        assertEq(id, 1, "the deck stood beside the house one rather than in its place");
        assertEq(deck.deckMeta(id), "bafyCID", "the pointer to the name and picture is written");
    }

    function test_custom_feeGoesToTreasuryNotToOwner() public {
        uint256 ownerBefore = MPUSDC.balanceOf(owner);
        uint256 contractBefore = MPUSDC.balanceOf(address(deck));

        _custom(2000);

        assertEq(MPUSDC.balanceOf(owner), ownerBefore, "the owner gets nothing out of it");
        assertEq(
            MPUSDC.balanceOf(address(deck)) - contractBefore,
            deck.customDeckFee(),
            "the fee stayed on the contract, that is, went to prizes"
        );
    }

    function test_custom_tooSmallIsRefused() public {
        uint16 min = deck.minCustomSize();
        uint16 small = min - 1;
        uint256 fee = deck.deckFee(small);
        vm.startPrank(maker);
        MPUSDC.approve(address(deck), type(uint256).max);
        vm.expectRevert(abi.encodeWithSelector(TesseraDeck.DeckTooSmall.selector, small, min));
        deck.createCustomDeck{value: fee}(small, _upTo(1), _weight(1), 0, 0, "bafyCID");
        vm.stopPrank();
    }

    // -- the main safeguard: generosity cannot be bought ----------------------

    /// The break even limit applies to a custom deck exactly as to a house one.
    ///
    /// This is the answer to "what if somebody cuts themselves a deck of nothing
    /// but jackpots": they do not. Not because we did not approve it, but because
    /// the total weight of the prizes has no right to exceed half the slots,
    /// which is exactly what the deck earns in commission.
    function test_custom_cannotOutSpendItsOwnCommission() public {
        uint256 fee = deck.deckFee(SIZE);
        vm.startPrank(maker);
        MPUSDC.approve(address(deck), type(uint256).max);
        // 100 slots, 60 of them at weight 1, so a total weight of 60 > 100/2.
        vm.expectRevert(TesseraDeck.TooManyShardSlots.selector);
        deck.createCustomDeck{value: fee}(SIZE, _upTo(60), _weight(1), 0, 0, "bafyCID");
        vm.stopPrank();
    }

    function test_custom_creatorShareIsCapped() public {
        uint16 tooMuch = deck.maxCreatorBps() + 1;
        uint256 fee = deck.deckFee(SIZE);
        vm.startPrank(maker);
        MPUSDC.approve(address(deck), type(uint256).max);
        vm.expectRevert(TesseraDeck.ShareTooBig.selector);
        deck.createCustomDeck{value: fee}(SIZE, _upTo(10), _weight(5), 0, tooMuch, "bafyCID");
        vm.stopPrank();
    }

    // -- where the creator's money comes from ---------------------------------

    /// The player's dollar does not get any thinner.
    ///
    /// The most important test in the file. The whole of Tessera rests on "a
    /// dollar buys a REAL ticket", and the creator's share has no right to bite a
    /// cent off it: it is taken from the commission Megapot returns to the
    /// referrer AFTER the purchase.
    function test_custom_playerDollarBuysTheSameTicketAsAlways() public {
        uint32 id = _custom(deck.maxCreatorBps());

        (uint256 before,,) = MEGAPOT.usersInfo(player);
        _open(id, 10);
        (uint256 afterCustom,,) = MEGAPOT.usersInfo(player);
        uint256 got = afterCustom - before;

        // The same as the house deck would have given for the same ten dollars.
        _open(0, 10);
        (uint256 afterHouse,,) = MEGAPOT.usersInfo(player);
        uint256 house = afterHouse - afterCustom;

        assertEq(got, house, "a custom deck buys exactly the same ticket");
    }

    function test_custom_creatorEarnsOnlyFromCommission() public {
        uint32 id = _custom(5000); // half of the treasury half
        _open(id, 20); // $20 gives about $2 of commission
        deck.sweepFees();

        uint256 owed = deck.creatorClaimable(maker);
        assertGt(owed, 0, "something was credited to the creator");

        // The ceiling: half of the treasury half, that is, a quarter of the whole
        // commission. The commission on twenty dollars is about two, so the
        // creator cannot receive more than 50 cents by construction.
        assertLe(owed, 0.5e6, "no more than a quarter of the commission");
    }

    function test_custom_houseDeckPaysNoCreator() public {
        _custom(5000);
        _open(0, 20); // the HOUSE deck was played
        deck.sweepFees();
        assertEq(
            deck.creatorClaimable(maker),
            0,
            "somebody else's deck brings the creator nothing"
        );
    }

    function test_custom_shareSplitsByOpensNotByDeckCount() public {
        uint32 mine = _custom(5000);
        _open(mine, 5);
        _open(0, 15);
        deck.sweepFees();

        uint256 owed = deck.creatorClaimable(maker);
        // The creator's deck gave a quarter of the opens, so a quarter of the
        // treasury share too, and half of that. The exact cents depend on the
        // Megapot commission, so we check the order rather than the number.
        assertGt(owed, 0, "something was credited after all");
        assertLt(owed, 0.2e6, "a quarter of the opens does not give a share of the whole game");
    }

    // -- does this eat the treasury -------------------------------------------

    /// The creator's share is set aside the same way the vault is.
    ///
    /// Without this the treasury would spend money that already belongs to
    /// somebody on TESA exchanges, and the first creator to come for theirs would
    /// be refused, with the contract balance full.
    function test_custom_creatorMoneyIsNotSpendable() public {
        uint32 id = _custom(5000);
        _open(id, 20);

        uint256 spendableBefore = deck.spendable();
        deck.sweepFees();

        uint256 owed = deck.creatorClaimable(maker);
        assertGt(owed, 0, "there is something to set aside");
        assertEq(
            deck.spendable(),
            MPUSDC.balanceOf(address(deck)) - deck.vault() - owed,
            "spendable counts balance minus vaults minus what is owed to creators"
        );
        assertGt(deck.spendable(), spendableBefore, "the treasury grew all the same");
    }

    function test_custom_bookkeepingHolds() public {
        uint32 id = _custom(3000);
        _open(id, 30);
        _open(0, 30);
        deck.sweepFees();

        assertLe(
            deck.vault() + deck.creatorOwed() + deck.spendable(),
            MPUSDC.balanceOf(address(deck)),
            "vaults plus what is owed to creators plus treasury is no more than the balance"
        );
    }

    // -- the payout ------------------------------------------------------------

    function test_custom_claimPaysExactlyOnce() public {
        uint32 id = _custom(5000);
        _open(id, 20);
        deck.sweepFees();

        uint256 owed = deck.creatorClaimable(maker);
        uint256 before = MPUSDC.balanceOf(maker);

        vm.prank(maker);
        deck.claimCreator();

        assertEq(MPUSDC.balanceOf(maker) - before, owed, "took exactly what was theirs");
        assertEq(deck.creatorClaimable(maker), 0, "the debt is settled");
        assertEq(deck.creatorOwed(), 0, "the total debt too");

        vm.prank(maker);
        vm.expectRevert(TesseraDeck.NothingToClaim.selector);
        deck.claimCreator();
    }

    function test_custom_strangerClaimsNothing() public {
        uint32 id = _custom(5000);
        _open(id, 20);
        deck.sweepFees();

        vm.prank(player);
        vm.expectRevert(TesseraDeck.NothingToClaim.selector);
        deck.claimCreator();
    }

    // -- the owner's knobs -------------------------------------------------------

    function test_custom_ownerCannotLiftTheCapAboveHalf() public {
        vm.prank(owner);
        vm.expectRevert(TesseraDeck.ShareTooBig.selector);
        deck.setCustomDeckRules(1e6, 5001, 50);
    }

    /// A deck already cut keeps its share forever.
    ///
    /// Otherwise the owner could zero out the creators' share retroactively while
    /// a creator went on believing the arrangement held. A deck is irreversible in
    /// full: both the drop table and the share.
    function test_custom_rulesChangeDoesNotTouchExistingDecks() public {
        uint32 id = _custom(5000);

        vm.prank(owner);
        deck.setCustomDeckRules(1e6, 0, 50);

        _open(id, 20);
        deck.sweepFees();
        assertGt(
            deck.creatorClaimable(maker),
            0,
            "the old deck pays its creator on the old arrangement"
        );
    }
}
