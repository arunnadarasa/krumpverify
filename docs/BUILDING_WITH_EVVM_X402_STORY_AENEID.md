# Building Apps with EVVM, x402, and Wrapped USDC on Story Aeneid

A step-by-step guide from the **Agent-to-Agent Krump Verification Protocol** — pay via x402/EVVM on Story Aeneid and verify on-chain. What we learned, what failed, and how we fixed it. Use this to build similar apps that take payments via **EVVM** (Ethereum Virtual Value Machine), **x402** (signed payment authorization), and **USDC.k** (wrapped USDC) on **Story Aeneid** (chain 1315).

---

## 1. What You’re Building (High Level)

- **User flow:** User pays a fee (e.g. 1 USDC.k) via a signed “x402” message; a **relayer** (backend) calls an **EVVM adapter** to move USDC.k and then submits a **payment receipt** to your contract. The contract only trusts receipts signed by a relayer that has a specific role.
- **Tech:** EVVM (internal balance, Core.pay), EIP-712 “TransferWithAuthorization” (x402), EVVM Treasury (deposit), EVVM Native x402 Adapter (on-chain), Story Aeneid (chain 1315), USDC.k.

---

## 2. Concepts You Need

### 2.1 EVVM (Ethereum Virtual Value Machine)

- **Internal balance:** EVVM keeps an internal balance per user per token. To pay someone via the adapter, the **payer must have enough internal balance**.
- **How to get internal balance:** User approves USDC.k for the **EVVM Treasury** and calls **Treasury.deposit(token, amount)**. After that, `Core.pay()` can debit that balance.
- **Core.pay(to, identity, token, amount, priorityFee, executor):** The adapter calls this. The **executor** must match what the user signed; in the Native x402 adapter it is `address(0)`.
- **Nonce:** Use **sync** execution with **getNextCurrentSyncNonce(user)** from EVVM Core and pass `isAsyncExec: false` so the signed payload matches what Core expects and you avoid InvalidSignature / async reservation issues.

### 2.2 x402 (Payment Authorization)

- **EIP-712 “TransferWithAuthorization”:** User signs a structured message (from, to, amount, validAfter, validBefore, nonce) with domain tied to the **adapter** contract. The relayer submits this to the adapter.
- **Adapter:** The **EVVM Native x402 Adapter** uses that signature plus an **EVVM signature** (see below) to pull USDC.k from the user’s EVVM internal balance and send it to the recipient.

### 2.3 EVVM Signature (for the adapter)

- The adapter needs the user to sign an **EVVM message** that authorizes `Core.pay(...)`.
- **Hash payload** must match what EVVM Core uses. We matched **evvm-js** `BaseService.buildHashPayload`: the payload is the **ABI-encoded** tuple for the `pay` function: **function name `"pay"`** then **(to_address, to_identity, token, amount, priorityFee)** in that order.
  - Correct: `keccak256(encodeAbiParameters(..., ['pay', toAddress, '', token, amount, 0n]))`
  - **Include the string `"pay"`** in the encoded data; omitting it causes “EVVM payment failed” on-chain.
- **Executor:** Must be **`address(0)`** because the EVVM Native x402 Adapter passes `address(0)` to `Core.pay()`. If the frontend signs a different executor (e.g. the adapter address), the adapter’s call to Core will revert.
- **Message format:** Comma-separated: `evvmId, coreAddress, hashPayloadLowercase, executorLowercase, nonce, isAsyncExec`. Use the same nonce as from **getNextCurrentSyncNonce(user)** and `isAsyncExec: false` for sync execution.

### 2.4 Story Aeneid & USDC.k

- **Chain ID:** 1315.
- **USDC.k:** Wrapped USDC on Aeneid (e.g. `0xd35890acdf3BFFd445C2c7fC57231bDE5cAFbde5`). Use it for fees and EVVM Treasury deposits.
- **Story Protocol:** If your contract uses IP Asset Registry (e.g. for licensing), set **IP Asset Registry**, **License Registry**, and **Royalty Module** at deploy or via setters. A revert like “IP registry not set” means your contract’s `ipAssetRegistry` was still `address(0)`.

---

## 3. Architecture (Krump Verify Style)

