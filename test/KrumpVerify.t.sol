// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {KrumpVerify} from "../src/KrumpVerify.sol";
import {KrumpTreasury} from "../src/KrumpTreasury.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockIPAssetRegistry} from "./mocks/MockIPAssetRegistry.sol";

contract KrumpVerifyTest is Test {
    KrumpVerify public krumpVerify;
    KrumpTreasury public treasury;
    MockERC20 public usdck;
    MockIPAssetRegistry public ipRegistry;

    address public user = address(0x1);
    address public admin = address(0x2);
    address public registeredIP = address(0x123);
    uint256 constant FEE = 1e6;

    function setUp() public {
        usdck = new MockERC20();
        usdck.mint(user, 1000e6);
        ipRegistry = new MockIPAssetRegistry();
        ipRegistry.setRegistered(registeredIP);

        treasury = new KrumpTreasury(address(usdck));
        krumpVerify = new KrumpVerify(
            address(ipRegistry),
            address(0),
            address(0),
            address(usdck),
            address(treasury)
        );
        treasury.setKrumpVerify(address(krumpVerify));

        krumpVerify.grantRole(krumpVerify.ADMIN_ROLE(), admin);
        krumpVerify.grantRole(krumpVerify.RECEIPT_SUBMITTER_ROLE(), admin);
    }

    function test_verifyMove() public {
        vm.startPrank(user);
        usdck.approve(address(krumpVerify), FEE);
        bytes32 receiptHash = krumpVerify.verifyMove(registeredIP, keccak256("move1"), "");
        vm.stopPrank();

        assertTrue(krumpVerify.receiptUsed(receiptHash));
        assertEq(usdck.balanceOf(user), 1000e6 - FEE);
        assertEq(usdck.balanceOf(address(treasury)), FEE);
    }

    function test_verifyMove_revert_ipNotFound() public {
        vm.startPrank(user);
        usdck.approve(address(krumpVerify), FEE);
        vm.expectRevert("IP not found");
        krumpVerify.verifyMove(address(0x999), keccak256("move1"), "");
        vm.stopPrank();
    }

    function test_setVerificationFee() public {
        vm.prank(admin);
        krumpVerify.setVerificationFee(2e6);
        assertEq(krumpVerify.verificationFee(), 2e6);
    }

    function test_submitPaymentReceipt_and_verifyMoveWithReceipt() public {
        bytes32 receiptId = keccak256("x402-receipt-1");
        vm.prank(admin);
        krumpVerify.submitPaymentReceipt(receiptId, user, FEE);

        (address payer, uint256 amount, bool used) = krumpVerify.paymentReceipts(receiptId);
        assertEq(payer, user);
        assertEq(amount, FEE);
        assertFalse(used);

        vm.prank(user);
        bytes32 vReceiptHash = krumpVerify.verifyMoveWithReceipt(registeredIP, keccak256("move1"), "", receiptId);

        assertTrue(krumpVerify.receiptUsed(vReceiptHash));
        (, , used) = krumpVerify.paymentReceipts(receiptId);
        assertTrue(used);
        assertEq(usdck.balanceOf(user), 1000e6); // no transfer
    }

    function test_verifyMoveWithReceipt_revert_onlyPayer() public {
        bytes32 receiptId = keccak256("x402-receipt-2");
        vm.prank(admin);
        krumpVerify.submitPaymentReceipt(receiptId, user, FEE);

        vm.prank(admin);
        vm.expectRevert("Only payer can use receipt");
        krumpVerify.verifyMoveWithReceipt(registeredIP, keccak256("move1"), "", receiptId);
    }

    function test_verifyMoveWithReceipt_revert_receiptAlreadyUsed() public {
        bytes32 receiptId = keccak256("x402-receipt-3");
        vm.prank(admin);
        krumpVerify.submitPaymentReceipt(receiptId, user, FEE);

        vm.prank(user);
        krumpVerify.verifyMoveWithReceipt(registeredIP, keccak256("move1"), "", receiptId);

        vm.prank(user);
        vm.expectRevert("Receipt already used");
        krumpVerify.verifyMoveWithReceipt(registeredIP, keccak256("move2"), "", receiptId);
    }

    function test_submitPaymentReceipt_revert_amountBelowFee() public {
        vm.prank(admin);
        vm.expectRevert("Amount below fee");
        krumpVerify.submitPaymentReceipt(keccak256("r"), user, FEE - 1);
    }

    function test_submitPaymentReceipt_revert_receiptAlreadySubmitted() public {
        bytes32 receiptId = keccak256("x402-receipt-4");
        vm.prank(admin);
        krumpVerify.submitPaymentReceipt(receiptId, user, FEE);
        vm.prank(admin);
        vm.expectRevert("Receipt already submitted");
        krumpVerify.submitPaymentReceipt(receiptId, user, FEE);
    }
}
