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

    uint16 public shardSlots;

    uint256 public constant SHARDS_PER_TICKET = 5;

    mapping(address => euint256[]) private slots;

    mapping(bytes32 => bool) public shardSpent;

    event DeckCreated(uint16 size, uint16 shardSlots, uint256 feePaid);
    event CaseOpened(address indexed player, uint16 index, bytes32 handle, uint256 paid);
    event SlotRevealed(address indexed player, uint256 index);
    event FeesSwept(uint256 amount);
    event ShardsRedeemed(address indexed player, bytes32[] handles, uint256 paid);
    event OwnerChanged(address indexed from, address indexed to);

    error NotOwner();
    error DeckEmpty();
    error DeckInPlay();
    error PurchasingDisabled();
    error TooManyShardSlots();
    error WrongShardCount();
    error BadAttestation(bytes32 handle);
    error NotAShard(bytes32 handle, uint256 value);
    error ShardAlreadySpent(bytes32 handle);
    error TreasuryEmpty(uint256 have, uint256 need);
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

    function createDeck(uint16 n, uint16 shards) external payable onlyOwner {
        require(n > 0, "n=0");
        if (shards > n) revert TooManyShardSlots();
        if (size != 0 && drawn < size) revert DeckInPlay();
        deck = e.shuffledRange(1, n + 1, ETypes.Uint256);
        e.allowThis(deck);
        size = n;
        shardSlots = shards;
        drawn = 0;
        emit DeckCreated(n, shards, msg.value);
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


    ///
    ///
    function redeem(uint256[] calldata slotIndexes, uint256[] calldata values, bytes[][] calldata signatures)
        external
        nonReentrant
        returns (uint256 paid)
    {
        if (
            slotIndexes.length != SHARDS_PER_TICKET || values.length != SHARDS_PER_TICKET
                || signatures.length != SHARDS_PER_TICKET
        ) revert WrongShardCount();

        bytes32[] memory handles = new bytes32[](SHARDS_PER_TICKET);

        for (uint256 i = 0; i < SHARDS_PER_TICKET; i++) {
            euint256 card = slots[msg.sender][slotIndexes[i]];
            bytes32 handle = euint256.unwrap(card);

            if (shardSpent[handle]) revert ShardAlreadySpent(handle);
            if (!e.verifyDecryption(card, values[i], signatures[i])) revert BadAttestation(handle);
            if (values[i] == 0 || values[i] > shardSlots) revert NotAShard(handle, values[i]);

            shardSpent[handle] = true;
            handles[i] = handle;
        }

        paid = adapter.ticketPrice();

        if (ticketToken.balanceOf(address(this)) < paid) _sweepFees();
        uint256 have = ticketToken.balanceOf(address(this));
        if (have < paid) revert TreasuryEmpty(have, paid);

        uint256 boughtBefore = adapter.ticketsOf(msg.sender);
        adapter.buyTicket(msg.sender, address(this));
        if (adapter.ticketsOf(msg.sender) <= boughtBefore) revert TicketNotCredited();

        emit ShardsRedeemed(msg.sender, handles, paid);
    }

    function isShardValue(uint256 value) external view returns (bool) {
        return value != 0 && value <= shardSlots;
    }


    function sweepFees() external returns (uint256 claimed) {
        return _sweepFees();
    }

    function _sweepFees() internal returns (uint256 claimed) {
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
