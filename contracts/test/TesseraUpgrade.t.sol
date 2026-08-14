// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Utils} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Utils.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {TesseraDeck} from "../src/TesseraDeck.sol";
import {DeployTessera} from "./helpers/DeployTessera.sol";
import {MegapotLegacyAdapter} from "../src/adapters/MegapotLegacyAdapter.sol";
import {IMegapot} from "../src/interfaces/IMegapot.sol";
import {IMegapotAdapter} from "../src/interfaces/IMegapotAdapter.sol";
import {Fork} from "./helpers/Fork.sol";

interface IMintable {
    function mint(address to, uint256 amount) external;
}

/// The "next version" implementation: the same game plus one new rule.
///
/// The new field is added AT THE END, which is how and the only how the storage
/// of a contract that already has slot owners may be changed. Had it gone higher,
/// every field below it would slide down a slot and quietly start reading somebody
/// else's bytes.
contract TesseraDeckV2 is TesseraDeck {
    uint256 public somethingNew;

    function setSomethingNew(uint256 v) external {
        somethingNew = v;
    }

    function version() external pure returns (uint8) {
        return 2;
    }
}

/// The main reason there is a proxy here at all: changing the rules must not
/// destroy what players have already bought.
///
/// Before the proxy every fix was a new deploy, that is, a new empty game: the
/// decks, the slots, the uncollected weight and the vaults stayed in the old
/// contract. On a testnet that cost nothing, on mainnet it is the destruction of
/// other people's property.
///
/// These tests fail on any build without a proxy: there is neither
/// upgradeToAndCall nor a way to keep the storage there.
contract TesseraUpgradeTest is Test {
    IMegapot constant MEGAPOT = IMegapot(0x6f03c7BCaDAdBf5E6F5900DA3d56AdD8FbDac5De);
    IERC20 constant MPUSDC = IERC20(0xA4253E7C13525287C56550b8708100f93E60509f);

    TesseraDeck deck;
    IMegapotAdapter adapter;
    address owner = makeAddr("owner");
    address player = makeAddr("player");
    address stranger = makeAddr("stranger");

    function setUp() public {
        vm.createSelectFork(vm.envOr("BASE_SEPOLIA_RPC_URL", Fork.BASE_SEPOLIA));

        adapter = new MegapotLegacyAdapter(MEGAPOT);
        deck = DeployTessera.behindProxy(adapter, owner);

        vm.deal(owner, 10 ether);
        IMintable(address(MPUSDC)).mint(player, 100e6);

        // The same table as in the other tests: slot 1 is a whole ticket, slots 2
        // and 3 are shards. A total weight of 7 over 20 slots, that is, within
        // break even (totalWeight * 2 <= n).
        uint16[] memory upTo = new uint16[](2);
        uint16[] memory weight = new uint16[](2);
        upTo[0] = 1;
        weight[0] = 5;
        upTo[1] = 3;
        weight[1] = 1;

        uint256 fee = deck.deckFee(40);
        vm.prank(owner);
        deck.createDeck{value: fee}(40, upTo, weight, 0);
    }

    function _upgrade() internal returns (TesseraDeckV2 v2) {
        v2 = new TesseraDeckV2();
        vm.prank(owner);
        deck.upgradeToAndCall(address(v2), "");
    }

    // -- what this was all started for ---------------------------------------------

    /// A deck and a bought slot survive a change of logic.
    function test_upgrade_keepsDecksAndPlayerSlots() public {
        vm.startPrank(player);
        MPUSDC.approve(address(deck), type(uint256).max);
        deck.openCase(0);
        deck.openCase(0);
        vm.stopPrank();

        uint256 decksBefore = deck.deckCount();
        uint256 slotsBefore = deck.countOf(player);
        uint16 leftBefore = deck.remaining(0);
        bytes32 handleBefore = deck.handleOf(player, 0);

        assertEq(slotsBefore, 2, "two slots before the upgrade");

        _upgrade();

        assertEq(TesseraDeckV2(payable(address(deck))).version(), 2, "the logic is new");
        assertEq(deck.deckCount(), decksBefore, "the decks are in place");
        assertEq(deck.countOf(player), slotsBefore, "the slots are in place");
        assertEq(deck.remaining(0), leftBefore, "the deck was not reshuffled");
        assertEq(deck.handleOf(player, 0), handleBefore, "the same Inco handle");
    }

    /// The address did not change, which means the Inco handles issued to
    /// address(this) still belong to this same contract. That is the reason a
    /// "move the state into a new contract" migration does not work here as a
    /// replacement for a proxy.
    function test_upgrade_addressStaysTheSame() public {
        address before = address(deck);
        _upgrade();
        assertEq(address(deck), before, "the game address is unchanged");
        assertEq(address(deck.adapter()), address(adapter), "the adapter is not lost");
        assertEq(address(deck.ticketToken()), address(MPUSDC), "the token is not lost");
    }

    /// The game's money survives an upgrade just as the slots do.
    function test_upgrade_keepsMoney() public {
        vm.startPrank(player);
        MPUSDC.approve(address(deck), type(uint256).max);
        for (uint256 i = 0; i < 5; i++) deck.openCase(0);
        vm.stopPrank();

        deck.sweepFees();

        uint256 vaultBefore = deck.vault();
        uint256 spendableBefore = deck.spendable();
        uint256 budgetBefore = deck.budgetWeight();
        assertGt(vaultBefore + spendableBefore, 0, "there is something to lose");

        _upgrade();

        assertEq(deck.vault(), vaultBefore, "the vault is in place");
        assertEq(deck.spendable(), spendableBefore, "the treasury is in place");
        assertEq(deck.budgetWeight(), budgetBefore, "the prize budget is in place");
    }

    /// A new field lands in a free slot and does not touch the old ones.
    function test_upgrade_newFieldDoesNotDisturbOldOnes() public {
        vm.startPrank(player);
        MPUSDC.approve(address(deck), type(uint256).max);
        deck.openCase(0);
        vm.stopPrank();

        uint16 vaultShareBefore = deck.vaultShareBps();
        uint256 customFeeBefore = deck.customDeckFee();
        uint16 minSizeBefore = deck.minCustomSize();

        TesseraDeckV2 v2 = TesseraDeckV2(payable(address(deck)));
        _upgrade();
        v2.setSomethingNew(777);

        assertEq(v2.somethingNew(), 777);
        assertEq(deck.vaultShareBps(), vaultShareBefore, "the vault share did not drift");
        assertEq(deck.customDeckFee(), customFeeBefore, "the cut fee did not drift");
        assertEq(deck.minCustomSize(), minSizeBefore, "the minimum size did not drift");
        assertEq(deck.countOf(player), 1, "the slot did not drift");
    }

    // -- the locks -----------------------------------------------------------------

    /// Only the owner can upgrade the logic. Otherwise a proxy is not insurance
    /// but an open door to other people's slots.
    function test_upgrade_onlyOwner() public {
        TesseraDeckV2 v2 = new TesseraDeckV2();
        vm.prank(stranger);
        vm.expectRevert(TesseraDeck.NotOwner.selector);
        deck.upgradeToAndCall(address(v2), "");
    }

    /// The right to upgrade follows ownership of the game rather than staying
    /// with whoever deployed it.
    function test_upgrade_followsOwnership() public {
        vm.prank(owner);
        deck.transferOwnership(stranger);

        TesseraDeckV2 v2 = new TesseraDeckV2();

        vm.prank(owner);
        vm.expectRevert(TesseraDeck.NotOwner.selector);
        deck.upgradeToAndCall(address(v2), "");

        vm.prank(stranger);
        deck.upgradeToAndCall(address(v2), "");
        assertEq(TesseraDeckV2(payable(address(deck))).version(), 2);
    }

    /// The game cannot be reinitialised and taken over.
    function test_initialize_cannotBeCalledTwice() public {
        vm.prank(stranger);
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        deck.initialize(adapter, stranger);
    }

    /// The implementation is locked in itself: if it were not, anyone could
    /// become its owner and be able to upgrade the implementation itself.
    function test_implementation_isLocked() public {
        TesseraDeck impl = new TesseraDeck();
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        impl.initialize(adapter, stranger);
    }

    /// The values that used to stand next to the fields reached the proxy storage.
    ///
    /// This is the quietest mistake in moving to a proxy: an inline initialiser
    /// runs in the constructor, that is, in the IMPLEMENTATION's storage. Forget
    /// to move it into initialize and the game comes up with a zero vault share
    /// and a zero minimum deck size, without a single revert.
    function test_defaults_survivedTheMoveToInitialize() public view {
        assertEq(deck.vaultShareBps(), 5000, "half the commission into the vault");
        assertEq(deck.customDeckFee(), 5e6, "the cut fee is $5");
        assertEq(deck.maxCreatorBps(), 5000, "the ceiling on the creator's share");
        assertEq(deck.minCustomSize(), 50, "the minimum custom deck");
    }

    /// The proxy really is a proxy: the ERC-1967 slot holds the implementation
    /// address, and after an upgrade it is a different one.
    function test_proxy_pointsAtTheNewImplementation() public {
        address implBefore = _implementationOf(address(deck));
        assertTrue(implBefore != address(0), "a proxy rather than an ordinary contract");

        TesseraDeckV2 v2 = _upgrade();

        assertEq(_implementationOf(address(deck)), address(v2), "points at the new logic");
        assertTrue(_implementationOf(address(deck)) != implBefore, "the logic changed");
    }

    function _implementationOf(address proxy) internal view returns (address) {
        return address(uint160(uint256(vm.load(proxy, ERC1967Utils.IMPLEMENTATION_SLOT))));
    }
}

