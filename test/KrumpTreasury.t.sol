// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {KrumpTreasury} from "../src/KrumpTreasury.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract KrumpTreasuryTest is Test {
    KrumpTreasury public treasury;
    MockERC20 public usdck;

    address public finance = address(0x1);
    address public multisig = address(0x2);
    address public royaltyPool = address(0x3);
    address public krumpVerify = address(0x4);

    function setUp() public {
        usdck = new MockERC20();
        treasury = new KrumpTreasury(address(usdck));
        treasury.grantRole(treasury.DEFAULT_ADMIN_ROLE(), address(this));
        treasury.grantRole(treasury.ADMIN_ROLE(), address(this));
        treasury.grantRole(treasury.FINANCE_ROLE(), finance);
        treasury.setTreasuryMultisig(multisig);
        treasury.setRoyaltyPoolContract(royaltyPool);
        treasury.setKrumpVerify(krumpVerify);

        usdck.mint(address(treasury), 1000e6);
    }

    function test_distribute() public {
        vm.prank(finance);
        treasury.distribute();

        assertEq(usdck.balanceOf(multisig), 500e6);
        assertEq(usdck.balanceOf(royaltyPool), 500e6);
        assertEq(usdck.balanceOf(address(treasury)), 0);
    }

    function test_collectFee_onlyKrumpVerify() public {
        vm.expectRevert("Only KrumpVerify");
        treasury.collectFee(100);
    }

    function test_collectFee_emitsEvent() public {
        vm.prank(krumpVerify);
        vm.expectEmit(true, true, false, true);
        emit KrumpTreasury.FeeReceived(krumpVerify, 100);
        treasury.collectFee(100);
    }
}
