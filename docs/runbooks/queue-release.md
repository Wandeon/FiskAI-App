# Release Queue Failure Runbook

## Component
- **ID:** queue-release
- **Type:** QUEUE
- **Owner:** team:ai

## Health Check
- **Command:** redis-cli LLEN bull:release:waiting
- **Expected:** Queue length < 100

## Common Issues

### Issue 1: Queue Backlog Growing
**Symptoms:** Release queue length increasing, rules not being published
**Resolution:**
1. Check worker-releaser status: `pgrep -f releaser.worker`
2. Review queue processing rate: `npx tsx scripts/queue-status.ts`
3. Check for stuck jobs in processing state
4. Scale up releaser workers if needed

### Issue 2: Jobs Failing to Complete
**Symptoms:** Jobs moving to failed queue, high failure rate
**Resolution:**
1. Check failed job error messages
2. Review database connectivity
3. Check for constraint violations
4. Retry failed jobs: `npx tsx scripts/retry-failed.ts release`

### Issue 3: Rate Limiting Hitting Threshold
**Symptoms:** Jobs delayed due to rate limiting (max 2 per 60s)
**Resolution:**
1. Check if rate limiting is appropriate for current load
2. Review batch sizing for releases
3. Consider adjusting rate limiter settings
4. Monitor for backpressure from downstream

## Escalation
- Primary: team:ai
- Backup: #ops-critical

## References
- Code: src/lib/regulatory-truth/workers/queues.ts
- Dependencies: store-redis
- Critical Path: path-rtl-pipeline
- Rate Limiter: max 2 per 60000ms
