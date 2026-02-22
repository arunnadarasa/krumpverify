import { useState, useEffect } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import {
  KRUMP_VERIFY_NFT_ADDRESS,
  EXPLORER_URL,
  krumpVerifyNftAbi,
} from './contracts'

export function MintNFTForm({
  onMintSuccess,
}: {
  onMintSuccess: (contract: string, tokenId: string) => void
}) {
  const { address, chain } = useAccount()
  const [mintTxHash, setMintTxHash] = useState<`0x${string}` | null>(null)
  const [mintedTokenId, setMintedTokenId] = useState<string | null>(null)
  const [pendingTokenId, setPendingTokenId] = useState<bigint | null>(null)

  const { data: nextId = 0n } = useReadContract({
    address: KRUMP_VERIFY_NFT_ADDRESS,
    abi: krumpVerifyNftAbi,
    functionName: 'nextTokenId',
  })

  const {
    writeContract: writeMint,
    data: mintHash,
    isPending: mintPending,
    error: mintError,
  } = useWriteContract()

  const { data: mintReceipt, isLoading: mintConfirming } =
    useWaitForTransactionReceipt({ hash: mintHash })

  useEffect(() => {
    if (mintHash) setMintTxHash(mintHash)
  }, [mintHash])

  useEffect(() => {
    if (mintReceipt?.status === 'success' && pendingTokenId !== null) {
      setMintedTokenId(String(pendingTokenId))
      setPendingTokenId(null)
    }
  }, [mintReceipt?.status, pendingTokenId])

  const handleMint = async () => {
    if (!address) return
    setPendingTokenId(nextId)
    try {
      await writeMint({
        address: KRUMP_VERIFY_NFT_ADDRESS,
        abi: krumpVerifyNftAbi,
        functionName: 'mint',
      })
    } catch {
      setPendingTokenId(null)
    }
  }

  const handleRegisterAsIP = () => {
    if (mintedTokenId !== null) {
      onMintSuccess(KRUMP_VERIFY_NFT_ADDRESS, mintedTokenId)
    }
  }

  const wrongChain = chain && chain.id !== 1315
  const canMint = address && !wrongChain

  return (
    <div className="max-w-lg mx-auto mt-8 p-6 rounded-2xl bg-white/5 border border-white/10 shadow-xl">
      <h2 className="text-xl font-semibold text-amber-400/90 mb-4">Mint my IP NFT</h2>
      {wrongChain && (
        <p className="text-amber-300/90 text-sm mb-4">
          Switch to Story Aeneid (chain 1315) in your wallet.
        </p>
      )}
      <p className="text-gray-400 text-sm mb-4">
        Mint an NFT from the &quot;Krump Verify&quot; collection. Then register it as an IP on Story to get an IP ID for verifying moves.
      </p>
      <div className="space-y-4">
        <button
          type="button"
          onClick={handleMint}
          disabled={!canMint || mintPending || mintConfirming}
          className="w-full px-4 py-2.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {mintPending || mintConfirming ? 'Minting…' : 'Mint my IP NFT'}
        </button>
        {mintError && (
          <p className="text-red-400/90 text-sm">{String(mintError.message)}</p>
        )}
        {mintedTokenId !== null && (
          <div className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
            <p className="text-sm text-gray-400 mb-1">Minted token #{mintedTokenId}</p>
            <p className="font-mono text-xs text-gray-500 break-all mb-3">{KRUMP_VERIFY_NFT_ADDRESS}</p>
            <button
              type="button"
              onClick={handleRegisterAsIP}
              className="px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 transition"
            >
              Register as IP →
            </button>
          </div>
        )}
        {mintTxHash && (
          <p className="text-sm text-gray-400">
            Transaction:{' '}
            <a
              href={`${EXPLORER_URL}/tx/${mintTxHash}`}
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
