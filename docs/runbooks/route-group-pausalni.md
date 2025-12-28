# Pausalni API Failure Runbook

## Component
- **ID:** route-group-pausalni
- **Type:** ROUTE_GROUP
- **Owner:** team:compliance

## Health Check
- **Endpoint:** /api/health/pausalni
- **Expected:** 200 OK

## Common Issues

### Issue 1: Income Entry Failures
**Symptoms:** Unable to record income entries, API errors
**Resolution:**
1. Check database connectivity
2. Verify user has pausalni module enabled
3. Review input validation for amount and date
4. Check for duplicate entry prevention logic

### Issue 2: Tax Calculation API Errors
**Symptoms:** Tax calculation endpoint returning incorrect values or errors
**Resolution:**
1. Verify current tax rates in configuration
2. Check income aggregation logic
3. Review threshold calculations
4. Validate date range parameters

### Issue 3: Report Export Failures
**Symptoms:** PDF/Excel exports timing out or failing
**Resolution:**
1. Check report generation service health
2. Review data volume for requested period
3. Check memory allocation for large reports
4. Verify file storage (R2) connectivity

## Escalation
- Primary: team:compliance
- Backup: #ops-critical

## References
- Code: src/app/api/pausalni/
- Dependencies: module-pausalni
- Endpoint Count: 12
