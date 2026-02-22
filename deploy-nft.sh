#!/usr/bin/env bash
# Deploy KrumpVerifyNFT (with setTokenURI for Story Explorer traits).
# After deploy, set VITE_KRUMP_VERIFY_NFT_ADDRESS in frontend/.env to the printed address.
set -e
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "No .env file. Copy .env.example to .env and set PRIVATE_KEY and RPC_URL or STORY_RPC."
  exit 1
fi

RPC_URL=$(grep -E '^RPC_URL=' .env 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'")
STORY_RPC=$(grep -E '^STORY_RPC=' .env 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'")
URL="${RPC_URL:-$STORY_RPC}"

if [ -z "$URL" ] || [ "$URL" = "[]" ]; then
  echo "Set RPC_URL or STORY_RPC in .env (e.g. RPC_URL=https://aeneid.storyrpc.io)"
  exit 1
fi

echo "Using RPC: $URL"
VERIFIER_URL="https://aeneid.storyscan.io/api/"
forge script script/DeployKrumpVerifyNFT.s.sol:DeployKrumpVerifyNFT \
  --rpc-url "$URL" \
  --broadcast \
  --gas-price 10000000000 \
  --legacy \
  --verify \
  --verifier blockscout \
  --verifier-url "$VERIFIER_URL"

echo ""
echo "Done. Add the printed KrumpVerifyNFT address to frontend/.env as:"
echo "  VITE_KRUMP_VERIFY_NFT_ADDRESS=<address>"
