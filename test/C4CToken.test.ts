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

  describe("Permit (ERC-2612)", () => {
    let token: any;
    let owner: any;
    let spender: any;
    let other: any;

    const PERMIT_AMOUNT = ethers.parseEther("250");

    async function signPermit(
      signer: any,
      tokenContract: any,
      spenderAddress: string,
      amount: bigint,
      deadline: bigint,
    ) {
      const domain = {
        name: "CurrencyForCivilization",
        version: "1",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await tokenContract.getAddress(),
      };
      const types = {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      };
      const nonce = await tokenContract.nonces(signer.address);
      const sig = await signer.signTypedData(domain, types, {
        owner: signer.address,
        spender: spenderAddress,
        value: amount,
        nonce,
        deadline,
      });
      return ethers.Signature.from(sig);
    }

    beforeEach(async () => {
      [owner, spender, other] = await ethers.getSigners();
      const TokenFactory = await ethers.getContractFactory("C4CToken");
      // Use testnet mode so owner has tokens via faucet calls
      token = await TokenFactory.deploy(owner.address, true);
      // Mint to owner via faucet (testnet mode)
      await token.connect(owner).faucet();
    });

    it("exposes nonces() and DOMAIN_SEPARATOR()", async () => {
      expect(await token.nonces(owner.address)).to.equal(0n);
      expect(await token.DOMAIN_SEPARATOR()).to.be.a("string").and.match(/^0x/);
    });

    it("sets allowance via permit without a prior approve transaction", async () => {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);
      const { v, r, s } = await signPermit(owner, token, spender.address, PERMIT_AMOUNT, deadline);

      await token.permit(owner.address, spender.address, PERMIT_AMOUNT, deadline, v, r, s);

      expect(await token.allowance(owner.address, spender.address)).to.equal(PERMIT_AMOUNT);
      expect(await token.nonces(owner.address)).to.equal(1n);
    });

    it("nonce increments after each permit — prevents replay", async () => {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);
      const sig1 = await signPermit(owner, token, spender.address, PERMIT_AMOUNT, deadline);
      await token.permit(owner.address, spender.address, PERMIT_AMOUNT, deadline, sig1.v, sig1.r, sig1.s);

      // Reusing the same signature must revert — nonce is now 1
      await expect(
        token.permit(owner.address, spender.address, PERMIT_AMOUNT, deadline, sig1.v, sig1.r, sig1.s),
      ).to.be.reverted;
    });

    it("reverts if permit signature is expired", async () => {
      const expiredDeadline = BigInt(Math.floor(Date.now() / 1000) - 1);
      const { v, r, s } = await signPermit(owner, token, spender.address, PERMIT_AMOUNT, expiredDeadline);

      await expect(
        token.permit(owner.address, spender.address, PERMIT_AMOUNT, expiredDeadline, v, r, s),
      ).to.be.reverted; // ERC2612ExpiredSignature
    });

    it("reverts if permit signature is signed by the wrong key", async () => {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);
      // Sign as `other` but claim it is from `owner`
      const { v, r, s } = await signPermit(other, token, spender.address, PERMIT_AMOUNT, deadline);

      await expect(
        token.permit(owner.address, spender.address, PERMIT_AMOUNT, deadline, v, r, s),
      ).to.be.reverted; // ERC2612InvalidSigner
    });
  });
});
