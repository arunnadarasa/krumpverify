## Krump Verify

On-chain verification for dance moves against registered IP (Story). Users pay a USDC.k fee; receipts are stored on-chain and fees are split via **KrumpTreasury**.

**→ [Building with EVVM, x402 & USDC.k on Story Aeneid](docs/BUILDING_WITH_EVVM_X402_STORY_AENEID.md)** — step-by-step guide: architecture, failures we hit (EVVM payment failed, IP registry, funding UX, relayer, deploy), and how we fixed them. Use it to build similar apps.

- **KrumpVerify** – `verifyMove(ipId, moveDataHash, proof)`: checks IP exists, pulls USDC.k fee to treasury, records receipt, emits `Verified`.
- **KrumpTreasury** – holds USDC.k, `collectFee` (called by KrumpVerify), `distribute()` splits to operational multisig and royalty pool (set `treasuryMultisig` and `royaltyPoolContract` before calling).

Interfaces (`IIPAssetRegistry`, `ILicenseRegistry`, `IRoyaltyModule`) are minimal placeholders; replace with official Story interfaces when integrating.

### Frontend

A React app in `frontend/` lets users connect a wallet (Story Aeneid), enter IP ID and move data, approve USDC.k, and call `verifyMove`. Run it with:

```bash
cd frontend && cp .env.example .env && npm install && npm run dev
```

See `frontend/README.md` for env and build options.

---

## Environment and secrets

**Never commit your private key.** Use a `.env` file at the **project root** (it is in `.gitignore`).

1. Copy the example file and edit it with your values:
   ```bash
   cp .env.example .env
   ```
2. In **`.env`** (project root), set:
   - **`PRIVATE_KEY`** – hex of your deployer wallet (with or without `0x`). The deployer (e.g. `0xf5FaeD614b2e185052Ce53Dd3C10D32d7BFBC4D6`) automatically receives **RECEIPT_SUBMITTER_ROLE** on KrumpVerify so the same key can be used as the x402 relayer.
   - **`RPC_URL`** or **`STORY_RPC`** – JSON-RPC URL (e.g. `https://aeneid.storyrpc.io` for Story Aeneid)
   - **`USDC_K`** – USDC.k token address (required for deploy)
   - Optional: **`IP_ASSET_REGISTRY`**, **`LICENSE_REGISTRY`**, **`ROYALTY_MODULE`** – Story contract addresses

Forge scripts load `.env` automatically via `foundry.toml` (`dotenv = ".env"`).

---

## Foundry

**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**

Foundry consists of:

- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
- **Chisel**: Fast, utilitarian, and verbose solidity REPL.

## Documentation

https://book.getfoundry.sh/

## Usage

### Build

```shell
$ forge build
```

### Test

```shell
$ forge test
```

### Format

```shell
$ forge fmt
```

### Gas Snapshots

```shell
$ forge snapshot
```

### Anvil

```shell
$ anvil
```

### Deploy (all 3 contracts)

1. In **`.env`** at the project root set `PRIVATE_KEY=0x<your_deployer_hex>` (and optionally `USDC_K`, `RPC_URL` or `STORY_RPC`, `RELAYER_ADDRESS`). See **[DEPLOY.md](DEPLOY.md)** for full steps.
2. Run (10 gwei):

```shell
$ ./deploy.sh
```

Or with Forge directly:

```shell
$ forge script script/DeployAll.s.sol:DeployAll --rpc-url https://aeneid.storyrpc.io --broadcast --gas-price 10000000000 --legacy
```

This deploys **KrumpTreasury**, **KrumpVerify** (with Story Aeneid IP/License/Royalty set), and **KrumpVerifyNFT**. Deployer gets **RECEIPT_SUBMITTER_ROLE**; use the same key in relayer `.env` as `RELAYER_PRIVATE_KEY`. After deploy, set the new contract addresses in frontend and relayer `.env`.

### Cast

```shell
$ cast <subcommand>
```

### Help

```shell
$ forge --help
$ anvil --help
$ cast --help
```
