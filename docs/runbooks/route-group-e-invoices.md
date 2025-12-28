# E-Invoices API Failure Runbook

## Component
- **ID:** route-group-e-invoices
- **Type:** ROUTE_GROUP
- **Owner:** team:backend

## Health Check
- **Endpoint:** /api/health/e-invoices
- **Expected:** 200 OK

## Common Issues

### Issue 1: E-Invoice Send Failures
**Symptoms:** E-invoices not being sent, API returns errors
**Resolution:**
1. Check e-invoicing module health
2. Verify recipient PEPPOL ID is valid
3. Review XML generation for schema compliance
4. Check electronic signature certificate validity

### Issue 2: E-Invoice Receive Failures
**Symptoms:** Incoming e-invoices not appearing, polling errors
**Resolution:**
1. Check access point connectivity
2. Verify API credentials for receiving service
3. Review inbox polling job status
4. Check for message format compatibility issues

### Issue 3: Status Update Failures
**Symptoms:** E-invoice status not reflecting actual state
**Resolution:**
1. Check webhook/callback configuration
2. Review status polling mechanism
3. Verify database update transactions
4. Check for race conditions in status updates

## Escalation
- Primary: team:backend
- Backup: #ops-critical

## References
- Code: src/app/api/e-invoices/
- Dependencies: module-e-invoicing
- Endpoint Count: 2
