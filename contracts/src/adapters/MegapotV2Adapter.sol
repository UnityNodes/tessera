// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IMegapotAdapter} from "../interfaces/IMegapotAdapter.sol";
import {IMegapotV2, MegapotTicket, MegapotV2Reads} from "../interfaces/IMegapotV2.sol";

interface IERC721Balance {
    function balanceOf(address owner) external view returns (uint256);
}

/// An adapter for the new Base mainnet jackpot 0x3bAe643002069dBCbcd62B1A4eb4C4A397d042a2.
///
/// Here a ticket is five distinct numbers and a bonus ball rather than a sum.
/// The player chooses nothing: the game buys a quick pick, because the whole
/// point of Tessera is one click. The rules for the set were taken from the
/// contract's behaviour (test/MegapotV2Rules.t.sol), since it is not verified:
///   - five numbers, all distinct, from the range [1, normalBallMax]
///   - order does not matter
///   - a bonus ball from [1, getDrawingState()[10]], a ceiling of its own per
///     drawing that matches neither bonusballMin nor the soft/hard cap
///   - identical tickets within one drawing are allowed
///   - referrers may be left empty, and referring yourself is allowed here
///     (unlike the legacy jackpot)
contract MegapotV2Adapter is IMegapotAdapter {
    using SafeERC20 for IERC20;
    using MegapotV2Reads for IMegapotV2;

    uint256 private constant NORMALS = 5;

    IMegapotV2 public immutable megapot;
    IERC20 private immutable _token;
    IERC721Balance private immutable _ticketNft;

    error TooFewNumbers(uint8 normalBallMax);

    constructor(IMegapotV2 _megapot) {
        megapot = _megapot;
        _token = IERC20(_megapot.usdc());
        _ticketNft = IERC721Balance(_megapot.jackpotNFT());
    }

    function jackpot() external view returns (address) {
        return address(megapot);
    }

    function ticketToken() external view returns (IERC20) {
        return _token;
    }

    function ticketPrice() external view returns (uint256) {
        return megapot.ticketPrice();
    }

    function purchasingAllowed() external view returns (bool) {
        return megapot.allowTicketPurchases() && !megapot.emergencyMode();
    }

    /// Here a ticket is an NFT, so the counter is an NFT balance rather than bps.
    /// All the game needs is monotonicity: fewer before the purchase, more after.
    function ticketsOf(address user) external view returns (uint256) {
        return _ticketNft.balanceOf(user);
    }

    function claimableFor(address referrer) external view returns (uint256) {
        return megapot.referralFees(referrer);
    }

    function buyTicket(address recipient, address referrer) external {
        uint256 price = megapot.ticketPrice();
        _token.safeTransferFrom(msg.sender, address(this), price);
        _token.forceApprove(address(megapot), price);

        MegapotTicket[] memory tickets = new MegapotTicket[](1);
        tickets[0] = _quickPick(recipient);

        (address[] memory referrers, uint256[] memory split) = _referral(referrer);
        // a source tag, seven bytes in a bytes32, so nothing is truncated
        // forge-lint: disable-next-line(unsafe-typecast)
        megapot.buyTickets(tickets, recipient, referrers, split, bytes32("tessera"));
    }

    function claimCalldata() external pure returns (bytes memory) {
        return abi.encodeCall(IMegapotV2.claimReferralFees, ());
    }

    // ── quick-pick ────────────────────────────────────────────────────────────

    /// The numbers come from a weak seed on purpose: they affect nothing. The
    /// win is decided by Pyth entropy inside Megapot itself, identical tickets
    /// are allowed, and the player does not pick the numbers anyway. What is
    /// needed here is variety, not unpredictability.
    function _quickPick(address recipient) internal view returns (MegapotTicket memory t) {
        uint256 drawingId = megapot.currentDrawingId();
        uint256[13] memory state = megapot.getDrawingState(drawingId);
        uint8 normalMax = uint8(state[9]);
        uint8 bonusCap = uint8(state[10]);

        if (normalMax < NORMALS) revert TooFewNumbers(normalMax);

        uint256 seed = uint256(
            keccak256(abi.encode(block.prevrandao, block.number, recipient, _ticketNft.balanceOf(recipient), drawingId))
        );

        // A partial Fisher-Yates shuffle: five distinct numbers in a fixed
        // number of steps, without a "draw until it fits" loop.
        uint8[] memory pool = new uint8[](normalMax);
        for (uint8 i = 0; i < normalMax; i++) {
            pool[i] = i + 1;
        }

        uint8[] memory normals = new uint8[](NORMALS);
        for (uint256 i = 0; i < NORMALS; i++) {
            uint256 j = i + (seed % (normalMax - i));
            seed = uint256(keccak256(abi.encode(seed)));
            (pool[i], pool[j]) = (pool[j], pool[i]);
            normals[i] = pool[i];
        }

        t.normals = normals;
        // a remainder of a uint8 ceiling always fits in a uint8
        // forge-lint: disable-next-line(unsafe-typecast)
        t.bonusball = uint8(seed % bonusCap) + 1;
    }

    function _referral(address referrer)
        internal
        pure
        returns (address[] memory referrers, uint256[] memory split)
    {
        if (referrer == address(0)) {
            return (new address[](0), new uint256[](0));
        }
        referrers = new address[](1);
        referrers[0] = referrer;
        split = new uint256[](1);
        split[0] = 1e18;
    }
}
