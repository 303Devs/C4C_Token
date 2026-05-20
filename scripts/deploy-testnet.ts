import { ethers, network } from "hardhat";

const BASE_SEPOLIA_CHAIN_ID = 84532;

async function main() {
  // JS-side assertion: refuse to run against the wrong chain.
  const chainId = network.config.chainId;
  if (chainId === undefined || chainId !== BASE_SEPOLIA_CHAIN_ID) {
    throw new Error(
      `deploy-testnet.ts must only run on Base Sepolia (${BASE_SEPOLIA_CHAIN_ID}). ` +
      `Got chainId ${chainId ?? "undefined"}. Use --network baseSepolia.`,
    );
  }

  const [deployer] = await ethers.getSigners();

  console.log("Deploying C4CToken with:", deployer.address);
  console.log(
    "Deployer balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "ETH",
  );

  console.log("\n--- Deploying C4CToken v3 (testnet mode, chain-guard enabled) ---");
  const TokenFactory = await ethers.getContractFactory("C4CToken");
  const c4c = await TokenFactory.deploy(
    deployer.address, // initialOwner
    true,             // testnet = true: faucet enabled, chain guard will revert on mainnet
  );
  await c4c.waitForDeployment();
  const c4cAddress = await c4c.getAddress();
  console.log("C4CToken v3 deployed to:", c4cAddress);

  console.log("\n--- Deployment Summary ---");
  console.log("Network:    Base Sepolia");
  console.log("C4CToken:  ", c4cAddress);
  console.log("isTestnet: ", await c4c.isTestnet());
  console.log("Owner:     ", deployer.address);
  console.log("\nNext steps:");
  console.log("1. Verify the contract on Basescan (run: npm run verify:testnet)");
  console.log("2. Update C4C_TOKEN_ADDRESS=" + c4cAddress + " in C4C_Token/.env");
  console.log("3. Update NEXT_PUBLIC_C4C_TOKEN_ADDRESS=" + c4cAddress + " in Civil_Showdown/.env");
  console.log("4. Redeploy CivilArcadePayment in Civil_Showdown/contracts (stores token address)");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
