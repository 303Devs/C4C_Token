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
      // Advance time to exactly lastAt + FAUCET_COOLDOWN.
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

  describe("Permit (ERC-2612)", () => {
    let token: C4CToken;
    let owner: SignerWithAddress;
    let spender: SignerWithAddress;
    let other: SignerWithAddress;

    const PERMIT_AMOUNT = ethers.parseEther("250");

    async function signPermit(
      signer: SignerWithAddress,
      tokenContract: C4CToken,
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
      token = await TokenFactory.deploy(owner.address, true);
      await token.connect(owner).faucet();
    });

    it("exposes nonces() and DOMAIN_SEPARATOR()", async () => {
      expect(await token.nonces(owner.address)).to.equal(0n);
      expect(await token.DOMAIN_SEPARATOR()).to.be.a("string").and.match(/^0x/);
    });

    it("sets allowance via permit without a prior approve transaction", async () => {
      const deadline = BigInt(await time.latest()) + 300n;
      const { v, r, s } = await signPermit(owner, token, spender.address, PERMIT_AMOUNT, deadline);

      await token.permit(owner.address, spender.address, PERMIT_AMOUNT, deadline, v, r, s);

      expect(await token.allowance(owner.address, spender.address)).to.equal(PERMIT_AMOUNT);
      expect(await token.nonces(owner.address)).to.equal(1n);
    });

    it("nonce increments after each permit - prevents replay", async () => {
      const deadline = BigInt(await time.latest()) + 300n;
      const sig1 = await signPermit(owner, token, spender.address, PERMIT_AMOUNT, deadline);
      await token.permit(owner.address, spender.address, PERMIT_AMOUNT, deadline, sig1.v, sig1.r, sig1.s);

      await expect(
        token.permit(owner.address, spender.address, PERMIT_AMOUNT, deadline, sig1.v, sig1.r, sig1.s),
      ).to.be.reverted;
    });

    it("reverts if permit signature is expired", async () => {
      const expiredDeadline = BigInt(await time.latest()) - 1n;
      const { v, r, s } = await signPermit(owner, token, spender.address, PERMIT_AMOUNT, expiredDeadline);

      await expect(
        token.permit(owner.address, spender.address, PERMIT_AMOUNT, expiredDeadline, v, r, s),
      ).to.be.reverted;
    });

    it("reverts if permit signature is signed by the wrong key", async () => {
      const deadline = BigInt(await time.latest()) + 300n;
      const { v, r, s } = await signPermit(other, token, spender.address, PERMIT_AMOUNT, deadline);

      await expect(
        token.permit(owner.address, spender.address, PERMIT_AMOUNT, deadline, v, r, s),
      ).to.be.reverted;
    });
  });
});
