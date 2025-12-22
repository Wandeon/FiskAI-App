#!/bin/bash

# Test rate limiting on the /api/rules/search endpoint
# This script will make 65 requests in quick succession
# The first 60 should succeed, the last 5 should return 429

echo "Testing rate limiting on /api/rules/search endpoint"
echo "Making 65 requests in quick succession..."
echo ""

BASE_URL="${1:-http://localhost:3000}"
SUCCESS_COUNT=0
RATE_LIMITED_COUNT=0

for i in {1..65}; do
  RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/rules/search?q=pausalni&limit=5")
  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  
  if [ "$HTTP_CODE" = "200" ]; then
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    echo "Request $i: ✓ Success (200)"
  elif [ "$HTTP_CODE" = "429" ]; then
    RATE_LIMITED_COUNT=$((RATE_LIMITED_COUNT + 1))
    BODY=$(echo "$RESPONSE" | sed '$d')
    REMAINING=$(echo "$BODY" | grep -o '"X-RateLimit-Remaining":"[^"]*"' || echo "N/A")
    echo "Request $i: ✗ Rate Limited (429) - $REMAINING"
  else
    echo "Request $i: ? Unexpected ($HTTP_CODE)"
  fi
  
  # Small delay to avoid overwhelming the server
  sleep 0.05
done

echo ""
echo "Summary:"
echo "  Successful requests: $SUCCESS_COUNT"
echo "  Rate limited requests: $RATE_LIMITED_COUNT"
echo ""
echo "Expected: ~60 successful, ~5 rate limited"
