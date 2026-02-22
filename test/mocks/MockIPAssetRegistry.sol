// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../src/interfaces/IIPAssetRegistry.sol";

contract MockIPAssetRegistry is IIPAssetRegistry {
    mapping(address => bool) public registered;

    function setRegistered(address id) external {
        registered[id] = true;
    }

    function isRegistered(address id) external view returns (bool) {
        return registered[id];
    }
}
