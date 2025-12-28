# Fiscalization Library Failure Runbook

## Component
- **ID:** lib-fiscal
- **Type:** LIB
- **Owner:** team:compliance

## Health Check
- **Endpoint:** /api/health/fiscal
- **Expected:** 200 OK with fiscal status

## Common Issues

### Issue 1: Certificate Loading Failures
**Symptoms:** Fiscalization disabled, certificate not found errors
**Resolution:**
1. Verify certificate file path and permissions
2. Check PKCS12 file integrity
3. Verify certificate password
4. Review certificate storage location

### Issue 2: Signature Generation Failures
**Symptoms:** ZKI calculation failing, signature errors
**Resolution:**
1. Check private key extraction from certificate
2. Verify signature algorithm (RSA-SHA1/SHA256)
3. Review data serialization for signing
4. Check for character encoding issues

### Issue 3: Request XML Generation Failures
**Symptoms:** FINA rejecting malformed XML, schema validation errors
**Resolution:**
1. Review XML namespace declarations
2. Check element ordering per FINA schema
3. Verify character encoding (UTF-8)
4. Validate against FINA XSD schema

### Issue 4: Response Processing Failures
**Symptoms:** JIR/ZKI not being stored, parsing errors
**Resolution:**
1. Log raw FINA response
2. Review XML parsing logic
3. Check for namespace handling
4. Verify database storage transaction

## Escalation
- Primary: team:compliance
- Backup: #ops-critical

## References
- Documentation: docs/FISCALIZATION.md
- Code: src/lib/fiscal/
- Dependencies: integration-fina-cis
- Critical Path: path-fiscalization
