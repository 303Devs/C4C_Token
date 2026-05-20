import { ethers, network } from "hardhat";

const BASE_MAINNET_CHAIN_ID = 8453;

async function main() {
  // JS-side assertion: refuse to run against a testnet.
  const chainId = network.config.chainId;
  if (chainId === undefined || chainId !== BASE_MAINNET_CHAIN_ID) {
    throw new Error(
      `deploy-mainnet.ts must only run on Base mainnet (${BASE_MAINNET_CHAIN_ID}). ` +
      `Got chainId ${chainId ?? "undefined"}. Use --network baseMainnet.`,
    );
  }

  const [deployer] = await ethers.getSigners();

  console.log("Deploying C4CToken with:", deployer.address);
  console.log(
    "Deployer balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "ETH",
  );

  // MAINNET DEPLOY: verify this address is the intended treasury / multisig.
  const INITIAL_OWNER = deployer.address; // REPLACE with multisig address before running

  console.log("\n--- Deploying C4CToken (MAINNET mode, testnet=false) ---");
  const TokenFactory = await ethers.getContractFactory("C4CToken");
  const c4c = await TokenFactory.deploy(
    INITIAL_OWNER,
    false, // testnet = false: faucet permanently disabled, 1B C4C minted to initialOwner
  );
  await c4c.waitForDeployment();
  const c4cAddress = await c4c.getAddress();
  console.log("C4CToken deployed to:", c4cAddress);

  console.log("\n--- Deployment Summary ---");
  console.log("Network:      Base Mainnet");
  console.log("C4CToken:    ", c4cAddress);
  console.log("isTestnet:   ", await c4c.isTestnet()); // must be false
  console.log("totalSupply: ", ethers.formatEther(await c4c.totalSupply()), "C4C");
  console.log("Owner:       ", deployer.address);
  console.log("\nNext steps:");
  console.log("1. Verify the contract on Basescan (run: npm run verify:mainnet)");
  console.log("2. Confirm totalSupply() == 1,000,000,000 C4C on-chain");
  console.log("3. Confirm isTestnet() == false on-chain");
  console.log("4. Deploy CivilArcadePayment on Base mainnet using this address");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
