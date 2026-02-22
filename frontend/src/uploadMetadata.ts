/**
 * Build and upload IPA metadata (Story) using the default KRUMP VERIFY cover image.
 * Requires VITE_PINATA_JWT. Image must be at /krump-verify-cover.png (public folder).
 */

import { uploadFileToPinata, uploadJsonToPinata, sha256Hex } from './pinata'

const DEFAULT_IMAGE_PATH = '/Krump Verify.png'

export type IpMetadataResult = {
  /** IPFS URI for the image (upload 1) */
  imageURI: string
  /** IPFS URI for NFT metadata JSON, OpenSea ERC721 standard (upload 2) */
  nftMetadataURI: string
  /** Canonical IPFS URI for IPA metadata JSON (use this for setMetadataURI on-chain) */
  ipMetadataURI: string
  ipMetadataHash: `0x${string}`
}

/**
 * Fetch the default cover image from the app's public folder.
 */
async function fetchDefaultImage(): Promise<ArrayBuffer> {
  const base = import.meta.env.BASE_URL ?? '/'
  const path = base.replace(/\/$/, '') + DEFAULT_IMAGE_PATH
  const res = await fetch(path)
  if (!res.ok) {
    throw new Error(
      `Cover image not found. Add krump-verify-cover.png to the frontend/public/ folder. (${path} returned ${res.status})`
    )
  }
  return res.arrayBuffer()
}

/**
 * Upload 3 assets to IPFS: (1) image, (2) NFT metadata (OpenSea ERC721), (3) IPA metadata (Story).
 * Uses KRUMP VERIFY branding; title/description/creatorAddress override defaults.
 */
export async function uploadIpMetadata(options: {
  title?: string
  description?: string
  creatorAddress?: string
}): Promise<IpMetadataResult> {
  const { title = 'KRUMP VERIFY', description = 'On-chain verification for dance moves against registered IP. Two dancers in a futuristic urban setting with OpenClaw AI Agents and x402 Payment.', creatorAddress } = options

  // 1. Load and upload image
  const imageBuffer = await fetchDefaultImage()
  const imageFile = new File([imageBuffer], 'Krump Verify.png', { type: 'image/png' })
  const { uri: imageUri } = await uploadFileToPinata(imageFile)
  const imageHash = await sha256Hex(imageBuffer)

  const imageGatewayUrl = imageUri.startsWith('ipfs://')
    ? `https://ipfs.io/ipfs/${imageUri.slice(7)}`
    : imageUri

  // 2. Build and upload NFT metadata (OpenSea ERC721 standard)
  const nftMetadata = {
    name: title,
    description,
    image: imageGatewayUrl,
    external_url: 'https://asura.lovable.app/',
    attributes: [
      { trait_type: 'Genre', value: 'Digital Art' },
      { trait_type: 'Style', value: 'Sci-Fi Urban' },
      { trait_type: 'Theme', value: 'Krump Dance' },
      { trait_type: 'Technology', value: 'AI Agents' },
      { trait_type: 'Platform', value: 'Blockchain' },
    ],
  }
  const nftMetadataJson = JSON.stringify(nftMetadata)
  const { uri: nftMetadataURI } = await uploadJsonToPinata(nftMetadataJson, 'nft-metadata.json')
  const nftMetadataGateway = nftMetadataURI.startsWith('ipfs://')
    ? `https://ipfs.io/ipfs/${nftMetadataURI.slice(7)}`
    : nftMetadataURI

  // 3. Build IPA metadata (Story IPA Metadata Standard)
  // Pass creatorAddress (e.g. connected wallet) so Story Explorer shows creator; zero address may show "NO DATA AVAILABLE".
  const zero = '0x0000000000000000000000000000000000000000'
  const creatorAddr = creatorAddress && creatorAddress.toLowerCase() !== zero ? creatorAddress : zero
  const ipMetadata = {
    title,
    description,
    createdAt: Math.floor(Date.now() / 1000).toString(),
    image: imageGatewayUrl,
    imageHash: imageHash as string,
    mediaUrl: imageGatewayUrl,
    mediaHash: imageHash as string,
    mediaType: 'image/png',
    creators: [
      {
        name: creatorAddr !== zero ? 'Creator' : 'OpenClaw',
        address: creatorAddr,
        contributionPercent: 100,
      },
    ],
    tags: ['Krump', 'Verify', 'AI', 'Agents', 'Openclaw', 'Dance', 'Blockchain', 'Payment', 'Sci-Fi', 'Urban', 'NFT'],
    ipType: 'Brand Asset',
  }

  const ipMetadataJson = JSON.stringify(ipMetadata)

  // Upload IPA metadata JSON to Pinata (3rd upload)
  const { uri: ipMetadataURIIpfs } = await uploadJsonToPinata(ipMetadataJson, 'ipa-metadata.json')

  const encoder = new TextEncoder()
  const ipMetadataHash = await sha256Hex(encoder.encode(ipMetadataJson))

  return {
    imageURI: imageGatewayUrl,
    nftMetadataURI: nftMetadataGateway,
    ipMetadataURI: ipMetadataURIIpfs,
    ipMetadataHash,
  }
}
