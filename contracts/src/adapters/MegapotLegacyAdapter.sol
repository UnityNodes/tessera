// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IMegapotAdapter} from "../interfaces/IMegapotAdapter.sol";
import {IMegapot} from "../interfaces/IMegapot.sol";

///
///
contract MegapotLegacyAdapter is IMegapotAdapter {
    using SafeERC20 for IERC20;

    IMegapot public immutable megapot;
    IERC20 private immutable _token;

    error CannotReferAdapter();

    constructor(IMegapot _megapot) {
        megapot = _megapot;
        _token = IERC20(_megapot.token());
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
        return megapot.allowPurchasing();
    }

    function ticketsOf(address user) external view returns (uint256 bps) {
        (bps,,) = megapot.usersInfo(user);
    }

    function claimableFor(address referrer) external view returns (uint256) {
        return megapot.referralFeesClaimable(referrer);
    }

    function buyTicket(address recipient, address referrer) external {
        if (referrer == address(this)) revert CannotReferAdapter();

        uint256 price = megapot.ticketPrice();
        _token.safeTransferFrom(msg.sender, address(this), price);
        _token.forceApprove(address(megapot), price);
        megapot.purchaseTickets(referrer, price, recipient);
    }

    function claimCalldata() external pure returns (bytes memory) {
        return abi.encodeCall(IMegapot.withdrawReferralFees, ());
    }
}
