# WebAuthn API Failure Runbook

## Component
- **ID:** route-group-webauthn
- **Type:** ROUTE_GROUP
- **Owner:** team:platform

## Health Check
- **Endpoint:** /api/health/webauthn
- **Expected:** 200 OK

## Common Issues

### Issue 1: Passkey Registration Failures
**Symptoms:** Users unable to register new passkeys, registration ceremony failing
**Resolution:**
1. Check WebAuthn RP ID matches domain (fiskai.hr)
2. Verify HTTPS is properly configured
3. Review browser compatibility (Chrome, Safari, Firefox)
4. Check for existing credential conflicts

### Issue 2: Passkey Authentication Failures
**Symptoms:** Users with registered passkeys unable to authenticate
**Resolution:**
1. Verify credential public key is stored correctly
2. Check challenge generation and verification
3. Review user verification requirements (UV flag)
4. Check for clock skew issues

### Issue 3: Cross-Device Authentication Issues
**Symptoms:** Passkeys not working across devices, sync failures
**Resolution:**
1. Check if passkey is synced (iCloud Keychain, Google Password Manager)
2. Verify attestation format compatibility
3. Review authenticator attachment preference
4. Check for CTAP2 vs FIDO2 compatibility

## Escalation
- Primary: team:platform
- Backup: #ops-critical

## References
- Code: src/app/api/webauthn/
- Dependencies: lib-auth
- Critical Path: path-authentication
- Endpoint Count: 6
