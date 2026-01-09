# Redis Migration Runbook: VPS-01 → VPS (x86)

> **Created:** 2026-01-09
> **Updated:** 2026-01-09 (fixed risky steps, added Phase 1.5)
> **Purpose:** Move BullMQ Redis from VPS-01 (ARM64) to VPS (x86) for migration prep
> **Prerequisite:** PR #1384 merged (worker portability)

---

## Overview

| Property      | VPS-01 (Source)            | VPS (Target)   |
| ------------- | -------------------------- | -------------- |
| Public IP     | 152.53.146.3               | 152.53.179.101 |
| Tailscale IP  | 100.64.123.81              | 100.120.14.126 |
| Architecture  | ARM64                      | x86_64         |
| Current Redis | fiskai-redis:6379 (Docker) | None           |

## Current State (VPS-01)

- Redis container: `fiskai-redis`
- Memory: 2GB maxmemory, allkeys-lru eviction
- Persistence: AOF enabled (`--appendonly yes`)
- Network: Coolify network + default network
- Keys: ~3M (mostly BullMQ job data)
- Queue backlog: ~10.3M jobs pending

---

## Phase 1.5: Portability Verification (Run Before Redis Move)

**Purpose:** Confirm all workers boot from compiled dist/ without bind mounts.

### 1.5.1 Verify No Source Mounts

```bash
# Check all workers for bind mounts to ./src
for w in $(docker ps --format '{{.Names}}' | grep fiskai-worker); do
  mounts=$(docker inspect "$w" --format '{{range .Mounts}}{{.Source}}:{{.Destination}} {{end}}')
  if echo "$mounts" | grep -q "/src:"; then
    echo "FAIL: $w has source mount: $mounts"
  else
    echo "OK: $w (mounts: ${mounts:-none})"
  fi
done
```

**Expected:** All workers show "OK" with no `/src:` mounts. Only `worker-content-sync` may have `/content:`.

### 1.5.2 Verify Module Resolution

```bash
# Check worker logs for module resolution errors
for w in $(docker ps --format '{{.Names}}' | grep fiskai-worker); do
  errors=$(docker logs "$w" 2>&1 | grep -c -E "Cannot find module|ERR_MODULE_NOT_FOUND|Error: Cannot find" || true)
  if [ "$errors" -gt 0 ]; then
    echo "FAIL: $w has $errors module resolution errors"
    docker logs "$w" 2>&1 | grep -E "Cannot find module|ERR_MODULE_NOT_FOUND" | head -3
  else
    echo "OK: $w (no module errors)"
  fi
done
```

**Expected:** All workers show "OK" with 0 module errors.

### 1.5.3 Verify Workers Actually Started

```bash
# Check each worker is running and has startup message
for w in $(docker ps --format '{{.Names}}' | grep fiskai-worker); do
  if docker logs "$w" 2>&1 | grep -q "Worker started\|ready\|listening"; then
    echo "OK: $w started successfully"
  else
    echo "WARN: $w may not have started - check logs"
  fi
done
```

### 1.5.4 Fail-Fast Log Grep Pattern

Use this pattern to catch module errors immediately after restart:

```bash
# Single command to check all workers for fatal errors
docker ps --format '{{.Names}}' | grep fiskai-worker | xargs -I{} sh -c \
  'docker logs {} 2>&1 | head -50 | grep -E "Cannot find module|ERR_MODULE_NOT_FOUND|ENOENT.*@/" && echo "^^^ FAIL: {}" || true'
```

**If any output appears:** Stop and fix before proceeding to Redis move.

---

## Step 1: Provision Redis on VPS

SSH to VPS and run:

```bash
# Connect to VPS
ssh admin@100.120.14.126

# Create Redis directory
sudo mkdir -p /opt/redis/data
sudo chown -R $USER:$USER /opt/redis

# Create Redis config
cat > /opt/redis/redis.conf << 'EOF'
# Bind to Tailscale interface only (not public)
bind 100.120.14.126 127.0.0.1

# Port
port 6379

# Memory limits (8GB for migration headroom)
maxmemory 8gb
maxmemory-policy allkeys-lru

# Persistence - AOF for durability
appendonly yes
appendfsync everysec
dir /data

# Logging
loglevel notice
logfile ""

# Security - require password
requirepass REDIS_PASSWORD_HERE
EOF

# Create docker-compose for Redis
cat > /opt/redis/docker-compose.yml << 'EOF'
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    container_name: fiskai-redis-vps
    restart: unless-stopped
    command: redis-server /usr/local/etc/redis/redis.conf
    volumes:
      - ./redis.conf:/usr/local/etc/redis/redis.conf:ro
      - ./data:/data
    ports:
      - "100.120.14.126:6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "REDIS_PASSWORD_HERE", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3
EOF

# Start Redis
cd /opt/redis
docker compose up -d

# Verify Redis is running (use ephemeral container, no install needed)
docker logs fiskai-redis-vps
docker run --rm redis:7-alpine redis-cli -h 100.120.14.126 -a REDIS_PASSWORD_HERE ping
```

