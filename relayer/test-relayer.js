#!/usr/bin/env node
/**
 * Integration test: POST to local relayer with a valid payload.
 * Requires RELAYER_PRIVATE_KEY in env (wallet must have RECEIPT_SUBMITTER_ROLE).
 * Run: node test-relayer.js [baseUrl]
 * Default baseUrl: http://localhost:7350
 */
import { keccak256, toHex } from 'viem'

const baseUrl = process.argv[2] || 'http://localhost:7350'
const receiptId = keccak256(toHex(crypto.getRandomValues(new Uint8Array(32))))
const payer = '0x0000000000000000000000000000000000000001'
const amount = '1000000'

const res = await fetch(`${baseUrl}/x402/pay`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ receiptId, from: payer, amount }),
})
const text = await res.text()
let body
try {
  body = JSON.parse(text)
} catch {
  body = { error: text }
}

if (res.ok && body.ok) {
  console.log('OK:', body.txHash)
  process.exit(0)
}
console.error('Failed:', res.status, body.error || text)
process.exit(1)
