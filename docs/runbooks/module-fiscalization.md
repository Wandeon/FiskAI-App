# Fiscalization Module Failure Runbook

## Component
- **ID:** module-fiscalization
- **Type:** MODULE
- **Owner:** team:compliance

## Health Check
- **Endpoint:** /api/health/fiscalization
- **Expected:** 200 OK

## Common Issues

### Issue 1: FINA CIS Connection Failures
**Symptoms:** Invoices stuck in PENDING fiscalization status, timeout errors
**Resolution:**
1. Check FINA CIS endpoint availability: `curl -I https://cis.porezna-uprava.hr`
2. Verify fiscal certificate validity and expiration date
3. Check firewall rules for outbound HTTPS to FINA
4. Review SSL/TLS handshake logs

### Issue 2: Certificate Expiration
**Symptoms:** All fiscalization requests failing with certificate errors
**Resolution:**
1. Check certificate expiration: `openssl x509 -enddate -noout -in cert.p12`
2. Upload renewed certificate through admin portal
3. Restart fiscalization services after certificate update
4. Verify certificate chain is complete

### Issue 3: Invalid JIR/ZKI Responses
**Symptoms:** Fiscalization succeeds but JIR/ZKI codes are invalid or missing
**Resolution:**
1. Verify invoice data matches FINA requirements
2. Check OIB (tax ID) validity for issuer
3. Review business premises and register codes
4. Validate timestamp synchronization with NTP

## Escalation
- Primary: team:compliance
- Backup: #ops-critical

## References
- Documentation: docs/02_FEATURES/features/fiscal-fiscalize.md
- Code: src/lib/modules/definitions.ts
- Dependencies: integration-fina-cis, lib-fiscal
- Critical Path: path-fiscalization
- SLO: 99.9% success rate, <5s processing time
