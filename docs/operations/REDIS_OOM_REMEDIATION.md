# Redis OOM Remediation - 2026-01-06

## Incident Summary

BullMQ workers were failing with:
```
OOM command not allowed when used memory > 'maxmemory'
```

## Root Cause Analysis

1. **Memory limit**: 512MB maxmemory (too small for job volume)
2. **Eviction policy**: `noeviction` (blocks writes when full instead of evicting)
3. **Job retention**: 24-hour age-based retention with ~121K jobs/hour = 2.9M potential jobs
4. **Failed jobs**: `removeOnFail: false` = infinite retention = unbounded growth

### Key Findings

| Metric | Before | After |
|--------|--------|-------|
| used_memory | 572MB | 4.5MB |
| maxmemory | 512MB | 2GB |
| maxmemory-policy | noeviction | allkeys-lru |
| Job keys | 508K+ | ~1K |

## Changes Applied

### 1. Redis Configuration (`docker-compose.workers.yml`)

```diff
- command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy noeviction
+ command: redis-server --appendonly yes --maxmemory 2gb --maxmemory-policy allkeys-lru
```

**Changes:**
- Increased maxmemory from 512MB to 2GB
- Changed eviction policy from `noeviction` to `allkeys-lru`

### 2. BullMQ Job Options (`src/lib/regulatory-truth/workers/queues.ts`)

```diff
const defaultJobOptions: JobsOptions = {
-  removeOnComplete: { age: RETENTION_MS }, // 24 hours
-  removeOnFail: false, // Keep forever
+  removeOnComplete: { count: 1000 }, // Keep last 1000
+  removeOnFail: { count: 100 }, // Keep last 100 failures
}
```

**Changes:**
- Switched from time-based to count-based retention
- `removeOnComplete: { count: 1000 }` - keeps last 1000 completed jobs per queue
- `removeOnFail: { count: 100 }` - keeps last 100 failed jobs per queue (was: keep forever)
- DLQ: `{ count: 5000 }` completed, `{ count: 500 }` failed
- System status: `{ count: 500 }` completed, `{ count: 50 }` failed

### 3. Immediate Remediation

```bash
# Applied runtime config (persists until container restart)
docker exec fiskai-redis redis-cli CONFIG SET maxmemory 2147483648
docker exec fiskai-redis redis-cli CONFIG SET maxmemory-policy allkeys-lru

# Flushed all stale job keys
docker exec fiskai-redis redis-cli FLUSHALL
```

## Verification

```bash
# Check current config
docker exec fiskai-redis redis-cli INFO memory | grep -E "used_memory_human|maxmemory"

# Check job counts
docker exec fiskai-redis redis-cli DBSIZE
```

## Prevention

1. **Count-based retention**: Prevents unbounded growth regardless of job volume
2. **LRU eviction**: Redis will evict oldest keys if memory pressure occurs
3. **Monitoring**: Add alerts for:
   - Redis memory > 1.5GB (warning)
   - Redis memory > 1.8GB (critical)
   - BullMQ completed job count > 50K (warning)

## Rollback

If issues occur, revert to time-based retention:

```typescript
const defaultJobOptions: JobsOptions = {
  removeOnComplete: { age: 24 * 60 * 60 * 1000 }, // 24 hours
  removeOnFail: { age: 7 * 24 * 60 * 60 * 1000 }, // 7 days
}
```

Note: Time-based retention requires sufficient memory (recommend 4GB+ for 24h retention at current job volume).

## Related

- PR: fix/ci-stability-redis-oom
- CLAUDE.md: See "Workers" section for queue monitoring commands
