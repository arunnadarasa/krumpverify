export const KRUMP_VERIFY_ADDRESS = (import.meta.env.VITE_KRUMP_VERIFY_ADDRESS ||
  '0x41CE400d0C0f8d5c38BDf68970981b359cB5bb4A') as `0x${string}`

export const USDC_K_ADDRESS = (import.meta.env.VITE_USDC_K_ADDRESS ||
  '0xd35890acdf3BFFd445C2c7fC57231bDE5cAFbde5') as `0x${string}`

export const EXPLORER_URL = import.meta.env.VITE_EXPLORER_URL || 'https://aeneid.storyscan.io'

// EVVM Native x402 Adapter (USDC Krump on Story Aeneid) — EIP-712 signer authorizes transfer to this contract; adapter calls EVVM Core pay().
export const EVVM_X402_ADAPTER_ADDRESS = (import.meta.env.VITE_EVVM_X402_ADAPTER_ADDRESS ||
  '0xDf5eaED856c2f8f6930d5F3A5BCE5b5d7E4C73cc') as `0x${string}`

/** EVVM Core and instance ID (Story Aeneid); required for payViaEVVMWithX402 EVVM signature. */
export const EVVM_CORE_ADDRESS = (import.meta.env.VITE_EVVM_CORE_ADDRESS ||
  '0xa6a02E8e17b819328DDB16A0ad31dD83Dd14BA3b') as `0x${string}`
export const EVVM_ID = Number(import.meta.env.VITE_EVVM_ID || '1140')

/** Payment recipient when using full x402+EVVM flow (e.g. treasury). If set, frontend requests EVVM personal_sign and relayer calls the adapter. */
export const X402_PAYMENT_RECIPIENT = (import.meta.env.VITE_X402_PAYMENT_RECIPIENT || '') as `0x${string}`

/** EVVM Treasury (Story Aeneid). Payer must deposit USDC.k here so Core.pay() can debit internal balance. */
export const EVVM_TREASURY_ADDRESS = (import.meta.env.VITE_EVVM_TREASURY_ADDRESS ||
  '0x977126dd6B03cAa3A87532784E6B7757aBc9C1cc') as `0x${string}`

