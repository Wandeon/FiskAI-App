#!/bin/bash
# Resource-limited FiskAI build for VPS-01
# This script limits CPU and memory to prevent OOM during builds
#
# Usage: ./build-limited.sh [tag]
# Limits: 4 CPUs, 8GB RAM max for build

set -e

TAG="${1:-latest}"
IMAGE="ghcr.io/wandeon/fiskai:${TAG}"
WORK_DIR="/home/admin/FiskAI"

echo "═══════════════════════════════════════════════════════════"
echo "  FiskAI Build (Resource Limited)"
echo "═══════════════════════════════════════════════════════════"
echo "  Tag:    ${TAG}"
echo "  Limits: 4 CPUs, 8GB RAM, 2GB swap"
echo ""

cd ${WORK_DIR}

# Pull latest code
git pull origin main || true

# Build with resource limits
# --cpuset-cpus limits to cores 0-3 (4 cores total)
# --memory limits RAM, --memory-swap includes swap
docker build \
  --cpuset-cpus="0-3" \
  --memory="8g" \
  --memory-swap="10g" \
  -t "${IMAGE}" \
  .

echo ""
echo "✅ Build complete: ${IMAGE}"
echo ""

# Optionally push to registry
if command -v docker-credential-ghcr &> /dev/null; then
  echo "Pushing to GHCR..."
  docker push "${IMAGE}"
  echo "✅ Pushed to GHCR"
fi
