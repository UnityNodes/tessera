// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test, console} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {inco} from "@inco/lightning/src/Lib.sol";
import {TesseraDeck} from "../src/TesseraDeck.sol";
import {MegapotLegacyAdapter} from "../src/adapters/MegapotLegacyAdapter.sol";
import {IMegapot} from "../src/interfaces/IMegapot.sol";

interface IMintable {
    function mint(address to, uint256 amount) external;
}

///
contract TesseraVaultTest is Test {
    IMegapot constant MEGAPOT = IMegapot(0x6f03c7BCaDAdBf5E6F5900DA3d56AdD8FbDac5De);
    IERC20 constant MPUSDC = IERC20(0xA4253E7C13525287C56550b8708100f93E60509f);

    uint16 constant DECK = 60;

    TesseraDeck deck;
    address owner = makeAddr("owner");
    address player = makeAddr("player");
    address verifier;

    function setUp() public {
        vm.createSelectFork(vm.envOr("BASE_SEPOLIA_RPC_URL", string("https://sepolia.base.org")));

        MegapotLegacyAdapter adapter = new MegapotLegacyAdapter(MEGAPOT);
        vm.prank(owner);
        deck = new TesseraDeck(adapter);

        vm.deal(owner, 1 ether);
        uint256 fee = deck.deckFee(DECK);

        uint16[] memory upTo = new uint16[](2);
        uint16[] memory weight = new uint16[](2);
        upTo[0] = 1;
        weight[0] = 0;
        upTo[1] = 6;
        weight[1] = 5;
        vm.prank(owner);
        deck.createDeck{value: fee}(DECK, upTo, weight, 1);

        IMintable(address(MPUSDC)).mint(player, 1000e6);
        verifier = address(inco.incoVerifier());
    }

    function _attest(bool valid) internal {
        vm.mockCall(
            verifier,
            abi.encodeWithSignature("isValidDecryptionAttestation((bytes32,bytes32),bytes[])"),
            abi.encode(valid)
        );
    }

    function _open(uint256 n) internal {
        vm.startPrank(player);
        MPUSDC.approve(address(deck), type(uint256).max);
        for (uint256 i = 0; i < n; i++) {
            deck.openCase(0);
        }
        vm.stopPrank();
    }

    function _sigs() internal pure returns (bytes[] memory s) {
        s = new bytes[](2);
    }


    function test_vault_takesHalfOfEverySweep() public {
        _open(20); // $2.00
        assertEq(deck.vault(), 0, unicode"");

        uint256 claimed = deck.sweepFees();

        assertEq(claimed, 2_000_000);
        assertEq(deck.vault(), 1_000_000, unicode"");
        assertEq(deck.treasury(), 1_000_000, unicode"");
    }

    function test_vault_isNotSpentOnOrdinaryPrizes() public {
        _open(20);
        deck.sweepFees();
        assertEq(deck.vault(), 1_000_000);

        _attest(true);
        uint256[] memory idx = new uint256[](1);
        uint256[] memory vals = new uint256[](1);
        bytes[][] memory sigs = new bytes[][](1);
        idx[0] = 0;
        vals[0] = 3; // ,
        sigs[0] = _sigs();

        vm.prank(player);
        deck.redeem(idx, vals, sigs);

        assertEq(deck.vault(), 1_000_000, unicode"");
    }

    function test_vault_survivesAThinTreasury() public {
        _open(4); // $0.40 -> $0.20 , $0.20
        deck.sweepFees();
        assertEq(deck.vault(), 200_000);

        _attest(true);
        uint256[] memory idx = new uint256[](1);
        uint256[] memory vals = new uint256[](1);
        bytes[][] memory sigs = new bytes[][](1);
        idx[0] = 0;
        vals[0] = 3;
        sigs[0] = _sigs();

        vm.prank(player);
        vm.expectRevert(abi.encodeWithSelector(TesseraDeck.TreasuryEmpty.selector, 200_000, 1_000_000));
        deck.redeem(idx, vals, sigs);

        assertEq(deck.vault(), 200_000, unicode"");
    }


    function test_vault_slotTakesEverything() public {
        _open(20);
        _attest(true);

        uint256 before = MPUSDC.balanceOf(player);
        uint256 expected = 1_000_000; // $2.00

        vm.prank(player);
        uint256 paid = deck.claimVault(0, 1, _sigs()); // 1

        assertEq(paid, expected);
        assertEq(MPUSDC.balanceOf(player) - before, expected, unicode"");
        assertEq(deck.vault(), 0, unicode"");
    }

    function test_vault_sweepsBeforePaying() public {
        _open(20);
        assertEq(deck.vault(), 0, unicode"");

        _attest(true);
        vm.prank(player);
        uint256 paid = deck.claimVault(0, 1, _sigs());

        assertEq(paid, 1_000_000, unicode"");
    }

    function test_vault_cannotBeOpenedTwice() public {
        _open(20);
        _attest(true);
        vm.prank(player);
        deck.claimVault(0, 1, _sigs());

        bytes32 h0 = deck.handleOf(player, 0);
        vm.prank(player);
        vm.expectRevert(abi.encodeWithSelector(TesseraDeck.ShardAlreadySpent.selector, h0));
        deck.claimVault(0, 1, _sigs());
    }

    function test_vault_rejectsOrdinarySlot() public {
        _open(20);
        _attest(true);
        bytes32 h0 = deck.handleOf(player, 0);
        vm.prank(player);
        vm.expectRevert(abi.encodeWithSelector(TesseraDeck.NotTheVault.selector, h0, 3));
        deck.claimVault(0, 3, _sigs());
    }

    function test_vault_rejectsBadAttestation() public {
        _open(20);
        _attest(false);
        bytes32 h0 = deck.handleOf(player, 0);
        vm.prank(player);
        vm.expectRevert(abi.encodeWithSelector(TesseraDeck.BadAttestation.selector, h0));
        deck.claimVault(0, 1, _sigs());
    }

    function test_vault_revertsWhenEmpty() public {
        vm.prank(owner);
        deck.setVaultShare(0);

        _open(2);
        _attest(true);
        vm.prank(player);
        vm.expectRevert(TesseraDeck.VaultEmpty.selector);
        deck.claimVault(0, 1, _sigs());

        assertFalse(deck.shardSpent(deck.handleOf(player, 0)), unicode"");
    }

    function test_vault_isPerSeason() public {
        _open(DECK); //
        uint256 fee = deck.deckFee(20);
        uint16[] memory upTo = new uint16[](1);
        uint16[] memory weight = new uint16[](1);
        upTo[0] = 3;
        weight[0] = 1;
        vm.prank(owner);
        deck.createDeck{value: fee}(20, upTo, weight, 0); //

        assertEq(deck.deckAt(0).vaultUpTo, 1, unicode"1 ");
        assertEq(deck.deckAt(1).vaultUpTo, 0, unicode"2 ");

        _attest(true);
        vm.prank(player);
        deck.claimVault(0, 1, _sigs()); // 1
    }


    ///
    function test_vault_splitsFeesBetweenDecksByOpens() public {
        uint256 fee = deck.deckFee(DECK);
        uint16[] memory upTo = new uint16[](2);
        uint16[] memory weight = new uint16[](2);
        upTo[0] = 1;
        weight[0] = 0;
        upTo[1] = 6;
        weight[1] = 5;
        vm.prank(owner);
        uint32 second = deck.createDeck{value: fee}(DECK, upTo, weight, 1);

        vm.startPrank(player);
        MPUSDC.approve(address(deck), type(uint256).max);
        for (uint256 i = 0; i < 15; i++) deck.openCase(0);
        for (uint256 i = 0; i < 5; i++) deck.openCase(second);
        vm.stopPrank();

        deck.sweepFees();

        assertEq(deck.vaultOf(0), 750_000, unicode", ");
        assertEq(deck.vaultOf(second), 250_000, unicode"");
        assertEq(deck.vault(), 1_000_000, unicode"");
    }

    function test_vault_untouchedDeckGetsNothing() public {
        uint256 fee = deck.deckFee(DECK);
        uint16[] memory upTo = new uint16[](2);
        uint16[] memory weight = new uint16[](2);
        upTo[0] = 1;
        weight[0] = 0;
        upTo[1] = 6;
        weight[1] = 5;
        vm.prank(owner);
        uint32 second = deck.createDeck{value: fee}(DECK, upTo, weight, 1);

        _open(10);
        deck.sweepFees();

        assertEq(deck.vaultOf(0), 500_000);
        assertEq(deck.vaultOf(second), 0, unicode"");
    }

    function test_vault_slotOpensItsOwnDeckVault() public {
        uint256 fee = deck.deckFee(DECK);
        uint16[] memory upTo = new uint16[](2);
        uint16[] memory weight = new uint16[](2);
        upTo[0] = 1;
        weight[0] = 0;
        upTo[1] = 6;
        weight[1] = 5;
        vm.prank(owner);
        uint32 second = deck.createDeck{value: fee}(DECK, upTo, weight, 1);

        vm.startPrank(player);
        MPUSDC.approve(address(deck), type(uint256).max);
        for (uint256 i = 0; i < 18; i++) deck.openCase(0);
        deck.openCase(second); // 18
        vm.stopPrank();
        deck.sweepFees();

        uint256 mine = deck.vaultOf(second);
        uint256 theirs = deck.vaultOf(0);
        assertGt(theirs, mine, unicode"");

        _attest(true);
        vm.prank(player);
        uint256 paid = deck.claimVault(18, 1, _sigs());

        assertEq(paid, mine, unicode"");
        assertEq(deck.vaultOf(0), theirs, unicode"");
    }

    function test_vault_deckWithoutAVaultSlotTakesNoShare() public {
        uint256 fee = deck.deckFee(DECK);
        uint16[] memory upTo = new uint16[](1);
        uint16[] memory weight = new uint16[](1);
        upTo[0] = 6;
        weight[0] = 5;
        vm.prank(owner);
        uint32 plain = deck.createDeck{value: fee}(DECK, upTo, weight, 0); //

        vm.startPrank(player);
        MPUSDC.approve(address(deck), type(uint256).max);
        for (uint256 i = 0; i < 10; i++) deck.openCase(0);
        for (uint256 i = 0; i < 10; i++) deck.openCase(plain);
        vm.stopPrank();

        deck.sweepFees(); // $2.00 , $1.00

        assertEq(deck.vaultOf(plain), 0, unicode"");
        assertEq(deck.vaultOf(0), 1_000_000, unicode", ");
        assertEq(deck.treasury(), 1_000_000, unicode"");
    }

    function test_setVaultShare_onlyOwnerAndBounded() public {
        vm.prank(player);
        vm.expectRevert(TesseraDeck.NotOwner.selector);
        deck.setVaultShare(3000);

        vm.prank(owner);
        vm.expectRevert(TesseraDeck.ShareTooBig.selector);
        deck.setVaultShare(10_001);

        vm.prank(owner);
        deck.setVaultShare(3000);
        assertEq(deck.vaultShareBps(), 3000);
    }
}
