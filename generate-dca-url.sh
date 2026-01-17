#!/bin/bash

# Helper script to generate a signed URL for manual DCA trigger
# Usage: ./generate-dca-url.sh [YOUR_SECRET] [force]
# Example: ./generate-dca-url.sh my-secret-key force

if [ -z "$1" ]; then
  echo "❌ Error: Secret not provided"
  echo "Usage: ./generate-dca-url.sh YOUR_SECRET [force]"
  echo "Example: ./generate-dca-url.sh my-secret-key force"
  exit 1
fi

SECRET="$1"
FORCE_FLAG="$2"
BASE_URL="https://YOUR-SITE.netlify.app/.netlify/functions/manual-dca"

# Generate current Unix timestamp (in seconds)
TIMESTAMP=$(date +%s)

# Generate HMAC-SHA256 signature
SIGNATURE=$(echo -n "$TIMESTAMP" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2)

# Build URL
if [ "$FORCE_FLAG" = "force" ]; then
  URL="${BASE_URL}?timestamp=${TIMESTAMP}&signature=${SIGNATURE}&force=true"
else
  URL="${BASE_URL}?timestamp=${TIMESTAMP}&signature=${SIGNATURE}"
fi

echo ""
echo "✅ Generated signed URL (valid for 5 minutes):"
echo ""
echo "$URL"
echo ""
echo "📋 Copy and paste into browser or use with curl:"
echo "curl \"$URL\""
echo ""
