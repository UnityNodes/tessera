// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test, console} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {inco} from "@inco/lightning/src/Lib.sol";
import {TesseraDeck} from "../src/TesseraDeck.sol";
import {DeployTessera} from "./helpers/DeployTessera.sol";
import {MegapotLegacyAdapter} from "../src/adapters/MegapotLegacyAdapter.sol";
import {IMegapot} from "../src/interfaces/IMegapot.sol";
import {Fork} from "./helpers/Fork.sol";

interface IMintable {
    function mint(address to, uint256 amount) external;
}

/// The vault.
///
/// Half the commission accumulates, and one slot in the deck takes all of it.
/// What is checked first of all is that the vault can be neither opened with
/// somebody else's slot, nor spent on ordinary prizes, nor taken twice.
contract TesseraVaultTest is Test {
    IMegapot constant MEGAPOT = IMegapot(0x6f03c7BCaDAdBf5E6F5900DA3d56AdD8FbDac5De);
    IERC20 constant MPUSDC = IERC20(0xA4253E7C13525287C56550b8708100f93E60509f);

    uint16 constant DECK = 100;

    TesseraDeck deck;
    address owner = makeAddr("owner");
    address player = makeAddr("player");
    address verifier;

    function setUp() public {
        vm.createSelectFork(vm.envOr("BASE_SEPOLIA_RPC_URL", Fork.BASE_SEPOLIA));

        MegapotLegacyAdapter adapter = new MegapotLegacyAdapter(MEGAPOT);
        deck = DeployTessera.behindProxy(adapter, owner);

        vm.deal(owner, 1 ether);
        uint256 fee = deck.deckFee(DECK);

        // slot 1 is the vault (weight 0), slots 2 to 6 a ticket each
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

    // -- accumulation -------------------------------------------------------------

    function test_vault_takesHalfOfEverySweep() public {
        _open(20); // $2.00 of commission
        assertEq(deck.vault(), 0, "until it is swept the vault is empty");

        uint256 claimed = deck.sweepFees();

        assertEq(claimed, 2_000_000);
        assertEq(deck.vault(), 1_000_000, "half into the vault");
        assertEq(deck.treasury(), 1_000_000, "half to ordinary prizes");
    }

    /// The vault cannot be eaten away by ordinary prizes.
    function test_vault_isNotSpentOnOrdinaryPrizes() public {
        _open(20);
        deck.sweepFees();
        assertEq(deck.vault(), 1_000_000);

        _attest(true);
        uint256[] memory idx = new uint256[](1);
        uint256[] memory vals = new uint256[](1);
        bytes[][] memory sigs = new bytes[][](1);
        idx[0] = 0;
        vals[0] = 3; // an ordinary prize, one ticket
        sigs[0] = _sigs();

        vm.prank(player);
        deck.redeem(idx, vals, sigs);

        assertEq(deck.vault(), 1_000_000, "the vault did not change");
    }

    /// When there is not enough for an ordinary prize, the vault is still not
    /// touched.
    function test_vault_survivesAThinTreasury() public {
        _open(4); // $0.40 of commission -> $0.20 into the vault, $0.20 to prizes
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

        assertEq(deck.vault(), 200_000, "the vault is untouched");
    }

    // -- opening --------------------------------------------------------------------

    function test_vault_slotTakesEverything() public {
        _open(20);
        _attest(true);

        uint256 before = MPUSDC.balanceOf(player);
        uint256 expected = 1_000_000; // half of $2.00

        vm.prank(player);
        uint256 paid = deck.claimVault(0, 1, _sigs()); // value 1 is the vault

        assertEq(paid, expected);
        assertEq(MPUSDC.balanceOf(player) - before, expected, "the money went to the player");
        assertEq(deck.vault(), 0, "the vault is empty now");
    }

    /// The vault sweeps up everything Megapot still owes so it can hand itself
    /// over in full.
    function test_vault_sweepsBeforePaying() public {
        _open(20);
        assertEq(deck.vault(), 0, "nothing has been swept yet");

        _attest(true);
        vm.prank(player);
        uint256 paid = deck.claimVault(0, 1, _sigs());

        assertEq(paid, 1_000_000, "took it including the unswept commission");
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

    /// An ordinary slot does not open the vault.
    function test_vault_rejectsOrdinarySlot() public {
        _open(20);
        _attest(true);
        bytes32 h0 = deck.handleOf(player, 0);
        vm.prank(player);
        vm.expectRevert(abi.encodeWithSelector(TesseraDeck.NotTheVault.selector, h0, 3));
        deck.claimVault(0, 3, _sigs());
    }

    /// Without the covalidators' signature, no way.
    function test_vault_rejectsBadAttestation() public {
        _open(20);
        _attest(false);
        bytes32 h0 = deck.handleOf(player, 0);
        vm.prank(player);
        vm.expectRevert(abi.encodeWithSelector(TesseraDeck.BadAttestation.selector, h0));
        deck.claimVault(0, 1, _sigs());
    }

    /// A vault with no money is not handed over, and the slot is not burned for
    /// nothing in the process.
    function test_vault_revertsWhenEmpty() public {
        // the vault share is zero, so the commission goes entirely to ordinary
        // prizes
        vm.prank(owner);
        deck.setVaultShare(0);

        _open(2);
        _attest(true);
        vm.prank(player);
        vm.expectRevert(TesseraDeck.VaultEmpty.selector);
        deck.claimVault(0, 1, _sigs());

        assertFalse(deck.shardSpent(deck.handleOf(player, 0)), "the slot is not spent");
    }

    /// A season's slot is judged by the table of ITS OWN season here too.
    function test_vault_isPerSeason() public {
        _open(DECK); // exhaust the deck
        uint256 fee = deck.deckFee(20);
        uint16[] memory upTo = new uint16[](1);
        uint16[] memory weight = new uint16[](1);
        upTo[0] = 3;
        weight[0] = 1;
        vm.prank(owner);
        deck.createDeck{value: fee}(20, upTo, weight, 0); // the new season has no vault

        assertEq(deck.deckAt(0).vaultUpTo, 1, "season 1 had a vault slot");
        assertEq(deck.deckAt(1).vaultUpTo, 0, "season 2 does not");

        _attest(true);
        vm.prank(player);
        deck.claimVault(0, 1, _sigs()); // a season 1 slot still opens the vault
    }

    // -- several decks ---------------------------------------------------------------

    /// The commission is split between the decks by their opens.
    ///
    /// Megapot hands it over as one sum and does not know which deck each dollar
    /// came from. We do: the opens brought that commission in. So a deck that was
    /// played three times as often fills its vault three times as fast, and one
    /// nobody touched does not profit from other people's players.
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

        // $2.00 of commission, half into the vaults, split 15:5
        deck.sweepFees();

        assertEq(deck.vaultOf(0), 750_000, "three quarters to the one that was played");
        assertEq(deck.vaultOf(second), 250_000, "a quarter to the second");
        assertEq(deck.vault(), 1_000_000, "together the same half");
    }

    /// A deck nobody touched gets nothing.
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
        assertEq(deck.vaultOf(second), 0, "its players paid nothing, so it gets nothing");
    }

    /// A slot from one deck opens ITS vault rather than somebody else's.
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
        deck.openCase(second); // slot 18 is from the second deck
        vm.stopPrank();
        deck.sweepFees();

        uint256 mine = deck.vaultOf(second);
        uint256 theirs = deck.vaultOf(0);
        assertGt(theirs, mine, "the first deck collected more");

        _attest(true);
        vm.prank(player);
        uint256 paid = deck.claimVault(18, 1, _sigs());

        assertEq(paid, mine, "we paid out the vault of OUR OWN deck");
        assertEq(deck.vaultOf(0), theirs, "the other one was not touched");
    }

    /// A deck without a vault takes no share, otherwise the money would be stuck
    /// in a vault there is nothing to open with, and would quietly eat the
    /// treasury.
    function test_vault_deckWithoutAVaultSlotTakesNoShare() public {
        uint256 fee = deck.deckFee(DECK);
        uint16[] memory upTo = new uint16[](1);
        uint16[] memory weight = new uint16[](1);
        upTo[0] = 5;
        weight[0] = 5;
        vm.prank(owner);
        uint32 plain = deck.createDeck{value: fee}(DECK, upTo, weight, 0); // no vault

        vm.startPrank(player);
        MPUSDC.approve(address(deck), type(uint256).max);
        for (uint256 i = 0; i < 10; i++) deck.openCase(0);
        for (uint256 i = 0; i < 10; i++) deck.openCase(plain);
        vm.stopPrank();

        deck.sweepFees(); // $2.00 of commission, $1.00 into the vaults

        assertEq(deck.vaultOf(plain), 0, "a deck without a vault gets nothing");
        assertEq(deck.vaultOf(0), 1_000_000, "the whole vault share goes to the one that has a vault");
        assertEq(deck.treasury(), 1_000_000, "the rest to ordinary prizes");
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
