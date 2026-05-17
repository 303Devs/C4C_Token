import { run } from "hardhat";

const C4C_TOKEN_ADDRESS = process.env.C4C_TOKEN_ADDRESS ?? "";
const DEPLOYER_ADDRESS = process.env.DEPLOYER_ADDRESS ?? "";

async function main() {
  if (!C4C_TOKEN_ADDRESS || !DEPLOYER_ADDRESS) {
    throw new Error("Set C4C_TOKEN_ADDRESS and DEPLOYER_ADDRESS in .env");
  }

  console.log("Verifying C4CToken at", C4C_TOKEN_ADDRESS, "...");
  await run("verify:verify", {
    address: C4C_TOKEN_ADDRESS,
    constructorArguments: [
      DEPLOYER_ADDRESS, // initialOwner
      true,             // testnet
    ],
  });

  console.log(
    "Verification complete. Check https://sepolia.basescan.org/address/" + C4C_TOKEN_ADDRESS,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
