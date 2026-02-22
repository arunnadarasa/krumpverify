/**
 * Pinata IPFS upload using VITE_PINATA_JWT. Required for registration metadata step.
 */

const PINATA_UPLOAD_URL = 'https://uploads.pinata.cloud/v3/files'

function getJwt(): string {
  const jwt = import.meta.env.VITE_PINATA_JWT
  if (!jwt || typeof jwt !== 'string' || jwt.trim() === '') {
    throw new Error('VITE_PINATA_JWT is required. Add it to your .env in the frontend folder.')
  }
  return jwt.trim()
}

/**
 * Upload a file to Pinata (public IPFS). Returns the IPFS CID.
 */
export async function uploadFileToPinata(file: File): Promise<{ cid: string; uri: string }> {
  const jwt = getJwt()
  const form = new FormData()
  form.append('file', file)
  form.append('network', 'public')
  const res = await fetch(PINATA_UPLOAD_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Pinata upload failed: ${res.status} ${err}`)
  }
  const data = (await res.json()) as { data?: { cid?: string } }
  const cid = data?.data?.cid
  if (!cid) throw new Error('Pinata did not return a CID')
  return { cid, uri: `ipfs://${cid}` }
}

/**
 * Upload JSON to Pinata by creating a File from the string. Returns CID and URI.
 */
export async function uploadJsonToPinata(
  json: string,
  filename: string
): Promise<{ cid: string; uri: string }> {
  const file = new File([json], filename, { type: 'application/json' })
  return uploadFileToPinata(file)
}

/**
 * SHA-256 hash of raw bytes, returned as 0x-prefixed hex (32 bytes).
 */
export async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<`0x${string}`> {
  const buffer = data instanceof ArrayBuffer ? new Uint8Array(data) : data
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `0x${hex}` as `0x${string}`
}

export function hasPinataJwt(): boolean {
  try {
    getJwt()
    return true
  } catch {
    return false
  }
}
