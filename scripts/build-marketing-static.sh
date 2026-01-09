#!/bin/bash
# Build marketing-only static export
# Temporarily excludes non-marketing route groups to avoid conflicts
set -euo pipefail

# Use GITHUB_WORKSPACE in CI, otherwise find repo root from script location
if [ -n "${GITHUB_WORKSPACE:-}" ]; then
  cd "$GITHUB_WORKSPACE"
else
  cd "$(dirname "$0")/.."
fi

echo "=== Building Marketing Static Export ==="

# Route groups to exclude from static export (they run on separate subdomains)
# Also exclude API routes, auth routes, and other non-marketing routes
EXCLUDE_DIRS=(
  "src/app/(admin)"
  "src/app/(app)"
  "src/app/(staff)"
  "src/app/(auth)"
  "src/app/api"
  "src/app/actions"
  "src/app/admin-login"
  "src/app/offline"
  "src/app/feed.xml"
)

# Dynamic routes within marketing that can't be statically generated
# NOTE: As of Phase 2, all marketing routes are static-safe:
# - vodic/[slug] and usporedba/[slug] now use generateStaticParams
# - check-email, verify-email, select-role are now static redirect stubs
# - Original auth pages moved to (auth) route group
EXCLUDE_MARKETING_DYNAMIC=(
  # Currently empty - all marketing routes are static-compatible
)

# Marketing files that are incompatible with static export
# OG image routes use dynamic runtime, not compatible with static export
EXCLUDE_MARKETING_FILES=(
  "src/app/(marketing)/opengraph-image.tsx"
  "src/app/(marketing)/vodic/[slug]/opengraph-image.tsx"
  "src/app/(marketing)/vijesti/[slug]/opengraph-image.tsx"
)

# Root-level files that use force-dynamic or are incompatible with static export
EXCLUDE_ROOT_FILES=(
  "src/app/sitemap.ts"
  "src/app/robots.ts"
  "src/app/global-error.tsx"
)

# Dynamic image generation routes (directories with route.tsx)
EXCLUDE_IMAGE_ROUTES=(
  "src/app/logo.png"
  "src/app/og-knowledge-hub.png"
)

BACKUP_DIR=".static-export-backup"

# Cleanup function
cleanup() {
  echo "Restoring excluded route groups..."
  for dir in "${EXCLUDE_DIRS[@]}"; do
    base=$(basename "$dir")
    if [ -d "$BACKUP_DIR/$base" ]; then
      rm -rf "$dir"
      mv "$BACKUP_DIR/$base" "$dir"
      echo "  Restored: $dir"
    fi
  done

  echo "Restoring dynamic marketing routes..."
  for dir in "${EXCLUDE_MARKETING_DYNAMIC[@]}"; do
    # Use a unique backup name based on path
    backup_name=$(echo "$dir" | tr '/' '_')
    if [ -d "$BACKUP_DIR/$backup_name" ]; then
      mkdir -p "$(dirname "$dir")"
      rm -rf "$dir"
      mv "$BACKUP_DIR/$backup_name" "$dir"
      echo "  Restored: $dir"
    fi
  done

  echo "Restoring marketing files..."
  for file in "${EXCLUDE_MARKETING_FILES[@]}"; do
    backup_name=$(echo "$file" | tr '/' '_')
    if [ -f "$BACKUP_DIR/$backup_name" ]; then
      mv "$BACKUP_DIR/$backup_name" "$file"
      echo "  Restored: $file"
    fi
  done

  echo "Restoring root-level files..."
  for file in "${EXCLUDE_ROOT_FILES[@]}"; do
    backup_name=$(basename "$file")
    if [ -f "$BACKUP_DIR/$backup_name" ]; then
      mv "$BACKUP_DIR/$backup_name" "$file"
      echo "  Restored: $file"
    fi
  done

  echo "Restoring dynamic image routes..."
  for dir in "${EXCLUDE_IMAGE_ROUTES[@]}"; do
    backup_name=$(basename "$dir")
    if [ -d "$BACKUP_DIR/$backup_name" ]; then
      mv "$BACKUP_DIR/$backup_name" "$dir"
      echo "  Restored: $dir"
    fi
  done

  rm -rf "$BACKUP_DIR"
}

# Set trap to restore on exit (success or failure)
trap cleanup EXIT

# Step 1: Backup and exclude non-marketing route groups
echo "Step 1: Excluding non-marketing route groups..."
rm -rf "$BACKUP_DIR"
mkdir -p "$BACKUP_DIR"

for dir in "${EXCLUDE_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    base=$(basename "$dir")
    mv "$dir" "$BACKUP_DIR/$base"
    echo "  Excluded: $dir"
  fi
done

echo "Step 1b: Excluding dynamic marketing routes..."
for dir in "${EXCLUDE_MARKETING_DYNAMIC[@]}"; do
  if [ -d "$dir" ]; then
    backup_name=$(echo "$dir" | tr '/' '_')
    mv "$dir" "$BACKUP_DIR/$backup_name"
    echo "  Excluded: $dir"
  fi
done

echo "Step 1b2: Excluding marketing files..."
for file in "${EXCLUDE_MARKETING_FILES[@]}"; do
  if [ -f "$file" ]; then
    backup_name=$(echo "$file" | tr '/' '_')
    mv "$file" "$BACKUP_DIR/$backup_name"
    echo "  Excluded: $file"
  fi
done

echo "Step 1c: Excluding dynamic root files..."
for file in "${EXCLUDE_ROOT_FILES[@]}"; do
  if [ -f "$file" ]; then
    backup_name=$(basename "$file")
    mv "$file" "$BACKUP_DIR/$backup_name"
    echo "  Excluded: $file"
  fi
done

echo "Step 1d: Excluding dynamic image routes..."
for dir in "${EXCLUDE_IMAGE_ROUTES[@]}"; do
  if [ -d "$dir" ]; then
    backup_name=$(basename "$dir")
    mv "$dir" "$BACKUP_DIR/$backup_name"
    echo "  Excluded: $dir"
  fi
done

# Step 2: Clean previous build artifacts
echo "Step 2: Cleaning previous builds..."
rm -rf .next out

# Step 3: Run static export build
echo "Step 3: Running static export build..."
export STATIC_EXPORT=true

# Also set dummy database URL to ensure no DB dependencies
export DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"

if npm run build 2>&1 | tee /tmp/marketing-static-build.log; then
  echo ""
  echo "=== Static Export Build SUCCEEDED ==="
  echo "Output directory: out/"
  ls -la out/ 2>/dev/null | head -20
else
  echo ""
  echo "=== Static Export Build FAILED ==="
  echo "Check /tmp/marketing-static-build.log for details"
  exit 1
fi
