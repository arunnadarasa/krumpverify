// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title KrumpTreasury
 * @notice Holds USDC.k fees from KrumpVerify; splits between operational budget and royalty pool.
 * @author Asura aka Angel of Indian Krump
 * @custom:website https://asura.lovable.app/
 * @custom:initiative StreetKode Fam Initiative
 * @custom:credits StreetKode Fam: Asura, Hectik, Kronos, Jo
 */
contract KrumpTreasury is AccessControl, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant FINANCE_ROLE = keccak256("FINANCE_ROLE");

    IERC20 public immutable usdck;
    address public krumpVerify; // Only this contract may call collectFee (emit event)

    /// Basis points (e.g. 5000 = 50%)
    uint256 public operationalBudgetRateBps = 5000;
    uint256 public royaltyPoolRateBps = 5000;

    address public treasuryMultisig;
    address public royaltyPoolContract;

    event FeeReceived(address indexed from, uint256 amount);
    event FeeDistributed(uint256 indexed distributionId, address to, uint256 amount, uint256 timestamp);

    constructor(address _usdck) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        usdck = IERC20(_usdck);
    }

    function setKrumpVerify(address _krumpVerify) external onlyRole(ADMIN_ROLE) {
        krumpVerify = _krumpVerify;
    }

    /// @notice Called by KrumpVerify after it transfers USDC.k to this contract (emits event only).
    function collectFee(uint256 amount) external {
        require(msg.sender == krumpVerify, "Only KrumpVerify");
        emit FeeReceived(msg.sender, amount);
    }

    /// @notice Distribute accumulated USDC.k: split to operational vs royalty pool. Set treasuryMultisig and royaltyPoolContract first.
    function distribute() external nonReentrant onlyRole(FINANCE_ROLE) {
        require(treasuryMultisig != address(0), "Treasury multisig not set");
        require(royaltyPoolContract != address(0), "Royalty pool not set");

        uint256 balance = usdck.balanceOf(address(this));
        require(balance > 0, "No balance");

        uint256 operational = (balance * operationalBudgetRateBps) / 10_000;
        uint256 royaltyPool = balance - operational;

        if (operational > 0) {
            require(usdck.transfer(treasuryMultisig, operational), "Transfer operational failed");
            emit FeeDistributed(uint256(block.timestamp), treasuryMultisig, operational, block.timestamp);
        }
        if (royaltyPool > 0) {
            require(usdck.transfer(royaltyPoolContract, royaltyPool), "Transfer royalty failed");
            emit FeeDistributed(uint256(block.timestamp) + 1, royaltyPoolContract, royaltyPool, block.timestamp);
        }
    }

    function setRatesBps(uint256 operationalBps, uint256 royaltyBps) external onlyRole(ADMIN_ROLE) {
        require(operationalBps + royaltyBps == 10_000, "Rates must sum to 10000");
        operationalBudgetRateBps = operationalBps;
        royaltyPoolRateBps = royaltyBps;
    }

    function setTreasuryMultisig(address multisig) external onlyRole(ADMIN_ROLE) {
        treasuryMultisig = multisig;
    }

    function setRoyaltyPoolContract(address pool) external onlyRole(ADMIN_ROLE) {
        royaltyPoolContract = pool;
    }
}