/// The same thing, but on the LIVE game.
///
/// The tests above bring the game up from zero, so they know nothing about the
/// board that already stands: five decks, other people's slots, money in the
/// vaults. And it is that board an upgrade breaks, and finding out after the
/// owner's signature would be too late.
///
/// So this test takes the address from `web/lib/chain.ts`, impersonates the owner
/// in a fork and moves the real proxy onto an implementation built from the
/// current sources. No keys are needed for that: pranking works in a fork, and
/// nothing happens on the network.
contract TesseraLiveUpgradeTest is Test {
    /// The same proxy the site knows.
    address payable constant LIVE = payable(0x985520De2A14BD443d06DcA07A57Ef4F349bd8B1);

    function setUp() public {
        vm.createSelectFork(vm.envOr("BASE_SEPOLIA_RPC_URL", Fork.BASE_SEPOLIA));
    }

    function test_liveGame_upgradesWithoutLosingTheBoard() public {
        TesseraDeck game = TesseraDeck(LIVE);

        uint256 decks = game.deckCount();
        uint256 battles = game.battleCount();
        uint256 budget = game.budgetWeight();
        uint256 vault = game.vault();
        address adapter = address(game.adapter());
        address token = address(game.ticketToken());
        string memory meta = game.deckMeta(4);
        uint16 leftInDeckZero = game.remaining(0);

        assertGt(decks, 0, "the live game has decks, otherwise there is nothing to check");

        TesseraDeck next = new TesseraDeck();
        vm.prank(game.owner());
        game.upgradeToAndCall(address(next), "");

        assertEq(game.deckCount(), decks, "the decks are in place");
        assertEq(game.battleCount(), battles, "the battles are in place");
        assertEq(game.budgetWeight(), budget, "the prize budget is in place");
        assertEq(game.vault(), vault, "the vaults are in place");
        assertEq(address(game.adapter()), adapter, "the adapter is not lost");
        assertEq(address(game.ticketToken()), token, "the token is not lost");
        assertEq(game.deckMeta(4), meta, "kungfumode stayed itself");
        assertEq(game.remaining(0), leftInDeckZero, "the deck was not reshuffled");

        // New fields have to come up as zeros rather than as garbage from somebody
        // else's bytes.
        assertEq(game.battleEscrow(), 0, "there was nothing set aside yet");
    }

    /// The settings survive an upgrade just as the board does.
    ///
    /// Apart from the rest, because it breaks differently: not "it disappeared"
    /// but "it shifted". A field that slid down a slot is read without a revert
    /// and shows somebody else's number, and here that is noticed at once.
    function test_liveGame_keepsItsSettings() public {
        TesseraDeck game = TesseraDeck(LIVE);

        uint16 share = game.vaultShareBps();
        uint256 fee = game.customDeckFee();
        uint16 maxBps = game.maxCreatorBps();
        uint16 minSize = game.minCustomSize();
        address owner = game.owner();

        TesseraDeck next = new TesseraDeck();
        vm.prank(owner);
        game.upgradeToAndCall(address(next), "");

        assertEq(game.vaultShareBps(), share);
        assertEq(game.customDeckFee(), fee);
        assertEq(game.maxCreatorBps(), maxBps);
        assertEq(game.minCustomSize(), minSize);
        assertEq(game.owner(), owner, "the owner did not change");
    }
}
