# RTL Sentinel Worker Failure Runbook

## Component
- **ID:** worker-sentinel
- **Type:** WORKER
- **Owner:** team:ai

## Health Check
- **Command:** pgrep -f sentinel.worker
- **Expected:** Process running

## Common Issues

### Issue 1: Source Fetching Failures
**Symptoms:** No new evidence being discovered, fetch errors in logs
**Resolution:**
1. Check network connectivity to regulatory sources
2. Verify source URLs are still valid (Narodne novine, Porezna uprava)
3. Review rate limiting/blocking from sources
4. Check SSL certificate validation

### Issue 2: Evidence Creation Failures
**Symptoms:** Sources fetched but evidence not being stored
**Resolution:**
1. Check PostgreSQL connectivity
2. Review evidence table constraints
3. Verify hash collision handling
4. Check disk space for content storage

### Issue 3: PDF Classification Errors
**Symptoms:** PDFs misclassified (PDF_TEXT vs PDF_SCANNED)
**Resolution:**
1. Review PDF parsing library errors
2. Check for corrupted PDF downloads
3. Verify text extraction logic
4. Review OCR queue routing

## Escalation
- Primary: team:ai
- Backup: #ops-critical

## References
- Architecture: docs/01_ARCHITECTURE/REGULATORY_TRUTH_LAYER.md
- Code: src/lib/regulatory-truth/workers/sentinel.worker.ts
- Dependencies: store-redis, queue-sentinel
- Critical Path: path-rtl-pipeline
