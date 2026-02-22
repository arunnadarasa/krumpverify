import { useState, useEffect, useRef } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi'
import {
  IP_ASSET_REGISTRY_ADDRESS,
  EXPLORER_URL,
  KRUMP_VERIFY_NFT_ADDRESS,
  ipAssetRegistryAbi,
  erc20Abi,
  krumpVerifyNftAbi,
  LICENSING_MODULE_ADDRESS,
  PIL_TEMPLATE_ADDRESS,
  LICENSE_TERMS_IDS,
  licensingModuleAbi,
  CORE_METADATA_MODULE_ADDRESS,
  coreMetadataModuleAbi,
  ROYALTY_POLICY_LAP_ADDRESS,
  PIL_CURRENCY_ADDRESS,
  pilTemplateAbi,
  type PILTermsTuple,
} from './contracts'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as `0x${string}`

function buildPilTermsForAttach(licenseType: 'commercial-use' | 'commercial-remix', revenueSharePercent: number): PILTermsTuple {
  const revShareScaled = Math.min(100, Math.max(0, revenueSharePercent)) * 1e6
  const commercialUse = true
  const commercialAttribution = true
  const currency = PIL_CURRENCY_ADDRESS
  const royaltyPolicy = ROYALTY_POLICY_LAP_ADDRESS
  const mintingFee = 0n
  const expiration = 0n
  const commercialRevCelling = 0n
  const derivativeRevCelling = 0n
  if (licenseType === 'commercial-use') {
    return [
      true, royaltyPolicy, mintingFee, expiration,
      commercialUse, commercialAttribution, ZERO_ADDRESS, '0x' as `0x${string}`,
      0, commercialRevCelling,
      false, false, false, false, derivativeRevCelling,
      currency, '',
    ]
  }
  return [
    true, royaltyPolicy, mintingFee, expiration,
    commercialUse, commercialAttribution, ZERO_ADDRESS, '0x' as `0x${string}`,
    revShareScaled, commercialRevCelling,
    true, true, false, true, derivativeRevCelling,
    currency, '',
  ]
}
import { hasPinataJwt } from './pinata'
import { uploadIpMetadata } from './uploadMetadata'

export type LicenseType =
  | 'none'
  | 'non-commercial-social-remixing'
  | 'commercial-use'
  | 'commercial-remix'
  | 'cc-attribution'

const LICENSE_OPTIONS: { value: LicenseType; label: string; termId: bigint | null }[] = [
  { value: 'non-commercial-social-remixing', label: 'Non-Commercial Social Remixing', termId: LICENSE_TERMS_IDS.nonCommercialSocialRemixing },
  { value: 'commercial-use', label: 'Commercial Use', termId: LICENSE_TERMS_IDS.commercialUse },
  { value: 'commercial-remix', label: 'Commercial Remix (revenue share)', termId: LICENSE_TERMS_IDS.commercialRemix },
  { value: 'cc-attribution', label: 'Creative Commons Attribution', termId: LICENSE_TERMS_IDS.ccAttribution },
  { value: 'none', label: 'Skip (no license terms)', termId: null },
]

function getLicenseTermId(licenseType: LicenseType): bigint | null {
  const opt = LICENSE_OPTIONS.find((o) => o.value === licenseType)
  return opt?.termId ?? null
}

