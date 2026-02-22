// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ILicenseRegistry
 * @notice Minimal interface for Story License Registry (or mock for testing).
 */
interface ILicenseRegistry {
    struct LicenseTerms {
        uint256 minPeriod;
        uint256 maxUses;
        bool commercial;
        bool derivative;
        uint256[] revShare;
    }

    function mintLicense(
        uint256 ipId,
        address licensee,
        LicenseTerms memory terms,
        string memory tokenURI
    ) external returns (uint256);

    function getLicense(uint256 licenseId) external view returns (
        LicenseTerms memory terms,
        address licensor,
        address licensee
    );
}
