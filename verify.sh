#!/usr/bin/env bash
# Verify KrumpTreasury and KrumpVerify on Story Aeneid (Blockscout at aeneid.storyscan.io)
set -e
cd "$(dirname "$0")"

CHAIN_ID=1315
VERIFIER_URL="https://aeneid.storyscan.io/api/"
RPC_URL="${RPC_URL:-${STORY_RPC:-https://aeneid.storyrpc.io}}"

# Deployed addresses (chain 1315; update after redeploy)
TREASURY_ADDRESS="0x69B1F2cc0CAa6eA977258C945c5E60c856f800F9"
KRUMP_VERIFY_ADDRESS="0x59422B9Ea7f9b5CfBBF23A4aed695FcCeF41eE91"
KRUMP_VERIFY_NFT_ADDRESS="0xA0d4cA5A926cd2E40e98318F3277Cc1A9e419A12"
USDC_K="0xd35890acdf3BFFd445C2c7fC57231bDE5cAFbde5"

echo "Verifying on chain $CHAIN_ID (Blockscout: $VERIFIER_URL)"
echo ""

echo "Verifying KrumpTreasury..."
forge verify-contract "$TREASURY_ADDRESS" \
  src/KrumpTreasury.sol:KrumpTreasury \
  --chain-id "$CHAIN_ID" \
  --verifier blockscout \
  --verifier-url "$VERIFIER_URL" \
  --constructor-args $(cast abi-encode "constructor(address)" "$USDC_K") \
  --watch

echo ""
echo "Verifying KrumpVerify..."
forge verify-contract "$KRUMP_VERIFY_ADDRESS" \
  src/KrumpVerify.sol:KrumpVerify \
  --chain-id "$CHAIN_ID" \
  --verifier blockscout \
  --verifier-url "$VERIFIER_URL" \
  --constructor-args $(cast abi-encode "constructor(address,address,address,address,address)" \
    0x0000000000000000000000000000000000000000 \
    0x0000000000000000000000000000000000000000 \
    0x0000000000000000000000000000000000000000 \
    "$USDC_K" \
    "$TREASURY_ADDRESS") \
  --watch

echo ""
echo "Verifying KrumpVerifyNFT..."
forge verify-contract "$KRUMP_VERIFY_NFT_ADDRESS" \
  src/KrumpVerifyNFT.sol:KrumpVerifyNFT \
  --chain-id "$CHAIN_ID" \
  --verifier blockscout \
  --verifier-url "$VERIFIER_URL" \
  --watch

echo ""
echo "Done. View contracts at: https://aeneid.storyscan.io"
