import { expect } from "chai";
import { ethers } from "hardhat";
import { C4CToken } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("C4CToken", () => {
  let token: C4CToken;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let other: SignerWithAddress;

  const MAINNET_SUPPLY = ethers.parseEther("1000000000");
  const FAUCET_AMOUNT = ethers.parseEther("1000");

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

    it("reverts on faucet() call", async () => {
      await expect(token.connect(user).faucet()).to.be.revertedWith(
        "C4C: faucet disabled on mainnet",
      );
    });

    it("allows burn()", async () => {
      const burnAmount = ethers.parseEther("1000");
      await token.connect(owner).burn(burnAmount);
      expect(await token.totalSupply()).to.equal(MAINNET_SUPPLY - burnAmount);
    });

    it("allows transfer", async () => {
      const amount = ethers.parseEther("100");
      await token.connect(owner).transfer(user.address, amount);
      expect(await token.balanceOf(user.address)).to.equal(amount);
    });
  });

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

    it("faucet() reverts within cooldown period", async () => {
      await token.connect(user).faucet();
      await expect(token.connect(user).faucet()).to.be.revertedWith(
        "C4C: faucet cooldown active",
      );
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
});
