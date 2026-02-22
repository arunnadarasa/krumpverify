// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IIPAssetRegistry
 * @notice Minimal interface for Story IP Asset Registry (or mock for testing).
 *        Story uses IP account address as IP id and exposes isRegistered(address).
 */
interface IIPAssetRegistry {
    /// @notice Story: true if the IP account is registered
    function isRegistered(address id) external view returns (bool);
}
