# C4C Mainnet Launch Runbook

This runbook is a launch checklist for deploying `C4CToken` to Base mainnet.
It is not deployment approval. Do not run mainnet deploy, verify,
ownership-transfer, or downstream address-rotation steps until Anthony
explicitly approves the launch window.

## Launch Scope

- Contract: `C4CToken`
- Network: Base mainnet
- Chain ID: `8453`
- Token name: `CurrencyForCivilization`
- Token symbol: `C4C`
- Decimals: `18`
- Constructor arguments:
  - `initialOwner`: Anthony-approved treasury or multisig address
  - `testnet`: `false`
- Mainnet supply: `1,000,000,000 C4C`, minted once to `initialOwner`
- Faucet: permanently disabled on this deployment

## Hard Stops

Stop before deployment if any of these are not true:

- Anthony has explicitly approved mainnet deployment for the current launch
  window.
- The intended `initialOwner` address is confirmed in writing.
- The deployer wallet is funded with enough Base mainnet ETH for deploy and any
  follow-up operations.
- `DEPLOYER_PRIVATE_KEY`, RPC URLs, and API keys are only in local environment
  files or secret stores, never committed.
- Local `main` is at the reviewed release commit or an approved release branch.
- The working tree contains no unexpected tracked changes.
- The current deployment script constructor arguments match this runbook.

## Required Environment

Set these locally before launch. Do not commit `.env`.

```sh
DEPLOYER_PRIVATE_KEY=<mainnet deployer private key>
BASE_MAINNET_RPC_URL=<Base mainnet RPC URL>
ETHERSCAN_API_KEY=<Etherscan v2 API key with Base support>
INITIAL_OWNER_ADDRESS=<Anthony-approved treasury or multisig address>
```

After deployment, also set:

```sh
C4C_TOKEN_ADDRESS=<deployed C4CToken address>
```

## Owner Confirmation

`C4CToken` mints the full mainnet supply to `initialOwner` during construction.
That choice is not reversible inside this contract.

Before deploying:

1. Confirm whether `initialOwner` should be the deployer, a treasury wallet, or
   a multisig.
2. Confirm the exact checksummed address.
3. Confirm the address can receive ERC-20 tokens on Base mainnet.
4. Confirm the address is the same value used by `scripts/deploy-mainnet.ts` and
   `INITIAL_OWNER_ADDRESS` for verification.

Current script note: `scripts/deploy-mainnet.ts` sets `INITIAL_OWNER` to
`deployer.address` and includes a comment to replace it with the multisig
address before running. If the approved owner is not the deployer, update that
script in a reviewed PR before executing this runbook.

## Preflight Checks

Run these before any mainnet transaction:

```sh
git status --short --branch
git log --oneline --decorate -8
npm ci
npm run compile
npm run typecheck
npm test
```

Confirm all pass and record the release commit hash.

There is no read-only dry-run command for `scripts/deploy-mainnet.ts` in the
current project. Treat `npx hardhat run scripts/deploy-mainnet.ts --network
baseMainnet` as a real deployment command. Only run it after approval. The
script has a JavaScript-side chain guard and must reject any network whose
configured chain ID is not `8453`.

## Deployment

After Anthony approval and preflight signoff:

```sh
npm run compile
npx hardhat run scripts/deploy-mainnet.ts --network baseMainnet
```

Expected deployment summary:

- Network: `Base Mainnet`
- `isTestnet`: `false`
- `totalSupply`: `1000000000.0 C4C`
- Owner: the approved `INITIAL_OWNER`
- C4CToken: newly deployed contract address

Capture these values in the Linear issue or project control handoff:

- Release commit
- Deployer address
- Initial owner address
- C4CToken address
- Deployment transaction hash
- Block number
- Basescan address URL

Do not commit generated Hardhat outputs, TypeChain files, `.env`, audit files,
or local artifacts as part of the deployment record.

## Verification

Set:

```sh
C4C_TOKEN_ADDRESS=<deployed C4CToken address>
INITIAL_OWNER_ADDRESS=<constructor initialOwner address>
```

Then run:

```sh
npm run verify:mainnet
```

Verification uses constructor arguments:

```ts
[INITIAL_OWNER_ADDRESS, false]
```

If Basescan verification fails because indexing is not ready, wait and retry with
the same address and constructor arguments. Do not redeploy just to fix a
verification timing failure.

## On-Chain Acceptance Checks

After verification, inspect the contract on Basescan or with a read-only script
and confirm:

- `name()` returns `CurrencyForCivilization`
- `symbol()` returns `C4C`
- `decimals()` returns `18`
- `isTestnet()` returns `false`
- `totalSupply()` returns `1000000000000000000000000000`
- `owner()` returns the approved `initialOwner`
- The approved `initialOwner` balance equals the full initial supply before any
  transfers or burns
- `faucet()` reverts
- `DOMAIN_SEPARATOR()` and `nonces(address)` are present for ERC-2612 permit

## Downstream Rotation Gate

Do not rotate Civil Showdown token or payment addresses as part of this runbook
unless Anthony separately approves that sequence.

After token deployment is accepted, the next gated work is:

- Update Civil Showdown C4C token references.
- Redeploy or rotate any payment contract that stores the token address.
- Verify game/payment flows against the new mainnet address.

Those steps belong to the Civil Showdown rotation issue and must record the
approved token address before execution.

## Rollback And Recovery Notes

This token is not upgradeable and has no pause, blacklist, rescue, or owner mint
path. Recovery depends on the failure type:

- Wrong `initialOwner`: stop using the bad address, disclose the bad deployment
  internally, and redeploy only after Anthony approval.
- Wrong network: do not use the address; redeploy on the approved network after
  approval.
- Verification failure: retry verification with the same constructor args after
  Basescan catches up.
- RPC or funding failure before deployment is mined: fix the environment or
  funding issue and rerun only after confirming no deployment transaction mined.
- Civil Showdown integration failure: do not change token state; fix downstream
  configuration through the separate rotation workflow.

## Final Signoff

Mainnet launch is complete only when:

- Anthony approval is recorded.
- Deployment transaction is mined on Base mainnet.
- Basescan verification is complete.
- On-chain acceptance checks pass.
- The deployment record is attached to the Linear issue or project control
  handoff.
- Any downstream Civil Showdown rotation remains explicitly approved or still
  blocked.
