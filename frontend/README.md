# Krump Verify – Frontend

Wallet-connected UI to verify moves on Story Aeneid: connect wallet, enter IP ID and move data, approve USDC.k, then submit `verifyMove`.

## Stack

- **Vite** + **React** + **TypeScript**
- **Tailwind CSS**
- **Wagmi** + **RainbowKit** + **viem** (Story Aeneid, wallet connect)

## Setup

```bash
cd frontend
cp .env.example .env
# Edit .env if you need different RPC, explorer, or contract addresses
npm install
npm run dev
```

Open http://localhost:5173. Connect a wallet on **Story Aeneid (chain 1315)**. Get testnet IP from the [Story faucet](https://aeneid.faucet.story.foundation/).

## Env (optional)

| Variable | Description |
|----------|-------------|
| `VITE_RPC_URL` | Story Aeneid RPC (default: aeneid.storyrpc.io) |
| `VITE_EXPLORER_URL` | Block explorer (default: aeneid.storyscan.io) |
| `VITE_KRUMP_VERIFY_ADDRESS` | KrumpVerify contract |
| `VITE_USDC_K_ADDRESS` | USDC.k token |
| `VITE_WALLETCONNECT_PROJECT_ID` | WalletConnect Cloud project ID (for mobile wallets) |

## Build

```bash
npm run build
npm run preview
```

## Credits

StreetKode Fam: Asura, Hectik, Kronos, Jo · [Asura](https://asura.lovable.app/)
