// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IRoyaltyModule
 * @notice Minimal interface for royalty distribution (Story or mock).
 *        payRoyalty(ipId, 0) used as optional query; distributeRoyalty for payouts.
 */
interface IRoyaltyModule {
    /// @notice Query accrued royalty for an IP (amount = 0 for query-only).
    function payRoyalty(uint256 ipId, uint256 amount) external returns (uint256);

    /// @notice Distribute royalty to a recipient.
    function distributeRoyalty(uint256 ipId, address to, uint256 amount) external;
}
