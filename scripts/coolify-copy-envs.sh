#!/usr/bin/env bash
# Copy environment variables from one Coolify application to another
# Usage: ./coolify-copy-envs.sh <source_app_uuid> <target_app_uuid>
#
# Requires: COOLIFY_API_TOKEN environment variable
# Coolify API endpoint: https://coolify.gfranceschini.com/api/v1

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

COOLIFY_API="https://coolify.gfranceschini.com/api/v1"

# Validation
if [[ -z "${COOLIFY_API_TOKEN:-}" ]]; then
    echo -e "${RED}ERROR: COOLIFY_API_TOKEN environment variable is not set${NC}" >&2
    echo "Export it first: export COOLIFY_API_TOKEN='your-token'" >&2
    exit 1
fi

if [[ $# -ne 2 ]]; then
    echo -e "${RED}ERROR: Missing arguments${NC}" >&2
    echo "Usage: $0 <source_app_uuid> <target_app_uuid>" >&2
    exit 1
fi

SOURCE_APP="$1"
TARGET_APP="$2"

echo -e "${YELLOW}=== Coolify Environment Variable Copy ===${NC}"
echo "Source: $SOURCE_APP"
echo "Target: $TARGET_APP"
echo ""

# Verify source app exists
echo -e "${YELLOW}Verifying source application...${NC}"
SOURCE_RESPONSE=$(curl -sf -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
    "${COOLIFY_API}/applications/${SOURCE_APP}" 2>&1) || {
    echo -e "${RED}ERROR: Failed to access source application${NC}" >&2
    echo "Response: $SOURCE_RESPONSE" >&2
    exit 1
}
SOURCE_NAME=$(echo "$SOURCE_RESPONSE" | jq -r '.name // "unknown"')
echo -e "${GREEN}Found source app: $SOURCE_NAME${NC}"

# Verify target app exists
echo -e "${YELLOW}Verifying target application...${NC}"
TARGET_RESPONSE=$(curl -sf -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
    "${COOLIFY_API}/applications/${TARGET_APP}" 2>&1) || {
    echo -e "${RED}ERROR: Failed to access target application${NC}" >&2
    echo "Response: $TARGET_RESPONSE" >&2
    exit 1
}
TARGET_NAME=$(echo "$TARGET_RESPONSE" | jq -r '.name // "unknown"')
echo -e "${GREEN}Found target app: $TARGET_NAME${NC}"

# Fetch source env vars
echo -e "${YELLOW}Fetching environment variables from source...${NC}"
SOURCE_ENVS=$(curl -sf -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
    "${COOLIFY_API}/applications/${SOURCE_APP}/envs" 2>&1) || {
    echo -e "${RED}ERROR: Failed to fetch source environment variables${NC}" >&2
    exit 1
}

ENV_COUNT=$(echo "$SOURCE_ENVS" | jq 'length')
echo -e "${GREEN}Found $ENV_COUNT environment variables${NC}"

if [[ "$ENV_COUNT" -eq 0 ]]; then
    echo -e "${YELLOW}No environment variables to copy${NC}"
    exit 0
fi

# Copy each env var
echo -e "${YELLOW}Copying environment variables to target...${NC}"
SUCCESS=0
FAILED=0

echo "$SOURCE_ENVS" | jq -c '.[]' | while read -r env; do
    KEY=$(echo "$env" | jq -r '.key')
    VALUE=$(echo "$env" | jq -r '.value')
    IS_BUILD=$(echo "$env" | jq -r '.is_build_time // false')
    IS_PREVIEW=$(echo "$env" | jq -r '.is_preview // false')

    # Skip empty keys
    if [[ -z "$KEY" || "$KEY" == "null" ]]; then
        continue
    fi

    # Construct payload
    PAYLOAD=$(jq -n \
        --arg key "$KEY" \
        --arg value "$VALUE" \
        --argjson is_build_time "$IS_BUILD" \
        --argjson is_preview "$IS_PREVIEW" \
        '{key: $key, value: $value, is_build_time: $is_build_time, is_preview: $is_preview}')

    # Create env var on target
    RESULT=$(curl -sf -X POST \
        -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$PAYLOAD" \
        "${COOLIFY_API}/applications/${TARGET_APP}/envs" 2>&1) && {
        echo -e "  ${GREEN}✓${NC} $KEY"
    } || {
        echo -e "  ${RED}✗${NC} $KEY (may already exist or error)"
    }
done

echo ""
echo -e "${GREEN}=== Environment variable copy complete ===${NC}"
echo "Target app: $TARGET_NAME ($TARGET_APP)"
echo ""
echo "Next steps:"
echo "  1. Verify env vars in Coolify UI"
echo "  2. Deploy the target application"
