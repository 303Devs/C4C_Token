// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CurrencyForCivilization (C4C)
 * @notice ERC-20 token for the Civil Protocol ecosystem.
 *         ERC-2612 Permit allows off-chain approval signatures so arcade plays
 *         require only one on-chain transaction (depositFeeWithPermit) instead of
 *         approve + depositFee.
 *
 * Mainnet mode (testnet = false):
 *   - 1,000,000,000 C4C minted to initialOwner at deployment. No further minting.
 *   - faucet() always reverts.
 *
 * Testnet mode (testnet = true):
 *   - No initial supply minted.
 *   - faucet() mints 1,000 C4C to caller with a 24-hour cooldown per address.
 *   - Used for Base Sepolia testing only. Never deploy testnet=true to mainnet.
 */
contract C4CToken is ERC20, ERC20Burnable, ERC20Permit, Ownable {
    uint256 public constant MAINNET_SUPPLY = 1_000_000_000 * 10 ** 18;
    uint256 public constant FAUCET_AMOUNT = 1_000 * 10 ** 18;
    uint256 public constant FAUCET_COOLDOWN = 1 days;

    bool public immutable isTestnet;

    mapping(address => uint256) public lastFaucetAt;

    event FaucetUsed(address indexed recipient, uint256 amount);

    constructor(
        address initialOwner,
        bool testnet
    ) ERC20("CurrencyForCivilization", "C4C")
      ERC20Permit("CurrencyForCivilization")
      Ownable(initialOwner) {
        isTestnet = testnet;
        if (!testnet) {
            _mint(initialOwner, MAINNET_SUPPLY);
        }
    }

    /**
     * @notice Dispense 1,000 C4C to caller. Testnet only. 24-hour cooldown per address.
     */
    function faucet() external {
        require(isTestnet, "C4C: faucet disabled on mainnet");
        require(
            block.timestamp >= lastFaucetAt[msg.sender] + FAUCET_COOLDOWN,
            "C4C: faucet cooldown active"
        );
        lastFaucetAt[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);
        emit FaucetUsed(msg.sender, FAUCET_AMOUNT);
    }

    /**
     * @notice Returns decimals. Standard ERC-20 is 18.
     */
    function decimals() public pure override returns (uint8) {
        return 18;
    }
}
