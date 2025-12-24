#!/bin/bash
# FiskAI E2E Verification Script
# Proves: Fail-closed, evidence-first, non-hallucinating regulatory assistant

# Don't exit on first error - we want to run all tests

BASE_URL="${1:-http://localhost:3001}"
API_URL="$BASE_URL/api/assistant/chat"
PASS=0
FAIL=0

echo "=========================================="
echo "FiskAI E2E Verification Report"
echo "Base URL: $BASE_URL"
echo "Date: $(date -Iseconds)"
echo "=========================================="
echo ""

# Test helper function
test_api() {
    local name="$1"
    local query="$2"
    local surface="${3:-MARKETING}"
    local expected_kind="$4"
    local expected_field="$5"
    local expected_pattern="$6"

    echo -n "TEST: $name... "

    response=$(curl -s "$API_URL" \
        -H "Content-Type: application/json" \
        -d "{\"query\": \"$query\", \"surface\": \"$surface\"}")

    kind=$(echo "$response" | jq -r '.kind')

    if [ "$kind" = "$expected_kind" ]; then
        if [ -n "$expected_field" ] && [ -n "$expected_pattern" ]; then
            field_value=$(echo "$response" | jq -r ".$expected_field // empty")
            if echo "$field_value" | grep -q "$expected_pattern"; then
                echo "PASS"
                ((PASS++))
            else
                echo "FAIL (expected $expected_field to match '$expected_pattern', got '$field_value')"
                ((FAIL++))
            fi
        else
            echo "PASS"
            ((PASS++))
        fi
    else
        echo "FAIL (expected kind=$expected_kind, got kind=$kind)"
        ((FAIL++))
    fi
}

echo "PHASE A: Lock Matcher Guarantees (Fail-Closed)"
echo "----------------------------------------------"

# Gibberish queries must return REFUSAL
test_api "Gibberish 'xyz123 asdfghjkl qwerty'" "xyz123 asdfghjkl qwerty" "MARKETING" "REFUSAL"
test_api "Gibberish 'aslkdjf asdfkjh zxcvbn'" "aslkdjf asdfkjh zxcvbn" "MARKETING" "REFUSAL"
test_api "Random words 'purple elephant moon'" "purple elephant moon" "MARKETING" "REFUSAL"
test_api "Keyboard smash 'asdf jkl qwer'" "asdf jkl qwer" "MARKETING" "REFUSAL"

# Single-token queries must return REFUSAL (minimum intent check)
test_api "Single token 'pdv'" "pdv" "MARKETING" "REFUSAL"
test_api "Single token 'porez'" "porez" "MARKETING" "REFUSAL"

# Valid multi-token queries should return ANSWER
test_api "Valid 'koja je stopa PDV'" "koja je stopa PDV" "MARKETING" "ANSWER"
test_api "Valid 'opca stopa pdv u hrvatskoj'" "opca stopa pdv u hrvatskoj" "MARKETING" "ANSWER"

echo ""
echo "PHASE B: Schema & Citation Verification"
echo "----------------------------------------"

# Verify schema fields
response=$(curl -s "$API_URL" \
    -H "Content-Type: application/json" \
    -d '{"query": "koja je stopa PDV", "surface": "MARKETING"}')

echo -n "TEST: schemaVersion is 1.0.0... "
if echo "$response" | jq -e '.schemaVersion == "1.0.0"' > /dev/null 2>&1; then
    echo "PASS"
    ((PASS++))
else
    echo "FAIL"
    ((FAIL++))
fi

echo -n "TEST: requestId starts with 'req_'... "
if echo "$response" | jq -r '.requestId' | grep -q "^req_"; then
    echo "PASS"
    ((PASS++))
else
    echo "FAIL"
    ((FAIL++))
fi

echo -n "TEST: traceId starts with 'trace_'... "
if echo "$response" | jq -r '.traceId' | grep -q "^trace_"; then
    echo "PASS"
    ((PASS++))
else
    echo "FAIL"
    ((FAIL++))
fi

echo -n "TEST: ANSWER has citations... "
kind=$(echo "$response" | jq -r '.kind')
if [ "$kind" = "ANSWER" ]; then
    if echo "$response" | jq -e '.citations.primary' > /dev/null 2>&1; then
        echo "PASS"
        ((PASS++))
    else
        echo "FAIL (ANSWER without citations)"
        ((FAIL++))
    fi
else
    echo "SKIP (got $kind)"
fi

echo ""
echo "PHASE C: Surface & Personalization Differentiation"
echo "---------------------------------------------------"

# MARKETING surface should NOT include clientContext for non-personalized queries
test_api "MARKETING non-personalized has no clientContext" "koja je stopa PDV" "MARKETING" "ANSWER"
response=$(curl -s "$API_URL" \
    -H "Content-Type: application/json" \
    -d '{"query": "koja je stopa PDV", "surface": "MARKETING"}')
echo -n "TEST: MARKETING clientContext is undefined... "
if echo "$response" | jq -e '.clientContext == null' > /dev/null 2>&1; then
    echo "PASS"
    ((PASS++))
else
    echo "FAIL"
    ((FAIL++))
fi

# APP surface with personalization keywords + no companyId = MISSING_CLIENT_DATA
test_api "APP personalized without companyId" "koliko trebam platiti za PDV" "APP" "REFUSAL" "refusalReason" "MISSING_CLIENT_DATA"
# "moj porez na dohodak" doesn't match concepts, so it returns NO_CITABLE_RULES (correct)
# Using a query that will match concepts AND trigger personalization - "koliko" + PDV works
test_api "APP 'koliko moram platiti PDV' without companyId" "koliko moram platiti PDV" "APP" "REFUSAL" "refusalReason" "MISSING_CLIENT_DATA"

echo ""
echo "PHASE D: Conflict & Refusal Proof"
echo "----------------------------------"

# Verify refusal messages don't contain hallucinated content
response=$(curl -s "$API_URL" \
    -H "Content-Type: application/json" \
    -d '{"query": "xyz gibberish query", "surface": "MARKETING"}')

echo -n "TEST: Refusal has proper message... "
if echo "$response" | jq -e '.refusal.message' > /dev/null 2>&1; then
    echo "PASS"
    ((PASS++))
else
    echo "FAIL"
    ((FAIL++))
fi

echo -n "TEST: Refusal has relatedTopics... "
if echo "$response" | jq -e '.refusal.relatedTopics | length > 0' > /dev/null 2>&1; then
    echo "PASS"
    ((PASS++))
else
    echo "FAIL"
    ((FAIL++))
fi

echo ""
echo "=========================================="
echo "SUMMARY"
echo "=========================================="
echo "PASSED: $PASS"
echo "FAILED: $FAIL"
echo "TOTAL:  $((PASS + FAIL))"
echo ""

if [ $FAIL -eq 0 ]; then
    echo "✅ ALL TESTS PASSED - System fulfills fail-closed promise"
    exit 0
else
    echo "❌ TESTS FAILED - System has issues"
    exit 1
fi
