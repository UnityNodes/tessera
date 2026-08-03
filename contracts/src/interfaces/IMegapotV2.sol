// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

struct MegapotTicket {
    uint8[] normals;
    uint8 bonusball;
}

///   buyTickets((uint8[],uint8)[],address,address[],uint256[],bytes32) = 0xde88c28a
interface IMegapotV2 {
    function buyTickets(
        MegapotTicket[] calldata tickets,
        address recipient,
        address[] calldata referrers,
        uint256[] calldata referralSplit,
        bytes32 source
    ) external;

    function claimReferralFees() external;

    function referralFees(address referrer) external view returns (uint256);

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

    function getDrawingState(uint256 drawingId) external view returns (uint256[13] memory);
}

library MegapotV2Reads {
    function bonusballCapNow(IMegapotV2 j) internal view returns (uint8) {
        return uint8(j.getDrawingState(j.currentDrawingId())[10]);
    }

    function normalBallMaxNow(IMegapotV2 j) internal view returns (uint8) {
        return uint8(j.getDrawingState(j.currentDrawingId())[9]);
    }
}
