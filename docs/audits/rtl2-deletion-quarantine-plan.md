# RTL2 Deletion and Quarantine Plan

**Date:** 2026-01-20
**Purpose:** Step-by-step plan to achieve clean slate before data ingestion

---

## Executive Summary

**Goal:** Ensure only RTL2 (event-driven) code can write to truth tables before ingesting production data.

**Current State:** Legacy batch code is actively running and can contaminate data.

**Target State:** All workers use RTL2 code, legacy paths are disabled.

---

## Phase 1: Emergency Stop (Immediate)

### 1.1 Stop Legacy Edge Building

**Action:** Disable buildKnowledgeGraph in production immediately.

```bash
# SSH to worker server
ssh admin@152.53.179.101

# Stop the releaser worker (it calls buildKnowledgeGraph after every release)
docker stop fiskai-worker-releaser

# Also stop scheduler (it has scheduled edge rebuilds)
docker stop fiskai-worker-scheduler
```

**Verification:**

```bash
docker ps | grep -E "releaser|scheduler"
# Should show no running containers
```

### 1.2 Disable Legacy Queues

**Action:** Pause all jobs in legacy queues.

```bash
# Connect to Redis and check graph-builder queue
docker run --rm --network redis_default redis:7-alpine \
  redis-cli -u 'redis://default:...@fiskai-redis-vps:6379' \
  lrange 'fiskai:graph-builder:waiting' 0 -1

# If any jobs, delete the queue
docker run --rm --network redis_default redis:7-alpine \
  redis-cli -u 'redis://default:...@fiskai-redis-vps:6379' \
  del 'fiskai:graph-builder:waiting' 'fiskai:graph-builder:active'
```

---

## Phase 2: Code Sync (2-4 hours)

### 2.1 Sync RTL2 Code to Workers Repo

**Files to copy from FiskAI to fiskai-workers:**

```bash
cd /home/admin

# Create sync script
cat > sync-rtl2-code.sh << 'EOF'
#!/bin/bash
SRC=/home/admin/FiskAI/src/lib/regulatory-truth
DST=/home/admin/fiskai-workers/src/lib/regulatory-truth

# New files
cp $SRC/graph/edge-builder.ts $DST/graph/
cp $SRC/graph/graph-rebuild-worker.ts $DST/graph/
cp $SRC/scripts/run-graph-rebuild.ts $DST/scripts/
cp $SRC/eval/rule-store-types.ts $DST/eval/
cp $SRC/eval/rule-store.ts $DST/eval/

# Updated files (merge carefully)
echo "Manual merge required for:"
echo "- $DST/services/rule-status-service.ts"
echo "- $DST/lib/infra/queues.ts"
EOF
chmod +x sync-rtl2-code.sh
```

### 2.2 Remove Legacy Calls

**Edit these files in fiskai-workers:**

1. `src/lib/regulatory-truth/workers/releaser.worker.ts`

   ```diff
   - import { buildKnowledgeGraph } from "../graph/knowledge-graph"

   - if (result.success) {
   -   await buildKnowledgeGraph()
   - }
   ```

2. `src/lib/regulatory-truth/workers/scheduler.service.ts`

   ```diff
   - import { buildKnowledgeGraph } from "../graph/knowledge-graph"

   - // In scheduled job:
   - const result = await buildKnowledgeGraph()
   + // Removed: batch edge building is now event-driven
   ```

3. `src/lib/regulatory-truth/scripts/overnight-run.ts`

   ```diff
   - const { buildKnowledgeGraph } = await import("../graph/knowledge-graph")
   - const graphResult = await buildKnowledgeGraph()
   + // Removed: batch edge building is now event-driven
   ```

4. `src/lib/regulatory-truth/watchdog/orchestrator.ts`
   ```diff
   - import { buildKnowledgeGraph } from "../graph/knowledge-graph"
   - await buildKnowledgeGraph()
   + // Removed: batch edge building is now event-driven
   ```

### 2.3 Add Legacy Kill Switch

**Add to `src/lib/regulatory-truth/graph/knowledge-graph.ts`:**

```typescript
export async function buildKnowledgeGraph(): Promise<GraphBuildResult> {
  // LEGACY KILL SWITCH - Remove this entire function after RTL2 is stable
  if (process.env.RTL_LEGACY_DISABLED !== "false") {
    throw new Error(
      "buildKnowledgeGraph is disabled. Use event-driven edge building via graph-rebuild queue. " +
        "Set RTL_LEGACY_DISABLED=false to override (NOT RECOMMENDED)."
    )
  }
  // ... rest of function
}
```

---

## Phase 3: Build and Deploy (1-2 hours)

### 3.1 Local Verification

