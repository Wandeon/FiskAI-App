#!/bin/bash
# validate-env.sh
# Validates .env file for placeholder values that should not be used in production
set -euo pipefail
ENV_FILE="${1:-.env}"
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: Environment file not found: $ENV_FILE"
  exit 2
fi
echo "Validating environment file: $ENV_FILE"
echo "Checking for placeholder values that should not be used in production..."
echo ""
PATTERNS=("REPLACE_ME" "REPLACE_with" "GENERATE_WITH" "change_me" "your_.*_key" "your_.*_secret" "sk_test_your" "whsec_your" "re_your" "sk-your")
FOUND_PLACEHOLDER=0
for PATTERN in "${PATTERNS[@]}"; do
  if grep -qE "$PATTERN" "$ENV_FILE" 2>/dev/null; then
    echo "WARNING: Found placeholder pattern '$PATTERN' in $ENV_FILE"
    FOUND_PLACEHOLDER=1
  fi
done
if [ $FOUND_PLACEHOLDER -eq 1 ]; then
  echo "VALIDATION FAILED"
  echo "Your .env file contains placeholder values that must be replaced before deployment."
  exit 1
fi
echo "No placeholder values detected"
echo "Environment file validation passed"
exit 0
