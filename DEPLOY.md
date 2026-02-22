# Deploy Krump Verify (all 3 contracts)

Deploys **KrumpTreasury**, **KrumpVerify**, and **KrumpVerifyNFT** on Story Aeneid with IP Asset Registry, License Registry, and Royalty Module set at deploy. The relayer (address with RECEIPT_SUBMITTER_ROLE) can call `submitPaymentReceipt` after x402/EVVM payments.

**Credits:** StreetKode Fam: Asura, Hectik, Kronos, Jo

---

## 1. Env (project root)

In **`.env`** at the project root (same folder as `foundry.toml`):

```bash
# Required: deployer private key (hex, with or without 0x)
PRIVATE_KEY=0x<your_deployer_private_key>

# Optional; defaults below are for Story Aeneid
# USDC_K=0xd35890acdf3BFFd445C2c7fC57231bDE5cAFbde5
# RPC_URL=https://aeneid.storyrpc.io
# RELAYER_ADDRESS=0x...   # If set, granted RECEIPT_SUBMITTER_ROLE; else deployer has it
```

The deployer address (e.g. `0xcF2C38f9903e6360bB0183A75a3bc1D0ef26964A`) automatically receives **RECEIPT_SUBMITTER_ROLE** on KrumpVerify. Use the same key in the **relayer** `.env` as `RELAYER_PRIVATE_KEY` so the relayer can submit receipts.

---

## 2. Deploy with 10 gwei

From the project root:

```bash
./deploy.sh
```

Or with Forge directly (10 gwei):

```bash
forge script script/DeployAll.s.sol:DeployAll \
  --rpc-url https://aeneid.storyrpc.io \
  --broadcast \
  --gas-price 10000000000 \
  --legacy
```

Add `--verify --verifier blockscout --verifier-url https://aeneid.storyscan.io/api/` if you want on-chain verification.

---

## 3. After deploy

1. **Frontend** – In `frontend/.env` set:
   - `VITE_KRUMP_VERIFY_ADDRESS=<KrumpVerify address from logs>`
   - `VITE_KRUMP_VERIFY_NFT_ADDRESS=<KrumpVerifyNFT address from logs>`

2. **Relayer** – In `relayer/.env` set:
   - `RELAYER_PRIVATE_KEY=<same as PRIVATE_KEY or key for an address that has RECEIPT_SUBMITTER_ROLE>`
   - Optionally `KRUMP_VERIFY_ADDRESS=<KrumpVerify address>`

No separate **SetStoryProtocol** run is needed; IP Asset Registry, License Registry, and Royalty Module are set in **DeployAll**.
