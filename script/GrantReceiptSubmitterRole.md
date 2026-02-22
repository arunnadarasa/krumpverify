# Grant RECEIPT_SUBMITTER_ROLE to the relayer

The relayer wallet must have `RECEIPT_SUBMITTER_ROLE` on KrumpVerify. You can either use the deployer as the relayer (no grant) or grant the role to another address.

## Option A – Use the deployer as the relayer (easiest)

The KrumpVerify deployer is **0x35df28Db852f528282Dd26AAa0C3968aac1d3a25** (from `broadcast/DeployKrumpVerify.s.sol`). That address already has `RECEIPT_SUBMITTER_ROLE`.

1. In MetaMask (or the wallet you used to deploy), open the account **0x35...3a25**.
2. Account details → **Export Private Key**; copy the key.
3. In **relayer/.env**, set:
   ```bash
   RELAYER_PRIVATE_KEY=<paste the key; with or without 0x>
   ```
4. Restart the relayer: `PORT=7351 npm run dev`.

No on-chain transaction needed.

---

## Option B – Grant the role to the current relayer address

If you want to keep using the relayer wallet **0x60d743487E4Be4d5cC188dc8B1eE6FACe74D8E09**, grant it the role once from the deployer wallet.

### Using Foundry `cast`

From the project root, with the deployer private key in `PRIVATE_KEY` (or pass it below):

```bash
# RPC for Story Aeneid
export RPC_URL=https://aeneid.storyrpc.io
export KRUMP_VERIFY=0x59422B9Ea7f9b5CfBBF23A4aed695FcCeF41eE91
export RELAYER_ADDRESS=0x60d743487E4Be4d5cC188dc8B1eE6FACe74D8E09

# Get the role id from the contract
ROLE=$(cast call $KRUMP_VERIFY "RECEIPT_SUBMITTER_ROLE()(bytes32)" --rpc-url $RPC_URL)

# Grant the role (use the deployer private key)
cast send $KRUMP_VERIFY "grantRole(bytes32,address)" $ROLE $RELAYER_ADDRESS \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY
```

Or one line (replace `YOUR_DEPLOYER_PRIVATE_KEY`):

```bash
cast send 0x59422B9Ea7f9b5CfBBF23A4aed695FcCeF41eE91 "grantRole(bytes32,address)" $(cast call 0x59422B9Ea7f9b5CfBBF23A4aed695FcCeF41eE91 "RECEIPT_SUBMITTER_ROLE()(bytes32)" --rpc-url https://aeneid.storyrpc.io) 0x60d743487E4Be4d5cC188dc8B1eE6FACe74D8E09 --rpc-url https://aeneid.storyrpc.io --private-key YOUR_DEPLOYER_PRIVATE_KEY
```

### Using the block explorer

1. Open [KrumpVerify on StoryScan (Aeneid)](https://aeneid.storyscan.io/address/0x59422B9Ea7f9b5CfBBF23A4aed695FcCeF41eE91).
2. If there is a “Contract” / “Write” tab, connect the **deployer** wallet (0x35...3a25).
3. Find **grantRole(bytes32 role, address account)**.
4. For **role**, use the value of `RECEIPT_SUBMITTER_ROLE()` (call the read function first and copy the bytes32).
5. For **account**, use `0x60d743487E4Be4d5cC188dc8B1eE6FACe74D8E09`.
6. Submit the transaction.

After the tx confirms, restart the relayer and try “Pay 1 USDC.k via x402” again.

---

## Option C – Grant the role to OpenClaw Payer (or any other wallet)

To use **OpenClaw Payer** as the relayer:

1. **Get OpenClaw Payer's address** from MetaMask (copy the full 0x… address).

2. **Grant the role** from the **deployer** wallet (one-time). From the project root:

   ```bash
   export PRIVATE_KEY=0xYourDeployerPrivateKey
   export OPENCLAW_PAYER_ADDRESS=0xYourOpenClawPayerAddress   # paste from MetaMask

   cast send 0x59422B9Ea7f9b5CfBBF23A4aed695FcCeF41eE91 "grantRole(bytes32,address)" \
     $(cast call 0x59422B9Ea7f9b5CfBBF23A4aed695FcCeF41eE91 "RECEIPT_SUBMITTER_ROLE()(bytes32)" --rpc-url https://aeneid.storyrpc.io) \
     $OPENCLAW_PAYER_ADDRESS \
     --rpc-url https://aeneid.storyrpc.io \
     --private-key $PRIVATE_KEY
   ```

3. **Use OpenClaw Payer as the relayer:** In **relayer/.env**, set `RELAYER_PRIVATE_KEY` to OpenClaw Payer's private key (MetaMask → Account details → Export Private Key; trim and add 0x if needed). Restart the relayer.

Then OpenClaw Payer can submit receipts as the relayer and you can use the contract-owner wallet for Register IP / setTokenURI in the app.

### If you get "encode length mismatch: expected 2 types, got 1"

Run the role grant in **two steps** so both arguments are clearly passed. Use the **locally computed** role hash (no contract read needed):

```bash
export PRIVATE_KEY=0xYourDeployerPrivateKey
export OPENCLAW_PAYER_ADDRESS=0xYourOpenClawPayerAddress   # e.g. 0x1234... (full 42 chars)

# Step 1: role = keccak256("RECEIPT_SUBMITTER_ROLE") (same as contract constant; no RPC call)
ROLE=$(cast keccak "RECEIPT_SUBMITTER_ROLE")

# Step 2: grant (both args must be set). Use 10 Gwei and longer timeout if the network is slow.
cast send 0x59422B9Ea7f9b5CfBBF23A4aed695FcCeF41eE91 "grantRole(bytes32,address)" "$ROLE" "$OPENCLAW_PAYER_ADDRESS" --rpc-url https://aeneid.storyrpc.io --private-key "$PRIVATE_KEY" --gas-price 10000000000 --timeout 120
```

Check that `echo $OPENCLAW_PAYER_ADDRESS` and `echo $ROLE` print one address and one 0x-prefixed bytes32 before running step 2.

### If "cast call ... RECEIPT_SUBMITTER_ROLE()" reverts

The contract read can revert (e.g. wrong chain or RPC). Use the **local role hash** instead of calling the contract:

```bash
ROLE=$(cast keccak "RECEIPT_SUBMITTER_ROLE")
# then use $ROLE in cast send as above
```

### If "transaction was not confirmed within the timeout"

Resend with a higher gas price (e.g. 10 Gwei) and a longer wait:

```bash
cast send 0x59422B9Ea7f9b5CfBBF23A4aed695FcCeF41eE91 "grantRole(bytes32,address)" "$ROLE" "$RELAYER_ADDRESS" --rpc-url https://aeneid.storyrpc.io --private-key "$PRIVATE_KEY" --gas-price 10000000000 --timeout 120
```

(10 Gwei = `10000000000` wei.) Check the explorer afterward; the tx may have confirmed even if cast timed out.

### If you get "execution reverted"

- The sender of the tx must be an **admin** on KrumpVerify (the deployer has this by default). Use the **deployer** private key in `PRIVATE_KEY`.
- If the deployer was changed or roles were revoked, the current admin must run `grantRole`.
