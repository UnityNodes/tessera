// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

/// The Megapot jackpot, "legacy" family ABI.
/// Selectors checked against the implementations' bytecode, not the docs:
///   Base Sepolia 0x6f03c7BCaDAdBf5E6F5900DA3d56AdD8FbDac5De -> impl 0x271ba7ac...2333
///   Base mainnet 0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95 -> impl 0x26eb7396...bc13
/// Both implementations expose the same set of 62 selectors.
interface IMegapot {
    /// value is divided by ticketPrice(), the referrer receives
    /// referralFeeBps() of the sum, and the ticket is recorded for recipient.
    function purchaseTickets(address referrer, uint256 value, address recipient) external;

    function withdrawReferralFees() external;

    function referralFeesClaimable(address referrer) external view returns (uint256);

    function ticketPrice() external view returns (uint256);

    function token() external view returns (address);

    function referralFeeBps() external view returns (uint256);

    function allowPurchasing() external view returns (bool);

    function usersInfo(address user)
        external
        view
        returns (uint256 ticketsPurchasedTotalBps, uint256 winningsClaimable, bool active);
}
