// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {elist, ETypes, euint256, e, inco} from "@inco/lightning/src/Lib.sol";

contract TesseraDeck {
    elist private deck;

    uint16 public size;
    uint16 public drawn;

    mapping(address => euint256[]) private slots;

    event DeckCreated(uint16 size, uint256 feePaid);
    event SlotDrawn(address indexed player, uint16 index);
    event SlotRevealed(address indexed player, uint256 index);

    function deckFee(uint16 n) public view returns (uint256) {
        return 2 * inco.getEListFee(n, ETypes.Uint256);
    }

    function createDeck(uint16 n) external payable {
        require(n > 0, "n=0");
        deck = e.shuffledRange(1, n + 1, ETypes.Uint256);
        e.allowThis(deck);
        size = n;
        drawn = 0;
        emit DeckCreated(n, msg.value);
    }

    function drawSlot() external returns (uint16 index) {
        require(drawn < size, "deck empty");
        index = drawn;
        euint256 card = e.getEuint256(deck, index);
        e.allowThis(card);
        e.allow(card, msg.sender);
        slots[msg.sender].push(card);
        drawn = index + 1;
        emit SlotDrawn(msg.sender, index);
    }

    function openCase() external returns (uint16 index, bytes32 handle) {
        require(drawn < size, "deck empty");
        index = drawn;
        euint256 card = e.getEuint256(deck, index);
        e.allowThis(card);
        e.allow(card, msg.sender);
        e.reveal(card);
        slots[msg.sender].push(card);
        drawn = index + 1;
        handle = euint256.unwrap(card);
        emit SlotDrawn(msg.sender, index);
        emit SlotRevealed(msg.sender, index);
    }

    function revealMine(uint256 i) external {
        euint256 card = slots[msg.sender][i];
        e.allowThis(card);
        e.reveal(card);
        emit SlotRevealed(msg.sender, i);
    }

    function myHandle(uint256 i) external view returns (bytes32) {
        return euint256.unwrap(slots[msg.sender][i]);
    }

    function myCount() external view returns (uint256) {
        return slots[msg.sender].length;
    }

    function remaining() external view returns (uint16) {
        return size - drawn;
    }

    receive() external payable {}
}
