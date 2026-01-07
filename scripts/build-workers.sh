#!/bin/bash
# scripts/build-workers.sh
# Build worker images with proper tagging and version info

set -e

GIT_SHA=$(git rev-parse HEAD)
GIT_SHA_SHORT=$(git rev-parse --short HEAD)
BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)
REGISTRY=${REGISTRY:-""}  # Optional registry prefix

echo "Building worker images..."
echo "  GIT_SHA: $GIT_SHA"
echo "  BUILD_DATE: $BUILD_DATE"

# Build base worker (no OCR)
echo ""
echo "=== Building base worker image ==="
docker build -f Dockerfile.worker \
  --build-arg GIT_SHA="$GIT_SHA" \
  --build-arg BUILD_DATE="$BUILD_DATE" \
  --build-arg WITH_OCR=false \
  -t "${REGISTRY}fiskai-worker:${GIT_SHA_SHORT}" \
  -t "${REGISTRY}fiskai-worker:latest" \
  .

# Build OCR worker
echo ""
echo "=== Building OCR worker image ==="
docker build -f Dockerfile.worker \
  --build-arg GIT_SHA="$GIT_SHA" \
  --build-arg BUILD_DATE="$BUILD_DATE" \
  --build-arg WITH_OCR=true \
  -t "${REGISTRY}fiskai-worker-ocr:${GIT_SHA_SHORT}" \
  -t "${REGISTRY}fiskai-worker-ocr:latest" \
  .

echo ""
echo "=== Build complete ==="
docker images | grep fiskai-worker | head -5
