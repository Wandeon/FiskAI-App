# ADR-005: IntegrationAccount Enforcement

| Status   | Decision                                                       | Date       |
| -------- | -------------------------------------------------------------- | ---------- |
| Accepted | IntegrationAccount is the ONLY supported integration mechanism | 2026-01-05 |

## Context

FiskAI handles regulated operations (fiscalization, B2B e-invoicing) that require:

1. Secure credential storage (API keys, P12 certificates)
2. Strict tenant isolation (Company A cannot use Company B's credentials)
3. Audit trail (which credentials were used for which operations)

Previously, the system supported multiple credential paths:

- Legacy: Environment variables (EPOSLOVANJE*\*, IE_RACUNI*_, FISCAL*CERT*_)
- Legacy: Company-level encrypted fields (eInvoiceApiKeyEncrypted)
- Legacy: FiscalCertificate table with envelope encryption
- New: IntegrationAccount with unified vault encryption

This fragmentation created risks:

- Cross-tenant credential leakage
- Inconsistent audit trails
- Complex security review surface
- Difficulty reasoning about credential access

## Decision

**IntegrationAccount + vault-based routing is the ONLY legal way to:**

1. Fiscalize invoices
2. Send or receive B2B e-invoices
3. Access certificates or API keys
4. Run integration workers

**Legacy paths are forbidden:**

- Any code attempting legacy credential access when `FF_ENFORCE_INTEGRATION_ACCOUNT=true` will throw `IntegrationRequiredError` (P0 severity)
- CI will fail if new code accesses legacy secret env vars
- Legacy paths are blocked at runtime, not just by convention

## Enforcement Mechanisms

### Runtime Enforcement

```typescript
// src/lib/integration/enforcement.ts
export function assertLegacyPathAllowed(
  operation: "FISCALIZATION" | "EINVOICE_SEND" | "EINVOICE_RECEIVE" | "WORKER_JOB",
  companyId: string,
  context: Record<string, unknown>
): void {
  if (isFeatureEnabled("ENFORCE_INTEGRATION_ACCOUNT")) {
    throw new IntegrationRequiredError(operation, companyId, reason)
  }
}
```

### CI Enforcement

```yaml
# .github/workflows/ci.yml
- name: Check no legacy secret access (Phase 5 guardrail)
  run: npx tsx scripts/check-legacy-secrets.ts
```

### Tenant Isolation Enforcement

```typescript
// Hard assertion in all V2 code paths
if (account.companyId !== companyId) {
  throw new TenantViolationError(companyId, account.companyId, integrationAccountId)
}
```

## Consequences

### Positive

- Single source of truth for credentials
- Tenant isolation enforced by construction
- Complete audit trail via integrationAccountId on all records
- Simplified security review surface
- Clear migration path for legacy deployments

### Negative

- Existing deployments must migrate before enforcement
- Cannot use simple env vars for quick testing (must set up IntegrationAccount)
- More complex setup for new tenants

### Mitigation

- Migration scripts and tools provided
- Feature flag allows gradual rollout
- Audit queries help verify migration completeness

## Related Documents

- `docs/plans/2026-01-04-multi-tenant-integration-architecture.md` - Full migration plan
- `docs/plans/2026-01-05-phase5-rollout-checklist.md` - Enforcement rollout checklist
- `scripts/check-legacy-secrets.ts` - CI guardrail script
- `scripts/check-integration-invariants.ts` - Database invariants check
- `scripts/audit-integration-state.sql` - Audit queries

## Schema

```prisma
model IntegrationAccount {
  id           String  @id @default(cuid())
  companyId    String
  kind         IntegrationKind
  environment  IntegrationEnv
  status       IntegrationStatus @default(ACTIVE)

  // Vault-encrypted secrets
  secrets      Json    // { apiKey: "..." } or { p12Base64: "...", p12Password: "..." }

  // Audit trail
  createdAt    DateTime @default(now())
  lastUsedAt   DateTime?

  // Relations - all operations link here
  eInvoices          EInvoice[]
  fiscalRequests     FiscalRequest[]
  providerSyncStates ProviderSyncState[]

  @@unique([companyId, kind, environment])
}
```

## Error Types

| Error                    | Severity | Meaning                             | Retry? |
| ------------------------ | -------- | ----------------------------------- | ------ |
| IntegrationRequiredError | P0       | Legacy path blocked by enforcement  | NO     |
| TenantViolationError     | P0       | Cross-tenant access attempt         | NO     |
| IntegrationNotFoundError | P1       | No matching IntegrationAccount      | NO     |
| IntegrationDisabledError | P1       | Account exists but disabled/expired | NO     |

## Final State

After Phase 5 enforcement:

1. Legacy secret paths are **mechanically impossible**
2. Cross-tenant credential access is **mechanically impossible**
3. All operations have **complete audit trail** via integrationAccountId
4. Feature flags can be removed (enforcement is permanent)
