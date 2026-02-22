// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {KrumpVerify} from "../src/KrumpVerify.sol";
import {KrumpTreasury} from "../src/KrumpTreasury.sol";

contract DeployKrumpVerify is Script {
    uint256 public constant STORY_CHAIN_ID = 1514;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address usdck = vm.envOr("USDC_K", address(0));
        address ipRegistry = vm.envOr("IP_ASSET_REGISTRY", address(0));
        address licenseRegistry = vm.envOr("LICENSE_REGISTRY", address(0));
        address royaltyModule = vm.envOr("ROYALTY_MODULE", address(0));

        require(usdck != address(0), "Set USDC_K in .env");

        vm.startBroadcast(deployerPrivateKey);

        KrumpTreasury treasury = new KrumpTreasury(usdck);

        address ipReg = ipRegistry != address(0) ? ipRegistry : address(0);
        address licReg = licenseRegistry != address(0) ? licenseRegistry : address(0);
        address royMod = royaltyModule != address(0) ? royaltyModule : address(0);

        KrumpVerify krumpVerify = new KrumpVerify(
            ipReg,
            licReg,
            royMod,
            usdck,
            address(treasury)
        );

        treasury.setKrumpVerify(address(krumpVerify));

        vm.stopBroadcast();

        console.log("KrumpTreasury", address(treasury));
        console.log("KrumpVerify", address(krumpVerify));
    }
}