export function RegisterIPForm({
  onRegisterSuccess,
  initialNft,
}: {
  onRegisterSuccess?: (ipId: string) => void
  initialNft?: { contract: string; tokenId: string }
}) {
  const { address, chain } = useAccount()
  const [chainId, setChainId] = useState('1315')
  const [tokenContract, setTokenContract] = useState('')
  const [tokenId, setTokenId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [licenseType, setLicenseType] = useState<LicenseType>('non-commercial-social-remixing')
  const [revenueSharePercent, setRevenueSharePercent] = useState(10)
  const [registeredIpId, setRegisteredIpId] = useState<string | null>(null)
  const [registerTxHash, setRegisterTxHash] = useState<`0x${string}` | null>(null)
  const [metadataUploading, setMetadataUploading] = useState(false)
  const [metadataError, setMetadataError] = useState<string | null>(null)
  const [ipMetadataURI, setIpMetadataURI] = useState<string | null>(null)
  const [ipMetadataHash, setIpMetadataHash] = useState<`0x${string}` | null>(null)
  const [nftMetadataURI, setNftMetadataURI] = useState<string | null>(null)
  const [existingIpId, setExistingIpId] = useState('')
  const [updateExistingUploading, setUpdateExistingUploading] = useState(false)
  const [updateExistingError, setUpdateExistingError] = useState<string | null>(null)
  const [attachExistingIpId, setAttachExistingIpId] = useState('')
  const [attachExistingLicenseType, setAttachExistingLicenseType] = useState<LicenseType>('non-commercial-social-remixing')
  const [attachExistingRevenueSharePercent, setAttachExistingRevenueSharePercent] = useState(10)
  const attachTriggeredRef = useRef(false)
  const setMetadataTriggeredRef = useRef(false)
  const prevRegisteredIpIdRef = useRef<string | null>(null)
  const pendingRegisterTermsRef = useRef<PILTermsTuple | null>(null)
  const pendingAttachIpIdRef = useRef<`0x${string}` | null>(null)
  const lastAutoTriggeredIpIdRef = useRef<string | null>(null)
  const pinataOk = hasPinataJwt()
  const publicClient = usePublicClient()

  useEffect(() => {
    if (initialNft?.contract && initialNft?.tokenId) {
      setTokenContract(initialNft.contract)
      setTokenId(initialNft.tokenId)
      setChainId('1315')
    }
  }, [initialNft?.contract, initialNft?.tokenId])

  const { data: feeAmount = 0n } = useReadContract({
    address: IP_ASSET_REGISTRY_ADDRESS,
    abi: ipAssetRegistryAbi,
    functionName: 'getFeeAmount',
  })

  const { data: feeToken } = useReadContract({
    address: IP_ASSET_REGISTRY_ADDRESS,
    abi: ipAssetRegistryAbi,
    functionName: 'getFeeToken',
  })

  const {
    writeContract: writeApprove,
    data: approveHash,
    isPending: approvePending,
  } = useWriteContract()

  const { isLoading: approveConfirming } = useWaitForTransactionReceipt({ hash: approveHash })

  const {
    writeContract: writeRegister,
    data: registerHash,
    isPending: registerPending,
    error: registerError,
  } = useWriteContract()

  const { data: registerReceipt, isLoading: registerConfirming } =
    useWaitForTransactionReceipt({ hash: registerHash })

  const {
    writeContract: writeAttach,
    data: attachHash,
    isPending: attachPending,
    error: attachError,
  } = useWriteContract()

  const { data: attachReceipt } = useWaitForTransactionReceipt({ hash: attachHash })

  const {
    writeContract: writeRegisterTerms,
    data: registerTermsHash,
    isPending: registerTermsPending,
    error: registerTermsError,
  } = useWriteContract()

  const { data: registerTermsReceipt } = useWaitForTransactionReceipt({ hash: registerTermsHash })

  useEffect(() => {
    if (registerTermsReceipt?.status !== 'success' || !pendingRegisterTermsRef.current || !pendingAttachIpIdRef.current || !publicClient) return
    const terms = pendingRegisterTermsRef.current
    const ipId = pendingAttachIpIdRef.current
    pendingRegisterTermsRef.current = null
    pendingAttachIpIdRef.current = null
    publicClient
      .readContract({
        address: PIL_TEMPLATE_ADDRESS,
        abi: pilTemplateAbi,
        functionName: 'getLicenseTermsId',
        args: [terms],
      })
      .then((id) => {
        if (id > 0n) {
          writeAttach({
            address: LICENSING_MODULE_ADDRESS,
            abi: licensingModuleAbi,
            functionName: 'attachLicenseTerms',
            args: [ipId, PIL_TEMPLATE_ADDRESS, id],
          })
        }
      })
      .catch(console.error)
  }, [registerTermsReceipt?.status, publicClient, writeAttach])

  const {
    writeContract: writeSetMetadata,
    data: setMetadataHash,
    isPending: setMetadataPending,
    error: setMetadataContractError,
  } = useWriteContract()

  const { writeContract: writeSetNftTokenURI } = useWriteContract()

  const runUploadMetadata = async () => {
    setMetadataError(null)
    setMetadataUploading(true)
    const contractTrimmed = tokenContract.trim().toLowerCase()
    const isKrumpNft = contractTrimmed === KRUMP_VERIFY_NFT_ADDRESS.toLowerCase()
    const tid = Number(tokenId.trim())
    const tokenIdBigInt = Number.isInteger(tid) && tid >= 0 ? BigInt(tid) : undefined
    try {
      const result = await uploadIpMetadata({
        title: title || undefined,
        description: description || undefined,
        creatorAddress: address ?? undefined,
      })
      setIpMetadataURI(result.ipMetadataURI)
      setIpMetadataHash(result.ipMetadataHash)
      setNftMetadataURI(result.nftMetadataURI)
      if (isKrumpNft && tokenIdBigInt !== undefined && result.nftMetadataURI) {
        let nftOwner: string | null = null
        if (publicClient) {
          try {
            nftOwner = await publicClient.readContract({
              address: KRUMP_VERIFY_NFT_ADDRESS,
              abi: krumpVerifyNftAbi,
              functionName: 'owner',
            })
          } catch (_) { /* ignore */ }
        }
        const isOwner = address && nftOwner ? address.toLowerCase() === nftOwner.toLowerCase() : false
        writeSetNftTokenURI({
          address: KRUMP_VERIFY_NFT_ADDRESS,
          abi: krumpVerifyNftAbi,
          functionName: 'setTokenURI',
          args: [tokenIdBigInt, result.nftMetadataURI],
        })
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e)
      setMetadataError(errMsg)
    } finally {
      setMetadataUploading(false)
    }
  }

  const existingIpIdTrimmed = existingIpId.trim().toLowerCase()
  const existingIpIdValid = /^0x[a-f0-9]{40}$/.test(existingIpIdTrimmed)
  const attachExistingIpIdTrimmed = attachExistingIpId.trim().toLowerCase()
  const attachExistingIpIdValid = /^0x[a-f0-9]{40}$/.test(attachExistingIpIdTrimmed)

  const runAttachLicenseForExistingIp = async () => {
    const termId = getLicenseTermId(attachExistingLicenseType)
    if (!attachExistingIpIdValid || termId === null) return
    const ipId = attachExistingIpIdTrimmed as `0x${string}`

    const useRegisterThenAttach = attachExistingLicenseType === 'commercial-use' || attachExistingLicenseType === 'commercial-remix'
    if (useRegisterThenAttach && publicClient) {
      const terms = buildPilTermsForAttach(attachExistingLicenseType, attachExistingRevenueSharePercent)
      try {
        const existingId = await publicClient.readContract({
          address: PIL_TEMPLATE_ADDRESS,
          abi: pilTemplateAbi,
          functionName: 'getLicenseTermsId',
          args: [terms],
        })
        if (existingId > 0n) {
          writeAttach({
            address: LICENSING_MODULE_ADDRESS,
            abi: licensingModuleAbi,
            functionName: 'attachLicenseTerms',
            args: [ipId, PIL_TEMPLATE_ADDRESS, existingId],
          })
        } else {
          pendingRegisterTermsRef.current = terms
          pendingAttachIpIdRef.current = ipId
          writeRegisterTerms({
            address: PIL_TEMPLATE_ADDRESS,
            abi: pilTemplateAbi,
            functionName: 'registerLicenseTerms',
            args: [terms],
          })
        }
      } catch (e) {
        console.error(e)
      }
      return
    }

    writeAttach({
      address: LICENSING_MODULE_ADDRESS,
      abi: licensingModuleAbi,
      functionName: 'attachLicenseTerms',
      args: [ipId, PIL_TEMPLATE_ADDRESS, termId],
    })
  }

  const runSetMetadataForExistingIp = async () => {
    if (!existingIpIdValid || !address) return
    setUpdateExistingError(null)
    setUpdateExistingUploading(true)
    try {
      const { ipMetadataURI: uri, ipMetadataHash: hash } = await uploadIpMetadata({
        title: title || undefined,
        description: description || undefined,
        creatorAddress: address ?? undefined,
      })
      writeSetMetadata({
        address: CORE_METADATA_MODULE_ADDRESS,
        abi: coreMetadataModuleAbi,
        functionName: 'setMetadataURI',
        args: [existingIpIdTrimmed as `0x${string}`, uri, hash],
      })
    } catch (e) {
      setUpdateExistingError(e instanceof Error ? e.message : String(e))
    } finally {
      setUpdateExistingUploading(false)
    }
  }

  const chainIdNum = (() => {
    if (chainId.trim() === '') return undefined
    const n = Number(chainId)
    return Number.isInteger(n) && n >= 0 ? BigInt(n) : undefined
  })()
  const tokenContractTrimmed = tokenContract.trim().toLowerCase()
  const tokenContractValid = /^0x[a-f0-9]{40}$/.test(tokenContractTrimmed)
  const tokenIdTrimmed = tokenId.trim()
  const tokenIdNum = (() => {
    if (tokenIdTrimmed === '') return undefined
    const n = Number(tokenIdTrimmed)
    return Number.isInteger(n) && n >= 0 ? BigInt(n) : undefined
  })()
  const formValid = chainIdNum !== undefined && tokenContractValid && tokenIdNum !== undefined
  const tokenContractAddress = tokenContractValid ? (tokenContractTrimmed as `0x${string}`) : undefined

  const { data: resolvedIpId } = useReadContract({
    address: IP_ASSET_REGISTRY_ADDRESS,
    abi: ipAssetRegistryAbi,
    functionName: 'ipId',
    args:
      registerReceipt?.status === 'success' &&
      chainIdNum !== undefined &&
      tokenContractAddress &&
      tokenIdNum !== undefined
        ? [chainIdNum, tokenContractAddress, tokenIdNum]
        : undefined,
  })

  useEffect(() => {
    if (registerHash) setRegisterTxHash(registerHash)
  }, [registerHash])

  useEffect(() => {
    if (resolvedIpId && registerReceipt?.status === 'success') {
      const id = resolvedIpId.toLowerCase() as `0x${string}`
      setRegisteredIpId(id)
      onRegisterSuccess?.(id)

      if (lastAutoTriggeredIpIdRef.current === id) return
      lastAutoTriggeredIpIdRef.current = id
      attachTriggeredRef.current = true
      setMetadataTriggeredRef.current = true

      if (ipMetadataURI && ipMetadataHash) {
        writeSetMetadata({
          address: CORE_METADATA_MODULE_ADDRESS,
          abi: coreMetadataModuleAbi,
          functionName: 'setMetadataURI',
          args: [id, ipMetadataURI, ipMetadataHash],
        })
      }
      const termId = getLicenseTermId(licenseType)
      if (termId !== null) {
        writeAttach({
          address: LICENSING_MODULE_ADDRESS,
          abi: licensingModuleAbi,
          functionName: 'attachLicenseTerms',
          args: [id, PIL_TEMPLATE_ADDRESS, termId],
        })
      }
    }
  }, [resolvedIpId, registerReceipt?.status, onRegisterSuccess, ipMetadataURI, ipMetadataHash, licenseType, writeSetMetadata, writeAttach])

  useEffect(() => {
    if (registeredIpId !== prevRegisteredIpIdRef.current) {
      prevRegisteredIpIdRef.current = registeredIpId
      if (registeredIpId !== lastAutoTriggeredIpIdRef.current) {
        attachTriggeredRef.current = false
        setMetadataTriggeredRef.current = false
      }
    }
  }, [registeredIpId])

  const licenseTermIdRef = useRef<LicenseType | null>(null)
  useEffect(() => {
    if (licenseType !== licenseTermIdRef.current) {
      licenseTermIdRef.current = licenseType
      attachTriggeredRef.current = false
    }
  }, [licenseType])

  useEffect(() => {
    const termId = getLicenseTermId(licenseType)
    const skip = !registeredIpId || termId === null || attachTriggeredRef.current
    if (skip) return
    attachTriggeredRef.current = true
    writeAttach({
      address: LICENSING_MODULE_ADDRESS,
      abi: licensingModuleAbi,
      functionName: 'attachLicenseTerms',
      args: [registeredIpId as `0x${string}`, PIL_TEMPLATE_ADDRESS, termId],
    })
  }, [registeredIpId, licenseType, writeAttach])

  useEffect(() => {
    const skip =
      !registeredIpId ||
      !ipMetadataURI ||
      !ipMetadataHash ||
      setMetadataTriggeredRef.current
    if (skip) return
    setMetadataTriggeredRef.current = true
    writeSetMetadata({
      address: CORE_METADATA_MODULE_ADDRESS,
      abi: coreMetadataModuleAbi,
      functionName: 'setMetadataURI',
      args: [registeredIpId as `0x${string}`, ipMetadataURI, ipMetadataHash],
    })
  }, [registeredIpId, ipMetadataURI, ipMetadataHash, writeSetMetadata])

  const runApprove = () => {
    if (!address || !feeToken || !formValid) return
    writeApprove({
      address: feeToken as `0x${string}`,
      abi: erc20Abi,
      functionName: 'approve',
      args: [IP_ASSET_REGISTRY_ADDRESS, feeAmount],
    })
  }

  const runRegister = () => {
    if (!address || !formValid || chainIdNum === undefined || !tokenContractAddress || tokenIdNum === undefined)
      return
    writeRegister({
      address: IP_ASSET_REGISTRY_ADDRESS,
      abi: ipAssetRegistryAbi,
      functionName: 'register',
      args: [chainIdNum, tokenContractAddress, tokenIdNum],
    })
  }

  const wrongChain = chain && chain.id !== 1315
  const metadataReady = !!ipMetadataURI && !!ipMetadataHash
  const canSubmit = address && !wrongChain && formValid && metadataReady && pinataOk
  const needsFeeApproval = feeToken && feeAmount > 0n

  return (
    <div className="max-w-lg mx-auto mt-8 p-6 rounded-2xl bg-white/5 border border-white/10 shadow-xl">
      <h2 className="text-xl font-semibold text-amber-400/90 mb-4">Register NFT as IP</h2>
      {wrongChain && (
        <p className="text-amber-300/90 text-sm mb-4">
          Switch to Story Aeneid (chain 1315) in your wallet.
        </p>
      )}
      <p className="text-gray-400 text-sm mb-4">
        Register an NFT as an IP Asset on Story. You get an IP ID (address) to use when verifying moves.
      </p>
      {!pinataOk && (
        <div className="mb-4 p-3 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-200 text-sm">
          <strong>Pinata JWT required.</strong> Add <code className="bg-black/30 px-1 rounded">VITE_PINATA_JWT</code> to your <code className="bg-black/30 px-1 rounded">.env</code> in the frontend folder to upload metadata (required for Story IPA explorer).
        </div>
      )}
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Step 1 — Upload metadata (required)</label>
          <p className="text-xs text-gray-500 mb-2">
            Uploads the KRUMP VERIFY cover image and IPA metadata to IPFS so your IP shows correctly on Story explorer. Your connected wallet is set as creator so the creator section shows on the explorer.
            {tokenContractTrimmed === KRUMP_VERIFY_NFT_ADDRESS.toLowerCase() && ' For Krump Verify NFT, this also sets the token metadata URI so traits show (approve the setTokenURI tx if prompted).'}
          </p>
          {!address && (
            <p className="mb-2 text-sm text-amber-300/90">Connect your wallet first so the creator is set on the explorer.</p>
          )}
          <button
            type="button"
            onClick={runUploadMetadata}
            disabled={!pinataOk || metadataUploading || !address}
            className="w-full px-4 py-2.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {metadataUploading ? 'Uploading image, NFT metadata, IPA metadata…' : metadataReady ? '✓ 3 uploads: image, NFT metadata, IPA metadata' : 'Upload metadata to IPFS (image + NFT + IPA)'}
          </button>
          {metadataError && <p className="mt-1 text-sm text-red-400">{metadataError}</p>}
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Chain ID (where the NFT lives)</label>
          <input
            type="text"
            value={chainId}
            onChange={(e) => setChainId(e.target.value)}
            placeholder="1315"
            className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white placeholder-gray-500 focus:border-amber-500/50 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">NFT contract address</label>
          <input
            type="text"
            value={tokenContract}
            onChange={(e) => setTokenContract(e.target.value)}
            placeholder="0x..."
            className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white placeholder-gray-500 focus:border-amber-500/50 focus:outline-none"
          />
          {tokenContractTrimmed !== '' && !tokenContractValid && (
            <p className="mt-1 text-sm text-amber-300/90">Must be a valid address (0x + 40 hex)</p>
          )}
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Token ID</label>
          <input
            type="text"
            value={tokenId}
            onChange={(e) => setTokenId(e.target.value)}
            placeholder="0"
            className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white placeholder-gray-500 focus:border-amber-500/50 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Title (optional)</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Name for this IP"
            className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white placeholder-gray-500 focus:border-amber-500/50 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description of the IP"
            rows={2}
            className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white placeholder-gray-500 focus:border-amber-500/50 focus:outline-none resize-none"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">License type</label>
          <select
            value={licenseType}
            onChange={(e) => setLicenseType(e.target.value as LicenseType)}
            className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white focus:border-amber-500/50 focus:outline-none"
          >
            {LICENSE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            {licenseType === 'non-commercial-social-remixing' && 'Free remixing with attribution, no commercialization.'}
            {licenseType === 'commercial-use' && 'Pay to use with attribution, no revenue share.'}
            {licenseType === 'commercial-remix' && 'Pay to use with attribution and revenue share.'}
            {licenseType === 'cc-attribution' && 'Free remixing and commercial use with attribution.'}
            {licenseType === 'none' && 'No license terms attached.'}
          </p>
          {licenseType === 'commercial-remix' && (
            <div className="mt-3">
              <label className="block text-sm text-gray-400 mb-1">Revenue share %</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={revenueSharePercent}
                  onChange={(e) => setRevenueSharePercent(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                  className="w-24 px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white focus:border-amber-500/50 focus:outline-none"
                />
                <span className="text-sm text-gray-400">% to licensor on commercial remix</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Attached term uses the standard commercial remix term ID on this chain. For custom %, register derivative terms on Story or use the Story SDK with PILFlavor.commercialRemix(royaltyPercent).
              </p>
            </div>
          )}
          <p className="mt-0.5 text-xs text-gray-600">
            Commercial / CC options use standard term IDs; if attach fails, those terms may need registering on this chain.
          </p>
        </div>
        {needsFeeApproval && (
          <p className="text-sm text-gray-500">
            Registration fee: {Number(feeAmount) / 1e6} (approve then register)
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          {needsFeeApproval && (
            <button
              type="button"
              onClick={runApprove}
              disabled={!canSubmit || approvePending || approveConfirming}
              className="px-4 py-2.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {approvePending || approveConfirming ? 'Approving…' : '2. Approve fee'}
            </button>
          )}
          <button
            type="button"
            onClick={runRegister}
            disabled={!canSubmit || registerPending || registerConfirming}
            className="px-4 py-2.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {registerPending || registerConfirming ? 'Registering…' : needsFeeApproval ? '3. Register IP' : '2. Register IP'}
          </button>
        </div>
        {registerError && (
          <p className="text-red-400/90 text-sm">{String(registerError.message)}</p>
        )}
        {registeredIpId && (
          <div className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
            <p className="text-sm font-medium text-white mb-2">Next: confirm in your wallet</p>
            <ul className="text-xs text-gray-400 space-y-1 mb-3">
              <li>✓ Registered</li>
              <li>
                {setMetadataHash && !setMetadataContractError
                  ? '✓ Set metadata (creator & image on explorer)'
                  : setMetadataPending
                    ? '⏳ Set metadata — confirm in wallet (required for creator & image)'
                    : ipMetadataURI
                      ? '⏳ Set metadata — confirm in wallet (required for creator & image)'
                      : '⚠ Set metadata — upload metadata first, then confirm setMetadata tx'}
              </li>
              <li>
                {getLicenseTermId(licenseType) === null
                  ? '⊘ License: skipped'
                  : attachReceipt?.status === 'success'
                    ? `✓ License attached (${LICENSE_OPTIONS.find((o) => o.value === licenseType)?.label ?? licenseType}${licenseType === 'commercial-remix' ? `, ${revenueSharePercent}%` : ''})`
                    : attachPending || (attachHash && !attachReceipt)
                      ? '⏳ Attach license — confirm in wallet'
                      : attachError
                        ? '⚠ License attach failed — use "Attach license terms to an existing IP" below'
                        : '⏳ Attach license — confirm in wallet'}
              </li>
            </ul>
            {(attachError || setMetadataContractError) && (
              <p className="text-xs text-amber-300/90 mb-2">Use the sections below to attach license or set metadata for this IP if a tx failed.</p>
            )}
            {title && <p className="text-sm font-medium text-white mb-0.5">{title}</p>}
            {description && (
              <p className="text-sm text-gray-400 mb-2 whitespace-pre-wrap">{description}</p>
            )}
            <p className="text-sm text-gray-400 mb-1">Your IP ID (use this in Verify a move):</p>
            <p className="font-mono text-sm text-emerald-300 break-all">{registeredIpId}</p>
            {getLicenseTermId(licenseType) !== null && (
              <p className="mt-2 text-xs text-gray-500">
                {attachPending || (attachHash && !attachReceipt)
                  ? 'Attaching license terms…'
                  : attachReceipt?.status === 'success'
                    ? `License terms attached (${LICENSE_OPTIONS.find((o) => o.value === licenseType)?.label ?? licenseType}${licenseType === 'commercial-remix' ? `, ${revenueSharePercent}% revenue share` : ''}).`
                    : attachError
                      ? `License attach failed: ${attachError.message}`
                      : null}
              </p>
            )}
            <p className="mt-2 text-xs text-gray-500">
              {setMetadataPending
                ? 'Setting IPA metadata (image & details on Story explorer)…'
                : setMetadataContractError
                  ? `Metadata set failed: ${setMetadataContractError.message}`
                  : setMetadataHash
                    ? 'IPA metadata set. Refresh the explorer to see the KRUMP VERIFY image.'
                    : ipMetadataURI
                      ? 'Setting IPA metadata…'
                      : null}
            </p>
            {setMetadataHash && (
              <p className="text-xs text-gray-400 mt-1">
                <a
                  href={`${EXPLORER_URL}/tx/${setMetadataHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-400 hover:underline"
                >
                  View setMetadata tx
                </a>
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-3">
              <a
                href={`${EXPLORER_URL}/address/${registeredIpId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-amber-400 hover:underline"
              >
                View IPA on explorer
              </a>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(registeredIpId)}
                className="text-xs text-amber-400 hover:underline"
              >
                Copy
              </button>
            </div>
          </div>
        )}
        {registerTxHash && (
          <p className="text-sm text-gray-400">
            Transaction:{' '}
            <a
              href={`${EXPLORER_URL}/tx/${registerTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400 hover:underline"
            >
              View on explorer
            </a>
          </p>
        )}

        <div className="mt-8 pt-6 border-t border-white/10">
          <p className="text-sm font-medium text-gray-300 mb-1">Already have an IP ID but image/details not showing on explorer?</p>
          <p className="text-xs text-gray-500 mb-3">
            Upload KRUMP VERIFY metadata and set it for an existing IP Asset. Your connected wallet will be set as creator so it shows on Story Explorer. Your wallet must have permission on that IP (e.g. you registered it).
          </p>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-gray-500 mb-1">IP ID (0x + 40 hex)</label>
              <input
                type="text"
                value={existingIpId}
                onChange={(e) => { setExistingIpId(e.target.value); setUpdateExistingError(null) }}
                placeholder="0x2bDf779A7A28F54C3332B130f0f634D1907d8d1F"
                className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white placeholder-gray-500 focus:border-amber-500/50 focus:outline-none font-mono text-sm"
              />
              {existingIpIdTrimmed !== '' && !existingIpIdValid && (
                <p className="mt-1 text-xs text-amber-300/90">Enter a valid address (0x + 40 hex)</p>
              )}
            </div>
            <button
              type="button"
              onClick={runSetMetadataForExistingIp}
              disabled={!pinataOk || !existingIpIdValid || updateExistingUploading || setMetadataPending}
              className="px-4 py-2.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition whitespace-nowrap"
            >
              {updateExistingUploading ? 'Uploading…' : setMetadataPending ? 'Confirm in wallet…' : 'Upload & set metadata'}
            </button>
          </div>
          {updateExistingError && <p className="mt-2 text-sm text-red-400">{updateExistingError}</p>}
          {setMetadataHash && existingIpIdValid && (
            <p className="mt-2 text-xs text-gray-400">
              <a href={`${EXPLORER_URL}/address/${existingIpIdTrimmed}`} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">
                View IPA on explorer
              </a>
              {' · '}
              <a href={`${EXPLORER_URL}/tx/${setMetadataHash}`} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">
                View setMetadata tx
              </a>
            </p>
          )}
        </div>

        <div className="mt-6 pt-6 border-t border-white/10">
          <p className="text-sm font-medium text-gray-300 mb-1">Attach license terms to an existing IP</p>
          <p className="text-xs text-gray-500 mb-3">
            If an IP has no license on the explorer, choose a license type below and attach it. Your wallet must have permission on that IP. For <strong>Commercial Use</strong> and <strong>Commercial Remix</strong>, terms are registered on-chain first (if not already), then attached—you may need to confirm 1 or 2 transactions.
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">IP ID (0x + 40 hex)</label>
              <input
                type="text"
                value={attachExistingIpId}
                onChange={(e) => setAttachExistingIpId(e.target.value)}
                placeholder="0x2bDf779A7A28F54C3332B130f0f634D1907d8d1F"
                className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white placeholder-gray-500 focus:border-amber-500/50 focus:outline-none font-mono text-sm"
              />
              {attachExistingIpIdTrimmed !== '' && !attachExistingIpIdValid && (
                <p className="mt-1 text-xs text-amber-300/90">Enter a valid address (0x + 40 hex)</p>
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">License type</label>
              <select
                value={attachExistingLicenseType}
                onChange={(e) => setAttachExistingLicenseType(e.target.value as LicenseType)}
                className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white focus:border-amber-500/50 focus:outline-none"
              >
                {LICENSE_OPTIONS.filter((o) => o.termId !== null).map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {attachExistingLicenseType === 'commercial-remix' && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Revenue share %</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={attachExistingRevenueSharePercent}
                    onChange={(e) => setAttachExistingRevenueSharePercent(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                    className="w-24 px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white focus:border-amber-500/50 focus:outline-none"
                  />
                  <span className="text-xs text-gray-400">% to licensor (standard term on this chain)</span>
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={() => runAttachLicenseForExistingIp()}
              disabled={
                !attachExistingIpIdValid ||
                getLicenseTermId(attachExistingLicenseType) === null ||
                attachPending ||
                registerTermsPending
              }
              className="w-full px-4 py-2.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {registerTermsPending
                ? 'Confirm register terms in wallet…'
                : attachPending
                  ? 'Confirm attach in wallet…'
                  : attachExistingLicenseType === 'commercial-remix'
                    ? `Attach Commercial Remix (revenue share), ${attachExistingRevenueSharePercent}%`
                    : `Attach ${LICENSE_OPTIONS.find((o) => o.value === attachExistingLicenseType)?.label ?? attachExistingLicenseType}`}
            </button>
            {registerTermsError && (
              <p className="mt-2 text-sm text-red-400">Register terms failed: {registerTermsError.message}</p>
            )}
            {attachReceipt?.status === 'reverted' && (
              <p className="mt-2 text-sm text-amber-300/90">
                Attach transaction reverted. Check that your wallet has permission on this IP.
              </p>
            )}
            {attachError && (
              <p className="mt-2 text-sm text-red-400">Attach failed: {attachError.message}</p>
            )}
            {attachReceipt?.status === 'success' && (
              <p className="mt-2 text-sm text-emerald-400/90">License terms attached.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