**Replace `REDIS_PASSWORD_HERE` with actual password from `.env` file.**

---

## Step 2: Connectivity Test

### From VPS-01 Host (using ephemeral container)

```bash
# Test connectivity from VPS-01 to VPS Redis
docker run --rm --network host redis:7-alpine \
  redis-cli -h 100.120.14.126 -a REDIS_PASSWORD_HERE ping
```

Expected: `PONG`

### From VPS (Local)

```bash
# On VPS - test via ephemeral container
docker run --rm redis:7-alpine redis-cli -h 100.120.14.126 -a REDIS_PASSWORD_HERE ping
```

Expected: `PONG`

---

## Step 3: Cutover Plan

### Environment Variables to Update

| Service       | Variable  | Current Value               | New Value                                          |
| ------------- | --------- | --------------------------- | -------------------------------------------------- |
| All workers   | REDIS_URL | `redis://fiskai-redis:6379` | `redis://:REDIS_PASSWORD_HERE@100.120.14.126:6379` |
| App (Coolify) | REDIS_URL | (if exists)                 | `redis://:REDIS_PASSWORD_HERE@100.120.14.126:6379` |

### Step A: Start Redis on VPS

```bash
# On VPS
cd /opt/redis
docker compose up -d
docker logs -f fiskai-redis-vps
# Verify: should see "Ready to accept connections"
```

### Step B: Update Workers REDIS_URL

On VPS-01:

```bash
cd /home/admin/FiskAI

# Edit .env to add new REDIS_URL
# REDIS_URL=redis://:REDIS_PASSWORD_HERE@100.120.14.126:6379

# Stop all workers
docker compose -f docker-compose.workers.yml down

# Update environment (edit .env or export)
export REDIS_URL="redis://:REDIS_PASSWORD_HERE@100.120.14.126:6379"

# Start workers with new Redis
docker compose -f docker-compose.workers.yml up -d
```

### Step C: Validate Worker Queue Activity

```bash
# On VPS-01, check worker logs
docker logs fiskai-worker-orchestrator --tail 20
docker logs fiskai-worker-extractor --tail 20

# Should NOT see ECONNREFUSED
# Should see normal processing messages

# On VPS, check Redis activity (via ephemeral container)
docker run --rm redis:7-alpine redis-cli -h 100.120.14.126 -a REDIS_PASSWORD_HERE info clients
# Should show connected_clients > 0

docker run --rm redis:7-alpine redis-cli -h 100.120.14.126 -a REDIS_PASSWORD_HERE info stats
# Should show instantaneous_ops_per_sec > 0
```

### Step D: Update App REDIS_URL (Coolify)

