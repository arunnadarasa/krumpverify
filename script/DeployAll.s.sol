// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {KrumpVerify} from "../src/KrumpVerify.sol";
import {KrumpTreasury} from "../src/KrumpTreasury.sol";
import {KrumpVerifyNFT} from "../src/KrumpVerifyNFT.sol";

/**
 * Deploy all three contracts for Story Aeneid: KrumpTreasury, KrumpVerify, KrumpVerifyNFT.
 * Sets IP Asset Registry, License Registry, and Royalty Module at deploy (no separate SetStoryProtocol run).
 * Grants RECEIPT_SUBMITTER_ROLE to RELAYER_ADDRESS so the relayer can call submitPaymentReceipt.
 *
 * Env:
 *   PRIVATE_KEY       - Deployer (and default relayer) private key.
 *   USDC_K            - USDC.k on Aeneid (default below).
 *   RELAYER_ADDRESS   - Optional. If set, granted RECEIPT_SUBMITTER_ROLE; else deployer has it.
 *
 * Run with 10 gwei:
 *   forge script script/DeployAll.s.sol --rpc-url https://aeneid.storyrpc.io --broadcast --gas-price 10000000000
 *
 * @custom:credits StreetKode Fam: Asura, Hectik, Kronos, Jo
 */
contract DeployAll is Script {
    // Story Aeneid (chain 1315) - from https://docs.story.foundation/developers/deployed-smart-contracts
    address constant USDC_K_AENEID = 0xd35890acdf3BFFd445C2c7fC57231bDE5cAFbde5;
    address constant IP_ASSET_REGISTRY_AENEID = 0x77319B4031e6eF1250907aa00018B8B1c67a244b;
    address constant LICENSE_REGISTRY_AENEID = 0x529a750E02d8E2f15649c13D69a465286a780e24;
    address constant ROYALTY_MODULE_AENEID = 0xD2f60c40fEbccf6311f8B47c4f2Ec6b040400086;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address usdck = vm.envOr("USDC_K", USDC_K_AENEID);
        address relayerAddress = vm.envOr("RELAYER_ADDRESS", address(0));

        vm.startBroadcast(deployerPrivateKey);

        KrumpTreasury treasury = new KrumpTreasury(usdck);
        console.log("KrumpTreasury", address(treasury));

        KrumpVerify krumpVerify = new KrumpVerify(
            IP_ASSET_REGISTRY_AENEID,
            LICENSE_REGISTRY_AENEID,
            ROYALTY_MODULE_AENEID,
            usdck,
            address(treasury)
        );
        console.log("KrumpVerify", address(krumpVerify));

        treasury.setKrumpVerify(address(krumpVerify));

        if (relayerAddress != address(0) && relayerAddress != msg.sender) {
            krumpVerify.grantRole(krumpVerify.RECEIPT_SUBMITTER_ROLE(), relayerAddress);
            console.log("RECEIPT_SUBMITTER_ROLE granted to", relayerAddress);
        } else {
            console.log("Deployer has RECEIPT_SUBMITTER_ROLE (use as relayer or set RELAYER_ADDRESS and grant manually)");
        }

        KrumpVerifyNFT nft = new KrumpVerifyNFT();
        console.log("KrumpVerifyNFT", address(nft));

        vm.stopBroadcast();

        console.log("---");
        console.log("Set in frontend .env: VITE_KRUMP_VERIFY_ADDRESS=%s", address(krumpVerify));
        console.log("Set in frontend .env: VITE_KRUMP_VERIFY_NFT_ADDRESS=%s", address(nft));
        console.log("Relayer: use PRIVATE_KEY for an address with RECEIPT_SUBMITTER_ROLE (deployer has it).");
    }
}
