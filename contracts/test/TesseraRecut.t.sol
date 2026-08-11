// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test} from "forge-std/Test.sol";
import {TesseraDeck} from "../src/TesseraDeck.sol";
import {DeployTessera} from "./helpers/DeployTessera.sol";
import {MegapotLegacyAdapter} from "../src/adapters/MegapotLegacyAdapter.sol";
import {IMegapot} from "../src/interfaces/IMegapot.sol";

///
///
contract TesseraRecutTest is Test {
    IMegapot constant MEGAPOT = IMegapot(0x6f03c7BCaDAdBf5E6F5900DA3d56AdD8FbDac5De);

    uint16 constant SIZE = 120;

    TesseraDeck game;
    address owner = makeAddr("owner");
    address stranger = makeAddr("stranger");

    function setUp() public {
        vm.createSelectFork(vm.envOr("BASE_SEPOLIA_RPC_URL", string("https://sepolia.base.org")));

        MegapotLegacyAdapter adapter = new MegapotLegacyAdapter(MEGAPOT);
        game = DeployTessera.behindProxy(adapter, owner);

        vm.deal(owner, 10 ether);
        vm.deal(stranger, 10 ether);

        (uint16[] memory upTo, uint16[] memory weight) = _table();
        uint256 fee = game.deckFee(SIZE);
        vm.prank(owner);
        game.createDeck{value: fee}(SIZE, upTo, weight, 1);
    }

    ///
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

    function test_copyRepeatsTheDropTable() public {
        TesseraDeck.Deck memory before = game.deckAt(0);
        TesseraDeck.Tier[] memory oldTiers = game.tiers(0);

        uint32 copyId = _recut(0);
        assertEq(copyId, 1, unicode", ");

        TesseraDeck.Deck memory copyDeck = game.deckAt(copyId);
        TesseraDeck.Tier[] memory newTiers = game.tiers(copyId);

        assertEq(copyDeck.size, before.size, unicode"");
        assertEq(copyDeck.vaultUpTo, before.vaultUpTo, unicode"");
        assertEq(newTiers.length, oldTiers.length, unicode"");
        for (uint256 i = 0; i < oldTiers.length; i++) {
            assertEq(newTiers[i].upTo, oldTiers[i].upTo, unicode"");
            assertEq(newTiers[i].weight, oldTiers[i].weight, unicode"");
        }
    }

    ///
    function test_copyStartsFull() public {
        uint32 copyId = _recut(0);

        assertEq(game.deckAt(copyId).drawn, 0, unicode"");
        assertEq(game.remaining(copyId), SIZE, unicode"");
        assertEq(game.deckAt(copyId).vault, 0, unicode": , ");
    }

    function test_originalIsUntouched() public {
        TesseraDeck.Deck memory before = game.deckAt(0);
        uint16 leftBefore = game.remaining(0);

        _recut(0);

        TesseraDeck.Deck memory now_ = game.deckAt(0);
        assertEq(now_.drawn, before.drawn, unicode"");
        assertEq(now_.size, before.size, unicode"");
        assertEq(now_.vaultUpTo, before.vaultUpTo, unicode"");
        assertEq(game.remaining(0), leftBefore, unicode"");
        assertEq(
            keccak256(abi.encode(game.deckAt(0).cards)),
            keccak256(abi.encode(before.cards)),
            unicode""
        );
    }

    ///
    function test_copyRaisesTheBudgetCeiling() public {
        uint256 before = game.budgetWeight();
        _recut(0);
        assertEq(game.budgetWeight(), before + 30, unicode"");
    }

    function test_strangerCannotCut() public {
        (uint16[] memory upTo, uint16[] memory weight) = _table();
        uint256 fee = game.deckFee(SIZE);
        vm.prank(stranger);
        vm.expectRevert();
        game.createDeck{value: fee}(SIZE, upTo, weight, 1);
    }

    ///
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
            assertFalse(ok, unicode"");
        }
    }
}
