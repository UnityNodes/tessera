// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IMegapotAdapter} from "../interfaces/IMegapotAdapter.sol";
import {IMegapot} from "../interfaces/IMegapot.sol";

/// An adapter for the "legacy" family ABI: purchaseTickets / withdrawReferralFees.
///
/// It fits both jackpots with that ABI:
///   Base Sepolia 0x6f03c7BCaDAdBf5E6F5900DA3d56AdD8FbDac5De (300 s round)
///   Base mainnet 0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95 (86280 s round)
/// Their implementations expose identical selector sets, checked against the
/// bytecode.
///
/// The contract has no state and no owner: it holds only the sum just forwarded
/// to it for a ticket, and spends it immediately.
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
        // Megapot forbids referrer == msg.sender, and msg.sender here is this
        // adapter.
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
