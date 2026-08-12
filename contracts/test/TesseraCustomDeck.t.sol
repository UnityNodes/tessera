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

///
///
///
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

        uint256 fee = deck.deckFee(SIZE);
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


    function test_custom_anyoneCanCut() public {
        uint32 id = _custom(2000);
        assertEq(id, 1, unicode", ");
        assertEq(deck.deckMeta(id), "bafyCID", unicode"");
    }

    function test_custom_feeGoesToTreasuryNotToOwner() public {
        uint256 ownerBefore = MPUSDC.balanceOf(owner);
        uint256 contractBefore = MPUSDC.balanceOf(address(deck));

        _custom(2000);

        assertEq(MPUSDC.balanceOf(owner), ownerBefore, unicode"");
        assertEq(
            MPUSDC.balanceOf(address(deck)) - contractBefore,
            deck.customDeckFee(),
            unicode", "
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


    ///
    function test_custom_cannotOutSpendItsOwnCommission() public {
        uint256 fee = deck.deckFee(SIZE);
        vm.startPrank(maker);
        MPUSDC.approve(address(deck), type(uint256).max);
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


    ///
    function test_custom_playerDollarBuysTheSameTicketAsAlways() public {
        uint32 id = _custom(deck.maxCreatorBps());

        (uint256 before,,) = MEGAPOT.usersInfo(player);
        _open(id, 10);
        (uint256 afterCustom,,) = MEGAPOT.usersInfo(player);
        uint256 got = afterCustom - before;

        _open(0, 10);
        (uint256 afterHouse,,) = MEGAPOT.usersInfo(player);
        uint256 house = afterHouse - afterCustom;

        assertEq(got, house, unicode"");
    }

    function test_custom_creatorEarnsOnlyFromCommission() public {
        uint32 id = _custom(5000); //
        _open(id, 20); // $20 → ~$2
        deck.sweepFees();

        uint256 owed = deck.creatorClaimable(maker);
        assertGt(owed, 0, unicode"");

        assertLe(owed, 0.5e6, unicode"");
    }

    function test_custom_houseDeckPaysNoCreator() public {
        _custom(5000);
        _open(0, 20); //
        deck.sweepFees();
        assertEq(
            deck.creatorClaimable(maker),
            0,
            unicode""
        );
    }

    function test_custom_shareSplitsByOpensNotByDeckCount() public {
        uint32 mine = _custom(5000);
        _open(mine, 5);
        _open(0, 15);
        deck.sweepFees();

        uint256 owed = deck.creatorClaimable(maker);
        assertGt(owed, 0, unicode"");
        assertLt(owed, 0.2e6, unicode"");
    }


    ///
    function test_custom_creatorMoneyIsNotSpendable() public {
        uint32 id = _custom(5000);
        _open(id, 20);

        uint256 spendableBefore = deck.spendable();
        deck.sweepFees();

        uint256 owed = deck.creatorClaimable(maker);
        assertGt(owed, 0, unicode"");
        assertEq(
            deck.spendable(),
            MPUSDC.balanceOf(address(deck)) - deck.vault() - owed,
            unicode"spendable "
        );
        assertGt(deck.spendable(), spendableBefore, unicode"");
    }

    function test_custom_bookkeepingHolds() public {
        uint32 id = _custom(3000);
        _open(id, 30);
        _open(0, 30);
        deck.sweepFees();

        assertLe(
            deck.vault() + deck.creatorOwed() + deck.spendable(),
            MPUSDC.balanceOf(address(deck)),
            unicode"+ + "
        );
    }


    function test_custom_claimPaysExactlyOnce() public {
        uint32 id = _custom(5000);
        _open(id, 20);
        deck.sweepFees();

        uint256 owed = deck.creatorClaimable(maker);
        uint256 before = MPUSDC.balanceOf(maker);

        vm.prank(maker);
        deck.claimCreator();

        assertEq(MPUSDC.balanceOf(maker) - before, owed, unicode"");
        assertEq(deck.creatorClaimable(maker), 0, unicode"");
        assertEq(deck.creatorOwed(), 0, unicode"");

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


    function test_custom_ownerCannotLiftTheCapAboveHalf() public {
        vm.prank(owner);
        vm.expectRevert(TesseraDeck.ShareTooBig.selector);
        deck.setCustomDeckRules(1e6, 5001, 50);
    }

    ///
    function test_custom_rulesChangeDoesNotTouchExistingDecks() public {
        uint32 id = _custom(5000);

        vm.prank(owner);
        deck.setCustomDeckRules(1e6, 0, 50);

        _open(id, 20);
        deck.sweepFees();
        assertGt(
            deck.creatorClaimable(maker),
            0,
            unicode""
        );
    }
}