```bash
cd /home/admin/fiskai-workers

# Install dependencies
npm install

# Generate Prisma
npm run prisma:generate

# Type check
npm run type-check

# Lint
npm run lint

# Build
npm run build:workers

# Verify build output includes new files
ls -la dist/workers/lib/regulatory-truth/graph/
# Should include: edge-builder.js, graph-rebuild-worker.js

ls -la dist/workers/lib/regulatory-truth/scripts/
# Should include: run-graph-rebuild.js
```

### 3.2 Commit and Push

```bash
cd /home/admin/fiskai-workers

git add -A
git commit -m "feat(rtl2): sync event-driven edge building from FiskAI

- Add edge-builder.ts for per-rule edge computation
- Add graph-rebuild-worker.ts for queue processing
- Add run-graph-rebuild.ts worker entrypoint
- Remove buildKnowledgeGraph calls from releaser, scheduler, overnight-run
- Add legacy kill switch to prevent accidental batch rebuilds

BREAKING: buildKnowledgeGraph() now throws by default.
Set RTL_LEGACY_DISABLED=false to override (not recommended).

Part of RTL2 clean slate initiative."

git push origin main
```

### 3.3 Wait for CI/CD

```bash
# Watch the workflow
gh run watch --exit-status

# Should complete:
# - lint-and-typecheck: pass
# - build: pass
# - build-docker: pass (builds new images)
# - deploy: pass (deploys to VPS)
```

---

## Phase 4: Verification (30 minutes)

### 4.1 Container Verification

```bash
# Verify all containers running new image
docker ps --format '{{.Names}} {{.Image}}' | grep fiskai-worker

# All should show same SHA:
# fiskai-worker-releaser ghcr.io/wandeon/fiskai-worker:<new-sha>
# fiskai-worker-scheduler ghcr.io/wandeon/fiskai-worker:<new-sha>
# etc.
```

### 4.2 Queue Verification

```bash
# Verify graph-rebuild queue is registered
docker run --rm --network redis_default redis:7-alpine \
  redis-cli -u 'redis://...@fiskai-redis-vps:6379' \
  keys 'fiskai:graph-rebuild:*'

# Should show:
# fiskai:graph-rebuild:meta
# fiskai:graph-rebuild:id
```

### 4.3 Worker Logs

```bash
# Check releaser doesn't call buildKnowledgeGraph
docker logs fiskai-worker-releaser --tail 50 2>&1 | grep -i "graph"
# Should NOT show "buildKnowledgeGraph"

# Check graph-rebuild worker is running
docker logs fiskai-worker-graph-rebuild --tail 50 2>&1
# Should show "[graph-rebuild] Worker started"
```

---

## Phase 5: Cleanup (After Verification)

### 5.1 Remove Legacy Queues from Redis

```bash
# Delete old graph-builder queue
docker run --rm --network redis_default redis:7-alpine \
  redis-cli -u 'redis://...@fiskai-redis-vps:6379' \
  keys 'fiskai:graph-builder:*' | xargs redis-cli DEL
```

### 5.2 Remove fiskai-repo Compose Stack

```bash
cd /home/admin/fiskai-repo
docker compose down
rm -rf /home/admin/fiskai-repo  # Optional: archive instead
```

### 5.3 Update Compose Override

Remove local image references in `docker-compose.workers.override.yml`:

- Change `image: fiskai-worker:local` to `image: ghcr.io/wandeon/fiskai-worker:${IMAGE_TAG:-latest}`
- Remove `image: fiskai-worker:pipeline-fix` references

---

## Phase 6: Monitoring (Ongoing)

### 6.1 Add Collision Detection Script

Create `scripts/rtl2-collision-scan.ts` to run in CI:

```typescript
// Fails if legacy code paths are found
// See implementation in rtl2-collision-scan.ts
```

### 6.2 Add Runtime Guards

Add to worker startup:

1. Verify BULLMQ_PREFIX is set
2. Verify RTL_LEGACY_DISABLED is not 'false'
3. Log image SHA on startup for audit

---

## Rollback Plan

If RTL2 deployment fails:

```bash
# Rollback to previous image
cd /home/admin/fiskai-workers
export IMAGE_TAG=<previous-sha>
docker compose -f docker-compose.workers.yml -f docker-compose.workers.override.yml pull
docker compose -f docker-compose.workers.yml -f docker-compose.workers.override.yml up -d

# Temporarily re-enable legacy
# (NOT RECOMMENDED - fix forward instead)
export RTL_LEGACY_DISABLED=false
docker compose up -d
```

---

## Success Criteria

- [ ] All workers running same GHCR image SHA
- [ ] No `buildKnowledgeGraph` calls in worker logs
- [ ] `fiskai:graph-rebuild:meta` queue exists
- [ ] `fiskai:graph-builder:*` queues deleted
- [ ] `fiskai-repo` compose stack removed
- [ ] No local image containers running
- [ ] CI collision scan passes
