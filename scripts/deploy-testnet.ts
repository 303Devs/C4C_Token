import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying C4CToken with:", deployer.address);
  console.log(
    "Deployer balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "ETH",
  );

  console.log("\n--- Deploying C4CToken (testnet mode) ---");
  const TokenFactory = await ethers.getContractFactory("C4CToken");
  const c4c = await TokenFactory.deploy(
    deployer.address, // initialOwner
    true,             // testnet = true - faucet enabled, no initial supply minted
  );
  await c4c.waitForDeployment();
  const c4cAddress = await c4c.getAddress();
  console.log("C4CToken deployed to:", c4cAddress);

  console.log("\n--- Deployment Summary ---");
  console.log("Network:    Base Sepolia");
  console.log("C4CToken:  ", c4cAddress);
  console.log("Owner:     ", deployer.address);
  console.log("\nNext steps:");
  console.log("1. Verify the contract on Basescan (run: npm run verify:testnet)");
  console.log("2. Set C4C_TOKEN_ADDRESS=" + c4cAddress + " in Civil_Showdown/contracts/.env");
  console.log("3. Deploy CivilArcadePayment in Civil_Showdown using that address");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
