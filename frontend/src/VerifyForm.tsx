import { useState, useEffect, useCallback } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient, useWalletClient } from 'wagmi'
import { keccak256, toHex, encodeAbiParameters } from 'viem'
import {
  KRUMP_VERIFY_ADDRESS,
  EXPLORER_URL,
  LICENSE_REGISTRY_ADDRESS,
  EVVM_X402_ADAPTER_ADDRESS,
  EVVM_CORE_ADDRESS,
  EVVM_ID,
  USDC_K_ADDRESS,
  EVVM_TREASURY_ADDRESS,
  X402_PAYMENT_RECIPIENT,
  X402_DOMAIN,
  X402_TRANSFER_WITH_AUTH_TYPE,
  evvmCoreAbi,
  evvmTreasuryAbi,
  erc20Abi,
  krumpVerifyAbi,
  licenseRegistryAbi,
} from './contracts'

type ReceiptOption = { receiptId: `0x${string}`; amount: bigint }

const USDC_DECIMALS = 6

/** Generate a random bytes32 for x402 nonce or receipt ID */
function randomBytes32(): `0x${string}` {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return keccak256(toHex(bytes)) as `0x${string}`
}

export function VerifyForm({ initialIpId }: { initialIpId?: string }) {
  const { address, chain } = useAccount()
  const { data: walletClient } = useWalletClient()
  const [ipId, setIpId] = useState('')
  const [moveData, setMoveData] = useState('')
  const [proof, setProof] = useState('')
  const [paymentReceiptId, setPaymentReceiptId] = useState('')
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null)
  const [availableReceipts, setAvailableReceipts] = useState<ReceiptOption[]>([])
  const [receiptsLoading, setReceiptsLoading] = useState(false)
  const [receiptsError, setReceiptsError] = useState<string | null>(null)
  const [receiptsFetched, setReceiptsFetched] = useState(false)
  const [x402Pending, setX402Pending] = useState(false)
  const [x402Error, setX402Error] = useState<string | null>(null)
  const [x402Success, setX402Success] = useState<string | null>(null)

  const publicClient = usePublicClient()
  const relayerUrl = import.meta.env.VITE_X402_RELAYER_URL as string | undefined

  const fetchMyReceipts = useCallback(async () => {
    if (!address || !publicClient) return
    setReceiptsLoading(true)
    setReceiptsError(null)
    try {
      const logs = await publicClient.getContractEvents({
        address: KRUMP_VERIFY_ADDRESS,
        abi: krumpVerifyAbi,
        eventName: 'PaymentReceiptSubmitted',
        args: { payer: address },
      })
      const unused: ReceiptOption[] = []
      for (const log of logs) {
        if (log.args.receiptId == null || log.args.amount == null) continue
        const [,, used] = await publicClient.readContract({
          address: KRUMP_VERIFY_ADDRESS,
          abi: krumpVerifyAbi,
          functionName: 'paymentReceipts',
          args: [log.args.receiptId],
        })
        if (!used) unused.push({ receiptId: log.args.receiptId, amount: log.args.amount })
      }
      setAvailableReceipts(unused)
      if (unused.length === 1) setPaymentReceiptId(unused[0].receiptId)
    } catch (e) {
      console.error('Fetch receipts failed', e)
      setReceiptsError(e instanceof Error ? e.message : String(e))
      setAvailableReceipts([])
    } finally {
      setReceiptsLoading(false)
      setReceiptsFetched(true)
    }
  }, [address, publicClient])

  useEffect(() => {
    if (initialIpId && /^0x[a-f0-9]{40}$/.test(initialIpId.trim().toLowerCase())) {
      setIpId(initialIpId.trim().toLowerCase())
    }
  }, [initialIpId])

  const { data: verificationFee = BigInt(1e6) } = useReadContract({
    address: KRUMP_VERIFY_ADDRESS,
    abi: krumpVerifyAbi,
    functionName: 'verificationFee',
  })

  const depositAmount = verificationFee ?? BigInt(1e6)
  const { data: usdcAllowance, refetch: refetchUsdcAllowance } = useReadContract({
    address: USDC_K_ADDRESS,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address && X402_PAYMENT_RECIPIENT ? [address, EVVM_TREASURY_ADDRESS] : undefined,
  })
  const { data: usdcBalance, refetch: refetchUsdcBalance } = useReadContract({
    address: USDC_K_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  })
  const hasEnoughAllowance = usdcAllowance !== undefined && usdcAllowance >= depositAmount
  const hasEnoughBalance = usdcBalance !== undefined && usdcBalance >= depositAmount

  const { writeContract: writeEvvmFund, data: evvmFundTxHash, isPending: evvmFundPending } = useWriteContract()
  const { isSuccess: evvmFundTxConfirmed } = useWaitForTransactionReceipt({ hash: evvmFundTxHash })

  // Auto-refresh Fund EVVM section when approve or deposit tx confirms so UI moves from step 1 → 2 without page refresh
  useEffect(() => {
    if (evvmFundTxConfirmed) {
      refetchUsdcAllowance()
      refetchUsdcBalance()
    }
  }, [evvmFundTxConfirmed, refetchUsdcAllowance, refetchUsdcBalance])

  const {
    writeContract: writeVerify,
    data: verifyHash,
    isPending: verifyPending,
    error: verifyError,
  } = useWriteContract()

  const { isLoading: verifyConfirming } =
    useWaitForTransactionReceipt({ hash: verifyHash })

  const moveDataHash = moveData
    ? (keccak256(toHex(moveData)) as `0x${string}`)
    : undefined

  // IP ID is Story IP account address (0x + 40 hex)
  const ipIdTrimmed = ipId.trim().toLowerCase()
  const ipIdValid = /^0x[a-f0-9]{40}$/.test(ipIdTrimmed)
  const ipIdAddress = ipIdValid ? (ipIdTrimmed as `0x${string}`) : undefined

  const { data: attachedLicenseCount } = useReadContract({
    address: LICENSE_REGISTRY_ADDRESS,
    abi: licenseRegistryAbi,
    functionName: 'getAttachedLicenseTermsCount',
    args: ipIdAddress ? [ipIdAddress] : undefined,
  })

  // Payment receipt ID (bytes32 = 0x + 64 hex). Required — verify only via verifyMoveWithReceipt.
  const receiptIdTrimmed = paymentReceiptId.trim().toLowerCase()
  const receiptIdValid = /^0x[a-f0-9]{64}$/.test(receiptIdTrimmed)
  const receiptIdBytes32 = receiptIdValid ? (receiptIdTrimmed as `0x${string}`) : undefined

  const runVerifyWithReceipt = async () => {
    if (!address || !moveDataHash || !ipIdValid || !ipIdAddress || !receiptIdBytes32) return
    const proofBytes = proof ? (toHex(new TextEncoder().encode(proof)) as `0x${string}`) : '0x'
    try {
      await writeVerify({
        address: KRUMP_VERIFY_ADDRESS,
        abi: krumpVerifyAbi,
        functionName: 'verifyMoveWithReceipt',
        args: [ipIdAddress, moveDataHash, proofBytes, receiptIdBytes32],
      })
    } catch (e) {
      console.error(e)
    }
  }

  const payViaX402 = useCallback(async () => {
    if (!address || !walletClient || !verificationFee) return
    setX402Pending(true)
    setX402Error(null)
    setX402Success(null)
    try {
      const receiptIdBytes32 = randomBytes32()
      const receiptIdString = receiptIdBytes32
      const nonce = randomBytes32()
      const validAfter = 0n
      const validBefore = BigInt(Math.floor(Date.now() / 1000) + 3600)
      const message = {
        from: address,
        to: EVVM_X402_ADAPTER_ADDRESS,
        amount: verificationFee,
        validAfter,
        validBefore,
        nonce,
      }
      const signature = await walletClient.signTypedData({
        domain: X402_DOMAIN,
        types: X402_TRANSFER_WITH_AUTH_TYPE,
        primaryType: 'TransferWithAuthorization',
        message,
      })
      const r = (`0x${signature.slice(2, 66)}`) as `0x${string}`
      const s = (`0x${signature.slice(66, 130)}`) as `0x${string}`
      const v = parseInt(signature.slice(130), 16) as number
      const payload: Record<string, unknown> = {
        receiptId: receiptIdBytes32,
        receiptIdString,
        from: address,
        amount: verificationFee.toString(),
        validAfter: validAfter.toString(),
        validBefore: validBefore.toString(),
        nonce,
        v,
        r,
        s,
      }
      // Full x402+EVVM: when payment recipient is set, request EVVM personal_sign so relayer can call the adapter (real USDC.k pull).
      if (X402_PAYMENT_RECIPIENT && X402_PAYMENT_RECIPIENT.length === 42 && publicClient) {
        // Use Core's next sync nonce so the signed payload matches what Core expects (avoids InvalidSignature / async reservation issues).
        const evvmNonce = await publicClient.readContract({
          address: EVVM_CORE_ADDRESS,
          abi: evvmCoreAbi,
          functionName: 'getNextCurrentSyncNonce',
          args: [address],
        })
        const isAsyncExec = false
        // Match evvm-js BaseService.buildHashPayload: function name "pay" then (to_address, to_identity, token, amount, priorityFee) per Core pay() ABI order
        const hashPayload = keccak256(
          encodeAbiParameters(
            [
              { type: 'string' },
              { type: 'address' },
              { type: 'string' },
              { type: 'address' },
              { type: 'uint256' },
              { type: 'uint256' },
            ],
            ['pay', X402_PAYMENT_RECIPIENT, '', USDC_K_ADDRESS, verificationFee, 0n]
          )
        )
        // Executor must match adapter: EVVMNativeX402Adapter passes address(0) to Core.pay() (see USDC Krump lz-bridge/contracts/EVVMNativeX402Adapter.sol)
        const evvmMessage = [
          String(EVVM_ID),
          EVVM_CORE_ADDRESS.toLowerCase(),
          hashPayload.toLowerCase(),
          '0x0000000000000000000000000000000000000000',
          String(evvmNonce),
          String(isAsyncExec),
        ].join(',')
        const evvmSignature = await walletClient.signMessage({ message: evvmMessage })
        payload.to = X402_PAYMENT_RECIPIENT
        payload.evvmNonce = evvmNonce.toString()
        payload.evvmSignature = evvmSignature
        payload.evvmIsAsyncExec = isAsyncExec
      }
      if (relayerUrl) {
        const res = await fetch(relayerUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const err = await res.text()
          throw new Error(err || `Relayer ${res.status}`)
        }
        setX402Success(receiptIdBytes32)
        setPaymentReceiptId(receiptIdBytes32)
        fetchMyReceipts()
        // Auto-verify: no need to load or paste receipt — trigger verify with this receipt if form is valid
        const ipIdTrimmed = ipId.trim().toLowerCase()
        const ipIdValidHere = /^0x[a-f0-9]{40}$/.test(ipIdTrimmed)
        const ipIdAddressHere = ipIdValidHere ? (ipIdTrimmed as `0x${string}`) : undefined
        const moveDataHashHere = moveData ? (keccak256(toHex(moveData)) as `0x${string}`) : undefined
        const proofBytesHere = proof ? (toHex(new TextEncoder().encode(proof)) as `0x${string}`) : '0x'
        if (ipIdAddressHere && moveDataHashHere) {
          writeVerify({
            address: KRUMP_VERIFY_ADDRESS,
            abi: krumpVerifyAbi,
            functionName: 'verifyMoveWithReceipt',
            args: [ipIdAddressHere, moveDataHashHere, proofBytesHere, receiptIdBytes32],
          })
        }
      } else {
        setX402Success(receiptIdBytes32)
        setX402Error('No relayer configured. Set VITE_X402_RELAYER_URL. You signed the x402 auth; send the payload to your relayer to call the adapter and submitPaymentReceipt, then Load my receipts.')
      }
    } catch (e) {
      setX402Error(e instanceof Error ? e.message : String(e))
    } finally {
      setX402Pending(false)
    }
  }, [address, walletClient, verificationFee, relayerUrl, fetchMyReceipts, ipId, moveData, proof, writeVerify])

  useEffect(() => {
    if (verifyHash) {
      setTxHash(verifyHash)
      fetchMyReceipts()
    }
  }, [verifyHash, fetchMyReceipts])

  useEffect(() => {
    setReceiptsFetched(false)
    setReceiptsError(null)
    setAvailableReceipts([])
  }, [address])

  // Auto-fetch receipts for connected user when on correct chain
  useEffect(() => {
    if (address && publicClient && chain?.id === 1315) fetchMyReceipts()
  }, [address, publicClient, chain?.id, fetchMyReceipts])

  const wrongChain = chain && chain.id !== 1315
  const canSubmit = address && !wrongChain && ipIdValid && moveData && !!receiptIdBytes32

  return (
    <div className="max-w-lg mx-auto mt-8 p-6 rounded-2xl bg-white/5 border border-white/10 shadow-xl">
      <h2 className="text-xl font-semibold text-amber-400/90 mb-4">Verify a move</h2>
      {wrongChain && (
        <p className="text-amber-300/90 text-sm mb-4">
          Switch to Story Aeneid (chain 1315) in your wallet.
        </p>
      )}
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">IP ID</label>
          <input
            type="text"
            value={ipId}
            onChange={(e) => setIpId(e.target.value)}
            placeholder="e.g. 0x1234... (IP account address)"
            className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white placeholder-gray-500 focus:border-amber-500/50 focus:outline-none"
          />
          {ipIdTrimmed !== '' && !ipIdValid && (
            <p className="mt-1 text-sm text-amber-300/90">IP ID must be a valid address (0x + 40 hex)</p>
          )}
          {ipIdValid && (
            <div className="mt-2 p-2 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-400 space-y-1">
              <p>
                License: {attachedLicenseCount !== undefined
                  ? Number(attachedLicenseCount) > 0
                    ? `${attachedLicenseCount} term(s) attached`
                    : 'Not set'
                  : '…'}
              </p>
              <p>
                <a
                  href={`${EXPLORER_URL}/address/${ipIdTrimmed}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-400 hover:underline"
                >
                  View IPA on explorer
                </a>
                {' — creator & full details'}
              </p>
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Move data (hashed on-chain)</label>
          <textarea
            value={moveData}
            onChange={(e) => setMoveData(e.target.value)}
            placeholder="Description or ID of the move"
            rows={2}
            className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white placeholder-gray-500 focus:border-amber-500/50 focus:outline-none resize-none"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Proof (optional, hex or text)</label>
          <input
            type="text"
            value={proof}
            onChange={(e) => setProof(e.target.value)}
            placeholder="Optional"
            className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white placeholder-gray-500 focus:border-amber-500/50 focus:outline-none"
          />
        </div>
        {X402_PAYMENT_RECIPIENT && X402_PAYMENT_RECIPIENT.length === 42 && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <p className="text-sm text-amber-200/90 mb-2">
              x402 payment uses your <strong>EVVM internal balance</strong>. Deposit USDC.k once so &quot;Pay via x402&quot; works.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {!hasEnoughAllowance && (
                <button
                  type="button"
                  onClick={() => writeEvvmFund({ address: USDC_K_ADDRESS, abi: erc20Abi, functionName: 'approve', args: [EVVM_TREASURY_ADDRESS, depositAmount] })}
                  disabled={!address || wrongChain || evvmFundPending || !hasEnoughBalance}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30 disabled:opacity-50 text-sm"
                >
                  {evvmFundPending ? 'Confirm in wallet…' : '1. Approve USDC.k for EVVM'}
                </button>
              )}
              {hasEnoughAllowance && (
                <button
                  type="button"
                  onClick={() => writeEvvmFund({ address: EVVM_TREASURY_ADDRESS, abi: evvmTreasuryAbi, functionName: 'deposit', args: [USDC_K_ADDRESS, depositAmount] })}
                  disabled={!address || wrongChain || evvmFundPending || !hasEnoughBalance}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 disabled:opacity-50 text-sm"
                >
                  {evvmFundPending ? 'Confirm in wallet…' : '2. Deposit 1 USDC.k to EVVM'}
                </button>
              )}
            </div>
            {usdcBalance !== undefined && !hasEnoughBalance && (
              <p className="text-sm text-amber-300/90 mt-2">Not enough USDC.k in wallet. Get testnet USDC.k first.</p>
            )}
          </div>
        )}
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-sm text-gray-400">Payment receipt (required):</span>
            <button
              type="button"
              onClick={payViaX402}
              disabled={!address || wrongChain || x402Pending || !verificationFee}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm"
            >
              {x402Pending ? 'Signing…' : `Pay ${Number(verificationFee) / 10 ** USDC_DECIMALS} USDC.k via x402`}
            </button>
            {x402Success && (
              <span className="text-sm text-emerald-400">Signed. Receipt ID: {x402Success.slice(0, 10)}…</span>
            )}
          </div>
          {x402Error && (
            <p className="text-sm text-amber-300/90 mb-2">{x402Error}</p>
          )}
          <label className="block text-sm text-gray-400 mb-1">Receipt ID (paste or load below)</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={paymentReceiptId}
              onChange={(e) => setPaymentReceiptId(e.target.value)}
              placeholder="0x… or pick below"
              className="flex-1 px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white placeholder-gray-500 focus:border-amber-500/50 focus:outline-none"
            />
            <button
              type="button"
              onClick={fetchMyReceipts}
              disabled={!address || wrongChain || receiptsLoading}
              className="px-3 py-2 rounded-lg bg-white/10 text-gray-300 border border-white/10 hover:bg-white/15 disabled:opacity-50 disabled:cursor-not-allowed transition whitespace-nowrap"
            >
              {receiptsLoading ? 'Loading…' : 'Load my receipts'}
            </button>
          </div>
          {receiptsFetched && !receiptsLoading && availableReceipts.length === 0 && !receiptsError && (
            <p className="mt-2 text-sm text-amber-300/90">No receipts found. Fill IP ID and move data, then use &quot;Pay via x402 & verify&quot; — the receipt is used automatically. Or pay via x402 and have the relayer submit a receipt, then load or paste the receipt ID above.</p>
          )}
          {receiptsError && (
            <p className="mt-2 text-sm text-red-400">Couldn&apos;t load receipts. Try using one wallet extension, or check the console.</p>
          )}
          {availableReceipts.length > 0 && (
            <select
              className="mt-2 w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white focus:border-amber-500/50 focus:outline-none"
              value={paymentReceiptId}
              onChange={(e) => setPaymentReceiptId(e.target.value as `0x${string}`)}
            >
              <option value="">Choose a receipt…</option>
              {availableReceipts.map((r) => (
                <option key={r.receiptId} value={r.receiptId}>
                  {r.receiptId.slice(0, 10)}… — {Number(r.amount) / 10 ** USDC_DECIMALS} USDC.k
                </option>
              ))}
            </select>
          )}
          {paymentReceiptId.trim() !== '' && !receiptIdValid && (
            <p className="mt-1 text-sm text-amber-300/90">Receipt ID must be 0x followed by 64 hex characters</p>
          )}
        </div>
        <p className="text-sm text-gray-500">
          Fee: {Number(verificationFee) / 10 ** USDC_DECIMALS} USDC.k (paid via x402 receipt — no on-chain approve).
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={runVerifyWithReceipt}
            disabled={!canSubmit || verifyPending || verifyConfirming}
            className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {verifyPending || verifyConfirming ? 'Verifying…' : 'Verify with receipt'}
          </button>
        </div>
        {verifyError && (
          <div className="space-y-1">
            <p className="text-red-400/90 text-sm">{String(verifyError.message)}</p>
            <p className="text-xs text-gray-500">
              If the revert reason is unclear: ensure you’re on Story Aeneid (1315), the IP ID is registered, and the receipt is for this wallet and not already used.
            </p>
          </div>
        )}
        {txHash && (
          <p className="text-sm text-gray-400">
            Transaction:{' '}
            <a
              href={`${EXPLORER_URL}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400 hover:underline"
            >
              View on explorer
            </a>
          </p>
        )}
      </div>
    </div>
  )
}
