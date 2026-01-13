#!/usr/bin/env bash
# scripts/deploy-workers.sh
# Deploy workers using pre-built GHCR images
#
# Usage:
#   IMAGE_TAG=abc123def ./scripts/deploy-workers.sh
#   IMAGE_TAG=latest ./scripts/deploy-workers.sh
#
# Requires:
#   - Docker logged into ghcr.io (see docs/ops/ghcr-delivery.md)
#   - .env file with required environment variables

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Default to latest if not specified
IMAGE_TAG="${IMAGE_TAG:-latest}"

echo "=== FiskAI Worker Deployment ==="
echo "Image tag: $IMAGE_TAG"
echo "Project dir: $PROJECT_DIR"
echo ""

# Verify GHCR authentication
if ! docker pull "ghcr.io/wandeon/fiskai-worker:$IMAGE_TAG" --quiet > /dev/null 2>&1; then
    echo "❌ Failed to pull worker image. Check GHCR authentication."
    echo ""
    echo "To authenticate, run:"
    echo "  echo \$GHCR_TOKEN | docker login ghcr.io -u USERNAME --password-stdin"
    exit 1
fi

echo "✅ Worker image available: ghcr.io/wandeon/fiskai-worker:$IMAGE_TAG"

# Pull OCR image too
if ! docker pull "ghcr.io/wandeon/fiskai-worker-ocr:$IMAGE_TAG" --quiet > /dev/null 2>&1; then
    echo "⚠️  OCR image not available at tag $IMAGE_TAG, OCR worker may fail to start"
else
    echo "✅ OCR image available: ghcr.io/wandeon/fiskai-worker-ocr:$IMAGE_TAG"
fi

echo ""
echo "Pulling and restarting workers..."

# Export IMAGE_TAG for docker compose
export IMAGE_TAG

# Pull all images and recreate containers
docker compose -f docker-compose.workers.yml pull
docker compose -f docker-compose.workers.yml up -d --remove-orphans

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Check status with:"
echo "  docker compose -f docker-compose.workers.yml ps"
echo ""
echo "View logs with:"
echo "  docker compose -f docker-compose.workers.yml logs -f [service-name]"
echo ""
echo "Verify image versions with:"
echo "  docker compose -f docker-compose.workers.yml images"
