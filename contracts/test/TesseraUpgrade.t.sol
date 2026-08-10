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

interface IMintable {
    function mint(address to, uint256 amount) external;
}

///
contract TesseraDeckV2 is TesseraDeck {
    uint256 public somethingNew;

    function setSomethingNew(uint256 v) external {
        somethingNew = v;
    }

    function version() external pure returns (uint8) {
        return 2;
    }
}

///
///
contract TesseraUpgradeTest is Test {
    IMegapot constant MEGAPOT = IMegapot(0x6f03c7BCaDAdBf5E6F5900DA3d56AdD8FbDac5De);
    IERC20 constant MPUSDC = IERC20(0xA4253E7C13525287C56550b8708100f93E60509f);

    TesseraDeck deck;
    IMegapotAdapter adapter;
    address owner = makeAddr("owner");
    address player = makeAddr("player");
    address stranger = makeAddr("stranger");

    function setUp() public {
        vm.createSelectFork(vm.envOr("BASE_SEPOLIA_RPC_URL", string("https://sepolia.base.org")));

        adapter = new MegapotLegacyAdapter(MEGAPOT);
        deck = DeployTessera.behindProxy(adapter, owner);

        vm.deal(owner, 10 ether);
        IMintable(address(MPUSDC)).mint(player, 100e6);

        uint16[] memory upTo = new uint16[](2);
        uint16[] memory weight = new uint16[](2);
        upTo[0] = 1;
        weight[0] = 5;
        upTo[1] = 3;
        weight[1] = 1;

        uint256 fee = deck.deckFee(20);
        vm.prank(owner);
        deck.createDeck{value: fee}(20, upTo, weight, 0);
    }

    function _upgrade() internal returns (TesseraDeckV2 v2) {
        v2 = new TesseraDeckV2();
        vm.prank(owner);
        deck.upgradeToAndCall(address(v2), "");
    }


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

        assertEq(slotsBefore, 2, unicode"");

        _upgrade();

        assertEq(TesseraDeckV2(payable(address(deck))).version(), 2, unicode"");
        assertEq(deck.deckCount(), decksBefore, unicode"");
        assertEq(deck.countOf(player), slotsBefore, unicode"");
        assertEq(deck.remaining(0), leftBefore, unicode"");
        assertEq(deck.handleOf(player, 0), handleBefore, unicode"Inco");
    }

    function test_upgrade_addressStaysTheSame() public {
        address before = address(deck);
        _upgrade();
        assertEq(address(deck), before, unicode"");
        assertEq(address(deck.adapter()), address(adapter), unicode"");
        assertEq(address(deck.ticketToken()), address(MPUSDC), unicode"");
    }

    function test_upgrade_keepsMoney() public {
        vm.startPrank(player);
        MPUSDC.approve(address(deck), type(uint256).max);
        for (uint256 i = 0; i < 5; i++) deck.openCase(0);
        vm.stopPrank();

        deck.sweepFees();

        uint256 vaultBefore = deck.vault();
        uint256 spendableBefore = deck.spendable();
        uint256 budgetBefore = deck.budgetWeight();
        assertGt(vaultBefore + spendableBefore, 0, unicode"");

        _upgrade();

        assertEq(deck.vault(), vaultBefore, unicode"");
        assertEq(deck.spendable(), spendableBefore, unicode"");
        assertEq(deck.budgetWeight(), budgetBefore, unicode"");
    }

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
        assertEq(deck.vaultShareBps(), vaultShareBefore, unicode"");
        assertEq(deck.customDeckFee(), customFeeBefore, unicode"");
        assertEq(deck.minCustomSize(), minSizeBefore, unicode"");
        assertEq(deck.countOf(player), 1, unicode"");
    }


    function test_upgrade_onlyOwner() public {
        TesseraDeckV2 v2 = new TesseraDeckV2();
        vm.prank(stranger);
        vm.expectRevert(TesseraDeck.NotOwner.selector);
        deck.upgradeToAndCall(address(v2), "");
    }

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

    function test_initialize_cannotBeCalledTwice() public {
        vm.prank(stranger);
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        deck.initialize(adapter, stranger);
    }

    function test_implementation_isLocked() public {
        TesseraDeck impl = new TesseraDeck();
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        impl.initialize(adapter, stranger);
    }

    ///
    function test_defaults_survivedTheMoveToInitialize() public view {
        assertEq(deck.vaultShareBps(), 5000, unicode"");
        assertEq(deck.customDeckFee(), 5e6, unicode"$5");
        assertEq(deck.maxCreatorBps(), 5000, unicode"");
        assertEq(deck.minCustomSize(), 50, unicode"");
    }

    function test_proxy_pointsAtTheNewImplementation() public {
        address implBefore = _implementationOf(address(deck));
        assertTrue(implBefore != address(0), unicode", ");

        TesseraDeckV2 v2 = _upgrade();

        assertEq(_implementationOf(address(deck)), address(v2), unicode"");
        assertTrue(_implementationOf(address(deck)) != implBefore, unicode"");
    }

    function _implementationOf(address proxy) internal view returns (address) {
        return address(uint160(uint256(vm.load(proxy, ERC1967Utils.IMPLEMENTATION_SLOT))));
    }
}
