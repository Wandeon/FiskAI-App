# Redis Cache and Queue Backend Failure Runbook

## Component
- **ID:** store-redis
- **Type:** STORE
- **Owner:** team:platform

## Health Check
- **Command:** redis-cli ping
- **Expected:** "PONG"

## Common Issues

### Issue 1: Redis Unreachable
**Symptoms:** Queue workers failing, cache misses, RTL pipeline stalled
**Resolution:**
1. Check Redis container: `docker ps | grep redis`
2. Check container logs: `docker logs fiskai-redis --tail 100`
3. Verify network connectivity to port 6379
4. Restart container if needed: `docker restart fiskai-redis`

### Issue 2: Memory Exhaustion
**Symptoms:** OOM errors, eviction warnings, data loss
**Resolution:**
1. Check memory usage: `redis-cli INFO memory`
2. Review maxmemory configuration (512mb)
3. Check eviction policy (allkeys-lru)
4. Clear non-essential cache keys if needed

### Issue 3: Queue Jobs Stuck
**Symptoms:** BullMQ jobs not processing, workers idle
**Resolution:**
1. Check queue status: `npx tsx scripts/queue-status.ts`
2. Review stuck jobs: `redis-cli LRANGE bull:*:active 0 -1`
3. Check for worker crashes during processing
4. Move stuck jobs back to waiting if safe

### Issue 4: Persistence Issues
**Symptoms:** Data lost after restart, RDB/AOF errors
**Resolution:**
1. Check RDB save status: `redis-cli LASTSAVE`
2. Review AOF configuration
3. Check disk space for persistence files
4. Verify backup schedule

## Escalation
- Primary: team:platform
- Backup: #ops-critical

## References
- Code: docker-compose.workers.yml
- Dependents: All RTL workers, queues, lib-cache
- Critical Path: path-rtl-pipeline
- Max Memory: 512mb
