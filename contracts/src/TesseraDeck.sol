// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {elist, ETypes, euint256, e, inco} from "@inco/lightning/src/Lib.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {IMegapotAdapter} from "./interfaces/IMegapotAdapter.sol";

/// A case and a lottery ticket in one transaction.
///
/// The player pays the Megapot ticket price. The contract buys them a real
/// ticket, naming itself as the referrer, and in the same transaction draws a
/// slot from an encrypted, exhaustible pool on Inco. The pool is shuffled once
/// per season through e.shuffledRange and slots are drawn without replacement,
/// so the counter "N big prizes left" is something you can verify rather than
/// something we declare.
///
/// The Inco fee is paid only when a deck is created. Opening a case costs gas.
///
/// The purchase is made by the adapter, not by this contract: Megapot reverts
/// with "Cannot refer yourself" when the referrer equals msg.sender. So the
/// game stays the referrer and the adapter does the calling.
///
/// The contract lives behind a proxy (UUPS). Changing a rule is a logic
/// upgrade, not a new game: decks, slots, vaults and open battles all stay
/// where they are. Without a proxy every deploy wiped the board, which means
/// destroying what players had already bought.
///
/// One thing worth spelling out: Inco handles are issued to `address(this)`.
/// Behind a proxy that is the PROXY address, and it does not change on an
/// upgrade, so cards already drawn stay readable. This is also why "move the
/// state into a new contract" is no substitute for a proxy: the handles are
/// bound to the old address.
contract TesseraDeck is Initializable, UUPSUpgradeable, ReentrancyGuardTransient {
    using SafeERC20 for IERC20;

    // ── storage ───────────────────────────────────────────────────────────────
    //
    // The order of these fields is part of the contract with every slot already
    // sold. An upgrade may only APPEND new fields at the end. Reordering,
    // removing or narrowing a type is not allowed: the storage stays as it was
    // and a field quietly starts reading somebody else's bytes. That failure
    // does not revert, it drifts.
    //
    // The parents take no slots: Initializable and UUPSUpgradeable keep theirs
    // at named ERC-7201 addresses, ReentrancyGuardTransient keeps its own in
    // transient storage. So the numbering starts at adapter.

    /// Not immutable, even though it never changes.
    ///
    /// An immutable lives in the BYTECODE of the implementation, not in
    /// storage. Behind a proxy that would mean the adapter has to be passed
    /// correctly to the constructor of EVERY new implementation, and a typo in
    /// some future upgrade would silently point the game at a different Megapot
    /// with a different token. In storage the value is set once and an upgrade
    /// cannot reach it. The price is measured below, in the comment on
    /// initialize.
    IMegapotAdapter public adapter;
    IERC20 public ticketToken;

    address public owner;

    /// One rung of the drop table: every value up to and including `upTo`
    /// weighs `weight`. Rungs go in increasing order of upTo; anything above
    /// the last one weighs nothing.
    struct Tier {
        uint16 upTo;
        uint16 weight;
    }

    /// A single deck.
    ///
    /// Several exist at once and they live in parallel: a cheap one with
    /// frequent small prizes, an expensive one with a rare large vault. The
    /// player picks what to play rather than taking whatever happens to be up.
    ///
    /// A deck's drop table is fixed forever and judges only its own slots.
    /// Without that, a redemption would price an old slot against somebody
    /// else's table: a more generous neighbouring deck would retroactively make
    /// cosmetics dearer and pay for them out of a treasury that never earned
    /// those fees.
    struct Deck {
        elist cards;
        uint16 size;
        uint16 drawn;
        /// Values 1..vaultUpTo open THIS deck's vault.
        uint16 vaultUpTo;
        /// Every deck has its own vault.
        uint128 vault;
        /// How many times it was opened since fees were last swept.
        /// This number is what splits the commission between decks.
        uint64 unsweptOpens;
        /// Who cut the deck. Zero means a house deck.
        ///
        /// The creator holds no power over it: they cannot reshuffle it, change
        /// the drop table or stop the sale, and neither can the contract owner.
        /// It is simply the address that owns a share of the commission.
        address creator;
        /// What share of the TREASURY half of the commission the creator takes.
        ///
        /// Not a share of the dollar. The dollar still goes whole into a real
        /// Megapot ticket, which is the one promise the game makes without
        /// conditions, and nobody gets to sell pieces of it, the creator
        /// included. Only the commission Megapot returns to the referrer is
        /// divided.
        uint16 creatorBps;
    }

    Deck[] private decks;

    mapping(uint256 => Tier[]) private tiersOfDeck;

    /// Total opens since the last sweep.
    uint64 public unsweptOpens;

    /// How much weight adds up to one real ticket.
    ///
    /// Weight is the "shard" as a unit of measure. A slot worth 1 is an eighth
    /// of a ticket, a slot worth 25 is five tickets at once. A steep drop table
    /// is possible precisely because the weights differ: almost always zero,
    /// rarely a lot.
    uint256 public constant WEIGHT_PER_TICKET = 5;

    /// How many cases one transaction may open.
    uint8 public constant MAX_BATCH = 10;

    /// A slot remembers which deck it was drawn from.
    struct Slot {
        euint256 card;
        uint32 deckId;
        /// The battle this slot is locked into. Zero means free.
        uint64 battle;
        /// A slot the player gave up their Megapot ticket for. Weighs double.
        ///
        /// There will be no new ones: the forfeit mode was taken out of the
        /// game. The field stays because a slot taken under that rule is
        /// already on the board and its weight is computed from this very flag.
        /// Removing the field would mean changing somebody else's slot after
        /// the fact.
        bool risk;
    }

    mapping(address => Slot[]) private slots;

    /// The prize budget of the game: the total weight of every deck ever cut.
    ///
    /// A ceiling, not a target. However much anyone doubles up, the game cannot
    /// hand out more weight than it put into the decks, and by construction no
    /// deck weighs more than half of its own slots. So payouts are bounded
    /// forever by the commission those same opens brought in.
    ///
    /// One counter for the whole game rather than one per season: a stake can
    /// outlive a change of deck, and splitting it by season would only offer a
    /// way to get insolvency wrong.
    uint256 public budgetWeight;

    /// How much weight has already been paid out in tickets.
    uint256 public paidWeight;

    /// A player's unsettled stake.
    struct Stake {
        /// How much weight is at stake.
        uint128 weight;
        /// The slot that will decide the stake, the next one opened.
        uint64 slotIndex;
        bool open;
    }

    mapping(address => Stake) public stakeOf;

    /// Weight won and not yet redeemed for tickets.
    mapping(address => uint256) public bankedWeight;

    // ── the vault ─────────────────────────────────────────────────────────────
    //
    // Half of the commission is not handed out ticket by ticket, it accumulates
    // instead. One slot in a deck opens the whole vault at once.
    //
    // The same money, gathered into a heap: "fifty players each got a ticket"
    // and "one person took the whole vault" cost exactly the same, and only the
    // second is worth spinning for. And since both the vault and the number of
    // cases left are on screen, the exhaustible pool finally works for the
    // thrill rather than only for honesty.

    /// What share of swept commission goes to the vaults. Set in initialize.
    uint16 public vaultShareBps;

    /// A prize burns on redemption. Keyed by handle, because a handle is
    /// unique forever and does not depend on how a player's slots are numbered.
    mapping(bytes32 => bool) public shardSpent;

    // ── player decks ──────────────────────────────────────────────────────────
    //
    // Anyone can cut a deck, and that is safer than it sounds: the same
    // break-even limit that applies to house decks makes it impossible to
    // create one that costs the game more than it earns. Someone who wants a
    // more generous drop simply cannot have it; the contract refuses while the
    // transaction is still being simulated.
    //
    // Three ways to do harm remain, and each has a lock:
    //   spam with tiny decks     -> a minimum size and a cutting fee;
    //   pull more out of the game -> a ceiling on the creator's share;
    //   eat the redemption fund   -> creatorOwed is subtracted from spendable().

    mapping(uint32 => string) public deckMeta;

    mapping(address => uint256) public creatorClaimable;

    uint256 public creatorOwed;

    uint256 public customDeckFee;

    uint16 public maxCreatorBps;

    uint16 public minCustomSize;

    event DeckCreated(
        uint32 indexed deckId,
        uint16 size,
        uint16 totalWeight,
        uint256 feePaid,
        address indexed creator,
        uint16 creatorBps
    );
    event CreatorPaid(uint32 indexed deckId, address indexed creator, uint256 amount);
    event CreatorClaimed(address indexed creator, uint256 amount);
    event CaseOpened(
        address indexed player, uint32 indexed deckId, uint16 index, bytes32 handle, uint256 paid
    );
    event SlotRevealed(address indexed player, uint256 index);
    event FeesSwept(uint256 amount);
    event ShardsRedeemed(address indexed player, bytes32[] handles, uint256 weight, uint256 tickets, uint256 paid);
    event Staked(address indexed player, uint256 weight, uint64 decidingSlot);
    event StakeSettled(address indexed player, uint256 staked, bool won, uint256 banked);
    event VaultGrew(uint32 indexed deckId, uint256 added, uint256 total);
    event RiskTaken(
        address indexed player, uint32 indexed deckId, uint16 index, bytes32 handle, uint256 toVault
    );
    event VaultOpened(address indexed player, uint32 indexed deckId, bytes32 handle, uint256 paid);
    event OwnerChanged(address indexed from, address indexed to);

    error NotOwner();
    error DeckEmpty();
    error NoSuchDeck();
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
    error ShareStarvesPrizes();
    error DeckHasNoVault();
    error DeckTooSmall(uint16 size, uint16 min);
    error NothingToClaim();
    error BadBatch(uint8 n);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        _disableInitializers();
    }

    ///
    ///
    ///
    function initialize(IMegapotAdapter _adapter, address _owner) external initializer {
        adapter = _adapter;
        ticketToken = _adapter.ticketToken();
        owner = _owner;

        vaultShareBps = 5000;
        customDeckFee = 5e6;
        maxCreatorBps = 5000;
        minCustomSize = 50;

        ticketToken.forceApprove(address(_adapter), type(uint256).max);
        emit OwnerChanged(address(0), _owner);
    }

    ///
    function _authorizeUpgrade(address) internal override onlyOwner {}


    function deckFee(uint16 n) public view returns (uint256) {
        return 2 * inco.getEListFee(n, ETypes.Uint256);
    }

    ///
    ///
    function createDeck(uint16 n, uint16[] calldata upTo, uint16[] calldata weight, uint16 vaultSlots)
        external
        payable
        onlyOwner
        returns (uint32 deckId)
    {
        return _createDeck(n, upTo, weight, vaultSlots, address(0), 0);
    }

    ///
    ///
    ///
    function createCustomDeck(
        uint16 n,
        uint16[] calldata upTo,
        uint16[] calldata weight,
        uint16 vaultSlots,
        uint16 creatorBps,
        string calldata cid
    ) external payable returns (uint32 deckId) {
        if (n < minCustomSize) revert DeckTooSmall(n, minCustomSize);
        if (creatorBps > maxCreatorBps) revert ShareTooBig();

        if (customDeckFee > 0) {
            ticketToken.safeTransferFrom(msg.sender, address(this), customDeckFee);
        }

        deckId = _createDeck(n, upTo, weight, vaultSlots, msg.sender, creatorBps);
        deckMeta[deckId] = cid;
    }

    function _createDeck(
        uint16 n,
        uint16[] calldata upTo,
        uint16[] calldata weight,
        uint16 vaultSlots,
        address creator,
        uint16 creatorBps
    ) internal returns (uint32 deckId) {
        if (vaultSlots > n) revert BadTierTable();
        if (upTo.length == 0 || upTo.length != weight.length) revert BadTierTable();

        uint16 prev;
        for (uint256 i = 0; i < upTo.length; i++) {
            if (upTo[i] <= prev || upTo[i] > n) revert BadTierTable();
            prev = upTo[i];
        }

        //
        //

        // forge-lint: disable-next-line(unsafe-typecast)
        deckId = uint32(decks.length);
        decks.push(
            Deck({
                cards: elist.wrap(bytes32(0)),
                size: n,
                drawn: 0,
                vaultUpTo: vaultSlots,
                vault: 0,
                unsweptOpens: 0,
                creator: creator,
                creatorBps: creatorBps
            })
        );

        Tier[] storage t = tiersOfDeck[deckId];
        for (uint256 i = 0; i < upTo.length; i++) {
            t.push(Tier({upTo: upTo[i], weight: weight[i]}));
        }

        uint256 totalWeight = _tableWeight(deckId);
        if (totalWeight * 2 * 10_000 > uint256(n) * (10_000 - vaultShareBps)) {
            revert TooManyShardSlots();
        }
        budgetWeight += totalWeight;
        _shuffleInto(decks[deckId]);

        // forge-lint: disable-next-line(unsafe-typecast)
        emit DeckCreated(deckId, n, uint16(totalWeight), msg.value, creator, creatorBps);
    }

    ///
    function claimCreator() external nonReentrant returns (uint256 amount) {
        amount = creatorClaimable[msg.sender];
        if (amount == 0) revert NothingToClaim();
        creatorClaimable[msg.sender] = 0;
        creatorOwed -= amount;
        ticketToken.safeTransfer(msg.sender, amount);
        emit CreatorClaimed(msg.sender, amount);
    }

    function weightOf(uint32 deckId, uint256 value) public view returns (uint16) {
        Tier[] storage t = tiersOfDeck[deckId];
        for (uint256 i = 0; i < t.length; i++) {
            if (value <= t[i].upTo) return t[i].weight;
        }
        return 0;
    }

    function tiers(uint32 deckId) external view returns (Tier[] memory) {
        return tiersOfDeck[deckId];
    }

    function deckCount() external view returns (uint256) {
        return decks.length;
    }

    function deckAt(uint32 deckId) external view returns (Deck memory) {
        return _deck(deckId);
    }

    function _deck(uint32 deckId) internal view returns (Deck storage) {
        if (deckId >= decks.length) revert NoSuchDeck();
        return decks[deckId];
    }


    ///
    function openCase(uint32 deckId) external nonReentrant returns (uint16 index, bytes32 handle) {
        return _openOne(deckId);
    }

    ///
    ///
    function openMany(uint32 deckId, uint8 n) external nonReentrant {
        if (n == 0 || n > MAX_BATCH) revert BadBatch(n);
        for (uint256 k = 0; k < n; k++) _openOne(deckId);
    }

    function _openOne(uint32 deckId) internal returns (uint16 index, bytes32 handle) {
        uint256 price;
        (index, price) = _buyAndDraw(deckId);

        uint256 i = slots[msg.sender].length - 1;
        Slot storage slot = slots[msg.sender][i];
        handle = euint256.unwrap(slot.card);
        _unseal(slot.card, msg.sender);

        emit CaseOpened(msg.sender, deckId, index, handle, price);
        emit SlotRevealed(msg.sender, i);
    }


    ///
    ///
    function _escrowAndDraw(uint32 deckId) internal returns (uint16 index, uint256 price) {
        Deck storage d = _deck(deckId);
        //
        if (!adapter.purchasingAllowed()) revert PurchasingDisabled();

        price = adapter.ticketPrice();
        ticketToken.safeTransferFrom(msg.sender, address(this), price);
        battleEscrow += price;

        index = _draw(d, deckId, false);
    }

    ///
    function _buyAndDraw(uint32 deckId) internal returns (uint16 index, uint256 price) {
        Deck storage d = _deck(deckId);
        if (!adapter.purchasingAllowed()) revert PurchasingDisabled();

        d.unsweptOpens += 1;
        unsweptOpens += 1;

        price = adapter.ticketPrice();
        uint256 boughtBefore = adapter.ticketsOf(msg.sender);

        ticketToken.safeTransferFrom(msg.sender, address(this), price);
        adapter.buyTicket(msg.sender, address(this));

        if (adapter.ticketsOf(msg.sender) <= boughtBefore) revert TicketNotCredited();

        index = _draw(d, deckId, false);
    }


    function _tableWeight(uint32 deckId) internal view returns (uint256 total) {
        Tier[] storage t = tiersOfDeck[deckId];
        uint16 prev;
        for (uint256 i = 0; i < t.length; i++) {
            total += uint256(t[i].upTo - prev) * uint256(t[i].weight);
            prev = t[i].upTo;
        }
    }

    ///
    function _shuffleInto(Deck storage d) internal {
        elist cards = e.shuffledRange(1, d.size + 1, ETypes.Uint256);
        e.allowThis(cards);
        d.cards = cards;
        d.drawn = 0;
    }

    ///
    ///
    ///
    function _reseal(uint32 deckId, uint8 why) internal {
        Deck storage d = decks[deckId];

        budgetWeight += _tableWeight(deckId);
        _shuffleInto(d);

        uint32 cut = reseals[deckId] + 1;
        reseals[deckId] = cut;
        emit DeckResealed(deckId, cut, d.size, why);
    }

    ///
    function _draw(Deck storage d, uint32 deckId, bool risk) internal returns (uint16 index) {
        if (d.drawn >= d.size) {
            if (address(this).balance < deckFee(d.size)) revert DeckEmpty();
            _reseal(deckId, RESEAL_DRAWN_OUT);
        }
        index = d.drawn;
        d.drawn = index + 1;

        euint256 card = e.getEuint256(d.cards, index);
        e.allowThis(card);
        slots[msg.sender].push(Slot({card: card, deckId: deckId, battle: 0, risk: risk}));
    }

    ///
    function _slotWeight(Slot storage slot, uint256 value) internal view returns (uint256) {
        uint256 w = weightOf(slot.deckId, value);
        return slot.risk ? w * 2 : w;
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

            uint256 w = _slotWeight(slot, values[i]);
            if (w == 0) revert WorthlessSlot(handle, values[i]);

            shardSpent[handle] = true;
            handles[i] = handle;
            weight += w;
        }

        tickets = weight / WEIGHT_PER_TICKET;
        if (tickets == 0) revert NotEnoughWeight(weight, WEIGHT_PER_TICKET);

        _spendBudget(weight);
        paid = _buyTicketsFor(msg.sender, tickets);

        emit ShardsRedeemed(msg.sender, handles, weight, tickets, paid);
    }

    ///
    function _buyTicketsFor(address to, uint256 count) internal returns (uint256 paid) {
        uint256 price = adapter.ticketPrice();
        paid = price * count;

        if (spendable() < paid) _sweepFees();
        uint256 have = spendable();
        if (have < paid) revert TreasuryEmpty(have, paid);

        for (uint256 i = 0; i < count; i++) {
            uint256 boughtBefore = adapter.ticketsOf(to);
            adapter.buyTicket(to, address(this));
            if (adapter.ticketsOf(to) <= boughtBefore) revert TicketNotCredited();
        }
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

            uint256 w = _slotWeight(slot, values[i]);
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

        //
        won = weightOf(slot.deckId, value) > 0 || _isVaultCard(slot.deckId, value);
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

        paid = _buyTicketsFor(msg.sender, tickets);
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
    //
    //
    //
    //
    //

    struct Battle {
        address a;
        uint64 slotA;
        bool resolved;
        address b;
        uint64 slotB;
        uint32 deckId;
        uint16 indexA;
        uint64 openedAt;
        uint128 paidA;
    }

    Battle[] private battles;

    mapping(address => uint256[]) private battlesOfPlayer;

    //
    //
    //
    //

    ///
    uint256 public battleEscrow;

    mapping(uint256 => uint128) public battlePaidB;

    uint64 public constant BATTLE_TIMEOUT = 15 minutes;

    //
    //
    //
    //
    //

    ///
    mapping(uint32 => uint32) public reseals;

    ///
    event DeckResealed(uint32 indexed deckId, uint32 indexed cut, uint16 size, uint8 why);

    uint8 constant RESEAL_DRAWN_OUT = 0;
    uint8 constant RESEAL_VAULT_TAKEN = 1;

    event BattleOpened(uint256 indexed id, address indexed a, uint64 slotA);
    event BattleJoined(uint256 indexed id, address indexed b, uint64 slotB);
    event BattleResolved(uint256 indexed id, address indexed winner, uint256 weight, uint256 tickets);
    event BattleAbandoned(uint256 indexed id, address indexed a);

    error NoSuchBattle();
    error BattleGone();
    error BattleTaken();
    error BattleWaiting();
    error CannotFightYourself();
    error SlotInBattle(uint64 id);
    error NotYourBattle();
    error TooEarlyToAbandon(uint64 openAt);

    ///
    function openBattle(uint32 deckId) external nonReentrant returns (uint256 id, uint64 slotIndex) {
        (uint16 index, uint256 price) = _escrowAndDraw(deckId);
        slotIndex = uint64(slots[msg.sender].length - 1);

        battles.push(
            Battle({
                a: msg.sender,
                slotA: slotIndex,
                resolved: false,
                b: address(0),
                slotB: 0,
                deckId: deckId,
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

        (uint16 index, uint256 price) = _escrowAndDraw(bt.deckId);
        slotIndex = uint64(slots[msg.sender].length - 1);

        bt.b = msg.sender;
        bt.slotB = slotIndex;
        // forge-lint: disable-next-line(unsafe-typecast)
        battlePaidB[id] = uint128(price);
        // forge-lint: disable-next-line(unsafe-typecast)
        slots[msg.sender][slotIndex].battle = uint64(id);
        battlesOfPlayer[msg.sender].push(id);

        Slot storage sa = slots[bt.a][bt.slotA];
        _unseal(sa.card, bt.a);
        _unseal(slots[msg.sender][slotIndex].card, msg.sender);

        emit BattleJoined(id, msg.sender, slotIndex);
        emit CaseOpened(bt.a, bt.deckId, bt.indexA, euint256.unwrap(sa.card), bt.paidA);
        emit CaseOpened(
            msg.sender, bt.deckId, index, euint256.unwrap(slots[msg.sender][slotIndex].card), price
        );
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

        (uint256 wa, uint256 pa) = _fight(slots[bt.a][bt.slotA], valueA, signaturesA);
        (uint256 wb, uint256 pb) = _fight(slots[bt.b][bt.slotB], valueB, signaturesB);

        //
        bool aWins = pa == pb ? valueA < valueB : pa > pb;
        winner = aWins ? bt.a : bt.b;

        banked = wa + wb;
        if (banked > 0) bankedWeight[winner] += banked;

        uint256 tickets =
            _payStake(bt.deckId, winner, uint256(bt.paidA) + uint256(battlePaidB[id]));

        emit BattleResolved(id, winner, banked, tickets);
    }

    ///
    ///
    function _payStake(uint32 deckId, address to, uint256 pot) internal returns (uint256 count) {
        battleEscrow -= pot;

        count = pot / adapter.ticketPrice();
        if (count == 0) return 0;

        Deck storage d = decks[deckId];
        // forge-lint: disable-next-line(unsafe-typecast)
        d.unsweptOpens += uint64(count);
        // forge-lint: disable-next-line(unsafe-typecast)
        unsweptOpens += uint64(count);

        _buyTicketsFor(to, count);
    }

    ///
    ///
    function abandonBattle(uint256 id) external nonReentrant {
        Battle storage bt = _battle(id);
        if (bt.resolved) revert BattleGone();
        if (bt.b != address(0)) revert BattleTaken();
        if (bt.a != msg.sender) revert NotYourBattle();
        if (block.timestamp < bt.openedAt + BATTLE_TIMEOUT) revert TooEarlyToAbandon(bt.openedAt);

        bt.resolved = true;
        Slot storage sa = slots[bt.a][bt.slotA];
        sa.battle = 0;
        _unseal(sa.card, bt.a);

        _payStake(bt.deckId, bt.a, bt.paidA);

        emit BattleAbandoned(id, msg.sender);
        emit CaseOpened(bt.a, bt.deckId, bt.indexA, euint256.unwrap(sa.card), bt.paidA);
    }

    ///
    function _fight(Slot storage slot, uint256 value, bytes[] calldata signatures)
        internal
        returns (uint256 w, uint256 power)
    {
        bytes32 handle = euint256.unwrap(slot.card);
        if (!e.verifyDecryption(slot.card, value, signatures)) revert BadAttestation(handle);

        slot.battle = 0;
        w = _slotWeight(slot, value);
        power = _power(slot.deckId, value, w);
        if (w > 0) shardSpent[handle] = true;
    }

    ///
    function _isVaultCard(uint32 deckId, uint256 value) internal view returns (bool) {
        uint16 upTo = decks[deckId].vaultUpTo;
        return upTo > 0 && value >= 1 && value <= upTo;
    }

    ///
    function _power(uint32 deckId, uint256 value, uint256 w) internal view returns (uint256) {
        if (_isVaultCard(deckId, value)) return type(uint256).max;
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
        _distribute(toVault, claimed - toVault);

        emit FeesSwept(claimed);
    }

    ///
    ///
    ///
    ///
    ///
    function _distribute(uint256 toVault, uint256 toTreasury) internal {
        uint64 vaultTotal;
        for (uint256 i = 0; i < decks.length; i++) {
            if (decks[i].vaultUpTo > 0) vaultTotal += decks[i].unsweptOpens;
        }

        if (toVault > 0 && vaultTotal > 0) {
            uint256 given;
            uint256 last = type(uint256).max;
            for (uint256 i = 0; i < decks.length; i++) {
                Deck storage d = decks[i];
                if (d.unsweptOpens == 0 || d.vaultUpTo == 0) continue;
                uint256 share = (toVault * d.unsweptOpens) / vaultTotal;
                if (share == 0) continue;
                // forge-lint: disable-next-line(unsafe-typecast)
                d.vault += uint128(share);
                given += share;
                last = i;
                // forge-lint: disable-next-line(unsafe-typecast)
                emit VaultGrew(uint32(i), share, d.vault);
            }
            if (last != type(uint256).max && given < toVault) {
                // forge-lint: disable-next-line(unsafe-typecast)
                decks[last].vault += uint128(toVault - given);
            }
        }

        //
        uint64 opensAll = unsweptOpens;
        if (toTreasury > 0 && opensAll > 0) {
            for (uint256 i = 0; i < decks.length; i++) {
                Deck storage d = decks[i];
                if (d.unsweptOpens == 0 || d.creator == address(0) || d.creatorBps == 0) continue;
                uint256 earned = (toTreasury * d.unsweptOpens) / opensAll;
                uint256 cut = (earned * d.creatorBps) / 10_000;
                if (cut == 0) continue;
                creatorClaimable[d.creator] += cut;
                creatorOwed += cut;
                // forge-lint: disable-next-line(unsafe-typecast)
                emit CreatorPaid(uint32(i), d.creator, cut);
            }
        }

        for (uint256 i = 0; i < decks.length; i++) decks[i].unsweptOpens = 0;
        unsweptOpens = 0;
    }

    function vault() public view returns (uint256 total) {
        for (uint256 i = 0; i < decks.length; i++) total += decks[i].vault;
    }

    function vaultOf(uint32 deckId) external view returns (uint256) {
        return _deck(deckId).vault;
    }

    ///
    function spendable() public view returns (uint256) {
        uint256 balance = ticketToken.balanceOf(address(this));
        uint256 locked = vault() + creatorOwed + battleEscrow;
        return balance > locked ? balance - locked : 0;
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

        uint32 deckId = slot.deckId;
        if (!_isVaultCard(deckId, value)) revert NotTheVault(handle, value);

        shardSpent[handle] = true;

        _sweepFees();

        paid = decks[deckId].vault;
        if (paid == 0) revert VaultEmpty();
        decks[deckId].vault = 0;

        ticketToken.safeTransfer(msg.sender, paid);
        emit VaultOpened(msg.sender, deckId, handle, paid);

        //
        if (address(this).balance >= deckFee(decks[deckId].size)) {
            _reseal(deckId, RESEAL_VAULT_TAKEN);
        }
    }

    ///
    ///
    function setVaultShare(uint16 bps) external onlyOwner {
        if (bps > 10_000) revert ShareTooBig();
        uint256 sold = _slotsCut();
        if (budgetWeight * 2 * 10_000 > sold * (10_000 - bps)) revert ShareStarvesPrizes();
        vaultShareBps = bps;
    }

    ///
    ///
    function _slotsCut() internal view returns (uint256 sold) {
        for (uint256 i = 0; i < decks.length; i++) {
            // forge-lint: disable-next-line(unsafe-typecast)
            sold += uint256(decks[i].size) * (1 + uint256(reseals[uint32(i)]));
        }
    }

    ///
    function maxVaultShare() external view returns (uint16) {
        uint256 sold = _slotsCut();
        if (sold == 0) return 10_000;
        //
        //
        uint256 need = (budgetWeight * 2 * 10_000 + sold - 1) / sold;
        // forge-lint: disable-next-line(unsafe-typecast)
        return need >= 10_000 ? 0 : uint16(10_000 - need);
    }

    function setCustomDeckRules(uint256 fee, uint16 maxBps, uint16 minSize) external onlyOwner {
        if (maxBps > 5000) revert ShareTooBig();
        customDeckFee = fee;
        maxCreatorBps = maxBps;
        minCustomSize = minSize;
    }



    function handleOf(address player, uint256 i) external view returns (bytes32) {
        return euint256.unwrap(slots[player][i].card);
    }

    function slotDeck(address player, uint256 i) external view returns (uint32) {
        return slots[player][i].deckId;
    }


    ///
    function weightOfSlot(address player, uint256 i, uint256 value) external view returns (uint256) {
        return _slotWeight(slots[player][i], value);
    }

    function slotIsRisk(address player, uint256 i) external view returns (bool) {
        return slots[player][i].risk;
    }


    function countOf(address player) external view returns (uint256) {
        return slots[player].length;
    }

    function remaining(uint32 deckId) external view returns (uint16) {
        Deck storage d = _deck(deckId);
        return d.size - d.drawn;
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

    ///
    ///
    ///
    receive() external payable {}
}
