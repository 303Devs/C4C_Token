// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CurrencyForCivilization (C4C)
 * @notice ERC-20 token for the Civil Protocol ecosystem.
 *
 * Mainnet mode (testnet = false):
 *   - 1,000,000,000 C4C minted to initialOwner at deployment. No further minting.
 *   - faucet() always reverts.
 *
 * Testnet mode (testnet = true):
 *   - No initial supply minted.
 *   - faucet() mints 1,000 C4C to caller with a 24-hour cooldown per address.
 *   - Blocked on production chain IDs (Base mainnet = 8453, Ethereum mainnet = 1).
 *   - Used for Base Sepolia testing only.
 *
 * @dev Ownable is inherited for future governance migration paths only.
 *      The owner has NO privileges in this contract - cannot mint, pause,
 *      blacklist, rescue, or upgrade. Ownership transfer/renounce has no
 *      effect on token economics or faucet behavior.
 */
contract C4CToken is ERC20, ERC20Burnable, ERC20Permit, Ownable {
    // Token economics
    uint256 public constant MAINNET_SUPPLY = 1_000_000_000 * 10 ** 18;
    uint256 public constant FAUCET_AMOUNT = 1_000 * 10 ** 18;
    uint256 public constant FAUCET_COOLDOWN = 1 days;

    // Chain IDs where testnet=true is forbidden
    uint256 private constant BASE_MAINNET_CHAIN_ID = 8453;
    uint256 private constant ETHEREUM_MAINNET_CHAIN_ID = 1;

    bool public immutable isTestnet;

    mapping(address => uint256) public lastFaucetAt;

    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------
    /// @notice Thrown when faucet() is called on a mainnet deployment.
    error C4CFaucetDisabled();

    /// @notice Thrown when faucet() is called before the cooldown has elapsed.
    /// @param account The caller address.
    /// @param retryAt The earliest timestamp at which the caller may call again.
    error C4CFaucetCooldownActive(address account, uint256 retryAt);

    /// @notice Thrown when testnet=true is passed on a production chain.
    /// @param chainId The chain ID at deploy time.
    error C4CTestnetOnProductionChain(uint256 chainId);

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event FaucetUsed(address indexed recipient, uint256 amount);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(
        address initialOwner,
        bool testnet
    )
        ERC20("CurrencyForCivilization", "C4C")
        ERC20Permit("CurrencyForCivilization")
        Ownable(initialOwner)
    {
        // H-01 fix: block testnet=true on production chains.
        // Deploying with testnet=true on mainnet would create a permissionless
        // unlimited-mint faucet with no recovery path (isTestnet is immutable).
        if (testnet) {
            uint256 id = block.chainid;
            if (id == BASE_MAINNET_CHAIN_ID || id == ETHEREUM_MAINNET_CHAIN_ID) {
                revert C4CTestnetOnProductionChain(id);
            }
        }

        isTestnet = testnet;
        if (!testnet) {
            _mint(initialOwner, MAINNET_SUPPLY);
        }
    }

    // -------------------------------------------------------------------------
    // Faucet
    // -------------------------------------------------------------------------
    /**
     * @notice Dispense 1,000 C4C to caller. Testnet only. 24-hour cooldown per address.
     */
    function faucet() external {
        if (!isTestnet) revert C4CFaucetDisabled();
        uint256 nextAt = lastFaucetAt[msg.sender] + FAUCET_COOLDOWN;
        if (block.timestamp < nextAt) revert C4CFaucetCooldownActive(msg.sender, nextAt);
        lastFaucetAt[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);
        emit FaucetUsed(msg.sender, FAUCET_AMOUNT);
    }

    // -------------------------------------------------------------------------
    // Metadata
    // -------------------------------------------------------------------------
    /**
     * @notice Returns decimals. Standard ERC-20 is 18.
     */
    function decimals() public pure override returns (uint8) {
        return 18;
    }
}
