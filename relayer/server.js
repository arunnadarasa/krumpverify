import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createWalletClient, createPublicClient, http, parseAbi, keccak256, toBytes } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

// keccak256("RECEIPT_SUBMITTER_ROLE") — same as Solidity constant; avoid contract read (can revert on some RPCs)
const RECEIPT_SUBMITTER_ROLE = keccak256(toBytes('RECEIPT_SUBMITTER_ROLE'))

const app = express()
app.use(cors({ origin: true }))
app.use(express.json())

const PORT = Number(process.env.PORT) || 7350
const RPC_URL = process.env.RPC_URL || 'https://aeneid.storyrpc.io'
const KRUMP_VERIFY_ADDRESS = (process.env.KRUMP_VERIFY_ADDRESS || '0x41CE400d0C0f8d5c38BDf68970981b359cB5bb4A')
const EVVM_X402_ADAPTER_ADDRESS = (process.env.EVVM_X402_ADAPTER_ADDRESS || '0xDf5eaED856c2f8f6930d5F3A5BCE5b5d7E4C73cc')
// Normalize private key: trim whitespace/newlines, ensure 0x prefix (viem/noble expect Hex)
const rawKey = process.env.RELAYER_PRIVATE_KEY
const RELAYER_PRIVATE_KEY = (() => {
  if (!rawKey || typeof rawKey !== 'string') return undefined
  const trimmed = rawKey.trim()
  if (!trimmed) return undefined
  return trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`
})()

const krumpVerifyAbi = parseAbi([
  'function submitPaymentReceipt(bytes32 receiptId, address payer, uint256 amount) external',
  'function verificationFee() view returns (uint256)',
  'function hasRole(bytes32 role, address account) view returns (bool)',
])

const evvmAdapterAbi = parseAbi([
  'function payViaEVVMWithX402(address from, address to, string toIdentity, uint256 amount, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s, string receiptId, uint256 evvmNonce, bool isAsyncExec, bytes evvmSignature) external',
])

const chain = {
  id: 1315,
  name: 'Story Aeneid',
  nativeCurrency: { name: 'IP', symbol: 'IP', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
}
const transport = http(RPC_URL)
const publicClient = createPublicClient({ chain, transport })

let walletClient = null
if (RELAYER_PRIVATE_KEY) {
  const account = privateKeyToAccount(RELAYER_PRIVATE_KEY)
  walletClient = createWalletClient({ account, chain, transport })
}

app.post('/x402/pay', async (req, res) => {
  try {
    const {
      receiptId,
      receiptIdString,
      from,
      amount,
      validAfter,
      validBefore,
      nonce,
      v,
      r,
      s,
      to: paymentTo,
      evvmNonce,
      evvmSignature,
      evvmIsAsyncExec,
    } = req.body
    if (!receiptId || !from || amount === undefined) {
      return res.status(400).json({ error: 'Missing receiptId, from, or amount' })
    }
    if (!/^0x[a-fA-F0-9]{64}$/.test(receiptId)) {
      return res.status(400).json({ error: 'Invalid receiptId (expect 0x + 64 hex)' })
    }

    const fee = await publicClient.readContract({
      address: KRUMP_VERIFY_ADDRESS,
      abi: krumpVerifyAbi,
      functionName: 'verificationFee',
    })
    const amountBig = BigInt(amount)
    if (amountBig < fee) {
      return res.status(400).json({ error: `Amount ${amount} below verificationFee ${fee}` })
    }

    if (!walletClient) {
      return res.status(503).json({
        error: 'Relayer not configured: set RELAYER_PRIVATE_KEY. This relayer only submits receipts (test mode); for real USDC pull set VITE_X402_PAYMENT_RECIPIENT in frontend so it sends evvmSignature and relayer will call the EVVM adapter.',
      })
    }

    const relayerAddress = walletClient.account.address
    const useAdapter =
      paymentTo &&
      /^0x[a-fA-F0-9]{40}$/.test(String(paymentTo)) &&
      evvmNonce !== undefined &&
      evvmSignature &&
      typeof evvmSignature === 'string' &&
      validAfter !== undefined &&
      validBefore !== undefined &&
      nonce &&
      v !== undefined &&
      r &&
      s &&
      (receiptIdString || receiptId)

    if (useAdapter) {
      const toIdentity = ''
      const validAfterBig = BigInt(validAfter)
      const validBeforeBig = BigInt(validBefore)
      const evvmNonceBig = BigInt(evvmNonce)
      const isAsyncExec = evvmIsAsyncExec !== undefined ? Boolean(evvmIsAsyncExec) : true
      const receiptIdStr = typeof receiptIdString === 'string' ? receiptIdString : receiptId
      const evvmSigHex = evvmSignature.startsWith('0x') ? evvmSignature : `0x${evvmSignature}`
      let simulateError = null
      try {
        await publicClient.simulateContract({
          address: EVVM_X402_ADAPTER_ADDRESS,
          abi: evvmAdapterAbi,
          functionName: 'payViaEVVMWithX402',
          args: [from, paymentTo, toIdentity, amountBig, validAfterBig, validBeforeBig, nonce, Number(v), r, s, receiptIdStr, evvmNonceBig, isAsyncExec, evvmSigHex],
          account: walletClient.account,
        })
      } catch (simErr) {
        simulateError = simErr
        const revMsg = simErr.shortMessage || simErr.message || String(simErr)
        const revData = simErr.data || (simErr.cause && simErr.cause.data) || (simErr.cause && simErr.cause.message) || ''
      }
      if (simulateError) throw simulateError
      const hashAdapter = await walletClient.writeContract({
        address: EVVM_X402_ADAPTER_ADDRESS,
        abi: evvmAdapterAbi,
        functionName: 'payViaEVVMWithX402',
        args: [
          from,
          paymentTo,
          toIdentity,
          amountBig,
          validAfterBig,
          validBeforeBig,
          nonce,
          Number(v),
          r,
          s,
          receiptIdStr,
          evvmNonceBig,
          isAsyncExec,
          evvmSigHex,
        ],
      })
      const recAdapter = await publicClient.waitForTransactionReceipt({ hash: hashAdapter })
      if (recAdapter.status !== 'success') {
        return res.status(502).json({ error: 'EVVM adapter tx reverted', txHash: hashAdapter })
      }
    }

    const hasRole = await publicClient.readContract({
      address: KRUMP_VERIFY_ADDRESS,
      abi: krumpVerifyAbi,
      functionName: 'hasRole',
      args: [RECEIPT_SUBMITTER_ROLE, relayerAddress],
    })
    if (!hasRole) {
      return res.status(403).json({
        error: `Relayer address ${relayerAddress} does not have RECEIPT_SUBMITTER_ROLE on KrumpVerify. Grant the role (e.g. as deployer: grantRole(RECEIPT_SUBMITTER_ROLE, "${relayerAddress}")) or use the deployer wallet as RELAYER_PRIVATE_KEY.`,
      })
    }

    const hash = await walletClient.writeContract({
      address: KRUMP_VERIFY_ADDRESS,
      abi: krumpVerifyAbi,
      functionName: 'submitPaymentReceipt',
      args: [receiptId, from, amountBig],
    })
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    if (receipt.status !== 'success') {
      return res.status(502).json({ error: 'Transaction reverted', txHash: hash })
    }
    res.json({
      ok: true,
      receiptId,
      txHash: hash,
      adapterUsed: useAdapter,
    })
  } catch (e) {
    console.error('/x402/pay', e)
    const msg = e.shortMessage || e.message || String(e)
    const hint = e.details ? ` (${e.details})` : (e.cause?.message ? ` (${e.cause.message})` : '')
    res.status(500).json({ error: msg + hint })
  }
})

app.get('/health', (_, res) => res.json({ ok: true }))

app.listen(PORT, () => {
  console.log(
    `x402 relayer on http://localhost:${PORT} (RELAYER_PRIVATE_KEY=${RELAYER_PRIVATE_KEY ? 'set' : 'not set'}; calls EVVM adapter when frontend sends evvmSignature + to)`
  )
})
