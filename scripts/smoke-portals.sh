#!/bin/bash
#
# Portal Smoke Test Script
#
# Verifies that all portal subdomains are responding correctly and
# that the redirect logic is working as expected.
#
# Usage:
#   ./scripts/smoke-portals.sh           # Test production
#   ./scripts/smoke-portals.sh staging   # Test staging (if configured)
#
# Exit codes:
#   0 - All checks passed
#   1 - One or more checks failed

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default to production
ENV="${1:-production}"

if [ "$ENV" = "staging" ]; then
  BASE_DOMAIN="staging.fiskai.hr"
else
  BASE_DOMAIN="fiskai.hr"
fi

HOSTS=(
  "https://$BASE_DOMAIN"
  "https://app.$BASE_DOMAIN"
  "https://staff.$BASE_DOMAIN"
  "https://admin.$BASE_DOMAIN"
)

FAILED=0

echo "========================================"
echo "Portal Smoke Test - $ENV"
echo "========================================"
echo ""

# Test /api/status on each host
echo "1. Testing /api/status endpoints..."
echo "----------------------------------------"
for h in "${HOSTS[@]}"; do
  echo -e "${YELLOW}$h/api/status${NC}"
  STATUS=$(curl -sS -w "\n%{http_code}" "$h/api/status" 2>/dev/null || echo "FAILED 000")
  HTTP_CODE=$(echo "$STATUS" | tail -n1)
  BODY=$(echo "$STATUS" | sed '$d')

  if [ "$HTTP_CODE" = "200" ]; then
    # Check for portal detection in response
    PORTAL=$(echo "$BODY" | grep -o '"detected":"[^"]*"' | head -1 || echo "not found")
    BUILD=$(echo "$BODY" | grep -o '"commitSha":"[^"]*"' | head -1 || echo "not found")
    echo -e "  ${GREEN}OK${NC} (HTTP $HTTP_CODE) - $PORTAL, $BUILD"
  elif [ "$HTTP_CODE" = "307" ] || [ "$HTTP_CODE" = "302" ]; then
    # Protected portals redirect to login when unauthenticated
    LOCATION=$(curl -sI "$h/api/status" 2>/dev/null | grep -i "^location:" | head -1 || echo "no location")
    echo -e "  ${GREEN}OK${NC} (HTTP $HTTP_CODE - redirecting to login) - $LOCATION"
  else
    echo -e "  ${RED}FAIL${NC} (HTTP $HTTP_CODE)"
    FAILED=1
  fi
done
echo ""

# Test root path redirects
echo "2. Testing root path behavior..."
echo "----------------------------------------"
for h in "${HOSTS[@]}"; do
  echo -e "${YELLOW}$h/${NC}"
  HEADERS=$(curl -sI "$h/" 2>/dev/null | head -15 || echo "FAILED")
  HTTP_CODE=$(echo "$HEADERS" | head -1 | awk '{print $2}')

  if [ "$HTTP_CODE" = "200" ]; then
    echo -e "  ${GREEN}OK${NC} (HTTP 200 - serving content)"
  elif [ "$HTTP_CODE" = "307" ] || [ "$HTTP_CODE" = "302" ]; then
    LOCATION=$(echo "$HEADERS" | grep -i "^location:" | head -1 | awk '{print $2}' | tr -d '\r')
    # Check that the redirect stays on the same host
    if [[ "$LOCATION" == "$h"* ]] || [[ "$LOCATION" == "/"* ]]; then
      echo -e "  ${GREEN}OK${NC} (HTTP $HTTP_CODE - redirect to: $LOCATION)"
    elif [[ "$LOCATION" == *"/login"* ]]; then
      echo -e "  ${GREEN}OK${NC} (HTTP $HTTP_CODE - unauthenticated, redirecting to login)"
    else
      echo -e "  ${YELLOW}WARN${NC} (HTTP $HTTP_CODE - redirect to different host: $LOCATION)"
    fi
  else
    echo -e "  ${RED}FAIL${NC} (HTTP $HTTP_CODE)"
    FAILED=1
  fi
done
echo ""

# Test /dashboard redirect (legacy compatibility)
echo "3. Testing /dashboard redirect (legacy compatibility)..."
echo "----------------------------------------"
for h in "${HOSTS[@]}"; do
  echo -e "${YELLOW}$h/dashboard${NC}"
  HEADERS=$(curl -sI "$h/dashboard" 2>/dev/null | head -15 || echo "FAILED")
  HTTP_CODE=$(echo "$HEADERS" | head -1 | awk '{print $2}')

  if [ "$HTTP_CODE" = "307" ] || [ "$HTTP_CODE" = "302" ]; then
    LOCATION=$(echo "$HEADERS" | grep -i "^location:" | head -1 | awk '{print $2}' | tr -d '\r')
    # /dashboard should redirect to / or to login, never 404
    if [[ "$LOCATION" == "$h/" ]] || [[ "$LOCATION" == "/" ]] || [[ "$LOCATION" == *"/login"* ]] || [[ "$LOCATION" == *"control-center"* ]]; then
      echo -e "  ${GREEN}OK${NC} (HTTP $HTTP_CODE - redirect to: $LOCATION)"
    else
      echo -e "  ${YELLOW}WARN${NC} (HTTP $HTTP_CODE - unexpected redirect: $LOCATION)"
    fi
  elif [ "$HTTP_CODE" = "200" ]; then
    echo -e "  ${GREEN}OK${NC} (HTTP 200 - dashboard page exists)"
  elif [ "$HTTP_CODE" = "404" ]; then
    echo -e "  ${RED}FAIL${NC} (HTTP 404 - legacy /dashboard not handled!)"
    FAILED=1
  else
    echo -e "  ${RED}FAIL${NC} (HTTP $HTTP_CODE)"
    FAILED=1
  fi
done
echo ""

# Summary
echo "========================================"
if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}All checks passed!${NC}"
  exit 0
else
  echo -e "${RED}Some checks failed!${NC}"
  exit 1
fi
