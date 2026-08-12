// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test} from "forge-std/Test.sol";
import {TesseraDeck} from "../src/TesseraDeck.sol";
import {DeployTessera} from "./helpers/DeployTessera.sol";
import {MegapotLegacyAdapter} from "../src/adapters/MegapotLegacyAdapter.sol";
import {IMegapot} from "../src/interfaces/IMegapot.sol";
import {Fork} from "./helpers/Fork.sol";

///
///
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

    ///
    /// $10.
    function test_deckAtOldCeilingIsRefused() public {
        assertEq(game.vaultShareBps(), 5000, unicode"");
        assertFalse(_cut(200, 100), unicode", , ");
        assertTrue(_cut(200, 50), unicode"");
    }

    function test_ceilingFollowsTheVaultShare() public {
        vm.prank(owner);
        game.setVaultShare(0);
        assertTrue(_cut(200, 100), unicode"");

        assertEq(game.maxVaultShare(), 0, unicode"");
    }

    function test_vaultShareCannotStarvePromisedPrizes() public {
        vm.prank(owner);
        game.setVaultShare(0);
        assertTrue(_cut(100, 50), unicode"");

        vm.prank(owner);
        vm.expectRevert(TesseraDeck.ShareStarvesPrizes.selector);
        game.setVaultShare(5000);

        assertEq(game.vaultShareBps(), 0, unicode"");
    }

    function test_vaultShareCanAlwaysGoDown() public {
        assertTrue(_cut(200, 50), unicode"");

        vm.prank(owner);
        game.setVaultShare(2000);
        assertEq(game.vaultShareBps(), 2000, unicode"");

        assertTrue(_cut(200, 80), unicode"20% 80 200 ");
    }

    ///
    function test_maxVaultShareMatchesTheGuard() public {
        _cut(200, 50);
        uint16 max = game.maxVaultShare();

        vm.prank(owner);
        game.setVaultShare(max);
        assertEq(game.vaultShareBps(), max, unicode"");

        if (max < 10_000) {
            vm.prank(owner);
            vm.expectRevert(TesseraDeck.ShareStarvesPrizes.selector);
            game.setVaultShare(max + 1);
        }
    }
}

///
contract TesseraLiveBudgetTest is Test {
    address payable constant LIVE = payable(0x985520De2A14BD443d06DcA07A57Ef4F349bd8B1);

    function setUp() public {
        vm.createSelectFork(vm.envOr("BASE_SEPOLIA_RPC_URL", Fork.BASE_SEPOLIA));
    }

    ///
    ///
    function test_liveBoard_coversWhatItPromised() public view {
        TesseraDeck game = TesseraDeck(LIVE);

        uint256 slots;
        for (uint32 i = 0; i < game.deckCount(); i++) slots += game.deckAt(i).size;

        uint256 promised = (game.budgetWeight() * 1e6) / 5;
        uint256 funded = (slots * 1e5 * (10_000 - game.vaultShareBps())) / 10_000;

        assertGe(funded, promised, unicode"");

        assertGe(
            game.maxVaultShare(),
            game.vaultShareBps(),
            unicode""
        );
    }

    ///
    ///
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

        assertGt(refused, 0, unicode"");
    }

    ///
    ///
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

            assertEq(game.deckAt(made).size, d.size, unicode"");
            assertEq(game.deckAt(made).drawn, 0, unicode"");
            cut++;
        }

        assertEq(cut, 1, unicode"");
    }
}
