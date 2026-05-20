import { run } from "hardhat";

const C4C_TOKEN_ADDRESS = process.env.C4C_TOKEN_ADDRESS ?? "";
const INITIAL_OWNER_ADDRESS = process.env.INITIAL_OWNER_ADDRESS ?? "";

async function main() {
  if (!C4C_TOKEN_ADDRESS || !INITIAL_OWNER_ADDRESS) {
    throw new Error("Set C4C_TOKEN_ADDRESS and INITIAL_OWNER_ADDRESS in .env");
  }

  console.log("Verifying C4CToken (mainnet) at", C4C_TOKEN_ADDRESS, "...");
  await run("verify:verify", {
    address: C4C_TOKEN_ADDRESS,
    constructorArguments: [
      INITIAL_OWNER_ADDRESS, // initialOwner
      false,                 // testnet = false
    ],
  });

  console.log(
    "Verification complete. Check https://basescan.org/address/" + C4C_TOKEN_ADDRESS,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
