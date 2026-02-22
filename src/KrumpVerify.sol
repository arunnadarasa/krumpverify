// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IIPAssetRegistry.sol";
import "./interfaces/ILicenseRegistry.sol";
import "./interfaces/IRoyaltyModule.sol";
import "./interfaces/IKrumpTreasury.sol";

/**
 * @title KrumpVerify
 * @notice Verifies dance moves against registered IP; charges USDC.k fee and records receipt on-chain.
 * @author Asura aka Angel of Indian Krump
 * @custom:website https://asura.lovable.app/
 * @custom:initiative StreetKode Fam Initiative
 * @custom:credits StreetKode Fam: Asura, Hectik, Kronos, Jo
 */
contract KrumpVerify is AccessControl, ReentrancyGuard {
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant RECEIPT_SUBMITTER_ROLE = keccak256("RECEIPT_SUBMITTER_ROLE");

    IIPAssetRegistry public ipAssetRegistry;
    ILicenseRegistry public licenseRegistry;
    IRoyaltyModule public royaltyModule;
    IERC20 public paymentToken; // USDC.k
    address public treasury;

    uint256 public verificationFee = 1e6; // 1 USDC.k (6 decimals)

    mapping(bytes32 => bool) public receiptUsed;

    struct PaymentReceipt {
        address payer;
        uint256 amount;
        bool used;
    }
    mapping(bytes32 => PaymentReceipt) public paymentReceipts;

    event Verified(address indexed ipId, address indexed verifier, bytes32 receiptHash, uint256 timestamp);
    event PaymentReceiptSubmitted(bytes32 indexed receiptId, address indexed payer, uint256 amount);

    constructor(
        address _ipAssetRegistry,
        address _licenseRegistry,
        address _royaltyModule,
        address _paymentToken,
        address _treasury
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
        _grantRole(RECEIPT_SUBMITTER_ROLE, msg.sender);

        ipAssetRegistry = IIPAssetRegistry(_ipAssetRegistry);
        licenseRegistry = ILicenseRegistry(_licenseRegistry);
        royaltyModule = IRoyaltyModule(_royaltyModule);
        paymentToken = IERC20(_paymentToken);
        treasury = _treasury;
    }

    function setVerificationFee(uint256 fee) external onlyRole(ADMIN_ROLE) {
        verificationFee = fee;
    }

    function setTreasury(address newTreasury) external onlyRole(ADMIN_ROLE) {
        treasury = newTreasury;
    }

    function setIPAssetRegistry(address _ipAssetRegistry) external onlyRole(ADMIN_ROLE) {
        ipAssetRegistry = IIPAssetRegistry(_ipAssetRegistry);
    }

    function setLicenseRegistry(address _licenseRegistry) external onlyRole(ADMIN_ROLE) {
        licenseRegistry = ILicenseRegistry(_licenseRegistry);
    }

    function setRoyaltyModule(address _royaltyModule) external onlyRole(ADMIN_ROLE) {
        royaltyModule = IRoyaltyModule(_royaltyModule);
    }

    /**
     * @notice Verify a move against an IP; payer pays verificationFee in USDC.k to treasury.
     * @param ipId Story IP account address (from IPAssetRegistry.ipId(...) or explorer)
     * @param moveDataHash Hash of move/video data
     * @param proof Optional proof data (e.g. signature or tx ref)
     */
    function verifyMove(
        address ipId,
        bytes32 moveDataHash,
        bytes calldata proof
    ) external nonReentrant returns (bytes32 receiptHash) {
        require(address(ipAssetRegistry) != address(0), "IP registry not set");
        require(treasury != address(0), "Treasury not set");
        require(msg.sender != treasury, "Treasury cannot verify");

        require(paymentToken.transferFrom(msg.sender, treasury, verificationFee), "Payment failed");
        IKrumpTreasury(treasury).collectFee(verificationFee);

        require(ipAssetRegistry.isRegistered(ipId), "IP not found");

        receiptHash = keccak256(
            abi.encodePacked(ipId, msg.sender, moveDataHash, block.timestamp, verificationFee, proof)
        );
        require(!receiptUsed[receiptHash], "Receipt already used");
        receiptUsed[receiptHash] = true;

        emit Verified(ipId, msg.sender, receiptHash, block.timestamp);
        return receiptHash;
    }

    /**
     * @notice Submit a payment receipt (e.g. from x402/EVVM). Only callable by RECEIPT_SUBMITTER_ROLE after payment is confirmed off-chain or by adapter.
     * @param receiptId Unique id for this payment (e.g. from your x402/EVVM flow)
     * @param payer Address that paid the fee
     * @param amount Amount paid (must be >= verificationFee)
     */
    function submitPaymentReceipt(bytes32 receiptId, address payer, uint256 amount) external onlyRole(RECEIPT_SUBMITTER_ROLE) {
        require(payer != address(0), "Payer is zero");
        require(amount >= verificationFee, "Amount below fee");
        require(paymentReceipts[receiptId].payer == address(0), "Receipt already submitted");
        paymentReceipts[receiptId] = PaymentReceipt({ payer: payer, amount: amount, used: false });
        emit PaymentReceiptSubmitted(receiptId, payer, amount);
    }

    /**
     * @notice Verify a move using a pre-submitted payment receipt (e.g. after paying via x402/EVVM). No transferFrom; receipt is consumed once.
     * @param ipId Story IP account address
     * @param moveDataHash Hash of move/video data
     * @param proof Optional proof data
     * @param paymentReceiptId Id of the payment receipt submitted via submitPaymentReceipt
     */
    function verifyMoveWithReceipt(
        address ipId,
        bytes32 moveDataHash,
        bytes calldata proof,
        bytes32 paymentReceiptId
    ) external nonReentrant returns (bytes32 receiptHash) {
        require(address(ipAssetRegistry) != address(0), "IP registry not set");
        require(treasury != address(0), "Treasury not set");
        require(msg.sender != treasury, "Treasury cannot verify");

        PaymentReceipt storage pr = paymentReceipts[paymentReceiptId];
        require(pr.payer != address(0), "Receipt not found");
        require(!pr.used, "Receipt already used");
        require(pr.amount >= verificationFee, "Receipt amount below fee");
        require(msg.sender == pr.payer, "Only payer can use receipt");

        require(ipAssetRegistry.isRegistered(ipId), "IP not found");

        receiptHash = keccak256(
            abi.encodePacked(ipId, msg.sender, moveDataHash, block.timestamp, verificationFee, proof)
        );
        require(!receiptUsed[receiptHash], "Receipt already used");
        receiptUsed[receiptHash] = true;
        pr.used = true;

        emit Verified(ipId, msg.sender, receiptHash, block.timestamp);
        return receiptHash;
    }

}
