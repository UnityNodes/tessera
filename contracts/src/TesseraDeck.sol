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
        uint64 battle;
    }

    mapping(address => Slot[]) private slots;

    ///
    ///
    uint256 public budgetWeight;

    uint256 public paidWeight;

    struct Stake {
        uint128 weight;
        uint64 slotIndex;
        bool open;
    }

    mapping(address => Stake) public stakeOf;

    mapping(address => uint256) public bankedWeight;

    //
    //

    uint256 public vault;

    uint16 public vaultShareBps = 5000;

    mapping(uint32 => uint16) public vaultUpToOfSeason;

    uint16 public vaultUpTo;

    mapping(bytes32 => bool) public shardSpent;

    event DeckCreated(uint32 indexed season, uint16 size, uint16 totalWeight, uint256 feePaid);
    event CaseOpened(address indexed player, uint16 index, bytes32 handle, uint256 paid);
    event SlotRevealed(address indexed player, uint256 index);
    event FeesSwept(uint256 amount);
    event ShardsRedeemed(address indexed player, bytes32[] handles, uint256 weight, uint256 tickets, uint256 paid);
    event Staked(address indexed player, uint256 weight, uint64 decidingSlot);
    event StakeSettled(address indexed player, uint256 staked, bool won, uint256 banked);
    event VaultGrew(uint256 added, uint256 total);
    event VaultOpened(address indexed player, bytes32 handle, uint256 paid);
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
    error StakeAlreadyOpen();
    error NoStakeOpen();
    error StakeNotSettled();
    error NothingBanked();
    error BudgetExhausted(uint256 left, uint256 need);
    error NotTheVault(bytes32 handle, uint256 value);
    error VaultEmpty();
    error ShareTooBig();

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
    function createDeck(uint16 n, uint16[] calldata upTo, uint16[] calldata weight, uint16 vaultSlots)
        external
        payable
        onlyOwner
    {
        require(n > 0, "n=0");
        if (vaultSlots > n) revert BadTierTable();
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

        budgetWeight += totalWeight;
        vaultUpTo = vaultSlots;
        vaultUpToOfSeason[season] = vaultSlots;

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
        uint256 price;
        (index, price) = _buyAndDraw();

        Slot storage slot = slots[msg.sender][slots[msg.sender].length - 1];
        handle = euint256.unwrap(slot.card);
        _unseal(slot.card, msg.sender);

        emit CaseOpened(msg.sender, index, handle, price);
        emit SlotRevealed(msg.sender, slots[msg.sender].length - 1);
    }

    ///
    function _buyAndDraw() internal returns (uint16 index, uint256 price) {
        if (drawn >= size) revert DeckEmpty();
        if (!adapter.purchasingAllowed()) revert PurchasingDisabled();

        index = drawn;
        drawn = index + 1;

        price = adapter.ticketPrice();
        uint256 boughtBefore = adapter.ticketsOf(msg.sender);

        ticketToken.safeTransferFrom(msg.sender, address(this), price);
        adapter.buyTicket(msg.sender, address(this));

        if (adapter.ticketsOf(msg.sender) <= boughtBefore) revert TicketNotCredited();

        euint256 card = e.getEuint256(deck, index);
        e.allowThis(card);
        slots[msg.sender].push(Slot({card: card, season: season, battle: 0}));
    }

    ///
    function _unseal(euint256 card, address to) internal {
        e.allowThis(card);
        e.allow(card, to);
        e.reveal(card);
    }

    function revealMine(uint256 i) external {
        Slot storage slot = slots[msg.sender][i];
        if (_inBattle(slot)) revert SlotInBattle(slot.battle);
        _unseal(slot.card, msg.sender);
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
            if (_inBattle(slot)) revert SlotInBattle(slot.battle);
            if (!e.verifyDecryption(card, values[i], signatures[i])) revert BadAttestation(handle);

            uint16 w = weightOf(slot.season, values[i]);
            if (w == 0) revert WorthlessSlot(handle, values[i]);

            shardSpent[handle] = true;
            handles[i] = handle;
            weight += w;
        }

        tickets = weight / WEIGHT_PER_TICKET;
        if (tickets == 0) revert NotEnoughWeight(weight, WEIGHT_PER_TICKET);

        _spendBudget(weight);
        paid = _buyTickets(tickets);

        emit ShardsRedeemed(msg.sender, handles, weight, tickets, paid);
    }

    function _buyTickets(uint256 count) internal returns (uint256 paid) {
        uint256 price = adapter.ticketPrice();
        paid = price * count;

        if (spendable() < paid) _sweepFees();
        uint256 have = spendable();
        if (have < paid) revert TreasuryEmpty(have, paid);

        for (uint256 i = 0; i < count; i++) {
            uint256 boughtBefore = adapter.ticketsOf(msg.sender);
            adapter.buyTicket(msg.sender, address(this));
            if (adapter.ticketsOf(msg.sender) <= boughtBefore) revert TicketNotCredited();
        }
    }

    function weightNow(uint256 value) external view returns (uint16) {
        return weightOf(season, value);
    }


    ///
    ///
    function stake(uint256[] calldata slotIndexes, uint256[] calldata values, bytes[][] calldata signatures)
        external
        nonReentrant
        returns (uint256 weight, uint64 decidingSlot)
    {
        if (stakeOf[msg.sender].open) revert StakeAlreadyOpen();

        uint256 n = slotIndexes.length;
        if (n == 0 || values.length != n || signatures.length != n) revert BadTierTable();

        for (uint256 i = 0; i < n; i++) {
            Slot storage slot = slots[msg.sender][slotIndexes[i]];
            euint256 card = slot.card;
            bytes32 handle = euint256.unwrap(card);

            if (shardSpent[handle]) revert ShardAlreadySpent(handle);
            if (_inBattle(slot)) revert SlotInBattle(slot.battle);
            if (!e.verifyDecryption(card, values[i], signatures[i])) revert BadAttestation(handle);

            uint16 w = weightOf(slot.season, values[i]);
            if (w == 0) revert WorthlessSlot(handle, values[i]);

            shardSpent[handle] = true;
            weight += w;
        }

        decidingSlot = uint64(slots[msg.sender].length);
        stakeOf[msg.sender] = Stake({weight: uint128(weight), slotIndex: decidingSlot, open: true});

        emit Staked(msg.sender, weight, decidingSlot);
    }

    ///
    function settleStake(uint256 value, bytes[] calldata signatures)
        external
        nonReentrant
        returns (bool won, uint256 banked)
    {
        Stake memory st = stakeOf[msg.sender];
        if (!st.open) revert NoStakeOpen();
        if (slots[msg.sender].length <= st.slotIndex) revert StakeNotSettled();

        Slot storage slot = slots[msg.sender][st.slotIndex];
        if (_inBattle(slot)) revert SlotInBattle(slot.battle);
        euint256 card = slot.card;
        if (!e.verifyDecryption(card, value, signatures)) {
            revert BadAttestation(euint256.unwrap(card));
        }

        won = weightOf(slot.season, value) > 0;
        delete stakeOf[msg.sender];

        if (won) {
            banked = uint256(st.weight) * 2;
            bankedWeight[msg.sender] += banked;
        }

        emit StakeSettled(msg.sender, st.weight, won, banked);
    }

    ///
    function claimBanked() external nonReentrant returns (uint256 tickets, uint256 paid) {
        uint256 weight = bankedWeight[msg.sender];
        if (weight == 0) revert NothingBanked();

        uint256 left = budgetLeft();
        uint256 usable = weight > left ? left : weight;

        tickets = usable / WEIGHT_PER_TICKET;
        if (tickets == 0) revert NotEnoughWeight(usable, WEIGHT_PER_TICKET);

        uint256 spent = tickets * WEIGHT_PER_TICKET;
        bankedWeight[msg.sender] = weight - spent;
        _spendBudget(spent);

        paid = _buyTickets(tickets);
        emit ShardsRedeemed(msg.sender, new bytes32[](0), spent, tickets, paid);
    }

    function budgetLeft() public view returns (uint256) {
        return budgetWeight > paidWeight ? budgetWeight - paidWeight : 0;
    }

    function _spendBudget(uint256 weight) internal {
        uint256 left = budgetLeft();
        if (weight > left) revert BudgetExhausted(left, weight);
        paidWeight += weight;
    }

    //
    //
    //

    struct Battle {
        address a;
        uint64 slotA;
        bool resolved;
        address b;
        uint64 slotB;
        uint16 indexA;
        uint64 openedAt;
        uint128 paidA;
    }

    Battle[] private battles;

    mapping(address => uint256[]) private battlesOfPlayer;

    uint64 public constant BATTLE_TIMEOUT = 15 minutes;

    event BattleOpened(uint256 indexed id, address indexed a, uint64 slotA);
    event BattleJoined(uint256 indexed id, address indexed b, uint64 slotB);
    event BattleResolved(uint256 indexed id, address indexed winner, uint256 weight);
    event BattleAbandoned(uint256 indexed id, address indexed a);

    error NoSuchBattle();
    error BattleGone();
    error BattleTaken();
    error BattleWaiting();
    error CannotFightYourself();
    error SlotInBattle(uint64 id);
    error NotYourBattle();
    error TooEarlyToAbandon(uint64 openAt);

    function openBattle() external nonReentrant returns (uint256 id, uint64 slotIndex) {
        (uint16 index, uint256 price) = _buyAndDraw();
        slotIndex = uint64(slots[msg.sender].length - 1);

        battles.push(
            Battle({
                a: msg.sender,
                slotA: slotIndex,
                resolved: false,
                b: address(0),
                slotB: 0,
                indexA: index,
                openedAt: uint64(block.timestamp),
                // forge-lint: disable-next-line(unsafe-typecast)
                paidA: uint128(price)
            })
        );
        id = battles.length;

        // forge-lint: disable-next-line(unsafe-typecast)
        slots[msg.sender][slotIndex].battle = uint64(id);
        battlesOfPlayer[msg.sender].push(id);

        emit BattleOpened(id, msg.sender, slotIndex);
    }

    function joinBattle(uint256 id) external nonReentrant returns (uint64 slotIndex) {
        Battle storage bt = _battle(id);
        if (bt.resolved) revert BattleGone();
        if (bt.b != address(0)) revert BattleTaken();
        if (bt.a == msg.sender) revert CannotFightYourself();

        (uint16 index, uint256 price) = _buyAndDraw();
        slotIndex = uint64(slots[msg.sender].length - 1);

        bt.b = msg.sender;
        bt.slotB = slotIndex;
        // forge-lint: disable-next-line(unsafe-typecast)
        slots[msg.sender][slotIndex].battle = uint64(id);
        battlesOfPlayer[msg.sender].push(id);

        Slot storage sa = slots[bt.a][bt.slotA];
        _unseal(sa.card, bt.a);
        _unseal(slots[msg.sender][slotIndex].card, msg.sender);

        emit BattleJoined(id, msg.sender, slotIndex);
        emit CaseOpened(bt.a, bt.indexA, euint256.unwrap(sa.card), bt.paidA);
        emit CaseOpened(msg.sender, index, euint256.unwrap(slots[msg.sender][slotIndex].card), price);
    }

    ///
    function resolveBattle(
        uint256 id,
        uint256 valueA,
        bytes[] calldata signaturesA,
        uint256 valueB,
        bytes[] calldata signaturesB
    ) external nonReentrant returns (address winner, uint256 banked) {
        Battle storage bt = _battle(id);
        if (bt.resolved) revert BattleGone();
        if (bt.b == address(0)) revert BattleWaiting();

        bt.resolved = true;

        (uint16 wa, uint256 pa) = _fight(slots[bt.a][bt.slotA], valueA, signaturesA);
        (uint16 wb, uint256 pb) = _fight(slots[bt.b][bt.slotB], valueB, signaturesB);

        if (pa == pb) {
            if (wa > 0) bankedWeight[bt.a] += wa;
            if (wb > 0) bankedWeight[bt.b] += wb;
        } else {
            winner = pa > pb ? bt.a : bt.b;
            banked = uint256(wa) + uint256(wb);
            if (banked > 0) bankedWeight[winner] += banked;
        }

        emit BattleResolved(id, winner, banked);
    }

    ///
    function abandonBattle(uint256 id) external {
        Battle storage bt = _battle(id);
        if (bt.resolved) revert BattleGone();
        if (bt.b != address(0)) revert BattleTaken();
        if (bt.a != msg.sender) revert NotYourBattle();
        if (block.timestamp < bt.openedAt + BATTLE_TIMEOUT) revert TooEarlyToAbandon(bt.openedAt);

        bt.resolved = true;
        Slot storage sa = slots[bt.a][bt.slotA];
        sa.battle = 0;
        _unseal(sa.card, bt.a);

        emit BattleAbandoned(id, msg.sender);
        emit CaseOpened(bt.a, bt.indexA, euint256.unwrap(sa.card), bt.paidA);
    }

    ///
    function _fight(Slot storage slot, uint256 value, bytes[] calldata signatures)
        internal
        returns (uint16 w, uint256 power)
    {
        bytes32 handle = euint256.unwrap(slot.card);
        if (!e.verifyDecryption(slot.card, value, signatures)) revert BadAttestation(handle);

        slot.battle = 0;
        w = weightOf(slot.season, value);
        power = _power(slot.season, value, w);
        if (w > 0) shardSpent[handle] = true;
    }

    ///
    function _power(uint32 forSeason, uint256 value, uint16 w) internal view returns (uint256) {
        uint16 upTo = vaultUpToOfSeason[forSeason];
        if (upTo > 0 && value >= 1 && value <= upTo) return type(uint256).max;
        return w;
    }

    function _battle(uint256 id) internal view returns (Battle storage) {
        if (id == 0 || id > battles.length) revert NoSuchBattle();
        return battles[id - 1];
    }

    function _inBattle(Slot storage slot) internal view returns (bool) {
        return slot.battle != 0 && !battles[slot.battle - 1].resolved;
    }

    function battleCount() external view returns (uint256) {
        return battles.length;
    }

    function battleAt(uint256 id) external view returns (Battle memory) {
        return _battle(id);
    }

    function battlesOf(address player) external view returns (uint256[] memory) {
        return battlesOfPlayer[player];
    }

    ///
    function sealedSlotsOf(address player) external view returns (uint64[] memory out) {
        uint256[] storage mine = battlesOfPlayer[player];
        out = new uint64[](mine.length);
        uint256 found;
        for (uint256 i = 0; i < mine.length; i++) {
            Battle storage bt = battles[mine[i] - 1];
            if (bt.resolved || bt.b != address(0)) continue;
            out[found] = bt.slotA;
            found++;
        }
        assembly {
            mstore(out, found)
        }
    }

    function openBattleIds(uint256 max) external view returns (uint256[] memory ids) {
        uint256 n = battles.length;
        uint256 found;
        ids = new uint256[](max);
        for (uint256 i = n; i > 0 && found < max; i--) {
            Battle storage bt = battles[i - 1];
            if (!bt.resolved && bt.b == address(0)) {
                ids[found] = i;
                found++;
            }
        }
        assembly {
            mstore(ids, found)
        }
    }


    function sweepFees() external returns (uint256 claimed) {
        return _sweepFees();
    }

    function _sweepFees() internal returns (uint256 claimed) {
        if (adapter.claimableFor(address(this)) == 0) return 0;

        uint256 before = ticketToken.balanceOf(address(this));
        (bool ok, bytes memory reason) = adapter.jackpot().call(adapter.claimCalldata());
        if (!ok) revert ClaimFailed(reason);
        claimed = ticketToken.balanceOf(address(this)) - before;

        uint256 toVault = (claimed * vaultShareBps) / 10_000;
        if (toVault > 0) {
            vault += toVault;
            emit VaultGrew(toVault, vault);
        }

        emit FeesSwept(claimed);
    }

    function spendable() public view returns (uint256) {
        uint256 balance = ticketToken.balanceOf(address(this));
        return balance > vault ? balance - vault : 0;
    }

    ///
    function claimVault(uint256 slotIndex, uint256 value, bytes[] calldata signatures)
        external
        nonReentrant
        returns (uint256 paid)
    {
        Slot storage slot = slots[msg.sender][slotIndex];
        euint256 card = slot.card;
        bytes32 handle = euint256.unwrap(card);

        if (shardSpent[handle]) revert ShardAlreadySpent(handle);
        if (_inBattle(slot)) revert SlotInBattle(slot.battle);
        if (!e.verifyDecryption(card, value, signatures)) revert BadAttestation(handle);

        uint16 upTo = vaultUpToOfSeason[slot.season];
        if (value == 0 || value > upTo) revert NotTheVault(handle, value);

        shardSpent[handle] = true;

        _sweepFees();

        paid = vault;
        if (paid == 0) revert VaultEmpty();
        vault = 0;

        ticketToken.safeTransfer(msg.sender, paid);
        emit VaultOpened(msg.sender, handle, paid);
    }

    function setVaultShare(uint16 bps) external onlyOwner {
        if (bps > 10_000) revert ShareTooBig();
        vaultShareBps = bps;
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
        return spendable();
    }


    function transferOwnership(address to) external onlyOwner {
        emit OwnerChanged(owner, to);
        owner = to;
    }

    receive() external payable {}
}