/** EVVM Core read-only ABI (for getNextCurrentSyncNonce when using sync nonce). */
export const evvmCoreAbi = [
  { inputs: [{ name: 'user', type: 'address' }], name: 'getNextCurrentSyncNonce', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
] as const

/** EVVM Treasury ABI (deposit so payer has internal balance for Native adapter). */
export const evvmTreasuryAbi = [
  { inputs: [{ name: 'token', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'deposit', outputs: [], stateMutability: 'nonpayable', type: 'function' },
] as const

/** EIP-712 domain for x402 (matches EVVMNativeX402Adapter: name "USDC Dance", version "1") */
export const X402_DOMAIN = {
  name: 'USDC Dance',
  version: '1',
  chainId: 1315,
  verifyingContract: EVVM_X402_ADAPTER_ADDRESS,
} as const

/** EIP-712 type for TransferWithAuthorization (x402 auth to adapter) */
export const X402_TRANSFER_WITH_AUTH_TYPE = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const

// Krump Verify NFT collection (ERC-721 "Krump Verify" on Aeneid; with setTokenURI for traits)
export const KRUMP_VERIFY_NFT_ADDRESS = (import.meta.env.VITE_KRUMP_VERIFY_NFT_ADDRESS ||
  '0x7F94D30cE8a0e3a4b83794b3f4b4F3bE77106d7A') as `0x${string}`

export const krumpVerifyNftAbi = [
  {
    inputs: [],
    name: 'mint',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'nextTokenId',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'uri', type: 'string' },
    ],
    name: 'setTokenURI',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

// Story IP Asset Registry (Aeneid)
export const IP_ASSET_REGISTRY_ADDRESS = (import.meta.env.VITE_IP_ASSET_REGISTRY_ADDRESS ||
  '0x77319B4031e6eF1250907aa00018B8B1c67a244b') as `0x${string}`

export const ipAssetRegistryAbi = [
  {
    inputs: [
      { name: 'chainid', type: 'uint256' },
      { name: 'tokenContract', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
    ],
    name: 'register',
    outputs: [{ name: 'id', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getFeeAmount',
    outputs: [{ name: '', type: 'uint96' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getFeeToken',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'chainId', type: 'uint256' },
      { name: 'tokenContract', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
    ],
    name: 'ipId',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'id', type: 'address' }],
    name: 'isRegistered',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

// Story Licensing (Aeneid) – attach license terms to an IPA
export const LICENSING_MODULE_ADDRESS = (import.meta.env.VITE_LICENSING_MODULE_ADDRESS ||
  '0x04fbd8a2e56dd85CFD5500A4A4DfA955B9f1dE6f') as `0x${string}`

export const PIL_TEMPLATE_ADDRESS = (import.meta.env.VITE_PIL_TEMPLATE_ADDRESS ||
  '0x2E896b0b2Fdb7457499B56AAaA4AE55BCB4Cd316') as `0x${string}`

// Aeneid: royalty policy and currency for registering PIL terms (Commercial Use / Commercial Remix)
export const ROYALTY_POLICY_LAP_ADDRESS = (import.meta.env.VITE_ROYALTY_POLICY_LAP_ADDRESS ||
  '0xBe54FB168b3c982b7AaE60dB6CF75Bd8447b390E') as `0x${string}`
export const PIL_CURRENCY_ADDRESS = (import.meta.env.VITE_PIL_CURRENCY_ADDRESS ||
  '0xF2104833d386a2734a4eB3B8ad6FC6812F29E38E') as `0x${string}`

// Story default: 1 = Non-Commercial Social Remixing (pre-registered). CC-Attribution may be 4 on some chains. Commercial Use/Remix use register-then-attach.
export const LICENSE_TERMS_IDS = {
  nonCommercialSocialRemixing: 1n,
  commercialUse: 2n,
  commercialRemix: 3n,
  ccAttribution: 4n,
} as const

// PILTerms struct for PIL template (order matches IPILicenseTemplate.sol)
export type PILTermsTuple = [
  boolean,   // transferable
  `0x${string}`, // royaltyPolicy
  bigint,    // mintingFee
  bigint,    // expiration
  boolean,   // commercialUse
  boolean,   // commercialAttribution
  `0x${string}`, // commercializerChecker
  `0x${string}`, // commercializerCheckerData
  number,    // commercialRevShare (e.g. 50 * 1e6 = 50%)
  bigint,    // commercialRevCelling
  boolean,   // derivativesAllowed
  boolean,   // derivativesAttribution
  boolean,   // derivativesApproval
  boolean,   // derivativesReciprocal
  bigint,    // derivativeRevCelling
  `0x${string}`, // currency
  string,    // uri
]

export const pilTemplateAbi = [
  {
    inputs: [
      {
        name: 'terms',
        type: 'tuple',
        components: [
          { name: 'transferable', type: 'bool' },
          { name: 'royaltyPolicy', type: 'address' },
          { name: 'mintingFee', type: 'uint256' },
          { name: 'expiration', type: 'uint256' },
          { name: 'commercialUse', type: 'bool' },
          { name: 'commercialAttribution', type: 'bool' },
          { name: 'commercializerChecker', type: 'address' },
          { name: 'commercializerCheckerData', type: 'bytes' },
          { name: 'commercialRevShare', type: 'uint32' },
          { name: 'commercialRevCelling', type: 'uint256' },
          { name: 'derivativesAllowed', type: 'bool' },
          { name: 'derivativesAttribution', type: 'bool' },
          { name: 'derivativesApproval', type: 'bool' },
          { name: 'derivativesReciprocal', type: 'bool' },
          { name: 'derivativeRevCelling', type: 'uint256' },
          { name: 'currency', type: 'address' },
          { name: 'uri', type: 'string' },
        ],
      },
    ],
    name: 'getLicenseTermsId',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        name: 'terms',
        type: 'tuple',
        components: [
          { name: 'transferable', type: 'bool' },
          { name: 'royaltyPolicy', type: 'address' },
          { name: 'mintingFee', type: 'uint256' },
          { name: 'expiration', type: 'uint256' },
          { name: 'commercialUse', type: 'bool' },
          { name: 'commercialAttribution', type: 'bool' },
          { name: 'commercializerChecker', type: 'address' },
          { name: 'commercializerCheckerData', type: 'bytes' },
          { name: 'commercialRevShare', type: 'uint32' },
          { name: 'commercialRevCelling', type: 'uint256' },
          { name: 'derivativesAllowed', type: 'bool' },
          { name: 'derivativesAttribution', type: 'bool' },
          { name: 'derivativesApproval', type: 'bool' },
          { name: 'derivativesReciprocal', type: 'bool' },
          { name: 'derivativeRevCelling', type: 'uint256' },
          { name: 'currency', type: 'address' },
          { name: 'uri', type: 'string' },
        ],
      },
    ],
    name: 'registerLicenseTerms',
    outputs: [{ name: 'id', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

export const licensingModuleAbi = [
  {
    inputs: [
      { name: 'ipId', type: 'address' },
      { name: 'licenseTemplate', type: 'address' },
      { name: 'licenseTermsId', type: 'uint256' },
    ],
    name: 'attachLicenseTerms',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

// Story License Registry (Aeneid) – read attached license count for an IP
export const LICENSE_REGISTRY_ADDRESS = (import.meta.env.VITE_LICENSE_REGISTRY_ADDRESS ||
  '0x529a750E02d8E2f15649c13D69a465286a780e24') as `0x${string}`

export const licenseRegistryAbi = [
  {
    inputs: [{ name: 'ipId', type: 'address' }],
    name: 'getAttachedLicenseTermsCount',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

// Story Core Metadata Module (Aeneid) – set IPA metadata for explorer display
export const CORE_METADATA_MODULE_ADDRESS = (import.meta.env.VITE_CORE_METADATA_MODULE_ADDRESS ||
  '0x6E81a25C99C6e8430aeC7353325EB138aFE5DC16') as `0x${string}`

export const coreMetadataModuleAbi = [
  {
    inputs: [
      { name: 'ipId', type: 'address' },
      { name: 'metadataURI', type: 'string' },
      { name: 'metadataHash', type: 'bytes32' },
    ],
    name: 'setMetadataURI',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

export const krumpVerifyAbi = [
  {
    inputs: [
      { name: 'ipId', type: 'address' },
      { name: 'moveDataHash', type: 'bytes32' },
      { name: 'proof', type: 'bytes' },
    ],
    name: 'verifyMove',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'ipId', type: 'address' },
      { name: 'moveDataHash', type: 'bytes32' },
      { name: 'proof', type: 'bytes' },
      { name: 'paymentReceiptId', type: 'bytes32' },
    ],
    name: 'verifyMoveWithReceipt',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'receiptId', type: 'bytes32' },
      { name: 'payer', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'submitPaymentReceipt',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: '', type: 'bytes32' }],
    name: 'paymentReceipts',
    outputs: [
      { name: 'payer', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'used', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'verificationFee',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'ipAssetRegistry',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    type: 'event',
    name: 'PaymentReceiptSubmitted',
    inputs: [
      { name: 'receiptId', type: 'bytes32', indexed: true },
      { name: 'payer', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const

export const erc20Abi = [
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const
