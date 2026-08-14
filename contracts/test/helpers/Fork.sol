// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

/// Where to fork the network from when no address is given by an environment
/// variable.
///
/// This address used to be the official `https://sepolia.base.org` in every test,
/// and because of it a run "failed" with two to five tests, different ones every
/// time and NEVER because of the code. In the logs lay a Cloudflare page:
///
///   [FAIL: EVM error; database error: failed to get storage for ...:
///    HTTP error 502 with body: <!DOCTYPE html> ... sepolia.base.org ... ]
///
/// The cause is not the rate of our requests but the fact that the endpoint is
/// shared by everyone and so is its limit. There are thirteen fork tests here,
/// each pulls state over the network, and together they exhaust that limit. Those
/// same two tests pass first time on a working endpoint.
///
/// So what stands here by default is the one that answers rather than the one that
/// is canonical. This matters for SOMEBODY ELSE'S machine specifically: at home
/// the address can be supplied by a variable, and whoever has just cloned the
/// repository gets exactly this line, and should see a green run rather than a 502
/// in half the files.
///
///   BASE_SEPOLIA_RPC_URL=...  overrides this value and stays the main way to
///                             supply your own node
///
/// The mainnet tests are not included here: they also pin the BLOCK, so foundry
/// caches their state on disk and barely goes to the network at all. That is
/// exactly why they never failed.
library Fork {
    string internal constant BASE_SEPOLIA = "https://base-sepolia-rpc.publicnode.com";
    string internal constant BASE_MAINNET = "https://mainnet.base.org";
}
