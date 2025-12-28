# Invoices API Failure Runbook

## Component
- **ID:** route-group-invoices
- **Type:** ROUTE_GROUP
- **Owner:** team:backend

## Health Check
- **Endpoint:** /api/health/invoices
- **Expected:** 200 OK

## Common Issues

### Issue 1: Invoice CRUD Failures
**Symptoms:** Unable to create, read, update, or delete invoices via API
**Resolution:**
1. Check database connectivity to PostgreSQL
2. Verify user authorization for invoice operations
3. Review Prisma query logs for errors
4. Check for database constraint violations

### Issue 2: Invoice List Performance Issues
**Symptoms:** Invoice list taking >5s to load, pagination failures
**Resolution:**
1. Check database indexes on invoice table
2. Review query complexity for filters
3. Implement cursor-based pagination if not present
4. Check for N+1 query issues

### Issue 3: Invoice Fiscalization Trigger Failures
**Symptoms:** Invoices created but not submitted for fiscalization
**Resolution:**
1. Verify fiscalization module is enabled for company
2. Check fiscal certificate is valid and not expired
3. Review invoice validation rules
4. Check fiscalization queue status

## Escalation
- Primary: team:backend
- Backup: #ops-critical

## References
- Code: src/app/api/invoices/
- Dependencies: module-invoicing
- Critical Path: path-fiscalization
- Endpoint Count: 1
