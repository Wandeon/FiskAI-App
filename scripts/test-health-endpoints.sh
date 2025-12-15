#!/bin/bash
# Test script for health check and monitoring endpoints

set -e

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"
ENDPOINTS=(
  "/api/health"
  "/api/health/ready"
  "/api/status"
)

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "======================================"
echo "Testing FiskAI Health Check Endpoints"
echo "======================================"
echo ""
echo "Base URL: $BASE_URL"
echo ""

# Function to test an endpoint
test_endpoint() {
  local endpoint=$1
  local url="${BASE_URL}${endpoint}"

  echo "-----------------------------------"
  echo "Testing: $endpoint"
  echo "-----------------------------------"

  # Get status code
  status_code=$(curl -s -o /dev/null -w "%{http_code}" "$url")

  # Get response body
  response=$(curl -s "$url")

  # Check if response is valid JSON
  if echo "$response" | jq . > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Valid JSON response${NC}"
  else
    echo -e "${RED}✗ Invalid JSON response${NC}"
    return 1
  fi

  # Display status code with color
  if [ "$status_code" -eq 200 ]; then
    echo -e "${GREEN}✓ Status Code: $status_code${NC}"
  elif [ "$status_code" -eq 503 ]; then
    echo -e "${YELLOW}⚠ Status Code: $status_code (Service Unavailable)${NC}"
  else
    echo -e "${RED}✗ Status Code: $status_code${NC}"
  fi

  # Pretty print response
  echo ""
  echo "Response:"
  echo "$response" | jq '.'
  echo ""

  return 0
}

# Test each endpoint
for endpoint in "${ENDPOINTS[@]}"; do
  if test_endpoint "$endpoint"; then
    echo -e "${GREEN}✓ Test passed for $endpoint${NC}"
  else
    echo -e "${RED}✗ Test failed for $endpoint${NC}"
  fi
  echo ""
done

echo "======================================"
echo "All tests completed!"
echo "======================================"
