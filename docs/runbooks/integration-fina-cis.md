# FINA CIS Fiscalization Integration Failure Runbook

## Component
- **ID:** integration-fina-cis
- **Type:** INTEGRATION
- **Owner:** team:compliance

## Health Check
- **Endpoint:** /api/health/fina-cis
- **Expected:** 200 OK with FINA CIS connectivity status

## Common Issues

### Issue 1: FINA CIS Endpoint Unreachable
**Symptoms:** All fiscalization requests timing out, connection refused
**Resolution:**
1. Check FINA CIS endpoint: `curl -I https://cis.porezna-uprava.hr`
2. Verify DNS resolution
3. Check firewall rules for outbound HTTPS
4. Review FINA maintenance announcements

### Issue 2: Certificate Authentication Failures
**Symptoms:** 401/403 errors from FINA, certificate rejected
**Resolution:**
1. Check certificate validity: `openssl x509 -enddate -noout -in cert.p12`
2. Verify certificate is registered with FINA
3. Check certificate chain is complete
4. Review PKCS12 password configuration

### Issue 3: Invalid Request Rejections
**Symptoms:** Requests sent but rejected with validation errors
**Resolution:**
1. Review FINA error codes in response
2. Check OIB (tax ID) format and validity
3. Verify business premises and register codes
4. Check invoice data against FINA schema

### Issue 4: Response Parsing Errors
**Symptoms:** FINA responds but response cannot be parsed
**Resolution:**
1. Log raw FINA response
2. Check for XML namespace changes
3. Review FINA API version
4. Update response parser if schema changed

## Escalation
- Primary: team:compliance
- Backup: #ops-critical

## References
- Documentation: docs/FISCALIZATION.md
- Code: src/lib/fiscal/porezna-client.ts
- Dependents: module-fiscalization, lib-fiscal, job-fiscal-processor, job-fiscal-retry
- Critical Path: path-fiscalization
