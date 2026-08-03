// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IMegapotAdapter} from "../interfaces/IMegapotAdapter.sol";
import {IMegapotV2, MegapotTicket, MegapotV2Reads} from "../interfaces/IMegapotV2.sol";

interface IERC721Balance {
    function balanceOf(address owner) external view returns (uint256);
}

///
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
        megapot.buyTickets(tickets, recipient, referrers, split, bytes32("tessera"));
    }

    function claimCalldata() external pure returns (bytes memory) {
        return abi.encodeCall(IMegapotV2.claimReferralFees, ());
    }

    // ── quick-pick ────────────────────────────────────────────────────────────

    function _quickPick(address recipient) internal view returns (MegapotTicket memory t) {
        uint256 drawingId = megapot.currentDrawingId();
        uint256[13] memory state = megapot.getDrawingState(drawingId);
        uint8 normalMax = uint8(state[9]);
        uint8 bonusCap = uint8(state[10]);

        if (normalMax < NORMALS) revert TooFewNumbers(normalMax);

        uint256 seed = uint256(
            keccak256(abi.encode(block.prevrandao, block.number, recipient, _ticketNft.balanceOf(recipient), drawingId))
        );

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
