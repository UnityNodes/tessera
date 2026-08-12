// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

///
///
///   [FAIL: EVM error; database error: failed to get storage for …:
///    HTTP error 502 with body: <!DOCTYPE html> … sepolia.base.org … ]
///
///
///
///
library Fork {
    string internal constant BASE_SEPOLIA = "https://base-sepolia-rpc.publicnode.com";
    string internal constant BASE_MAINNET = "https://mainnet.base.org";
}
