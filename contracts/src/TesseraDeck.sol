// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {elist, ETypes, euint256, e, inco} from "@inco/lightning/src/Lib.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import {IMegapotAdapter} from "./interfaces/IMegapotAdapter.sol";

///
///
///
contract TesseraDeck is ReentrancyGuardTransient {
    using SafeERC20 for IERC20;

    IMegapotAdapter public immutable adapter;
    IERC20 public immutable ticketToken;

    address public owner;

    elist private deck;

    uint16 public size;
    uint16 public drawn;

    mapping(address => euint256[]) private slots;

    event DeckCreated(uint16 size, uint256 feePaid);
    event CaseOpened(address indexed player, uint16 index, bytes32 handle, uint256 paid);
    event SlotRevealed(address indexed player, uint256 index);
    event FeesSwept(uint256 amount);
    event OwnerChanged(address indexed from, address indexed to);

    error NotOwner();
    error DeckEmpty();
    error DeckInPlay();
    error PurchasingDisabled();
    error TicketNotCredited();
    error ClaimFailed(bytes reason);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(IMegapotAdapter _adapter) {
        adapter = _adapter;
        ticketToken = _adapter.ticketToken();
        owner = msg.sender;
        ticketToken.forceApprove(address(_adapter), type(uint256).max);
        emit OwnerChanged(address(0), msg.sender);
    }


    function deckFee(uint16 n) public view returns (uint256) {
        return 2 * inco.getEListFee(n, ETypes.Uint256);
    }

    function createDeck(uint16 n) external payable onlyOwner {
        require(n > 0, "n=0");
        if (size != 0 && drawn < size) revert DeckInPlay();
        deck = e.shuffledRange(1, n + 1, ETypes.Uint256);
        e.allowThis(deck);
        size = n;
        drawn = 0;
        emit DeckCreated(n, msg.value);
    }


    ///
    function openCase() external nonReentrant returns (uint16 index, bytes32 handle) {
        if (drawn >= size) revert DeckEmpty();
        if (!adapter.purchasingAllowed()) revert PurchasingDisabled();

        index = drawn;
        drawn = index + 1;

        uint256 price = adapter.ticketPrice();
        uint256 boughtBefore = adapter.ticketsOf(msg.sender);

        ticketToken.safeTransferFrom(msg.sender, address(this), price);
        adapter.buyTicket(msg.sender, address(this));

        if (adapter.ticketsOf(msg.sender) <= boughtBefore) revert TicketNotCredited();

        euint256 card = e.getEuint256(deck, index);
        e.allowThis(card);
        e.allow(card, msg.sender);
        e.reveal(card);
        slots[msg.sender].push(card);

        handle = euint256.unwrap(card);
        emit CaseOpened(msg.sender, index, handle, price);
        emit SlotRevealed(msg.sender, index);
    }

    function revealMine(uint256 i) external {
        euint256 card = slots[msg.sender][i];
        e.allowThis(card);
        e.reveal(card);
        emit SlotRevealed(msg.sender, i);
    }


    function sweepFees() external returns (uint256 claimed) {
        uint256 before = ticketToken.balanceOf(address(this));
        (bool ok, bytes memory reason) = adapter.jackpot().call(adapter.claimCalldata());
        if (!ok) revert ClaimFailed(reason);
        claimed = ticketToken.balanceOf(address(this)) - before;
        emit FeesSwept(claimed);
    }


    function myHandle(uint256 i) external view returns (bytes32) {
        return euint256.unwrap(slots[msg.sender][i]);
    }

    function handleOf(address player, uint256 i) external view returns (bytes32) {
        return euint256.unwrap(slots[player][i]);
    }

    function myCount() external view returns (uint256) {
        return slots[msg.sender].length;
    }

    function countOf(address player) external view returns (uint256) {
        return slots[player].length;
    }

    function remaining() external view returns (uint16) {
        return size - drawn;
    }

    function feesClaimable() external view returns (uint256) {
        return adapter.claimableFor(address(this));
    }

    function treasury() external view returns (uint256) {
        return ticketToken.balanceOf(address(this));
    }


    function transferOwnership(address to) external onlyOwner {
        emit OwnerChanged(owner, to);
        owner = to;
    }

    receive() external payable {}
}
