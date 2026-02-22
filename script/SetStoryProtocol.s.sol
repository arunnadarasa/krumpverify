// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {KrumpVerify} from "../src/KrumpVerify.sol";

// Story Aeneid testnet (from https://docs.story.foundation/developers/deployed-smart-contracts)
address constant IP_ASSET_REGISTRY_AENEID = 0x77319B4031e6eF1250907aa00018B8B1c67a244b;
address constant LICENSE_REGISTRY_AENEID = 0x529a750E02d8E2f15649c13D69a465286a780e24;
address constant ROYALTY_MODULE_AENEID = 0xD2f60c40fEbccf6311f8B47c4f2Ec6b040400086;

contract SetStoryProtocol is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address krumpVerifyAddr = vm.envOr(
            "KRUMP_VERIFY_ADDRESS",
            address(0x0afE14299af9619CB44Cc505B3C2dbF79e3e8397)
        );
        require(krumpVerifyAddr != address(0), "Set KRUMP_VERIFY_ADDRESS in .env");

        vm.startBroadcast(deployerPrivateKey);

        KrumpVerify kv = KrumpVerify(krumpVerifyAddr);
        kv.setIPAssetRegistry(IP_ASSET_REGISTRY_AENEID);
        kv.setLicenseRegistry(LICENSE_REGISTRY_AENEID);
        kv.setRoyaltyModule(ROYALTY_MODULE_AENEID);

        vm.stopBroadcast();

        console.log("KrumpVerify", krumpVerifyAddr);
        console.log("IPAssetRegistry set to", IP_ASSET_REGISTRY_AENEID);
        console.log("LicenseRegistry set to", LICENSE_REGISTRY_AENEID);
        console.log("RoyaltyModule set to", ROYALTY_MODULE_AENEID);
    }
}
