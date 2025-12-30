# FiskAI Security Audit

## Summary
Security review focused on authentication, multi-tenancy, and deployment artifacts. Multiple high-severity issues allow credential exposure and host-header spoofing, plus medium-severity problems around plain-text storage of provider API keys and missing tenant scoping on contacts.

## Findings

### 1. Hard-coded production secrets committed to git (High)
- `docker-compose.yml` embeds live Postgres credentials and `NEXTAUTH_SECRET` (lines 6-33).
- Anyone with repo access gets DB user/pass and JWT secret, enabling database compromise and forging Auth.js sessions.
- **Remediation:** Move all secrets to environment/secret management (Coolify, host env, etc.), remove from git, and rotate every leaked credential immediately.

### 2. Host header poisoning via `AUTH_TRUST_HOST=true` (High) - MITIGATED
- Compose file sets `AUTH_TRUST_HOST=true` while exposing the container on `0.0.0.0:3002`.
- Auth.js will trust arbitrary `Host` headers, so direct hits to the VPS IP can forge callbacks/cookies for attacker domains -> account takeover/open redirects.
- **Remediation:** Drop the flag and rely on `NEXTAUTH_URL`, or restrict network so only Cloudflare/front proxy can reach the app.
- **Status:** Network isolation verified and documented. Production config (`docker-compose.prod.yml`) has no port exposure; container is only accessible via Traefik on internal network. See [NETWORK_ISOLATION_SECURITY.md](../../04_OPERATIONS/NETWORK_ISOLATION_SECURITY.md) for verification procedures.

### 3. Provider API keys stored/returned in plaintext (Medium)
- `Company.eInvoiceApiKey` is plain string storage (schema lines 84-85) and `updateCompanySettings` writes raw data without encryption or access scoping.
- Brokers/DB readers can steal e-invoice provider keys and submit invoices on behalf of clients.
- **Remediation:** Encrypt at rest (KMS/libsodium), never echo the raw key back, and rotate any existing keys.

### 4. Cross-tenant contact disclosure in e-invoice creation (Medium)
- `createEInvoice` trusts `buyerId` from the client without checking tenant ownership; later `getEInvoices`/`getEInvoice` eagerly include the buyer relation.
- Attackers can reference another company's contact ID to view their full PII.
- **Remediation:** Verify `buyerId`/`sellerId` belong to the caller's company prior to create/update and add Prisma-level constraints/middleware enforcing `companyId` filters across relations.

## Next Steps
1. Rotate every leaked credential (`POSTGRES_PASSWORD`, DB URL, `NEXTAUTH_SECRET`).
2. Remove secret literals from git history; source them from secure runtime storage.
3. ~~Remove `AUTH_TRUST_HOST` or network-isolate the app.~~ **DONE:** Network isolation documented and verified. See [NETWORK_ISOLATION_SECURITY.md](../../04_OPERATIONS/NETWORK_ISOLATION_SECURITY.md).
4. Implement secret encryption for provider keys plus restricted read APIs.
5. Add tenant-ownership checks on all foreign keys (contacts, products, etc.) before shipping multi-tenant features.
