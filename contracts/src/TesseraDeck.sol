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

    uint32 public season;

    struct Tier {
        uint16 upTo;
        uint16 weight;
    }

    ///
    mapping(uint32 => Tier[]) private tiersOfSeason;

    ///
    uint256 public constant WEIGHT_PER_TICKET = 5;

    struct Slot {
        euint256 card;
        uint32 season;
    }

    mapping(address => Slot[]) private slots;

    mapping(bytes32 => bool) public shardSpent;

    event DeckCreated(uint32 indexed season, uint16 size, uint16 totalWeight, uint256 feePaid);
    event CaseOpened(address indexed player, uint16 index, bytes32 handle, uint256 paid);
    event SlotRevealed(address indexed player, uint256 index);
    event FeesSwept(uint256 amount);
    event ShardsRedeemed(address indexed player, bytes32[] handles, uint256 weight, uint256 tickets, uint256 paid);
    event OwnerChanged(address indexed from, address indexed to);

    error NotOwner();
    error DeckEmpty();
    error DeckInPlay();
    error PurchasingDisabled();
    error TooManyShardSlots();
    error BadTierTable();
    error NotEnoughWeight(uint256 weight, uint256 need);
    error BadAttestation(bytes32 handle);
    error WorthlessSlot(bytes32 handle, uint256 value);
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

    ///
    function createDeck(uint16 n, uint16[] calldata upTo, uint16[] calldata weight)
        external
        payable
        onlyOwner
    {
        require(n > 0, "n=0");
        if (upTo.length == 0 || upTo.length != weight.length) revert BadTierTable();
        if (size != 0 && drawn < size) revert DeckInPlay();

        uint256 totalWeight;
        uint16 prev;
        for (uint256 i = 0; i < upTo.length; i++) {
            if (upTo[i] <= prev || upTo[i] > n) revert BadTierTable();
            totalWeight += uint256(upTo[i] - prev) * uint256(weight[i]);
            prev = upTo[i];
        }

        if (totalWeight * 2 > uint256(n)) revert TooManyShardSlots();

        deck = e.shuffledRange(1, n + 1, ETypes.Uint256);
        e.allowThis(deck);
        size = n;
        drawn = 0;
        season += 1;

        Tier[] storage t = tiersOfSeason[season];
        for (uint256 i = 0; i < upTo.length; i++) {
            t.push(Tier({upTo: upTo[i], weight: weight[i]}));
        }

        emit DeckCreated(season, n, uint16(totalWeight), msg.value);
    }

    function weightOf(uint32 forSeason, uint256 value) public view returns (uint16) {
        Tier[] storage t = tiersOfSeason[forSeason];
        for (uint256 i = 0; i < t.length; i++) {
            if (value <= t[i].upTo) return t[i].weight;
        }
        return 0;
    }

    function tiers(uint32 forSeason) external view returns (Tier[] memory) {
        return tiersOfSeason[forSeason];
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
        slots[msg.sender].push(Slot({card: card, season: season}));

        handle = euint256.unwrap(card);
        emit CaseOpened(msg.sender, index, handle, price);
        emit SlotRevealed(msg.sender, index);
    }

    function revealMine(uint256 i) external {
        euint256 card = slots[msg.sender][i].card;
        e.allowThis(card);
        e.reveal(card);
        emit SlotRevealed(msg.sender, i);
    }


    ///
    ///
    ///
    function redeem(uint256[] calldata slotIndexes, uint256[] calldata values, bytes[][] calldata signatures)
        external
        nonReentrant
        returns (uint256 tickets, uint256 paid)
    {
        uint256 n = slotIndexes.length;
        if (n == 0 || values.length != n || signatures.length != n) revert BadTierTable();

        bytes32[] memory handles = new bytes32[](n);
        uint256 weight;

        for (uint256 i = 0; i < n; i++) {
            Slot storage slot = slots[msg.sender][slotIndexes[i]];
            euint256 card = slot.card;
            bytes32 handle = euint256.unwrap(card);

            if (shardSpent[handle]) revert ShardAlreadySpent(handle);
            if (!e.verifyDecryption(card, values[i], signatures[i])) revert BadAttestation(handle);

            uint16 w = weightOf(slot.season, values[i]);
            if (w == 0) revert WorthlessSlot(handle, values[i]);

            shardSpent[handle] = true;
            handles[i] = handle;
            weight += w;
        }

        tickets = weight / WEIGHT_PER_TICKET;
        if (tickets == 0) revert NotEnoughWeight(weight, WEIGHT_PER_TICKET);

        uint256 price = adapter.ticketPrice();
        paid = price * tickets;

        if (ticketToken.balanceOf(address(this)) < paid) _sweepFees();
        uint256 have = ticketToken.balanceOf(address(this));
        if (have < paid) revert TreasuryEmpty(have, paid);

        for (uint256 i = 0; i < tickets; i++) {
            uint256 boughtBefore = adapter.ticketsOf(msg.sender);
            adapter.buyTicket(msg.sender, address(this));
            if (adapter.ticketsOf(msg.sender) <= boughtBefore) revert TicketNotCredited();
        }

        emit ShardsRedeemed(msg.sender, handles, weight, tickets, paid);
    }

    function weightNow(uint256 value) external view returns (uint16) {
        return weightOf(season, value);
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
        return euint256.unwrap(slots[msg.sender][i].card);
    }

    function handleOf(address player, uint256 i) external view returns (bytes32) {
        return euint256.unwrap(slots[player][i].card);
    }

    function slotSeason(address player, uint256 i) external view returns (uint32) {
        return slots[player][i].season;
    }

    function weightOfSlot(address player, uint256 i, uint256 value) external view returns (uint16) {
        return weightOf(slots[player][i].season, value);
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
