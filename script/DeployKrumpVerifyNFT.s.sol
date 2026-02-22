// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {KrumpVerifyNFT} from "../src/KrumpVerifyNFT.sol";

contract DeployKrumpVerifyNFT is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        KrumpVerifyNFT nft = new KrumpVerifyNFT();

        vm.stopBroadcast();

        console.log("KrumpVerifyNFT", address(nft));
    }
}
