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

    /// The deck's name and picture. What sits here is an IPFS CID, not the data
    /// itself: the chain stores only a pointer, and nobody can swap it after the
    /// deck is cut, the creator included.
    mapping(uint32 => string) public deckMeta;

    /// How much commission belongs to a creator and has not been taken yet.
    mapping(address => uint256) public creatorClaimable;

    /// The sum of every creatorClaimable. Kept separately so that spendable()
    /// does not have to walk all creators: this money is no longer ours, and
    /// spending it on redemptions is as forbidden as spending the vaults.
    uint256 public creatorOwed;

    /// The fee for cutting a player deck, in the ticket token. Goes to the treasury.
    uint256 public customDeckFee;

    /// Ceiling on the creator's share: half of the treasury half of the fee.
    /// The other half has to stay with the game, because that is what pays for
    /// turning TESA into real tickets, including inside that very deck.
    uint16 public maxCreatorBps;

    /// The smallest player deck allowed. Tiny decks run out at once and turn
    /// the catalogue into a graveyard of dead cards.
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
    /// The player gave up their ticket: the slot weighs double, the dollar went
    /// to the vault.
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
    /// A vault share that would leave the prizes less than has already been promised.
    error ShareStarvesPrizes();
    error DeckHasNoVault();
    error DeckTooSmall(uint16 size, uint16 min);
    error NothingToClaim();
    error BadBatch(uint8 n);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /// Nobody should initialize the implementation directly: the game lives in
    /// the proxy's storage, not here. We lock it so that a stranger cannot become
    /// the owner of the implementation and gain the right to upgrade it.
    constructor() {
        _disableInitializers();
    }

    /// Starting the game in the proxy's storage.
    ///
    /// The owner comes in as an argument rather than from msg.sender: a script
    /// deploys the proxy, but a wallet has to own the game, and confusing the two
    /// is not an option.
    ///
    /// The values that used to sit next to the fields are set here as well.
    /// Inline initializers run in the CONSTRUCTOR, that is, in the storage of the
    /// implementation; behind a proxy they would never take effect, and the game
    /// would come up with a zero vault share and a zero minimum deck size.
    /// Silently: no revert, just different rules.
    ///
    /// The measured price of the whole move to a proxy, on a warm case open:
    /// 222,690 to 223,811 gas, so +1,121 (+0.5%). That covers the delegatecall
    /// through the proxy and reading adapter/ticketToken from storage instead of
    /// bytecode. The implementation grew by 1,646 bytes (21,847 to 23,493),
    /// leaving 1,083 before the EIP-170 limit.
    function initialize(IMegapotAdapter _adapter, address _owner) external initializer {
        adapter = _adapter;
        ticketToken = _adapter.ticketToken();
        owner = _owner;

        vaultShareBps = 5000;
        customDeckFee = 5e6;
        maxCreatorBps = 5000;
        minCustomSize = 50;

        // The adapter is fixed and stateless, so the approval is granted once:
        // that way an open does not pay for an approve every time.
        ticketToken.forceApprove(address(_adapter), type(uint256).max);
        emit OwnerChanged(address(0), _owner);
    }

    /// Only the owner of the game may replace the logic.
    ///
    /// This is the price of a proxy: the owner can change the rules underneath
    /// slots already sold. The cure is a timelock on this address, and once the
    /// mechanics settle, an upgrade that makes _authorizeUpgrade revert forever.
    /// While the mechanics still move, being able to upgrade matters more.
    function _authorizeUpgrade(address) internal override onlyOwner {}

    // ── decks ─────────────────────────────────────────────────────────────────

    /// How much ETH it takes to create a deck of n slots.
    function deckFee(uint16 n) public view returns (uint256) {
        return 2 * inco.getEListFee(n, ETypes.Uint256);
    }

    /// A new deck with its own drop table and its own vault.
    ///
    /// Decks live in parallel rather than replacing one another. The deal players
    /// pay into stays the same down to its last slot; nobody can reshuffle a deck
    /// mid game, the owner included. But once a deal is played out, or its vault
    /// has been taken, the deck deals itself again: see `_reseal`.
    ///
    /// upTo increases; weight is what a slot in that rung is worth. A steep table
    /// for 100 slots looks like upTo [1, 4, 12] with weight [25, 5, 1]: one slot
    /// worth five tickets, three worth one each, eight shards, and the remaining
    /// eighty eight worth nothing.
    function createDeck(uint16 n, uint16[] calldata upTo, uint16[] calldata weight, uint16 vaultSlots)
        external
        payable
        onlyOwner
        returns (uint32 deckId)
    {
        return _createDeck(n, upTo, weight, vaultSlots, address(0), 0);
    }

    /// A deck cut by a player.
    ///
    /// The rules are the same as for a house deck: the same break even limit, the
    /// same irreversibility, the same public drop table. Exactly one thing is
    /// different, the deck has an address that owns a share of the commission.
    ///
    /// Why a generous drop cannot break this: `_createDeck` weighs the total
    /// against what the deck will earn in commission, and not against all of it,
    /// only the part that actually reaches the prizes, that is, without the vault
    /// share. A deck made of nothing but jackpots simply does not get created,
    /// and not because we disapproved, but because the arithmetic does not add up.
    ///
    /// `cid` is the deck's signature in the form `name:hue`. The chain holds
    /// nothing else about how it looks, and nobody can change that string after
    /// the cut. The picture, if the creator supplied one, lives off chain and is
    /// tied to the deck number: refusing it does not cancel the deck.
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

        // The fee goes to the treasury, which means to everyone's prizes, not to
        // the owner.
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
        // There is deliberately no separate n = 0 check here: the drop table
        // already does it. An empty table is rejected by the line below, and in a
        // non-empty one the first rung has upTo >= 1, which is greater than a
        // size of zero, so the deck falls out on BadTierTable. A second lock on
        // the same door would cost a line of bytecode, and there is no room left.
        if (vaultSlots > n) revert BadTierTable();
        if (upTo.length == 0 || upTo.length != weight.length) revert BadTierTable();

        uint16 prev;
        for (uint256 i = 0; i < upTo.length; i++) {
            // Strictly increasing and within the deck, otherwise the rungs
            // overlap and "the weight of a slot" stops being a single answer.
            if (upTo[i] <= prev || upTo[i] > n) revert BadTierTable();
            prev = upTo[i];
        }

        // A break even limit rather than a matter of taste: an open brings in 10%
        // of a dollar, a ticket costs a dollar, and a ticket takes five weight.
        //
        // But not all of that 10% goes to prizes: vaultShareBps settles in the
        // vaults. The old limit counted the full ten cents and therefore let a
        // deck promise EXACTLY TWICE what there was to pay with when the vault
        // takes half. The mistake did not fail at cut time and did not fail on an
        // open; it waited for the first person who came to redeem a prize and
        // would have met them with a TreasuryEmpty revert. "You won, but you
        // cannot collect" is the worst thing a game can say.
        //
        // So the limit only counts the share of the commission that really
        // reaches the prizes. If Megapot ever cuts the referral share, the
        // multiplier of 2 has to come down with it.

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

        // The weight is computed from storage, with the very code that recomputes
        // it on every reshuffle. Two separate counts of one quantity would drift
        // apart sooner or later, and here they must not: the solvency of the game
        // rests on this number.
        uint256 totalWeight = _tableWeight(deckId);
        if (totalWeight * 2 * 10_000 > uint256(n) * (10_000 - vaultShareBps)) {
            revert TooManyShardSlots();
        }
        budgetWeight += totalWeight;
        _shuffleInto(decks[deckId]);

        // forge-lint: disable-next-line(unsafe-typecast)
        emit DeckCreated(deckId, n, uint16(totalWeight), msg.value, creator, creatorBps);
    }

    /// Take your share of the commission.
    ///
    /// The money is already set aside: it is counted in creatorOwed and excluded
    /// from spendable(), so the treasury could never have spent it on
    /// redemptions. There is no queue here, no permission, and no way to end up
    /// with nothing.
    function claimCreator() external nonReentrant returns (uint256 amount) {
        amount = creatorClaimable[msg.sender];
        if (amount == 0) revert NothingToClaim();
        creatorClaimable[msg.sender] = 0;
        creatorOwed -= amount;
        ticketToken.safeTransfer(msg.sender, amount);
        emit CreatorClaimed(msg.sender, amount);
    }

    /// What such a value weighs in such a deck. The table is public; the only
    /// hidden thing is which slot goes to whom.
    function weightOf(uint32 deckId, uint256 value) public view returns (uint16) {
        Tier[] storage t = tiersOfDeck[deckId];
        for (uint256 i = 0; i < t.length; i++) {
            if (value <= t[i].upTo) return t[i].weight;
        }
        return 0;
    }

    /// The deck's drop table, as it stands.
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

    // ── opening ───────────────────────────────────────────────────────────────

    /// One Megapot ticket plus one case slot, in one transaction.
    /// The player must have approved this contract on ticketToken beforehand.
    ///
    /// The referrer is the contract itself: 10% of every purchase comes back
    /// here, and that is what funds the prizes. The ticket goes to the player;
    /// the contract holds no tickets.
    function openCase(uint32 deckId) external nonReentrant returns (uint16 index, bytes32 handle) {
        return _openOne(deckId);
    }

    /// Open several cases in one transaction.
    ///
    /// Not a convenience but the same open n times: every case still buys its own
    /// real ticket and still draws a slot from the same pool without replacement.
    /// The only difference is that the wallet is asked once instead of ten times.
    ///
    /// The ceiling is ten. Not because of gas (ten opens is about 2.2M, which is
    /// little for Base) but because of the covalidators: every slot has to be
    /// decrypted, and a queue of a hundred handles would keep the player waiting
    /// minutes, watching a spinner instead of prizes.
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


    /// Take a dollar as a stake in a battle and draw a slot, but do NOT buy the
    /// ticket.
    ///
    /// That is the whole difference from `_buyAndDraw`: as long as the ticket is
    /// unbought, there is something to stake. It gets bought at resolution, for
    /// the winner.
    ///
    /// The open counters are deliberately left alone here. They are what splits
    /// the referral commission, and the commission comes from a PURCHASE that has
    /// not happened yet. We count it where the money really goes into Megapot.
    /// `_forfeitAndDraw` did the same, for the same reason.
    function _escrowAndDraw(uint32 deckId) internal returns (uint16 index, uint256 price) {
        Deck storage d = _deck(deckId);
        // There is no check for an empty deck here and none is needed: a deck
        // that has been played out reshuffles itself, in `_draw`.
        //
        // We ask up front even though we buy later: there is no sense in
        // assembling a battle that cannot pay out the win.
        if (!adapter.purchasingAllowed()) revert PurchasingDisabled();

        price = adapter.ticketPrice();
        ticketToken.safeTransferFrom(msg.sender, address(this), price);
        battleEscrow += price;

        index = _draw(d, deckId, false);
    }

    /// Buy the player a real ticket and draw them a slot from the deck.
    ///
    /// The card stays closed: it is unsealed by whoever called. An ordinary open
    /// does that at once; a battle only when both players have arrived.
    function _buyAndDraw(uint32 deckId) internal returns (uint16 index, uint256 price) {
        Deck storage d = _deck(deckId);
        if (!adapter.purchasingAllowed()) revert PurchasingDisabled();

        // The commission is split between decks by opens, so both the deck and
        // the game keep a counter; otherwise there would be nothing to compare.
        d.unsweptOpens += 1;
        unsweptOpens += 1;

        // The price is read every time: Megapot has setTicketPrice, and a cached
        // value would go stale in silence.
        price = adapter.ticketPrice();
        uint256 boughtBefore = adapter.ticketsOf(msg.sender);

        ticketToken.safeTransferFrom(msg.sender, address(this), price);
        adapter.buyTicket(msg.sender, address(this));

        // Megapot returns nothing and does not revert when a purchase fails to
        // register (for instance when a per player cap is reached). We check for
        // ourselves, otherwise the player would pay for a case without a ticket.
        if (adapter.ticketsOf(msg.sender) <= boughtBefore) revert TicketNotCredited();

        index = _draw(d, deckId, false);
    }


    /// The total weight of a deck's drop table: what it promises per deal.
    function _tableWeight(uint32 deckId) internal view returns (uint256 total) {
        Tier[] storage t = tiersOfDeck[deckId];
        uint16 prev;
        for (uint256 i = 0; i < t.length; i++) {
            total += uint256(t[i].upTo - prev) * uint256(t[i].weight);
            prev = t[i].upTo;
        }
    }

    /// Deal the deck a fresh, shuffled arrangement.
    ///
    /// One place for two roads, cutting and reshuffling. Not for elegance: a
    /// second copy of these four lines weighs the better part of a kilobyte of
    /// compiled code and pushed the contract past the EIP-170 limit.
    function _shuffleInto(Deck storage d) internal {
        elist cards = e.shuffledRange(1, d.size + 1, ETypes.Uint256);
        // Permission on a handle lasts only within the transaction. Without this
        // the next transaction fails with SenderNotAllowedForHandle.
        e.allowThis(cards);
        d.cards = cards;
        d.drawn = 0;
    }

    /// Reshuffle the deck: the same contents, fresh randomness.
    ///
    /// What stays: the size, the drop table, how many slots open the vault, the
    /// creator and their share. The deck remains the same deck; only the order of
    /// the cards changes.
    ///
    /// What is NOT carried over: the unplayed cards of the old deal. They simply
    /// cease to exist. That is no loss to a player, because a fresh deal puts
    /// every prize back into the pool, not only the ones that were left.
    ///
    /// Slots already drawn do not depend on the shuffle at all. A card's handle
    /// lives separately from the list it came from, and is judged by ITS OWN
    /// deck's table, which never changes. So a slot bought yesterday is worth
    /// exactly the same after the tenth reshuffle.
    function _reseal(uint32 deckId, uint8 why) internal {
        Deck storage d = decks[deckId];

        // A fresh deal promises its weight again, so the budget ceiling has to
        // rise by exactly that much. Without this line the game would hand out
        // more than it set aside, and the limit would be noticed by the very
        // person who came to redeem a win.
        budgetWeight += _tableWeight(deckId);
        _shuffleInto(d);

        uint32 cut = reseals[deckId] + 1;
        reseals[deckId] = cut;
        emit DeckResealed(deckId, cut, d.size, why);
    }

    /// Draw the deck's next card and record the slot for the player.
    ///
    /// A deck that has been played out reshuffles right here, in the transaction
    /// of whoever came next. That is why `DeckEmpty` no longer happens on an
    /// open: there is always a card.
    function _draw(Deck storage d, uint32 deckId, bool risk) internal returns (uint16 index) {
        if (d.drawn >= d.size) {
            // Nothing to pay the covalidators with, so the deck stays played
            // out, as it always used to. Selling a card off an empty list in
            // silence is not an option, and there is no need to lie about why.
            if (address(this).balance < deckFee(d.size)) revert DeckEmpty();
            _reseal(deckId, RESEAL_DRAWN_OUT);
        }
        index = d.drawn;
        d.drawn = index + 1;

        euint256 card = e.getEuint256(d.cards, index);
        e.allowThis(card);
        slots[msg.sender].push(Slot({card: card, deckId: deckId, battle: 0, risk: risk}));
    }

    /// What a player's slot weighs at such a value.
    ///
    /// The only place where the doubling for a forfeited ticket becomes weight.
    /// An empty slot stays empty: doubling zero is zero, and a slot someone gave
    /// up a ticket for does not become a prize just because it was risked.
    function _slotWeight(Slot storage slot, uint256 value) internal view returns (uint256) {
        uint256 w = weightOf(slot.deckId, value);
        return slot.risk ? w * 2 : w;
    }

    /// Make a card public and hand the player the key to it.
    ///
    /// Permission on a handle lasts only within the transaction, so allowThis is
    /// repeated here even if it was already granted at the draw.
    function _unseal(euint256 card, address to) internal {
        e.allowThis(card);
        e.allow(card, to);
        e.reveal(card);
    }

    /// Publicly reveal your own slot, the fallback when the reveal from openCase
    /// never reached the covalidators.
    function revealMine(uint256 i) external {
        Slot storage slot = slots[msg.sender][i];
        // A card in an unfinished battle stays silent: otherwise whoever opened
        // the battle would simply peek at it and decide whether to wait for an
        // opponent.
        if (_inBattle(slot)) revert SlotInBattle(slot.battle);
        _unseal(slot.card, msg.sender);
        emit SlotRevealed(msg.sender, i);
    }

    // ── redemption ────────────────────────────────────────────────────────────

    /// Burn your slots and get real tickets for their combined weight.
    ///
    /// Five weight makes one ticket. A shard slot weighs 1, so five shards are
    /// still one ticket; a top rung slot weighs 25 and pays five tickets at once,
    /// with nothing to collect.
    ///
    /// The contract cannot see what is in a slot: decryption lives off chain. So
    /// the player brings a covalidator attestation for each of their handles and
    /// the contract checks the signatures through the Inco verifier. Forging is
    /// impossible, and so is lying about the value.
    ///
    /// values[i] is the revealed value of a slot, signatures[i] are the
    /// covalidator signatures over the pair (handle, value). Quorum is 2 of 2.
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

            // Its own season's table, not the current one: a slot bought last
            // year should neither gain nor lose value from new rules.
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

    /// Buy n real tickets out of the treasury, for whoever is named.
    ///
    /// The recipient is an argument rather than msg.sender: anyone may resolve a
    /// battle, but the tickets have to go to the winner.
    function _buyTicketsFor(address to, uint256 count) internal returns (uint256 paid) {
        uint256 price = adapter.ticketPrice();
        paid = price * count;

        // The treasury refills itself: when it is short, we first collect the
        // commission Megapot has accrued and only then give up.
        if (spendable() < paid) _sweepFees();
        uint256 have = spendable();
        if (have < paid) revert TreasuryEmpty(have, paid);

        for (uint256 i = 0; i < count; i++) {
            uint256 boughtBefore = adapter.ticketsOf(to);
            adapter.buyTicket(to, address(this));
            if (adapter.ticketsOf(to) <= boughtBefore) revert TicketNotCredited();
        }
    }


    // ── risk ──────────────────────────────────────────────────────────────────

    /// Stake your prizes instead of redeeming them for tickets.
    ///
    /// The slots burn at once, and the stake is decided by this player's NEXT
    /// open: anything at all doubles the weight, an empty slot burns it.
    ///
    /// The player is not risking money. The dollar each slot was bought with has
    /// already become a real Megapot ticket and stays theirs whatever happens.
    /// Only the bonus on top is at risk.
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

        // It will be decided by the next slot the player draws. We record its
        // index in advance so that a stake cannot be settled with an open that is
        // already known, only with one that does not exist yet.
        decidingSlot = uint64(slots[msg.sender].length);
        stakeOf[msg.sender] = Stake({weight: uint128(weight), slotIndex: decidingSlot, open: true});

        emit Staked(msg.sender, weight, decidingSlot);
    }

    /// Close a stake with the slot that was meant to decide it.
    ///
    /// The attestation is needed for the same reason as everywhere else: the
    /// contract cannot see inside a slot, so the player brings the value along
    /// with the covalidator signatures.
    function settleStake(uint256 value, bytes[] calldata signatures)
        external
        nonReentrant
        returns (bool won, uint256 banked)
    {
        Stake memory st = stakeOf[msg.sender];
        if (!st.open) revert NoStakeOpen();
        // No such slot yet: the player has not opened a case since staking.
        if (slots[msg.sender].length <= st.slotIndex) revert StakeNotSettled();

        Slot storage slot = slots[msg.sender][st.slotIndex];
        // A stake is decided by the next card, and that card may have gone into
        // a battle. Then the stake waits for the battle; saying so is fairer than
        // failing on signatures the player simply cannot obtain.
        if (_inBattle(slot)) revert SlotInBattle(slot.battle);
        euint256 card = slot.card;
        if (!e.verifyDecryption(card, value, signatures)) {
            revert BadAttestation(euint256.unwrap(card));
        }

        // Any card that gave something wins, the vault card included.
        //
        // Weight alone will not do here: a vault slot weighs zero, because its
        // payout is money rather than tickets. Which meant the best card in the
        // deck, the one people play for, BURNED the stake, and a player would
        // find the vault and lose what they staked in the same moment. Battles
        // already knew about this exception (`_power`); stake settlement did not.
        won = weightOf(slot.deckId, value) > 0 || _isVaultCard(slot.deckId, value);
        delete stakeOf[msg.sender];

        if (won) {
            banked = uint256(st.weight) * 2;
            bankedWeight[msg.sender] += banked;
        }

        emit StakeSettled(msg.sender, st.weight, won, banked);
    }

    /// Redeem won weight for real tickets.
    ///
    /// The payout is capped by the season's budget: however much anyone doubles
    /// up, a deck cannot give out more than it earned. That is not a policy but a
    /// limit in the code, which is exactly why doubling cannot bankrupt the game.
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

    /// How much weight the game can still pay out.
    function budgetLeft() public view returns (uint256) {
        return budgetWeight > paidWeight ? budgetWeight - paidWeight : 0;
    }

    /// Charge the budget. The only place it goes down, which is why the ceiling
    /// holds without exceptions rather than "almost always".
    function _spendBudget(uint256 weight) internal {
        uint256 left = budgetLeft();
        if (weight > left) revert BudgetExhausted(left, weight);
        paidWeight += weight;
    }

    // ── battles ───────────────────────────────────────────────────────────────
    //
    // Two players put up a dollar each. The winner takes both tickets and both
    // bonuses; the loser gets nothing.
    //
    // It used to work differently, and it did not work. The ticket was bought on
    // the way in, so by the time the cards met there was nothing left to stake:
    // only the bonus was divided, and most slots are empty. The most common
    // outcome was a 0:0 draw where nothing happened at all. The game was called a
    // battle and losing it was impossible.
    //
    // Hence two rules, each patching its own hole:
    //
    //   1. THERE IS ALWAYS A WINNER. On equal weight the rarer slot wins, that is
    //      the lower value. Values within a deck are unique (the pool is shuffled
    //      without replacement) and both fighters draw from ONE deck, so a draw
    //      is impossible even in theory.
    //
    //   2. THE STAKE IS THE TICKET ITSELF. The dollars are held aside and the
    //      tickets are bought at resolution: two for the winner, none for the
    //      loser.
    //
    // Neither rule saves the mode on its own: the first gives a winner with a
    // zero prize, the second leaves draws where it is unclear who takes the pot.
    //
    // The promise "a dollar is a real ticket" reads differently in battles, and
    // deliberately so: here a dollar buys a CHANCE at two tickets. The `Risk it`
    // mode already offers to trade a ticket for a doubling; a battle is the same
    // thing against a live opponent. The game still hands out no more than it
    // earned: two dollars become two tickets and bring in the same commission,
    // only the question of who gets them changes.
    //
    // The important part is that the opener's card stays silent until an opponent
    // appears. Otherwise there would be something to choose from: an obviously
    // empty card means walk in for free, an obvious porphyry means never walk in
    // at all, and no battle holding a good card would ever find an opponent. Both
    // cards become public in exactly one transaction, the same one in which the
    // opponent has already paid.

    struct Battle {
        address a;
        uint64 slotA;
        bool resolved;
        address b;
        uint64 slotB;
        /// Both draw from ONE deck. Otherwise the cards would be judged by
        /// different tables and "higher" would stop meaning higher.
        uint32 deckId;
        /// Where the opener's card sits in the deck, so that its open reaches
        /// the feed at the moment the card finally becomes public.
        uint16 indexA;
        uint64 openedAt;
        uint128 paidA;
    }

    Battle[] private battles;

    /// A player's battles, in the order they appeared. For the interface.
    mapping(address => uint256[]) private battlesOfPlayer;

    // ── battle stake: appended by an upgrade ──────────────────────────────────
    //
    // These sit here, at the VERY end of storage, and that is not cosmetic.
    //
    // Slots are assigned in order of declaration in the source, not by section.
    // These two fields first sat among the other settings, above `battles`, and
    // shifted the battles array two slots down. After that upgrade the live game
    // showed zero battles instead of one. No revert, no build error: just
    // different data.
    //
    // `TesseraLiveUpgradeTest` caught it, the one that upgrades the real proxy on
    // a fork. Tests on a clean game cannot see this: there is nothing there
    // before the upgrade, so there is nothing to shift.
    //
    // Both are separate fields rather than a new field inside `Battle`: the
    // struct lives in a dynamic array, and adding to it would change the array's
    // STRIDE, shifting every battle already played at once.

    /// Dollars held aside for unresolved battles.
    ///
    /// This money sits on the contract's balance but already belongs to someone,
    /// like the vaults and the creators' shares. Without this line, redeeming
    /// TESA would spend other people's battle stakes, and the first battle to
    /// resolve could not buy the winner their tickets.
    uint256 public battleEscrow;

    /// What the player who joined a battle paid. The pair to `Battle.paidA`.
    mapping(uint256 => uint128) public battlePaidB;

    /// How long to wait for an opponent before the card can be taken back.
    uint64 public constant BATTLE_TIMEOUT = 15 minutes;

    // ── reshuffling ───────────────────────────────────────────────────────────
    //
    // A deck does not die. It is dealt again, with the same contents and fresh
    // randomness, and it does that BY ITSELF, with no owner and no button.
    //
    // There are exactly two triggers, and the contract genuinely knows both:
    //
    //   the last card is drawn -> there is nothing left to play;
    //   the vault is taken     -> the deck's headline prize is gone.
    //
    // A third one, "when all the big prizes have been taken", cannot exist here,
    // and that is not laziness. The cards are encrypted, and the contract learns
    // a value only when a player PROVES it: on a redemption, a stake, a battle or
    // a vault claim. How many aureus are still in the pool it does not know and
    // cannot know; the site counts that from the publicly revealed values. The
    // vault is the exception precisely because taking it requires a proof.
    //
    // The reshuffle happens inside somebody else's transaction: whoever came for
    // the next case, or whoever is taking the vault. It costs them around 250
    // thousand gas, about one extra open. A queue, a bot or an admin button would
    // cost more: they would cost trust.

    /// How many times the deck has been dealt again. Zero means never.
    ///
    /// A separate mapping rather than a field in Deck: the struct lives in a
    /// dynamic array, and adding to it would change the array's stride, shifting
    /// every deck already cut at once.
    mapping(uint32 => uint32) public reseals;

    /// The deck was reshuffled. `cut` is the number of the deal, from one.
    ///
    /// The site counts what is left in the pool from publicly revealed opens, and
    /// without this event it would count across every deal at once: a fresh deck
    /// would look empty. So the event carries both the deal number and the block;
    /// opens before it belong to a pool that no longer exists.
    event DeckResealed(uint32 indexed deckId, uint32 indexed cut, uint16 size, uint8 why);

    /// Why it was reshuffled: 0 played out, 1 vault taken.
    uint8 constant RESEAL_DRAWN_OUT = 0;
    uint8 constant RESEAL_VAULT_TAKEN = 1;

    event BattleOpened(uint256 indexed id, address indexed a, uint64 slotA);
    event BattleJoined(uint256 indexed id, address indexed b, uint64 slotB);
    /// `tickets` is how many real tickets the winner took. Without that number
    /// the interface has nothing to show in a battle where all the weight is
    /// zero: the tickets are what remains as the prize, and they were not in the
    /// event.
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

    /// Open a battle: put up a dollar and get a closed card.
    ///
    /// There is no ticket yet, because the ticket is the stake. If an opponent
    /// never turns up, `abandonBattle` returns the dollar as a ticket, exactly as
    /// an ordinary open would.
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
                // the ticket price is millions of units, and fits in uint128
                // even if Megapot raises it by orders of magnitude
                // forge-lint: disable-next-line(unsafe-typecast)
                paidA: uint128(price)
            })
        );
        id = battles.length;

        // the battle id is the array length, and uint64 cannot be overflowed
        // by opens
        // forge-lint: disable-next-line(unsafe-typecast)
        slots[msg.sender][slotIndex].battle = uint64(id);
        battlesOfPlayer[msg.sender].push(id);

        emit BattleOpened(id, msg.sender, slotIndex);
    }

    /// Join someone else's battle. Both cards become public right here.
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

        // Both cards in one transaction and not a second earlier.
        Slot storage sa = slots[bt.a][bt.slotA];
        _unseal(sa.card, bt.a);
        _unseal(slots[msg.sender][slotIndex].card, msg.sender);

        emit BattleJoined(id, msg.sender, slotIndex);
        // The feed and the pool counter watch CaseOpened and decrypt every
        // handle from it. So a card reaches them not when it was drawn but when
        // it became readable.
        emit CaseOpened(bt.a, bt.deckId, bt.indexA, euint256.unwrap(sa.card), bt.paidA);
        emit CaseOpened(
            msg.sender, bt.deckId, index, euint256.unwrap(slots[msg.sender][slotIndex].card), price
        );
    }

    /// Bring the cards together and hand over the pot.
    ///
    /// Anyone can submit the values with the covalidator signatures: the cards
    /// are public by then, so a stranger can close the battle too, and the loser
    /// cannot freeze it by simply staying away.
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

        // There is always a winner.
        //
        // On equal weight, which is the common case with both empty, the value
        // itself decides: the lower one wins because it is rarer. A draw here is
        // not "almost" impossible but entirely so: the pool is shuffled without
        // replacement (`e.shuffledRange`) and both fighters draw from one deck,
        // so two identical values cannot meet in a battle.
        bool aWins = pa == pb ? valueA < valueB : pa > pb;
        winner = aWins ? bt.a : bt.b;

        banked = wa + wb;
        if (banked > 0) bankedWeight[winner] += banked;

        // And the stake itself: both dollars become the winner's tickets.
        uint256 tickets =
            _payStake(bt.deckId, winner, uint256(bt.paidA) + uint256(battlePaidB[id]));

        emit BattleResolved(id, winner, banked, tickets);
    }

    /// Spend the dollars held for a battle on real tickets.
    ///
    /// The price is read now rather than remembered from the entry: Megapot has
    /// setTicketPrice, and what must be paid is what a ticket costs today. Which
    /// is why the count is a division rather than a two: if the price has risen,
    /// fewer are bought and the remainder stays in the treasury the game pays
    /// everyone's prizes from. A silent shortfall is impossible, because the
    /// division always balances.
    ///
    /// The open counters move HERE, because the referral commission comes from a
    /// purchase. Counting them at entry would hand the deck a share of a
    /// commission it had not earned yet.
    function _payStake(uint32 deckId, address to, uint256 pot) internal returns (uint256 count) {
        battleEscrow -= pot;

        count = pot / adapter.ticketPrice();
        if (count == 0) return 0;

        Deck storage d = decks[deckId];
        // two tickets per battle, a uint64 counter cannot overflow
        // forge-lint: disable-next-line(unsafe-typecast)
        d.unsweptOpens += uint64(count);
        // forge-lint: disable-next-line(unsafe-typecast)
        unsweptOpens += uint64(count);

        _buyTicketsFor(to, count);
    }

    /// Take your card back when no opponent ever came.
    ///
    /// There was no battle, so there was no stake: the dollar turns into the same
    /// real ticket the player would have got from an ordinary open, and the card
    /// becomes public and redeemable. The result is exactly `openCase`, only
    /// delayed by the wait.
    ///
    /// Refunding the money instead would be worse: the slot has already left the
    /// deck, and a refund would make it free.
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

    /// Check a card and take it out of a battle: verify the signatures, compute
    /// weight and power, and burn the slot if it is worth anything.
    ///
    /// Only what has weight is burned. A vault slot weighs zero and is
    /// deliberately left alive: its value is not in the weight but in the vault
    /// itself, and winning a battle should not take that away.
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

    /// Whether this value opens THIS deck's vault.
    ///
    /// One definition for all three places where "is this the vault card?"
    /// decides a slot's fate: a battle, a vault claim and a stake settlement.
    /// It used to be written out separately in each, and in the third it was
    /// simply forgotten, so a stake was burned by the very card that should have
    /// won it.
    function _isVaultCard(uint32 deckId, uint256 value) internal view returns (bool) {
        uint16 upTo = decks[deckId].vaultUpTo;
        return upTo > 0 && value >= 1 && value <= upTo;
    }

    /// A slot's power in a battle.
    ///
    /// The vault weighs zero, because its payout is money rather than tickets.
    /// But in a battle it outranks everything: otherwise the best slot in the
    /// deck would lose to the cheapest, and winning the battle would burn it too.
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

    /// A player's slots locked in battles still waiting for an opponent.
    ///
    /// The client needs this: it reveals its slots in a batch, and one handle the
    /// covalidators will not release yet hangs the whole batch. Slots from a
    /// battle someone has already joined do not appear here, because those are
    /// public.
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

    /// Battles waiting for an opponent, newest first, at most max.
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

    // ── treasury ──────────────────────────────────────────────────────────────

    /// Collects the referral commission Megapot has accrued into the game's
    /// treasury. Open to everyone: the money stays on the contract either way.
    function sweepFees() external returns (uint256 claimed) {
        return _sweepFees();
    }

    /// The call has to come from the referrer, that is from here, so the
    /// calldata is taken from the adapter.
    function _sweepFees() internal returns (uint256 claimed) {
        // Megapot reverts with the string "No referral fees to withdraw" when
        // there is nothing to take. For us that is not an error but a normal
        // state: we try to sweep before every payout. Without this check a player
        // would see an unexplained ClaimFailed instead of an honest "the treasury
        // is empty".
        if (adapter.claimableFor(address(this)) == 0) return 0;

        uint256 before = ticketToken.balanceOf(address(this));
        (bool ok, bytes memory reason) = adapter.jackpot().call(adapter.claimCalldata());
        if (!ok) revert ClaimFailed(reason);
        claimed = ticketToken.balanceOf(address(this)) - before;

        uint256 toVault = (claimed * vaultShareBps) / 10_000;
        _distribute(toVault, claimed - toVault);

        emit FeesSwept(claimed);
    }

    /// Spread the vault share of the commission across the decks, by opens.
    ///
    /// There is no other honest way: Megapot returns the commission as one sum
    /// and does not know which deck each dollar came from. We do know, and it was
    /// the opens that earned it. So a deck that was played twice as often fills
    /// its vault twice as fast, and a deck nobody touched does not profit from
    /// other people's players.
    ///
    /// A deck without a vault slot takes no share, and its opens do not count in
    /// the denominator. Otherwise the money would settle in a vault that nothing
    /// can open: no value passes the `value <= vaultUpTo` check when that is
    /// zero. It would not vanish from the contract, but it would reach nobody,
    /// and it would quietly eat the treasury, because spendable() subtracts the
    /// vaults from the balance.
    ///
    /// The remainder of the division settles in the last deck to receive a share.
    /// That is a few microcents, and they do not leave the contract.
    /// One pass, two payouts: to the vaults and to the creators.
    ///
    /// The denominators differ, and that is not a detail. The vault share is
    /// divided only among decks that HAVE a vault, otherwise the money would
    /// settle where nothing can open it. The treasury share is brought in by
    /// EVERY open, so a creator's share is computed from the overall counter.
    ///
    /// Which is why the counters are zeroed at the end rather than along the way:
    /// the first pass still reads them.
    function _distribute(uint256 toVault, uint256 toTreasury) internal {
        uint64 vaultTotal;
        for (uint256 i = 0; i < decks.length; i++) {
            if (decks[i].vaultUpTo > 0) vaultTotal += decks[i].unsweptOpens;
        }

        // ── vaults ─────────────────────────────────────────────────────────
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
            // The remainder of the division settles in the last deck to
            // receive a share. A few microcents, and they stay on the contract.
            if (last != type(uint256).max && given < toVault) {
                // forge-lint: disable-next-line(unsafe-typecast)
                decks[last].vault += uint128(toVault - given);
            }
        }

        // ── creators ───────────────────────────────────────────────────────
        //
        // Taken from the treasury half, not from the player's dollar. Rounding is
        // always down, that is, in the game's favour: the remainder stays with
        // the prizes, and creatorOwed can never exceed what actually arrived.
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

    /// How much sits in the vaults of every deck combined.
    function vault() public view returns (uint256 total) {
        for (uint256 i = 0; i < decks.length; i++) total += decks[i].vault;
    }

    /// How much sits in one deck's vault.
    function vaultOf(uint32 deckId) external view returns (uint256) {
        return _deck(deckId).vault;
    }

    /// How much money may be spent on ordinary prizes.
    ///
    /// Nothing already owed to somebody is included: a vault waits for its slot,
    /// a creator's commission waits for claimCreator(), a battle stake waits for
    /// resolution. Without this line the treasury would spend other people's
    /// money on redemptions, and whoever came for what was theirs would be
    /// refused: the creator at payout, the battle winner at ticket purchase.
    function spendable() public view returns (uint256) {
        uint256 balance = ticketToken.balanceOf(address(this));
        uint256 locked = vault() + creatorOwed + battleEscrow;
        return balance > locked ? balance - locked : 0;
    }

    /// Open the vault with your own slot and take everything in it.
    ///
    /// Paid in money rather than tickets: a vault grows into hundreds of dollars,
    /// and that many tickets cannot be bought in one transaction. The money is
    /// the same either way, being the referral commission those very opens
    /// brought in.
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

        // Sweep whatever Megapot still owes, so the vault is handed over full.
        _sweepFees();

        paid = decks[deckId].vault;
        if (paid == 0) revert VaultEmpty();
        decks[deckId].vault = 0;

        ticketToken.safeTransfer(msg.sender, paid);
        emit VaultOpened(msg.sender, deckId, handle, paid);

        // The deck's headline prize is gone, and so is the deck in the shape it
        // was promised in. We reshuffle at once, in this same transaction: the
        // unplayed cards now have no vault, and selling them under the old sign
        // would be a lie.
        //
        // What must never happen is a vault claim FAILING because of this. The
        // money has already gone to the winner, and if there is not enough for a
        // reshuffle the deck simply plays out its old deal. There is no choice
        // here between "renew the deck" and "pay the win".
        if (address(this).balance >= deckFee(decks[deckId].size)) {
            _reseal(deckId, RESEAL_VAULT_TAKEN);
        }
    }

    /// The share of the commission that goes to the vault. The rest funds
    /// ordinary prizes.
    ///
    /// It cannot be raised after the fact above what leaves the prizes enough:
    /// decks have already promised their weight to players, and it is the
    /// treasury half that pays those promises. One signature has no right to turn
    /// "+5 tickets" into a revert in the hands of whoever won them.
    ///
    /// Counted across all decks together rather than one by one: the commission
    /// arrives as a single sum for the whole game, and the prizes are paid from
    /// it jointly. Slots are counted afresh rather than from a counter: there are
    /// only a handful of decks, and a spare storage field lives forever.
    function setVaultShare(uint16 bps) external onlyOwner {
        if (bps > 10_000) revert ShareTooBig();
        uint256 sold = _slotsCut();
        if (budgetWeight * 2 * 10_000 > sold * (10_000 - bps)) revert ShareStarvesPrizes();
        vaultShareBps = bps;
    }

    /// How many slots the game has cut over its whole life, reshuffles included.
    ///
    /// It is this number, not the sum of deck sizes, that holds the solvency
    /// line. Every reshuffle adds its deal's weight to `budgetWeight`, so it must
    /// add the slots that pay for that weight too. Counting sizes alone would
    /// mean that after ten reshuffles the game had promised ten times what it
    /// sold.
    ///
    /// The slots are counted by walking the decks rather than from a counter:
    /// there are only a handful of them, and a spare storage field lives forever.
    function _slotsCut() internal view returns (uint256 sold) {
        for (uint256 i = 0; i < decks.length; i++) {
            // forge-lint: disable-next-line(unsafe-typecast)
            sold += uint256(decks[i].size) * (1 + uint256(reseals[uint32(i)]));
        }
    }

    /// How much more may be given to the vaults without leaving the prizes
    /// unfunded.
    ///
    /// The same number setVaultShare checks, exposed outwards: without it the
    /// owner would grope for a share by catching reverts.
    function maxVaultShare() external view returns (uint16) {
        uint256 sold = _slotsCut();
        if (sold == 0) return 10_000;
        // Division rounding UP, and this is not pedantry.
        //
        // `setVaultShare` refuses on a strict inequality, so a share that leaves
        // exactly what is needed still passes, while one hundredth more does not.
        // With ordinary division `need` rounded DOWN, the ceiling came out one
        // too high, and `setVaultShare(maxVaultShare())` failed with
        // ShareStarvesPrizes.
        //
        // It stayed invisible for a long time because the division came out even:
        // 396 * 2 * 10000 / 1000 is exactly 7920. The first reshuffle made the
        // remainder non-zero, and the owner was refused on a number the game had
        // named itself. The screen says yes, the chain says no, which is exactly
        // the disagreement that must never exist here.
        uint256 need = (budgetWeight * 2 * 10_000 + sold - 1) / sold;
        // forge-lint: disable-next-line(unsafe-typecast)
        return need >= 10_000 ? 0 : uint16(10_000 - need);
    }

    /// Knobs for player decks. They change only what comes NEXT: a deck already
    /// cut keeps its creator share forever, as it keeps its drop table.
    function setCustomDeckRules(uint256 fee, uint16 maxBps, uint16 minSize) external onlyOwner {
        // A ceiling on the ceiling: the game keeps half of the treasury share in
        // any case, because that is what pays for redeeming TESA.
        if (maxBps > 5000) revert ShareTooBig();
        customDeckFee = fee;
        maxCreatorBps = maxBps;
        minCustomSize = minSize;
    }

    // ── views ─────────────────────────────────────────────────────────────────


    function handleOf(address player, uint256 i) external view returns (bytes32) {
        return euint256.unwrap(slots[player][i].card);
    }

    /// Which deck this slot came from, and therefore which drop table judges it.
    function slotDeck(address player, uint256 i) external view returns (uint32) {
        return slots[player][i].deckId;
    }


    /// What a player's slot weighs, by ITS OWN deck's table and taking into
    /// account whether the player gave up a ticket for it.
    ///
    /// Not a duplicate of `weightOf`: that one judges a value, while this also
    /// doubles the weight of a slot taken in risk mode. It is exactly that
    /// difference the tests use to prove the doubling really works.
    function weightOfSlot(address player, uint256 i, uint256 value) external view returns (uint256) {
        return _slotWeight(slots[player][i], value);
    }

    /// Whether the player gave up a ticket for this slot.
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

    /// How much referral commission Megapot already owes this contract.
    function feesClaimable() external view returns (uint256) {
        return adapter.claimableFor(address(this));
    }

    /// How much money is in the treasury, which funds ordinary prizes.
    /// The vault is not part of it.
    function treasury() external view returns (uint256) {
        return spendable();
    }

    // ── administration ────────────────────────────────────────────────────────

    function transferOwnership(address to) external onlyOwner {
        emit OwnerChanged(owner, to);
        owner = to;
    }

    /// The reshuffle fund lands here too.
    ///
    /// Reshuffling is not free: `shuffledRange` pays the Inco covalidators in
    /// native ETH, exactly `deckFee(size)` per deal. The contract, meanwhile,
    /// earns in the ticket token rather than ETH, and cannot conjure any for
    /// itself.
    ///
    /// So the contract's ETH balance is that fund. Anyone can top it up with a
    /// plain transfer, needing no permission and no owner, and how much is left
    /// is visible from outside: it is simply the balance of an address, and
    /// anyone can divide it by `deckFee`.
    ///
    /// When the fund is empty the game does not break and hides nothing: a deck
    /// plays out to its end and stops exactly as it always used to.
    receive() external payable {}
}
