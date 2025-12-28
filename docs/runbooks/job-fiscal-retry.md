# Fiscal Retry Cron Failure Runbook

## Component
- **ID:** job-fiscal-retry
- **Type:** JOB
- **Owner:** team:compliance

## Health Check
- **Endpoint:** /api/cron/fiscal-retry
- **Expected:** 200 OK with retry status

## Common Issues

### Issue 1: Retry Loop Not Processing
**Symptoms:** Failed invoices stuck in FAILED status, not being retried
**Resolution:**
1. Check retry eligibility criteria (max retries, cooldown period)
2. Verify cron job is executing
3. Review retry count incrementing
4. Check for permanent failure classification

### Issue 2: Excessive Retry Attempts
**Symptoms:** Same invoices retrying repeatedly, high FINA API usage
**Resolution:**
1. Check max retry limit configuration
2. Review exponential backoff implementation
3. Identify permanently failing invoices
4. Mark non-recoverable errors appropriately

### Issue 3: Retry Success Not Updating Status
**Symptoms:** Retries succeeding but invoice status not updating
**Resolution:**
1. Check database transaction commits
2. Review status update logic
3. Verify JIR/ZKI storage
4. Check for race conditions with other processes

## Escalation
- Primary: team:compliance
- Backup: #ops-critical

## References
- Code: src/app/api/cron/fiscal-retry/route.ts
- Dependencies: lib-fiscal, integration-fina-cis
- Critical Path: path-fiscalization
- Related: job-fiscal-processor for initial processing
