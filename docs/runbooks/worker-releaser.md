# RTL Releaser Worker Failure Runbook

## Component
- **ID:** worker-releaser
- **Type:** WORKER
- **Owner:** team:ai

## Health Check
- **Command:** pgrep -f releaser.worker
- **Expected:** Process running

## Common Issues

### Issue 1: Rule Publication Failures
**Symptoms:** Approved rules not appearing in production, release stuck
**Resolution:**
1. Check queue-release status: `npx tsx scripts/queue-status.ts`
2. Verify rule approval status
3. Check database transaction for publication
4. Review cache invalidation logic

### Issue 2: Cache Invalidation Failures
**Symptoms:** Old rules still being served after release, stale data
**Resolution:**
1. Check Redis connectivity
2. Verify cache key patterns
3. Force cache clear if needed: `redis-cli FLUSHDB` (use with caution)
4. Review CDN cache headers

### Issue 3: Version Conflict During Release
**Symptoms:** Release failing due to version mismatch, concurrent release issues
**Resolution:**
1. Check for concurrent release attempts
2. Review optimistic locking implementation
3. Implement distributed lock if needed
4. Retry release after conflict resolution

## Escalation
- Primary: team:ai
- Backup: #ops-critical

## References
- Architecture: docs/01_ARCHITECTURE/REGULATORY_TRUTH_LAYER.md
- Code: src/lib/regulatory-truth/workers/releaser.worker.ts
- Dependencies: store-redis, queue-release
- Critical Path: path-rtl-pipeline
