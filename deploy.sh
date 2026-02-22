#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "No .env file. Copy .env.example to .env and set PRIVATE_KEY. Optional: USDC_K, RPC_URL or STORY_RPC, RELAYER_ADDRESS."
  exit 1
fi

# Read RPC URL from .env (prefer RPC_URL, fallback to STORY_RPC)
RPC_URL=$(grep -E '^RPC_URL=' .env 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'")
STORY_RPC=$(grep -E '^STORY_RPC=' .env 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'")
URL="${RPC_URL:-${STORY_RPC:-https://aeneid.storyrpc.io}}"

echo "Using RPC: $URL (gas price: 10 gwei)"
VERIFIER_URL="https://aeneid.storyscan.io/api/"

# Deploy all 3: KrumpTreasury, KrumpVerify (with Story Aeneid IP/License/Royalty), KrumpVerifyNFT.
# Deployer gets RECEIPT_SUBMITTER_ROLE; set RELAYER_ADDRESS in .env to grant it to another address.
forge script script/DeployAll.s.sol:DeployAll \
  --rpc-url "$URL" \
  --broadcast \
  --gas-price 10000000000 \
  --legacy \
  --verify \
  --verifier blockscout \
  --verifier-url "$VERIFIER_URL"
