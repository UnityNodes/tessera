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

///
///
///
contract TesseraResealTest is Test {
    IMegapot constant MEGAPOT = IMegapot(0x6f03c7BCaDAdBf5E6F5900DA3d56AdD8FbDac5De);
    IERC20 constant MPUSDC = IERC20(0xA4253E7C13525287C56550b8708100f93E60509f);

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

        (uint16[] memory upTo, uint16[] memory weight) = _table();
        vm.prank(owner);
        deck.createDeck{value: fee}(SIZE, upTo, weight, 1);

        IMintable(address(MPUSDC)).mint(player, 1000e6);
        verifier = address(inco.incoVerifier());

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


    ///
    function test_reseal_deckDrawnToTheEndKeepsPlaying() public {
        _open(SIZE);
        assertEq(deck.remaining(0), 0, unicode"");
        assertEq(deck.reseals(0), 0, unicode"");

        _open(1);

        assertEq(deck.reseals(0), 1, unicode"");
        assertEq(deck.deckAt(0).drawn, 1, unicode"");
        assertEq(deck.remaining(0), SIZE - 1, unicode", ");
    }

    function test_reseal_dealsANewList() public {
        bytes32 before = elist.unwrap(deck.deckAt(0).cards);
        _open(SIZE);
        _open(1);
        assertTrue(elist.unwrap(deck.deckAt(0).cards) != before, unicode"");
    }


    ///
    function test_reseal_vaultTakenResealsAtOnce() public {
        _open(4);
        deck.sweepFees();
        assertGt(deck.vaultOf(0), 0, unicode"");

        _attest(true);
        vm.prank(player);
        deck.claimVault(0, 1, _sigs());

        assertEq(deck.reseals(0), 1, unicode"");
        assertEq(deck.deckAt(0).drawn, 0, unicode", ");
        assertEq(deck.remaining(0), SIZE, unicode"");
        assertEq(deck.vaultOf(0), 0, unicode", ");
    }


    ///
    function test_reseal_doesNotTouchSlotsAlreadyBought() public {
        _open(1);
        uint256 weightBefore = deck.weightOfSlot(player, 0, 2);

        _open(SIZE); //
        assertEq(deck.reseals(0), 1);

        assertEq(deck.weightOfSlot(player, 0, 2), weightBefore, unicode"");
        assertEq(weightBefore, 1, unicode"");
    }

    ///
    function test_reseal_raisesThePrizeBudget() public {
        uint256 before = deck.budgetWeight();
        _open(SIZE);
        _open(1);
        assertEq(deck.budgetWeight(), before * 2, unicode"");
    }

    ///
    function test_reseal_withoutTheFundTheDeckSimplyEnds() public {
        vm.deal(address(deck), 0);
        _open(SIZE);

        vm.startPrank(player);
        vm.expectRevert(TesseraDeck.DeckEmpty.selector);
        deck.openCase(0);
        vm.stopPrank();

        assertEq(deck.reseals(0), 0, unicode"");
    }

    ///
    function test_reseal_emptyFundNeverBlocksTheVault() public {
        _open(4);
        deck.sweepFees();
        uint256 pot = deck.vaultOf(0);
        assertGt(pot, 0);

        vm.deal(address(deck), 0);
        _attest(true);
        vm.prank(player);
        uint256 paid = deck.claimVault(0, 1, _sigs());

        assertEq(paid, pot, unicode"");
        assertEq(deck.reseals(0), 0, unicode"");
    }

    ///
    function test_reseal_keepsTheVaultShareCeilingHonest() public {
        uint16 ceilingBefore = deck.maxVaultShare();
        _open(SIZE);
        _open(1);
        assertEq(deck.maxVaultShare(), ceilingBefore, unicode": ");

        vm.prank(owner);
        deck.setVaultShare(ceilingBefore);
        assertEq(deck.vaultShareBps(), ceilingBefore, unicode"");
    }
}
