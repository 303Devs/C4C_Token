import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { C4CToken } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("C4CToken", () => {
  let token: C4CToken;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let other: SignerWithAddress;

  const MAINNET_SUPPLY = ethers.parseEther("1000000000");
  const FAUCET_AMOUNT = ethers.parseEther("1000");
  const FAUCET_COOLDOWN = 86400n; // 1 day in seconds

  // ---------------------------------------------------------------------------
  // Mainnet mode
  // ---------------------------------------------------------------------------
  describe("Mainnet mode (testnet = false)", () => {
    beforeEach(async () => {
      [owner, user] = await ethers.getSigners();
      const Factory = await ethers.getContractFactory("C4CToken");
      token = await Factory.deploy(owner.address, false);
    });

    it("mints full supply to owner at deployment", async () => {
      expect(await token.balanceOf(owner.address)).to.equal(MAINNET_SUPPLY);
    });

    it("has correct name, symbol, and decimals", async () => {
      expect(await token.name()).to.equal("CurrencyForCivilization");
      expect(await token.symbol()).to.equal("C4C");
      expect(await token.decimals()).to.equal(18);
    });

    it("total supply equals 1 billion C4C", async () => {
      expect(await token.totalSupply()).to.equal(MAINNET_SUPPLY);
    });

    it("reverts on faucet() with C4CFaucetDisabled", async () => {
      await expect(token.connect(user).faucet())
        .to.be.revertedWithCustomError(token, "C4CFaucetDisabled");
    });

    it("faucet is disabled even for owner", async () => {
      await expect(token.connect(owner).faucet())
        .to.be.revertedWithCustomError(token, "C4CFaucetDisabled");
    });

    it("allows burn()", async () => {
      const burnAmount = ethers.parseEther("1000");
      await token.connect(owner).burn(burnAmount);
      expect(await token.totalSupply()).to.equal(MAINNET_SUPPLY - burnAmount);
    });

    it("allows burnFrom() with allowance", async () => {
      const amount = ethers.parseEther("500");
      await token.connect(owner).approve(user.address, amount);
      await token.connect(user).burnFrom(owner.address, amount);
      expect(await token.totalSupply()).to.equal(MAINNET_SUPPLY - amount);
      expect(await token.allowance(owner.address, user.address)).to.equal(0n);
    });

    it("allows transfer", async () => {
      const amount = ethers.parseEther("100");
      await token.connect(owner).transfer(user.address, amount);
      expect(await token.balanceOf(user.address)).to.equal(amount);
    });

    it("owner cannot mint via any path", async () => {
      // No mint function exists. The only supply increase is the constructor
      // and the testnet faucet (disabled in this mode). Verify faucet reverts.
      await expect(token.connect(owner).faucet())
        .to.be.revertedWithCustomError(token, "C4CFaucetDisabled");
    });

    it("ownership transfer does not affect supply or faucet mode", async () => {
      await token.connect(owner).transferOwnership(user.address);
      expect(await token.owner()).to.equal(user.address);
      expect(await token.totalSupply()).to.equal(MAINNET_SUPPLY);
      await expect(token.connect(user).faucet())
        .to.be.revertedWithCustomError(token, "C4CFaucetDisabled");
    });
  });

  // ---------------------------------------------------------------------------
  // Testnet mode
  // ---------------------------------------------------------------------------
  describe("Testnet mode (testnet = true)", () => {
    beforeEach(async () => {
      [owner, user, other] = await ethers.getSigners();
      const Factory = await ethers.getContractFactory("C4CToken");
      token = await Factory.deploy(owner.address, true);
    });

    it("mints no supply at deployment", async () => {
      expect(await token.totalSupply()).to.equal(0);
    });

    it("faucet() mints 1,000 C4C to caller", async () => {
      await token.connect(user).faucet();
      expect(await token.balanceOf(user.address)).to.equal(FAUCET_AMOUNT);
    });

    it("faucet() reverts within cooldown period with C4CFaucetCooldownActive", async () => {
      await token.connect(user).faucet();
      await expect(token.connect(user).faucet())
        .to.be.revertedWithCustomError(token, "C4CFaucetCooldownActive");
    });

    it("faucet() succeeds exactly at cooldown boundary", async () => {
      await token.connect(user).faucet();
      const lastAt = await token.lastFaucetAt(user.address);
      // advance time to exactly lastAt + FAUCET_COOLDOWN
      await time.setNextBlockTimestamp(lastAt + FAUCET_COOLDOWN);
      await expect(token.connect(user).faucet()).to.not.be.reverted;
      expect(await token.balanceOf(user.address)).to.equal(FAUCET_AMOUNT * 2n);
    });

    it("faucet() emits FaucetUsed with correct args", async () => {
      await expect(token.connect(user).faucet())
        .to.emit(token, "FaucetUsed")
        .withArgs(user.address, FAUCET_AMOUNT);
    });

    it("different addresses can use faucet independently", async () => {
      await token.connect(user).faucet();
      await token.connect(other).faucet();
      expect(await token.balanceOf(user.address)).to.equal(FAUCET_AMOUNT);
      expect(await token.balanceOf(other.address)).to.equal(FAUCET_AMOUNT);
    });

    it("faucet() records lastFaucetAt", async () => {
      await token.connect(user).faucet();
      const lastAt = await token.lastFaucetAt(user.address);
      expect(lastAt).to.be.gt(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Constructor edge cases
  // ---------------------------------------------------------------------------
  describe("Constructor edge cases", () => {
    it("reverts deploy when initialOwner is zero address (mainnet mode)", async () => {
      const Factory = await ethers.getContractFactory("C4CToken");
      await expect(Factory.deploy(ethers.ZeroAddress, false))
        .to.be.revertedWithCustomError(Factory, "OwnableInvalidOwner");
    });

    it("reverts deploy when initialOwner is zero address (testnet mode)", async () => {
      const Factory = await ethers.getContractFactory("C4CToken");
      await expect(Factory.deploy(ethers.ZeroAddress, true))
        .to.be.revertedWithCustomError(Factory, "OwnableInvalidOwner");
    });

    // H-01 regression: testnet=true on Hardhat (chainId 31337) must succeed.
    // The chain guard only blocks production chains (8453, 1).
    it("H-01: testnet=true deploy is allowed on Hardhat (chainId 31337)", async () => {
      [owner] = await ethers.getSigners();
      const chainId = (await ethers.provider.getNetwork()).chainId;
      expect(Number(chainId)).to.equal(31337);
      const Factory = await ethers.getContractFactory("C4CToken");
      await expect(Factory.deploy(owner.address, true)).to.not.be.reverted;
    });

    // H-01 regression: to verify the guard fires on Base mainnet (chainId 8453),
    // run the following manually against a Base mainnet fork:
    //
    //   npx hardhat test --network baseMainnetFork
    //
    // Expected: C4CTestnetOnProductionChain(8453) revert when testnet=true is passed.
    // This cannot be tested in normal Hardhat CI without a forked network config.
  });

  // ---------------------------------------------------------------------------
  // ERC20Permit
  // ---------------------------------------------------------------------------
  describe("ERC20Permit (EIP-2612)", () => {
    it("exposes a non-zero domain separator", async () => {
      [owner] = await ethers.getSigners();
      const Factory = await ethers.getContractFactory("C4CToken");
      token = await Factory.deploy(owner.address, false);
      const sep = await token.DOMAIN_SEPARATOR();
      expect(sep).to.not.equal(ethers.ZeroHash);
    });

    it("has nonces starting at 0 for a fresh address", async () => {
      [owner, user] = await ethers.getSigners();
      const Factory = await ethers.getContractFactory("C4CToken");
      token = await Factory.deploy(owner.address, false);
      expect(await token.nonces(user.address)).to.equal(0n);
    });
  });
});
