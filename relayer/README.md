# Krump Verify x402 Relayer

Express server that accepts signed x402 payment requests from the frontend, calls the EVVM adapter (when applicable), and submits payment receipts to KrumpVerify.

## Local

```bash
cp .env.example .env   # or create .env with RELAYER_PRIVATE_KEY, etc.
npm install
npm start
```

Runs at http://localhost:7350 (or `PORT` from env).

## Fly.io

**App:** [krump-x402-relayer](https://krump-x402-relayer.fly.dev)

- **Deploy** (from this directory): `fly deploy`
- **Set the relayer private key** (required for signing and submitting receipts):
  ```bash
  fly secrets set RELAYER_PRIVATE_KEY=0x<your_hex_private_key>
  ```
  Then restart: `fly apps restart krump-x402-relayer` (or redeploy).

Contract addresses and RPC are set in `fly.toml`; override with `fly secrets set RPC_URL=...` etc. if needed.

**Frontend:** Point `VITE_X402_RELAYER_URL` to `https://krump-x402-relayer.fly.dev` so the app uses the deployed relayer instead of localhost.
