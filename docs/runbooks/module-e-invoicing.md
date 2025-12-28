# E-Invoicing Module Failure Runbook

## Component
- **ID:** module-e-invoicing
- **Type:** MODULE
- **Owner:** team:backend

## Health Check
- **Endpoint:** /api/health/e-invoicing
- **Expected:** 200 OK

## Common Issues

### Issue 1: e-Invoice XML Generation Failures
**Symptoms:** e-Invoices not generating valid UBL/ZUGFeRD XML, validation errors
**Resolution:**
1. Check XML schema validation logs
2. Verify all required invoice fields are populated
3. Review UBL version compatibility
4. Check for special character encoding issues

### Issue 2: e-Invoice Delivery Failures
**Symptoms:** e-Invoices stuck in pending state, delivery timeouts
**Resolution:**
1. Check PEPPOL network connectivity
2. Verify recipient endpoint availability
3. Review certificate validity for signing
4. Check message queue backlog

### Issue 3: R2 Storage Upload Failures
**Symptoms:** e-Invoice attachments not saving, storage errors
**Resolution:**
1. Verify Cloudflare R2 credentials
2. Check bucket permissions and CORS settings
3. Review file size limits
4. Check network connectivity to R2 endpoints

## Escalation
- Primary: team:backend
- Backup: #ops-critical

## References
- Feature Spec: docs/02_FEATURES/features/e-invoicing-create.md
- Code: src/lib/modules/definitions.ts
- Dependencies: module-invoicing, store-r2
