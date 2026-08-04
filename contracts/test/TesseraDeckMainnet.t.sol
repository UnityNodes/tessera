// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test, console} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TesseraDeck} from "../src/TesseraDeck.sol";
import {MegapotV2Adapter} from "../src/adapters/MegapotV2Adapter.sol";
import {MegapotLegacyAdapter} from "../src/adapters/MegapotLegacyAdapter.sol";
import {IMegapotV2} from "../src/interfaces/IMegapotV2.sol";
import {IMegapot} from "../src/interfaces/IMegapot.sol";
import {IMegapotAdapter} from "../src/interfaces/IMegapotAdapter.sol";

interface IERC721Balance {
    function balanceOf(address owner) external view returns (uint256);
}

///
contract TesseraDeckMainnetForkTest is Test {
    IMegapotV2 constant JACKPOT_V2 = IMegapotV2(0x3bAe643002069dBCbcd62B1A4eb4C4A397d042a2);
    IMegapot constant JACKPOT_LEGACY = IMegapot(0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95);
    IERC20 constant USDC = IERC20(0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913);
    IERC721Balance constant TICKET_NFT = IERC721Balance(0x48FfE35AbB9f4780a4f1775C2Ce1c46185b366e4);

    address owner = makeAddr("owner");
    address player = makeAddr("player");

    function setUp() public {
        vm.createSelectFork(
            vm.envOr("BASE_MAINNET_RPC_URL", string("https://mainnet.base.org")),
            vm.envOr("BASE_MAINNET_FORK_BLOCK", uint256(49488308))
        );
        vm.deal(owner, 1 ether);
        deal(address(USDC), player, 1000e6);
    }

    function _deck(IMegapotAdapter adapter) internal returns (TesseraDeck deck) {
        vm.prank(owner);
        deck = new TesseraDeck(adapter);
        uint256 fee = deck.deckFee(20);
        uint16[] memory upTo = new uint16[](1);
        uint16[] memory weight = new uint16[](1);
        upTo[0] = 3;
        weight[0] = 1;
        vm.prank(owner);
        deck.createDeck{value: fee}(20, upTo, weight, 0);
        vm.prank(owner);
        deck.setVaultShare(0);
    }

    function test_openCase_onNewMainnetJackpot() public {
        TesseraDeck deck = _deck(new MegapotV2Adapter(JACKPOT_V2));

        uint256 nftBefore = TICKET_NFT.balanceOf(player);

        vm.startPrank(player);
        USDC.approve(address(deck), type(uint256).max);
        (uint16 index, bytes32 handle) = deck.openCase(0);
        vm.stopPrank();

        assertEq(index, 0);
        assertTrue(handle != bytes32(0));
        assertEq(TICKET_NFT.balanceOf(player), nftBefore + 1, unicode"NFT-");
        assertEq(deck.feesClaimable(), 100_000, unicode"10% , Sepolia");
        assertEq(USDC.balanceOf(address(deck)), 0, unicode"");

        console.log("v2 referral claimable:", deck.feesClaimable());
    }

    function test_openCase_onLegacyMainnetJackpot() public {
        TesseraDeck deck = _deck(new MegapotLegacyAdapter(JACKPOT_LEGACY));

        vm.startPrank(player);
        USDC.approve(address(deck), type(uint256).max);
        deck.openCase(0);
        vm.stopPrank();

        assertEq(deck.feesClaimable(), 100_000);
        console.log("legacy referral claimable:", deck.feesClaimable());
    }

    function test_sweepFees_worksOnBothAdapters() public {
        TesseraDeck v2 = _deck(new MegapotV2Adapter(JACKPOT_V2));
        TesseraDeck legacy = _deck(new MegapotLegacyAdapter(JACKPOT_LEGACY));

        vm.startPrank(player);
        USDC.approve(address(v2), type(uint256).max);
        USDC.approve(address(legacy), type(uint256).max);
        v2.openCase(0);
        legacy.openCase(0);
        vm.stopPrank();

        assertEq(v2.sweepFees(), 100_000, unicode"claimReferralFees() ABI");
        assertEq(legacy.sweepFees(), 100_000, unicode"withdrawReferralFees() ABI");
        assertEq(v2.treasury(), 100_000);
        assertEq(legacy.treasury(), 100_000);
    }

    function test_quickPick_manyOpensAllValid() public {
        TesseraDeck deck = _deck(new MegapotV2Adapter(JACKPOT_V2));

        vm.startPrank(player);
        USDC.approve(address(deck), type(uint256).max);
        for (uint256 i = 0; i < 15; i++) {
            vm.roll(block.number + 1);
            deck.openCase(0);
        }
        vm.stopPrank();

        assertEq(deck.deckAt(0).drawn, 15);
        assertEq(TICKET_NFT.balanceOf(player), 15, unicode"15 , ");
        assertEq(deck.feesClaimable(), 15 * 100_000);
    }
}
