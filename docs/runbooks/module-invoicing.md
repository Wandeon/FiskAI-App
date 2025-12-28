# Invoicing Module Failure Runbook

## Component
- **ID:** module-invoicing
- **Type:** MODULE
- **Owner:** team:backend

## Health Check
- **Endpoint:** /api/health/invoicing
- **Expected:** 200 OK

## Common Issues

### Issue 1: Invoice Creation Failures
**Symptoms:** Users unable to create new invoices, API returns 500 errors
**Resolution:**
1. Check database connectivity: `docker exec fiskai-db psql -U fiskai -d fiskai -c "SELECT 1"`
2. Review invoice table constraints and sequences
3. Check for disk space issues affecting PostgreSQL
4. Verify Prisma connection pool status

### Issue 2: Invoice Numbering Gaps
**Symptoms:** Invoice numbers not sequential, gaps in numbering
**Resolution:**
1. Check failed transaction rollbacks
2. Review sequence current value in PostgreSQL
3. Investigate concurrent invoice creation race conditions
4. Validate business logic for number generation

### Issue 3: PDF Generation Failures
**Symptoms:** Invoice PDFs not generating, download timeouts
**Resolution:**
1. Check PDF generation service health
2. Verify R2 storage connectivity for uploads
3. Review memory allocation for PDF rendering
4. Check for template syntax errors

## Escalation
- Primary: team:backend
- Backup: #ops-critical

## References
- Feature Spec: docs/02_FEATURES/features/invoicing-create.md
- Code: src/lib/modules/definitions.ts
- Dependencies: store-postgresql, module-contacts, module-products
- Critical Path: path-fiscalization
