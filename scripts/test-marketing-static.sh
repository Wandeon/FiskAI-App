#!/bin/bash
set -euo pipefail

echo "=== Marketing Static Purity Acceptance Test ==="
echo ""

cd /home/admin/FiskAI

# Step 1: Check for forbidden patterns in marketing code
echo "Step 1: Checking for forbidden patterns..."

FORBIDDEN_PATTERNS=(
  "force-dynamic"
  '"use server"'
  "next/server"
  "@/lib/db/drizzle"
  "@/lib/db/core"
  "@prisma/client"
  "@/lib/auth\""
  'from "@/lib/auth"'
  "getDetailedHealth"
  "checkRateLimit"
)

MARKETING_DIRS=(
  "src/app/(marketing)"
  "src/components/marketing"
  "src/components/news"
)

VIOLATIONS=0

for pattern in "${FORBIDDEN_PATTERNS[@]}"; do
  for dir in "${MARKETING_DIRS[@]}"; do
    if [ -d "$dir" ]; then
      # Exclude test files and the script itself
      if grep -r "$pattern" "$dir" --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v "test-marketing-static.sh" | grep -v ".test.ts"; then
        echo "VIOLATION: Found '$pattern' in $dir"
        VIOLATIONS=$((VIOLATIONS + 1))
      fi
    fi
  done
done

if [ $VIOLATIONS -gt 0 ]; then
  echo ""
  echo "FAILED: $VIOLATIONS forbidden pattern violations found"
  exit 1
fi
echo "OK: No forbidden patterns found"

# Step 2: Attempt build without DATABASE_URL
echo ""
echo "Step 2: Testing build with no database..."

# Save current DATABASE_URL if set
OLD_DATABASE_URL="${DATABASE_URL:-}"

# Unset database-related variables
unset DATABASE_URL
unset REDIS_URL

# Use empty WP_BASE_URL to force JSON fallback
export WP_BASE_URL=""

# Try the build
echo "Running: pnpm build (this may take a few minutes)..."
if pnpm build 2>&1 | tee /tmp/marketing-build.log; then
  echo "OK: Build succeeded"
else
  echo "FAILED: Build failed. Check /tmp/marketing-build.log"
  # Restore DATABASE_URL
  if [ -n "$OLD_DATABASE_URL" ]; then
    export DATABASE_URL="$OLD_DATABASE_URL"
  fi
  exit 1
fi

# Restore DATABASE_URL if it was set
if [ -n "$OLD_DATABASE_URL" ]; then
  export DATABASE_URL="$OLD_DATABASE_URL"
fi

# Step 3: Verify out/ directory exists and has expected files
echo ""
echo "Step 3: Verifying static output..."

if [ ! -d "out" ]; then
  echo "FAILED: out/ directory not created"
  exit 1
fi

EXPECTED_FILES=(
  "out/index.html"
  "out/vijesti/index.html"
  "out/status/index.html"
  "out/contact/index.html"
  "out/login/index.html"
  "out/register/index.html"
)

MISSING_FILES=0
for file in "${EXPECTED_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "  Found: $file"
  else
    echo "  MISSING: $file"
    MISSING_FILES=$((MISSING_FILES + 1))
  fi
done

if [ $MISSING_FILES -gt 0 ]; then
  echo ""
  echo "FAILED: $MISSING_FILES expected files missing from out/"
  exit 1
fi
echo "OK: All expected static files generated"

# Step 4: Serve and test with dumb static server
echo ""
echo "Step 4: Testing with static server..."

# Kill any existing serve process on port 3001
pkill -f "serve out -p 3001" 2>/dev/null || true
sleep 1

# Start serve in background
npx serve out -p 3001 &
SERVER_PID=$!
sleep 3

# Test pages
PAGES_TO_TEST=(
  "http://localhost:3001/"
  "http://localhost:3001/vijesti/"
  "http://localhost:3001/status/"
  "http://localhost:3001/contact/"
  "http://localhost:3001/login/"
  "http://localhost:3001/register/"
)

TEST_FAILED=0
for url in "${PAGES_TO_TEST[@]}"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
  if [ "$STATUS" = "200" ]; then
    echo "  OK: $url -> $STATUS"
  else
    echo "  FAILED: $url -> $STATUS"
    TEST_FAILED=1
  fi
done

# Cleanup
kill $SERVER_PID 2>/dev/null || true

if [ $TEST_FAILED -eq 1 ]; then
  echo ""
  echo "FAILED: Some pages not accessible via static server"
  exit 1
fi
echo "OK: All pages serve correctly"

# Step 5: Verify redirect pages contain meta refresh
echo ""
echo "Step 5: Verifying redirect pages..."

REDIRECT_PAGES=(
  "out/login/index.html"
  "out/register/index.html"
)

for page in "${REDIRECT_PAGES[@]}"; do
  if grep -q "app.fiskai.hr" "$page"; then
    echo "  OK: $page redirects to app.fiskai.hr"
  else
    echo "  FAILED: $page missing redirect to app.fiskai.hr"
    TEST_FAILED=1
  fi
done

if [ $TEST_FAILED -eq 1 ]; then
  echo ""
  echo "FAILED: Redirect pages missing app.fiskai.hr redirect"
  exit 1
fi

# Final summary
echo ""
echo "=== Phase 1 Acceptance Test PASSED ==="
echo ""
echo "Verified:"
echo "  ✓ No forbidden imports in marketing code"
echo "  ✓ Build succeeds without DATABASE_URL"
echo "  ✓ Static out/ directory created"
echo "  ✓ All marketing pages serve from static server"
echo "  ✓ Redirect pages point to app.fiskai.hr"
echo ""
echo "Marketing site is ready for static deployment."
