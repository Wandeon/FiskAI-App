# Pausalni Module Failure Runbook

## Component
- **ID:** module-pausalni
- **Type:** MODULE
- **Owner:** team:compliance

## Health Check
- **Endpoint:** /api/health/pausalni
- **Expected:** 200 OK

## Common Issues

### Issue 1: Tax Calculation Errors
**Symptoms:** Pausalni tax calculations showing incorrect amounts, dashboard totals wrong
**Resolution:**
1. Verify current year's pausalni tax rates in configuration
2. Check income threshold calculations
3. Review business type classification
4. Validate contribution base calculations

### Issue 2: Deadline Tracking Failures
**Symptoms:** Missing or incorrect tax deadline notifications
**Resolution:**
1. Check deadline calculation logic for current quarter
2. Verify calendar/holiday data is up to date
3. Review notification job (job-deadline-reminders) status
4. Check user timezone settings

### Issue 3: Report Generation Issues
**Symptoms:** Quarterly reports not generating or showing incomplete data
**Resolution:**
1. Verify all income entries for the period
2. Check database aggregation queries
3. Review PDF template rendering
4. Validate date range filtering

## Escalation
- Primary: team:compliance
- Backup: #ops-critical

## References
- Feature Spec: docs/02_FEATURES/features/pausalni-dashboard.md
- Code: src/lib/modules/definitions.ts
- Dependencies: store-postgresql
