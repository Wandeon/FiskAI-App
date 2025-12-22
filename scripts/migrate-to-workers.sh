#!/bin/bash
# scripts/migrate-to-workers.sh
# Migration script for transitioning from overnight-run.ts to workers

set -e

echo "=== FiskAI Worker Migration ==="
echo ""

# Phase 1: Start Redis
echo "Phase 1: Starting Redis..."
docker compose -f docker-compose.workers.yml up redis -d
sleep 5

# Check Redis health
docker exec fiskai-redis redis-cli ping || {
  echo "ERROR: Redis not healthy"
  exit 1
}
echo "✓ Redis healthy"

# Phase 2: Build workers
echo ""
echo "Phase 2: Building workers..."
npm run build:workers || {
  echo "ERROR: Worker build failed"
  exit 1
}
echo "✓ Workers built"

# Phase 3: Start Bull Board
echo ""
echo "Phase 3: Starting Bull Board..."
docker compose -f docker-compose.workers.yml up bull-board -d
echo "✓ Bull Board available at http://localhost:3001"

# Phase 4: Start workers
echo ""
echo "Phase 4: Starting workers..."
docker compose -f docker-compose.workers.yml up -d
echo "✓ Workers started"

# Phase 5: Verify
echo ""
echo "Phase 5: Verifying deployment..."
sleep 10
docker compose -f docker-compose.workers.yml ps

echo ""
echo "=== Migration Complete ==="
echo ""
echo "Next steps:"
echo "1. Monitor Bull Board at http://localhost:3001"
echo "2. Check worker logs: npm run workers:logs"
echo "3. Trigger a test run: curl -X POST http://localhost:3000/api/regulatory/trigger"
echo "4. Once verified, disable overnight-run.ts cron"