```
[Frontend]
  1. User approves USDC.k for EVVM Treasury.
  2. User deposits USDC.k into EVVM Treasury (internal balance).
  3. User signs x402 (EIP-712) + EVVM message; clicks “Pay via x402”.
  4. Frontend POSTs payload to relayer.

[Relayer]
  5. Relayer calls adapter.payViaEVVMWithX402(...) (and optionally submitPaymentReceipt in same flow).
  6. Relayer calls your contract’s submitPaymentReceipt(receiptId, payer, amount).

[Contract]
  7. Only addresses with RECEIPT_SUBMITTER_ROLE can call submitPaymentReceipt.
  8. Later, user calls verifyMoveWithReceipt(..., receiptId) using that receipt.
```

- **Relayer** holds a private key for an address that has **RECEIPT_SUBMITTER_ROLE** on your contract.
- **EVVM Treasury** and **EVVM Core** (and adapter) are shared infrastructure on Story Aeneid; your app only needs the right addresses and ABIs.

---

## 4. Step-by-Step: Building a Similar App

### Step 1: Contracts

- **Fee / receipt contract:**  
  - Define a role (e.g. `RECEIPT_SUBMITTER_ROLE = keccak256("RECEIPT_SUBMITTER_ROLE")`).  
  - Implement `submitPaymentReceipt(bytes32 receiptId, address payer, uint256 amount)` restricted to that role.  
  - Implement your main action (e.g. `verifyMoveWithReceipt`) that checks a receipt and marks it used.
- **Optional:** If you use Story Protocol (IP assets, licenses), pass **IP_ASSET_REGISTRY**, **LICENSE_REGISTRY**, **ROYALTY_MODULE** in the constructor or set them soon after deploy so you never hit “IP registry not set”.

### Step 2: Frontend – Fund EVVM (One-Time per User)

- **Approve:** `ERC20(USDC_K).approve(EVVM_TREASURY_ADDRESS, amount)`.
- **Deposit:** `EVVM_TREASURY.deposit(USDC_K_ADDRESS, amount)`.
- **UX:** After the user confirms the approve tx, refetch the USDC allowance (e.g. with wagmi’s `refetch`) so the UI can switch from “1. Approve” to “2. Deposit” without a full page refresh. Use `useWaitForTransactionReceipt` on the approve/deposit tx hash and trigger refetch on success.

### Step 3: Frontend – x402 + EVVM Signing

- **x402:** Sign EIP-712 `TransferWithAuthorization` with domain pointing at the **adapter** (name/version/chainId/verifyingContract).
- **EVVM:**  
  - Read `getNextCurrentSyncNonce(user)` from EVVM Core.  
  - Build `hashPayload = keccak256(encodeAbiParameters(..., ['pay', recipientAddress, '', USDC_K_ADDRESS, amount, 0n]))`.  
  - Build EVVM message: `evvmId, coreAddress, hashPayload.toLowerCase(), '0x0000000000000000000000000000000000000000', nonce, 'false'`.  
  - Sign with `signMessage(message)` (no EIP-712 for this part in our setup).
- Send to relayer: `receiptId`, x402 fields (from, to, amount, validAfter, validBefore, nonce, v, r, s), `evvmNonce`, `evvmIsAsyncExec: false`, `evvmSignature`.

### Step 4: Relayer

- **Validate** request (amount, recipient, chain).
- **Call adapter:** `payViaEVVMWithX402(from, to, toIdentity, amount, validAfter, validBefore, nonce, v, r, s, receiptIdString, evvmNonce, isAsyncExec, evvmSignature)` using the relayer’s wallet (viem `writeContract`). Use the **same** `isAsyncExec` (false) and nonce the frontend used.
- **Call your contract:** `submitPaymentReceipt(receiptId, payer, amount)` with the same relayer wallet (must have RECEIPT_SUBMITTER_ROLE).
- Return `receiptId` and tx hash to the frontend.

### Step 5: Deploy Contracts

- Deploy with a single script if possible: Treasury → Main contract (with Story registries if needed) → grant RECEIPT_SUBMITTER_ROLE to deployer or a dedicated relayer address → any NFT or helper contracts.
- Use a fixed gas price (e.g. 10 gwei) when the chain is busy to avoid “replacement transaction underpriced” on retries; quote the private key in the shell to avoid “no such file or directory” from the shell parsing the key.

### Step 6: Deploy Relayer (e.g. Fly.io)

- Run the relayer in a container; set **RELAYER_PRIVATE_KEY** as a secret (never in code or repo).
- Set **KRUMP_VERIFY_ADDRESS** (or your contract), **EVVM_X402_ADAPTER_ADDRESS**, **RPC_URL** in env.
- Fly.io: avoid app names that contain words like “verify” (abuse filter). Use e.g. `krump-x402-relayer`.
- Frontend: set **VITE_X402_RELAYER_URL** to the deployed relayer URL so production uses it instead of localhost.

