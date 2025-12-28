# VAT Module Failure Runbook

## Component
- **ID:** module-vat
- **Type:** MODULE
- **Owner:** team:compliance

## Health Check
- **Endpoint:** /api/health/vat
- **Expected:** 200 OK

## Common Issues

### Issue 1: VAT Calculation Discrepancies
**Symptoms:** VAT amounts not matching expected totals, rounding errors
**Resolution:**
1. Verify VAT rate configuration (5%, 13%, 25%)
2. Check invoice line item VAT assignments
3. Review rounding rules (Croatian standard: 2 decimal places)
4. Validate reverse charge mechanism for B2B transactions

### Issue 2: PDV-S/PDV Form Generation Failures
**Symptoms:** VAT return forms not generating correctly, export failures
**Resolution:**
1. Check all required fields are populated
2. Verify OIB validation for trading partners
3. Review period date ranges
4. Validate XML schema for electronic submission

### Issue 3: EU VAT (OSS) Issues
**Symptoms:** Cross-border VAT calculations incorrect, OSS reporting failures
**Resolution:**
1. Verify customer country detection
2. Check EU VAT rate updates
3. Review threshold calculations for OSS registration
4. Validate VIES number verification

## Escalation
- Primary: team:compliance
- Backup: #ops-critical

## References
- Code: src/lib/modules/definitions.ts
- Dependencies: store-postgresql
- Status: BETA
