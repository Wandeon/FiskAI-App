# RTL2 Runtime Inventory Audit

**Date:** 2026-01-20
**Purpose:** Document all running worker containers, schedulers, and queues before clean slate

---

## Summary of Critical Findings

| Issue                                                  | Severity | Status          |
| ------------------------------------------------------ | -------- | --------------- |
| Workers repo has OLD `buildKnowledgeGraph` code        | CRITICAL | Action Required |
| Graph-rebuild worker fails to start (MODULE_NOT_FOUND) | CRITICAL | Action Required |
| 4 workers running from LOCAL images (not GHCR)         | HIGH     | Action Required |
| Mixed image versions across containers                 | MEDIUM   | Action Required |
| Legacy `fiskai:graph-builder` queue exists             | HIGH     | Needs Cleanup   |

---

## 1. Running Containers

### Worker Server (VPS)

**Command:** `docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.CreatedAt}}'`

| Container                    | Image                                  | Status      | Issue           |
| ---------------------------- | -------------------------------------- | ----------- | --------------- |
| fiskai-worker-scheduler      | `fiskai-worker:local`                  | Up 18h      | **LOCAL IMAGE** |
| fiskai-worker-pointer-repair | `fiskai-worker:pipeline-fix`           | Up 21h      | **LOCAL IMAGE** |
| fiskai-worker-content-scout  | `fiskai-worker:pipeline-fix`           | Up 21h      | **LOCAL IMAGE** |
| fiskai-worker-sentinel       | `fiskai-worker:pipeline-fix`           | Up 21h      | **LOCAL IMAGE** |
| fiskai-worker-graph-rebuild  | `ghcr.io/.../fiskai-worker:d0d3014...` | **Created** | **NOT RUNNING** |
| fiskai-worker-arbiter        | `ghcr.io/.../fiskai-worker:latest`     | Up 19h      | Mixed version   |
| fiskai-worker-extractor      | `ghcr.io/.../fiskai-worker:latest`     | Up 19h      | Mixed version   |
| fiskai-worker-releaser       | `ghcr.io/.../fiskai-worker:latest`     | Up 19h      | Mixed version   |
| fiskai-worker-composer       | `ghcr.io/.../fiskai-worker:latest`     | Up 19h      | Mixed version   |
| fiskai-worker-reviewer       | `ghcr.io/.../fiskai-worker:latest`     | Up 19h      | Mixed version   |
| 14 other workers             | `ghcr.io/.../fiskai-worker:4c020fd...` | Up 44h      | Older SHA       |

### Graph-Rebuild Worker Failure

**Error:** `MODULE_NOT_FOUND: /app/dist/workers/lib/regulatory-truth/scripts/run-graph-rebuild.js`

**Root Cause:** The workers repo does not have the `run-graph-rebuild.ts` script - it only exists in FiskAI repo. The worker image was built from workers repo which doesn't include the new graph-rebuild code.

**Evidence:**

```
docker logs fiskai-worker-graph-rebuild 2>&1 | tail -10
# Error: Cannot find module '/app/dist/workers/lib/regulatory-truth/scripts/run-graph-rebuild.js'
```

---

## 2. Compose Stacks

**Command:** `docker compose ls`

| Stack              | Services | Config                                |
| ------------------ | -------- | ------------------------------------- |
| `fiskai-workers`   | 19       | docker-compose.workers.yml + override |
| `fiskai-repo`      | 1        | **LEGACY STACK** (only redis)         |
| `automation-stack` | 6        | Unrelated                             |
| `monitoring`       | 5        | Unrelated                             |

**Issue:** `fiskai-repo` stack should be removed - it's a potential collision source.

---

## 3. Redis Queues

**Connection:** `redis://fiskai-redis-vps:6379` (via redis_default network)

### Active Queues (fiskai: prefix)

```
fiskai:apply:meta
fiskai:arbiter:meta
fiskai:composer:meta
fiskai:consolidator:meta
fiskai:content-sync:meta
fiskai:deadletter:meta
fiskai:embedding:meta
fiskai:evidence-embedding:meta
fiskai:extractor:meta
fiskai:graph-builder:meta          ← LEGACY QUEUE!
fiskai:ocr:meta
fiskai:pointer-repair:meta
fiskai:quote-healer:meta
fiskai:regression-detector:meta
fiskai:releaser:meta
fiskai:revalidation:meta
fiskai:reviewer:meta
fiskai:router:meta
fiskai:scheduled:meta
fiskai:scout:meta
fiskai:scraper:meta
fiskai:selector-adaptation:meta
fiskai:sentinel:meta
fiskai:system-status:meta
```

### Mixed Prefix Queues

```
bull:pointer-repair:*              ← WRONG PREFIX (should be fiskai:)
```

**Issue:** `fiskai:graph-builder` is the legacy batch queue. `bull:` prefix queues bypass namespace isolation.

---

## 4. Schedulers

### Cron Jobs

**Command:** `crontab -l && sudo ls /etc/cron.d/`

- No user crontab
- System cron: Only standard `e2scrub_all`, `kernel` entries

### Systemd Timers

**Command:** `systemctl list-timers --all`

- No RTL-related timers found
- `chrome-watchdog.timer` - unrelated
- `fleet-db-backup.timer` - unrelated

---

## 5. Required Actions

### CRITICAL

1. **Sync graph-rebuild code to workers repo**
   - Copy `src/lib/regulatory-truth/graph/graph-rebuild-worker.ts` from FiskAI
   - Copy `src/lib/regulatory-truth/scripts/run-graph-rebuild.ts` from FiskAI
   - Update queue registration in workers repo

2. **Remove buildKnowledgeGraph from workers repo**
   - `src/lib/regulatory-truth/workers/releaser.worker.ts:23` - Remove call
   - `src/lib/regulatory-truth/workers/scheduler.service.ts:485` - Remove call
   - `src/lib/regulatory-truth/scripts/overnight-run.ts:312` - Remove call
   - `src/lib/regulatory-truth/watchdog/orchestrator.ts:307` - Remove call

3. **Rebuild and redeploy all workers with new image**

### HIGH

4. **Remove local image workers**
   - Update compose override to use GHCR images for all workers
   - scheduler, pointer-repair, content-scout, sentinel

5. **Clean up legacy queues**
   - Delete `fiskai:graph-builder:*` keys from Redis
   - Verify no consumers for legacy queues

### MEDIUM

6. **Remove fiskai-repo compose stack**

   ```bash
   cd /home/admin/fiskai-repo && docker compose down
   ```

7. **Standardize image versions**
   - All workers should use same IMAGE_TAG

---

## Evidence Commands

```bash
# List running containers
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'

# Check compose stacks
docker compose ls

# List Redis queues
docker run --rm --network redis_default redis:7-alpine \
  redis-cli -u 'redis://...@fiskai-redis-vps:6379' keys 'fiskai:*:meta'

# Check graph-rebuild worker logs
docker logs fiskai-worker-graph-rebuild 2>&1

# Check for buildKnowledgeGraph in workers
git grep -n "buildKnowledgeGraph" -- "*.ts" | grep -v test
```
