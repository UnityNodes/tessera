// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// The single interface to Megapot. There are two implementations, because Base
/// hosts two different jackpots with different ABIs (see adapters/).
///
/// The adapter is also a way around a Megapot restriction: the contract reverts
/// with "Cannot refer yourself" when referrer == msg.sender. So the adapter
/// always does the buying and the game is passed as the referrer. Confirmed by a
/// fork test (test/MegapotRules.t.sol); the documentation does not mention it.
interface IMegapotAdapter {
    /// The jackpot address. The referrer runs claimCalldata() against it to
    /// collect the commission.
    function jackpot() external view returns (address);

    function ticketToken() external view returns (IERC20);

    function ticketPrice() external view returns (uint256);

    function purchasingAllowed() external view returns (bool);

    /// How many tickets (in bps) are recorded for a user. A dollar yields 8500
    /// bps, because Megapot takes 15% as a fee before crediting.
    function ticketsOf(address user) external view returns (uint256);

    function claimableFor(address referrer) external view returns (uint256);

    /// Buys one ticket for recipient. Pulls ticketPrice() from msg.sender via
    /// transferFrom, so they must have approved it beforehand.
    function buyTicket(address recipient, address referrer) external;

    /// The calldata a referrer runs against jackpot() to collect the accrued
    /// commission. The call has to come from the referrer, so the adapter cannot
    /// make it on their behalf.
    function claimCalldata() external pure returns (bytes memory);
}
