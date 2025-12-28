# Cron API Failure Runbook

## Component
- **ID:** route-group-cron
- **Type:** ROUTE_GROUP
- **Owner:** team:platform

## Health Check
- **Endpoint:** /api/health/cron
- **Expected:** 200 OK

## Common Issues

### Issue 1: Cron Jobs Not Executing
**Symptoms:** Scheduled jobs not running, no recent execution logs
**Resolution:**
1. Check Vercel cron configuration in vercel.json
2. Verify cron endpoint authentication (CRON_SECRET)
3. Review Vercel dashboard for cron execution history
4. Check for deployment issues affecting cron routes

### Issue 2: Cron Job Timeouts
**Symptoms:** Jobs starting but not completing, timeout errors
**Resolution:**
1. Review job execution time vs. Vercel function timeout (10s/60s)
2. Check for long-running database queries
3. Consider breaking job into smaller batches
4. Review memory usage during execution

### Issue 3: Duplicate Job Executions
**Symptoms:** Same job running multiple times, data inconsistencies
**Resolution:**
1. Implement idempotency checks in job handlers
2. Review cron schedule for overlapping triggers
3. Check for retry logic causing duplicates
4. Add distributed locking if needed

## Escalation
- Primary: team:platform
- Backup: #ops-critical

## References
- Code: src/app/api/cron/
- Endpoint Count: 12 cron jobs
- Related Jobs: job-fiscal-processor, job-fiscal-retry, job-certificate-check, job-bank-sync