In Coolify dashboard (http://152.53.146.3:8000):

1. Go to Applications → FiskAI
2. Edit Environment Variables
3. Add or update: `REDIS_URL=redis://:REDIS_PASSWORD_HERE@100.120.14.126:6379`
4. Redeploy application

### Step E: Verify Cross-Boundary Producers

These 4 locations in the App produce to worker queues:

| Producer                      | Queue         | Test Command                                                |
| ----------------------------- | ------------- | ----------------------------------------------------------- |
| `/api/regulatory/trigger`     | scheduled     | `curl -X POST http://localhost:3002/api/regulatory/trigger` |
| `lib/backup/export.ts`        | backup        | Trigger backup from UI                                      |
| `lib/article-agent/queue.ts`  | article       | Create article job from admin                               |
| `lib/system-status/worker.ts` | system-status | Wait for health check cycle                                 |

Verify jobs appear in VPS Redis (use SCAN, not KEYS to avoid blocking):

```bash
# On VPS - check for scheduled queue keys (non-blocking)
docker run --rm redis:7-alpine redis-cli -h 100.120.14.126 -a REDIS_PASSWORD_HERE \
  --scan --pattern "*scheduled*" | head -10

# Check for article queue keys
docker run --rm redis:7-alpine redis-cli -h 100.120.14.126 -a REDIS_PASSWORD_HERE \
  --scan --pattern "*article*" | head -10

# Check total key count (non-blocking)
docker run --rm redis:7-alpine redis-cli -h 100.120.14.126 -a REDIS_PASSWORD_HERE dbsize
```

---

## Step 4: Rollback Plan

If issues occur, revert to VPS-01 Redis:

### Quick Rollback (Workers Only)

```bash
# On VPS-01
cd /home/admin/FiskAI

# Stop workers
docker compose -f docker-compose.workers.yml down

# Revert REDIS_URL to old value
export REDIS_URL="redis://fiskai-redis:6379"

# Restart workers
docker compose -f docker-compose.workers.yml up -d
```

### Full Rollback (Workers + App)

1. Update workers as above
2. In Coolify: revert `REDIS_URL` to `redis://fiskai-redis:6379`
3. Redeploy app in Coolify

### Verify Rollback Success

```bash
# Check workers connect to old Redis
docker logs fiskai-worker-orchestrator --tail 10
# Should NOT see ECONNREFUSED

# Check VPS-01 Redis has activity again
docker exec fiskai-redis redis-cli info clients
```

---

## Step 5: Validation Checklist

### Pre-Cutover Checklist

- [ ] Phase 1.5 portability verification passed (no bind mounts, no module errors)
- [ ] VPS Redis container running
- [ ] VPS Redis accessible from VPS-01 (ping test)
- [ ] VPS Redis has 8GB memory configured
- [ ] VPS Redis authentication working
- [ ] Backup of current queue state noted

### During-Cutover Checklist

- [ ] Workers restarted with new REDIS_URL
- [ ] No ECONNREFUSED in worker logs
- [ ] VPS Redis shows connected clients
- [ ] App redeployed with new REDIS_URL
- [ ] Cross-boundary producers verified (scheduled, article queues)

### Post-Cutover Checklist

- [ ] Queue depths changing as expected (jobs being processed)
- [ ] No mass job failures in worker logs
- [ ] VPS Redis INFO shows stable memory
- [ ] No evictions during test window (30 min)
- [ ] BullMQ dashboard (if available) shows healthy queues

### Validation Commands

```bash
# On VPS - Redis health (via ephemeral container)
docker run --rm redis:7-alpine redis-cli -h 100.120.14.126 -a REDIS_PASSWORD_HERE info memory
# Check: used_memory_human < 8gb

docker run --rm redis:7-alpine redis-cli -h 100.120.14.126 -a REDIS_PASSWORD_HERE info stats | grep evicted
# Check: evicted_keys should be 0 or very low

docker run --rm redis:7-alpine redis-cli -h 100.120.14.126 -a REDIS_PASSWORD_HERE info clients
# Check: connected_clients should match number of workers + app

# On VPS-01 - Worker health
for w in orchestrator sentinel extractor ocr composer reviewer; do
  echo "=== worker-$w ==="
  docker logs fiskai-worker-$w --tail 3 2>&1 | grep -E "error|Error|ECONNREFUSED" || echo "OK"
done

# Queue depth check (from VPS-01)
npx tsx scripts/queue-status.ts
# Should show queues processing, not growing unboundedly
```

---

## Timing Estimate

| Step                   | Duration    |
| ---------------------- | ----------- |
| Phase 1.5 verification | 5 min       |
| Provision Redis on VPS | 10 min      |
| Connectivity tests     | 5 min       |
| Worker cutover         | 5 min       |
| App cutover            | 5 min       |
| Validation             | 15 min      |
| **Total**              | **~45 min** |

---

## Emergency Contacts

- VPS-01 access: `ssh admin@100.64.123.81`
- VPS access: `ssh admin@100.120.14.126`
- Coolify dashboard: http://152.53.146.3:8000
- Redis CLI on VPS: `docker run --rm redis:7-alpine redis-cli -h 100.120.14.126 -a REDIS_PASSWORD_HERE`

---

## Post-Migration Cleanup (After Stability Confirmed)

After 24-48 hours of stable operation:

1. Stop old Redis on VPS-01:

   ```bash
   docker stop fiskai-redis
   docker rm fiskai-redis
   ```

2. Remove old Redis volume (optional, keeps backup):

   ```bash
   docker volume rm fiskai_fiskai_redis_data
   ```

3. Update docker-compose.workers.yml to remove old Redis service definition (separate PR)

---

## End of Runbook

**Last updated:** 2026-01-09
**Status:** Ready for execution after PR #1384 merge
