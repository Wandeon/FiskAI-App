# Fiscal Processor Cron Failure Runbook

## Component
- **ID:** job-fiscal-processor
- **Type:** JOB
- **Owner:** team:compliance

## Health Check
- **Endpoint:** /api/cron/fiscal-processor
- **Expected:** 200 OK with processing status

## Common Issues

### Issue 1: Job Not Triggering
**Symptoms:** Pending invoices not being fiscalized, no job execution logs
**Resolution:**
1. Check Vercel cron configuration
2. Verify CRON_SECRET environment variable
3. Review cron schedule timing
4. Check for deployment issues

### Issue 2: FINA CIS Batch Processing Failures
**Symptoms:** Some invoices fiscalized, others failing in batch
**Resolution:**
1. Identify failing invoices from logs
2. Check individual invoice data validity
3. Review FINA error codes
4. Retry individual failures

### Issue 3: Certificate Issues During Processing
**Symptoms:** All fiscalization attempts failing with cert errors
**Resolution:**
1. Check fiscal certificate expiration
2. Verify certificate is properly loaded
3. Check PKCS12 password
4. Review certificate chain

## Escalation
- Primary: team:compliance
- Backup: #ops-critical

## References
- Code: src/app/api/cron/fiscal-processor/route.ts
- Dependencies: lib-fiscal, integration-fina-cis
- Critical Path: path-fiscalization
- Related: job-fiscal-retry for failed retries