---

## 5. Failures and How We Fixed Them

### 5.1 “EVVM payment failed” (Adapter Revert)

- **Cause:** EVVM Core rejected the payload (wrong hash or executor/nonce).
- **Fixes:**  
  - **Hash:** Encode and hash exactly as for `pay(to, identity, token, amount, priorityFee)` and **include the string `"pay"`** in the ABI-encoded data.  
  - **Executor:** Use **`address(0)`** in the EVVM message.  
  - **Nonce:** Use **getNextCurrentSyncNonce(user)** and **isAsyncExec: false**; pass the same from frontend to relayer.

### 5.2 “IP registry not set” (Contract Revert)

- **Cause:** Your contract’s IP Asset Registry (or similar) was never set (`address(0)`).
- **Fix:** Set **IP Asset Registry** (and License/Royalty if needed) in the deploy script or via `setIPAssetRegistry(...)` after deploy so the contract never reads a zero address.

### 5.3 User Has No EVVM Internal Balance

- **Cause:** User clicked “Pay via x402” without having deposited USDC.k into the EVVM Treasury.
- **Fix:** In the UI, add a clear “Fund EVVM” flow: (1) Approve USDC.k for EVVM Treasury, (2) Deposit USDC.k. Only then is “Pay via x402” valid.

### 5.4 UI Stuck on “1. Approve” After User Approved

- **Cause:** Allowance was read once and not refetched after the approve tx confirmed.
- **Fix:** Use the approve/deposit tx hash with **useWaitForTransactionReceipt**; when `isSuccess`, call **refetch** on the allowance (and balance) read so the section updates to “2. Deposit” without a page refresh.

### 5.5 Relayer 500 / “EVVM payment failed”

- **Cause:** Same as 5.1 (wrong hash, executor, or nonce) or relayer not passing `isAsyncExec` from the request to the adapter.
- **Fix:** Ensure relayer forwards **evvmIsAsyncExec** from the frontend payload to the adapter and uses the same nonce; apply the same EVVM payload/nonce/executor fixes as in the frontend.

### 5.6 Replacement Transaction Underpriced (Foundry / cast)

- **Cause:** A replacement tx was sent with the same or lower gas price than the pending one.
- **Fix:** Use a **higher gas price** (e.g. 20 gwei) for the replacement, and ensure the private key is **quoted** in the shell when using `cast send`.

### 5.7 Fly.io “Name blocked by abuse filter”

- **Cause:** App name contained a blocked word (e.g. “verify”).
- **Fix:** Use a different app name (e.g. `krump-x402-relayer`).

---

## 6. Checklist for a New App

- [ ] Contract: RECEIPT_SUBMITTER_ROLE and submitPaymentReceipt; use receipts in your main logic.
- [ ] Contract: If using Story Protocol, set IP Asset Registry (and related) at deploy or right after.
- [ ] Frontend: Fund EVVM (approve + deposit); refetch allowance after approve so the UI updates.
- [ ] Frontend: x402 EIP-712 with domain = adapter; EVVM hash with **"pay"** + (to, '', token, amount, 0n); executor **0x0**; sync nonce from getNextCurrentSyncNonce; isAsyncExec false.
- [ ] Relayer: Same nonce and isAsyncExec as frontend; RELAYER_PRIVATE_KEY for an address with RECEIPT_SUBMITTER_ROLE.
- [ ] Deploy: One script with 10 gwei; set relayer role; then deploy relayer (e.g. Fly.io) with secrets and point frontend at relayer URL.

---

## 7. References

- **Story Aeneid:** https://docs.story.foundation/developers/deployed-smart-contracts  
- **EVVM / evvm-js:** Hash payload and pay() ABI; use sync nonce and executor `address(0)` for the Native x402 adapter.  
- **USDC Krump / EVVMNativeX402Adapter:** Reference for adapter interface and how it calls Core.pay (executor, etc.).  
- **This repo:** `frontend/src/VerifyForm.tsx` (Fund EVVM, x402 + EVVM sign, relayer POST), `frontend/src/contracts.ts` (addresses, ABIs, domain), `relayer/server.js` (adapter + submitPaymentReceipt), `script/DeployAll.s.sol` (deploy + Story registries + role).

Credits: StreetKode Fam — Asura, Hectik, Kronos, Jo.
