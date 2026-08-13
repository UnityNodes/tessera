// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

/// A ticket in the new jackpot: five "normal" balls and a bonus one.
struct MegapotTicket {
    uint8[] normals;
    uint8 bonusball;
}

/// The next generation Megapot, Base mainnet 0x3bAe643002069dBCbcd62B1A4eb4C4A397d042a2.
/// Not a proxy and not the same contract as on Base Sepolia: a different ABI,
/// numbered tickets, and the ticket issued as an NFT.
/// Selectors checked against the bytecode:
///   buyTickets((uint8[],uint8)[],address,address[],uint256[],bytes32) = 0xde88c28a
interface IMegapotV2 {
    /// _referralSplit is in 1e18 fractions and must sum to 1e18.
    /// No more referrers than maxReferrers(). _source is an arbitrary source tag.
    function buyTickets(
        MegapotTicket[] calldata tickets,
        address recipient,
        address[] calldata referrers,
        uint256[] calldata referralSplit,
        bytes32 source
    ) external;

    function claimReferralFees() external;

    function referralFees(address referrer) external view returns (uint256);

    /// The referrer's share, scaled by 1e18. On the contract 1e17 means 10%,
    /// although the documentation claims 8%.
    function referralFee() external view returns (uint256);

    function ticketPrice() external view returns (uint256);

    function usdc() external view returns (address);

    function allowTicketPurchases() external view returns (bool);

    function emergencyMode() external view returns (bool);

    function maxReferrers() external view returns (uint256);

    function normalBallMax() external view returns (uint8);

    function bonusballMin() external view returns (uint8);

    function bonusballSoftCap() external view returns (uint8);

    function bonusballHardCap() external view returns (uint8);

    function currentDrawingId() external view returns (uint256);

    function jackpotNFT() external view returns (address);

    /// The state of a drawing. Positions checked against live values:
    /// [1] ticket price, [3] referral share, [9] the normal ball ceiling,
    /// [10] the bonus ball ceiling for this particular drawing.
    /// The remaining fields are unused, so they are not named.
    function getDrawingState(uint256 drawingId) external view returns (uint256[13] memory);
}

/// Small reads on top of IMegapotV2, to keep array indices out of the code.
library MegapotV2Reads {
    function bonusballCapNow(IMegapotV2 j) internal view returns (uint8) {
        return uint8(j.getDrawingState(j.currentDrawingId())[10]);
    }

    function normalBallMaxNow(IMegapotV2 j) internal view returns (uint8) {
        return uint8(j.getDrawingState(j.currentDrawingId())[9]);
    }
}
