// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test, console} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IMegapotV2, MegapotTicket, MegapotV2Reads} from "../src/interfaces/IMegapotV2.sol";
import {Fork} from "./helpers/Fork.sol";

interface IERC721Like {
    function balanceOf(address owner) external view returns (uint256);
}

/// The rules of the new Base mainnet jackpot (0x3bAe6430...42a2), from behaviour
/// rather than from the documentation. The documentation has already lied about
/// the 8% referral: referralFee() on the contract is 1e17, that is, 10%.
contract V2Caller {
    function buy(
        IMegapotV2 m,
        IERC20 t,
        MegapotTicket[] calldata tickets,
        address recipient,
        address[] calldata referrers,
        uint256[] calldata split,
        uint256 value
    ) external {
        t.approve(address(m), value);
        m.buyTickets(tickets, recipient, referrers, split, bytes32("tessera"));
    }
}

contract MegapotV2RulesTest is Test {
    using MegapotV2Reads for IMegapotV2;

    IMegapotV2 constant JACKPOT = IMegapotV2(0x3bAe643002069dBCbcd62B1A4eb4C4A397d042a2);
    IERC20 constant USDC = IERC20(0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913);
    IERC721Like constant TICKET_NFT = IERC721Like(0x48FfE35AbB9f4780a4f1775C2Ce1c46185b366e4);

    V2Caller caller;
    address player = makeAddr("player");
    address referrer = makeAddr("referrer");
    uint256 price;

    function setUp() public {
        // The block is pinned: the public mainnet RPC returns 429 on ten fork
        // tests in a row, and with a pinned block forge takes everything from
        // the cache.
        vm.createSelectFork(
            vm.envOr("BASE_MAINNET_RPC_URL", Fork.BASE_MAINNET),
            vm.envOr("BASE_MAINNET_FORK_BLOCK", uint256(49488308))
        );
        caller = new V2Caller();
        price = JACKPOT.ticketPrice();
        deal(address(USDC), address(caller), 1000e6);
    }

    function _ticket(uint8 a, uint8 b, uint8 c, uint8 d, uint8 f, uint8 bonus)
        internal
        pure
        returns (MegapotTicket[] memory t)
    {
        uint8[] memory n = new uint8[](5);
        n[0] = a;
        n[1] = b;
        n[2] = c;
        n[3] = d;
        n[4] = f;
        t = new MegapotTicket[](1);
        t[0] = MegapotTicket({normals: n, bonusball: bonus});
    }

    function _ticket(uint8 a, uint8 b, uint8 c, uint8 d, uint8 f)
        internal
        pure
        returns (MegapotTicket[] memory)
    {
        return _ticketB(a, b, c, d, f, 7);
    }

    function _ticketB(uint8 a, uint8 b, uint8 c, uint8 d, uint8 f, uint8 bonus)
        internal
        pure
        returns (MegapotTicket[] memory)
    {
        return _ticket(a, b, c, d, f, bonus);
    }

    function _one(address who) internal pure returns (address[] memory r, uint256[] memory s) {
        r = new address[](1);
        r[0] = who;
        s = new uint256[](1);
        s[0] = 1e18;
    }

    function test_A_plainQuickPick() public {
        (address[] memory r, uint256[] memory s) = _one(referrer);
        caller.buy(JACKPOT, USDC, _ticket(1, 2, 3, 4, 5, 7), player, r, s, price);

        console.log("NFT balance of player:", TICKET_NFT.balanceOf(player));
        console.log("referral fees:", JACKPOT.referralFees(referrer));
        console.log("drawing id:", JACKPOT.currentDrawingId());
    }

    /// Does the new contract forbid referring yourself, as the legacy one does?
    function test_B_selfReferral() public {
        (address[] memory r, uint256[] memory s) = _one(address(caller));
        try caller.buy(JACKPOT, USDC, _ticket(6, 7, 8, 9, 10, 3), player, r, s, price) {
            console.log("self-referral ACCEPTED, fees:", JACKPOT.referralFees(address(caller)));
        } catch Error(string memory why) {
            console.log("self-referral rejected:", why);
        } catch {
            console.log("self-referral rejected (no reason string)");
        }
    }

    function test_C_noReferrers() public {
        address[] memory r = new address[](0);
        uint256[] memory s = new uint256[](0);
        try caller.buy(JACKPOT, USDC, _ticket(2, 4, 6, 8, 10, 3), player, r, s, price) {
            console.log("empty referrers ACCEPTED");
        } catch Error(string memory why) {
            console.log("empty referrers rejected:", why);
        } catch {
            console.log("empty referrers rejected (no reason)");
        }
    }

    function test_D_duplicateNormals() public {
        (address[] memory r, uint256[] memory s) = _one(referrer);
        try caller.buy(JACKPOT, USDC, _ticket(3, 3, 3, 3, 3, 9), player, r, s, price) {
            console.log("duplicates ACCEPTED");
        } catch Error(string memory why) {
            console.log("duplicates rejected:", why);
        } catch {
            console.log("duplicates rejected (no reason)");
        }
    }

    function test_E_unsortedNormals() public {
        (address[] memory r, uint256[] memory s) = _one(referrer);
        try caller.buy(JACKPOT, USDC, _ticket(9, 2, 30, 5, 17, 3), player, r, s, price) {
            console.log("unsorted ACCEPTED");
        } catch Error(string memory why) {
            console.log("unsorted rejected:", why);
        } catch {
            console.log("unsorted rejected (no reason)");
        }
    }

    function test_F_normalAboveMax() public {
        (address[] memory r, uint256[] memory s) = _one(referrer);
        uint8 max = JACKPOT.normalBallMax();
        try caller.buy(JACKPOT, USDC, _ticket(1, 2, 3, 4, max + 1, 9), player, r, s, price) {
            console.log("out-of-range normal ACCEPTED (unexpected)");
        } catch Error(string memory why) {
            console.log("out-of-range normal rejected:", why);
        } catch {
            console.log("out-of-range normal rejected (no reason)");
        }
    }

    function test_G_bonusballRange() public {
        (address[] memory r, uint256[] memory s) = _one(referrer);
        console.log("bonusballMin:", JACKPOT.bonusballMin());
        console.log("bonusballSoftCap:", JACKPOT.bonusballSoftCap());
        try caller.buy(JACKPOT, USDC, _ticket(1, 2, 3, 4, 5, 1), player, r, s, price) {
            console.log("bonusball=1 ACCEPTED");
        } catch Error(string memory why) {
            console.log("bonusball=1 rejected:", why);
        } catch {
            console.log("bonusball=1 rejected (no reason)");
        }
    }

    function test_H_twoTicketsOnePayment() public {
        (address[] memory r, uint256[] memory s) = _one(referrer);
        uint8[] memory n1 = new uint8[](5);
        uint8[] memory n2 = new uint8[](5);
        for (uint8 i = 0; i < 5; i++) {
            n1[i] = i + 1;
            n2[i] = i + 11;
        }
        MegapotTicket[] memory t = new MegapotTicket[](2);
        t[0] = MegapotTicket({normals: n1, bonusball: 7});
        t[1] = MegapotTicket({normals: n2, bonusball: 8});
        try caller.buy(JACKPOT, USDC, t, player, r, s, 2 * price) {
            console.log("two tickets ACCEPTED, NFT balance:", TICKET_NFT.balanceOf(player));
        } catch Error(string memory why) {
            console.log("two tickets rejected:", why);
        } catch {
            console.log("two tickets rejected (no reason)");
        }
    }

    /// The same numbers as in test_E but in ascending order, so as to tell
    /// "not sorted" from "an invalid set".
    function test_I_sortedSameNumbers() public {
        (address[] memory r, uint256[] memory s) = _one(referrer);
        caller.buy(JACKPOT, USDC, _ticket(2, 5, 9, 17, 30), player, r, s, price);
        console.log("sorted ACCEPTED, NFT balance:", TICKET_NFT.balanceOf(player));
    }

    function test_J_bonusballUpperBound() public {
        (address[] memory r, uint256[] memory s) = _one(referrer);
        // getDrawingState()[10] is the bonus ball ceiling of the current draw.
        // It matches neither bonusballMin nor soft/hardCap, it grows with the pool.
        console.log("bonusball cap from drawing state:", JACKPOT.bonusballCapNow());
        uint8[4] memory candidates = [uint8(9), 10, 11, 65];
        for (uint256 i = 0; i < candidates.length; i++) {
            try caller.buy(JACKPOT, USDC, _ticketB(1, 2, 3, 4, 5, candidates[i]), player, r, s, price) {
                console.log("bonusball accepted:", candidates[i]);
            } catch {
                console.log("bonusball rejected:", candidates[i]);
            }
        }
    }

    /// Two identical tickets in one draw, allowed?
    function test_K_duplicateTicketAcrossBuys() public {
        (address[] memory r, uint256[] memory s) = _one(referrer);
        caller.buy(JACKPOT, USDC, _ticket(7, 8, 9, 10, 11), player, r, s, price);
        try caller.buy(JACKPOT, USDC, _ticket(7, 8, 9, 10, 11), player, r, s, price) {
            console.log("same ticket twice ACCEPTED, NFT balance:", TICKET_NFT.balanceOf(player));
        } catch Error(string memory why) {
            console.log("same ticket twice rejected:", why);
        } catch {
            console.log("same ticket twice rejected (no reason)");
        }
    }
}
