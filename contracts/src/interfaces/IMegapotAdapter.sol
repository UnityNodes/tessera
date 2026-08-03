// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

///
interface IMegapotAdapter {
    function jackpot() external view returns (address);

    function ticketToken() external view returns (IERC20);

    function ticketPrice() external view returns (uint256);

    function purchasingAllowed() external view returns (bool);

    function ticketsOf(address user) external view returns (uint256);

    function claimableFor(address referrer) external view returns (uint256);

    function buyTicket(address recipient, address referrer) external;

    function claimCalldata() external pure returns (bytes memory);
}
