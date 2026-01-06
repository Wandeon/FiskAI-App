# Multi-Tenant Integration Architecture - Master Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement each phase plan.

**Goal:** Eliminate cross-tenant incident risk by construction through a unified IntegrationAccount model with encrypted secrets and deterministic routing.

**Architecture:** All regulated integrations (e-invoice, fiscalization) become tenant-scoped accounts with encrypted secrets stored in a unified vault. Every regulated action must resolve credentials through IntegrationAccount, making cross-tenant execution mechanically impossible.

**Tech Stack:** Prisma 7, PostgreSQL, AES-256-GCM encryption, TypeScript, Vitest

---

## Executive Summary

This document improves upon the original design by adding:
- Explicit migration strategies with rollback procedures
- Detailed acceptance criteria per phase
- Edge case handling and failure modes
- Testing strategy with coverage requirements
- Specific file paths and code changes

---

## 1. Design Document Analysis & Improvements

### 1.1 Original Design Strengths
- Clear non-negotiable goals
- Well-defined IntegrationAccount model
- Proper encryption contract
- Good phased approach

### 1.2 Identified Gaps (Now Addressed)

| Gap | Resolution |
|-----|------------|
| No rollback strategy | Each phase includes rollback procedure |
| Missing edge cases | Explicit handling for cert expiry, key rotation, provider failures |
| No testing strategy | TDD approach with coverage requirements per phase |
| Unclear migration order | Dependency graph defined |
| Two encryption schemes exist | Unified under single vault with backward compatibility |
| No observability plan | Structured logging with tenant context mandatory |

### 1.3 Current State Summary

**Existing Encryption:**
- `FISCAL_CERT_KEY` → Envelope encryption for P12 certificates
- `EINVOICE_KEY_SECRET` → Simple AES for API keys

**Existing Models:**
- `Company.eInvoiceProvider` / `eInvoiceApiKeyEncrypted`
- `FiscalCertificate` with envelope encryption
- `ProviderSyncState` with `(companyId, provider, direction)` unique

**Existing Tenant Isolation:**
- AsyncLocalStorage-based `TenantContext`
- Prisma extensions for automatic filtering
- Workers use `COMPANY_ID` env var

---

## 2. Target Architecture

### 2.1 IntegrationAccount Model (Revised)

```prisma
model IntegrationAccount {
  id            String   @id @default(cuid())
  companyId     String
  company       Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)

  // Integration identity
  kind          IntegrationKind
  environment   IntegrationEnv   @default(PROD)
  status        IntegrationStatus @default(ACTIVE)

  // Provider configuration (non-sensitive)
  providerConfig Json?   // { baseUrl, softwareId, timeout, etc. }

  // Encrypted secrets (unified vault)
  secretEnvelope  String?  // Encrypted JSON payload
  secretKeyVersion Int      @default(1)

  // Audit fields
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  rotatedAt     DateTime?
  lastUsedAt    DateTime?

  // Relations
  eInvoices         EInvoice[]
  fiscalRequests    FiscalRequest[]
  providerSyncStates ProviderSyncState[]

  // Constraints
  @@unique([companyId, kind, environment])
  @@index([companyId])
  @@index([status])
  @@map("integration_account")
}

enum IntegrationKind {
  EINVOICE_EPOSLOVANJE
  EINVOICE_FINA
  EINVOICE_IE_RACUNI
  FISCALIZATION_CIS
}

enum IntegrationEnv {
  TEST
  PROD
}

enum IntegrationStatus {
  ACTIVE
  DISABLED
  EXPIRED
  REVOKED
}
```

### 2.2 Unified Secret Vault

**Single master key:** `INTEGRATION_VAULT_KEY` (32-byte AES-256-GCM)

**Secret payload schemas:**
```typescript
// E-Invoice secrets
interface EInvoiceSecrets {
  apiKey: string
}

// Fiscalization secrets
interface FiscalizationSecrets {
  p12Base64: string
  p12Password: string
}
```

**Encryption format:** Same envelope pattern as existing fiscal certificates
- `secretEnvelope` = encrypted JSON payload
- `secretKeyVersion` = allows key rotation without re-encryption

### 2.3 Runtime Resolution Contract

```typescript
async function resolveIntegrationAccount(
  companyId: string,
  kind: IntegrationKind,
  environment: IntegrationEnv
): Promise<IntegrationAccount | null> {
  return db.integrationAccount.findUnique({
    where: {
      companyId_kind_environment: { companyId, kind, environment },
      status: 'ACTIVE'
    }
  })
}

// HARD INVARIANT: Every regulated call MUST go through this
async function executeRegulatedAction<T>(
  companyId: string,
  integrationAccountId: string,
  action: (secrets: DecryptedSecrets) => Promise<T>
): Promise<T> {
  const account = await db.integrationAccount.findUnique({
    where: { id: integrationAccountId }
  })

  // HARD ASSERTION - fails immediately, no retry
  if (!account || account.companyId !== companyId) {
    throw new TenantViolationError(companyId, integrationAccountId)
  }

  if (account.status !== 'ACTIVE') {
    throw new IntegrationDisabledError(integrationAccountId, account.status)
  }

  const secrets = decryptSecretEnvelope(account.secretEnvelope, account.secretKeyVersion)

  try {
    return await action(secrets)
  } finally {
    // Update lastUsedAt
    await db.integrationAccount.update({
      where: { id: integrationAccountId },
      data: { lastUsedAt: new Date() }
    })
  }
}
```

---

## 3. Phase Definitions

### Phase 1: Foundation (IntegrationAccount + Vault)
**Goal:** Introduce new model and unified encryption without changing behavior
**Risk:** Low - additive only
**Duration:** 2-3 days
**Rollback:** Drop migration, remove files

### Phase 2: E-Invoice Outbound Migration
**Goal:** Outbound e-invoices use IntegrationAccount
**Risk:** Medium - changes send path
**Duration:** 3-4 days
**Rollback:** Feature flag to old path

### Phase 3: E-Invoice Inbound Migration
**Goal:** Inbound polling uses IntegrationAccount
**Risk:** Medium - changes polling workers
**Duration:** 2-3 days
**Rollback:** Revert worker to COMPANY_ID pattern

### Phase 4: Fiscalization Migration
**Goal:** Fiscal certificates stored in IntegrationAccount vault
**Risk:** High - touches certificate security
**Duration:** 3-4 days
**Rollback:** Keep FiscalCertificate as source of truth

### Phase 5: Enforcement & Cleanup
**Goal:** Remove legacy paths, enforce invariants
**Risk:** Medium - removes fallbacks
**Duration:** 2-3 days
**Rollback:** Re-enable legacy paths via feature flags

---

## 4. Cross-Cutting Concerns

### 4.1 Observability
Every regulated action logs:
```typescript
logger.info('regulated_action', {
  companyId,
  integrationAccountId,
  kind,
  environment,
  action: 'send_invoice' | 'poll_incoming' | 'fiscal_submit',
  durationMs,
  success: boolean,
  errorCode?: string
})
```

### 4.2 Testing Strategy
- Unit tests: Mock IntegrationAccount resolution
- Integration tests: Real DB with test accounts
- Property tests: Tenant isolation invariants
- Golden tests: Encryption/decryption stability

### 4.3 Feature Flags
```typescript
const FEATURE_FLAGS = {
  USE_INTEGRATION_ACCOUNT_OUTBOUND: boolean,
  USE_INTEGRATION_ACCOUNT_INBOUND: boolean,
  USE_INTEGRATION_ACCOUNT_FISCAL: boolean,
  ENFORCE_INTEGRATION_ACCOUNT: boolean, // Phase 5
}
```

### 4.4 Migration Data Flow
```
Phase 1: Company + FiscalCertificate (unchanged)
         ↓ (backfill creates)
         IntegrationAccount (new, parallel)

Phase 2-4: Both paths active, feature flag controls which executes

Phase 5: IntegrationAccount only, legacy deprecated
```

### 4.5 UI/UX & Settings Flows

**Integration setup locations:**
- Client App → Settings → Integrations
- Admin Portal → Company → Integration Accounts

**UI must support:**
1. View active IntegrationAccounts per kind/environment
2. Upload new credentials (API key or P12 certificate)
3. Rotate secrets (creates new secretEnvelope, sets rotatedAt)
4. Disable/re-enable accounts
5. View usage audit (lastUsedAt, operation count)

**Settings page data flow:**
```
UI → API Route → IntegrationAccount Repository
                 ↓
                 Encrypt secrets with vault
                 ↓
                 Store in DB
```

**Admin multi-tenant view:**
- List all companies with their IntegrationAccounts
- Filter by kind, status, environment
- Quick actions: disable, view audit log

### 4.6 Staff Portal Implications

**Critical rule:** Staff actions on behalf of clients MUST resolve IntegrationAccount

```typescript
// Staff impersonating client for e-invoice send
const staffContext = getStaffContext(); // Staff user info
const clientContext = getImpersonatedClientContext(); // Client company

// WRONG - uses staff's context
await sendEInvoice({ companyId: staffContext.companyId, ... });

// CORRECT - explicitly uses client's company
await sendEInvoice({ companyId: clientContext.companyId, ... });
// IntegrationAccount resolved from clientContext.companyId
```

**Audit logging for staff actions:**
```typescript
logger.info('regulated_action', {
  companyId: clientContext.companyId,
  integrationAccountId,
  actorType: 'STAFF',
  actorId: staffContext.userId,
  // ... rest of fields
})
```

### 4.7 Job & Worker Orchestration

**Current state:** Per-company workers with `COMPANY_ID` env var

**Target state (post-Phase 5):** Single orchestrator iterating IntegrationAccounts

**Job claim contract:**
```typescript
interface RegulatedJob {
  id: string;
  companyId: string;
  integrationAccountId: string;  // IMMUTABLE after creation
  kind: IntegrationKind;
  payload: JsonValue;
  status: 'PENDING' | 'CLAIMED' | 'COMPLETED' | 'FAILED';
  claimedAt?: Date;
  completedAt?: Date;
}
```

**Execution contract:**
```typescript
async function executeJob(job: RegulatedJob): Promise<void> {
  // 1. Resolve IntegrationAccount (MUST match job.integrationAccountId)
  const account = await findIntegrationAccountById(job.integrationAccountId);

  // 2. Assert tenant match
  assertTenantMatch(job.companyId, account.companyId);

  // 3. Execute action with decrypted secrets
  const secrets = decryptSecretEnvelope(account.secretEnvelope, account.secretKeyVersion);
  await performAction(job.kind, secrets, job.payload);

  // 4. Mark complete
  await db.regulatedJob.update({
    where: { id: job.id },
    data: { status: 'COMPLETED', completedAt: new Date() }
  });
}
```

### 4.8 Incident Prevention Rules

**Mechanical impossibility rules (enforced in code):**

1. **Every outbound request logs `companyId + integrationAccountId`**
   - No send/submit without both logged
   - Log at INFO level (always visible)

2. **Every DB row created by integration includes `integrationAccountId`**
   - EInvoice, FiscalRequest, ProviderSyncState
   - Nullable during migration, required after Phase 5

3. **Any tenant mismatch throws TenantViolationError**
   - Hard assertion at IntegrationAccount lookup
   - P0 alert on any occurrence

4. **No regulated action without IntegrationAccount after enforcement**
   - IntegrationRequiredError if account null
   - No fallback to legacy Company fields

**Invariant tests (run in CI):**
```typescript
describe('Incident Prevention Invariants', () => {
  it('all EInvoice SENT/DELIVERED have integrationAccountId after enforcement', async () => {
    // Test in invariants.db.test.ts
  });

  it('all FiscalRequest SUCCESS have integrationAccountId after enforcement', async () => {
    // Test in invariants.db.test.ts
  });

  it('TenantViolationError thrown on companyId mismatch', async () => {
    // Test in assertions.test.ts
  });
})
```

---

## 5. Acceptance Criteria (Definition of Done)

### System-Wide
- [ ] No regulated action executes without IntegrationAccount
- [ ] No secrets exist outside unified vault
- [ ] Cross-tenant execution triggers hard failure (not silent skip)
- [ ] All regulated actions have structured logs with tenant context
- [ ] 100% test coverage on tenant isolation invariants

### Per-Phase (see individual plans)

---

## 6. Individual Phase Plans

Each phase has a dedicated plan document:
- `2026-01-04-phase1-integration-account-foundation.md`
- `2026-01-04-phase2-einvoice-outbound-migration.md`
- `2026-01-04-phase3-einvoice-inbound-migration.md`
- `2026-01-04-phase4-fiscalization-migration.md`
- `2026-01-04-phase5-enforcement-cleanup.md`

---

## 7. Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Cross-tenant data exposure | Low (by design) | Critical | Hard assertions, audit logs |
| Key rotation breaks decryption | Medium | High | Version field, gradual rotation |
| Worker crash during migration | Medium | Medium | Idempotent operations, cursor-based |
| Performance regression | Low | Medium | Batch operations, connection pooling |
| Rollback needed mid-phase | Medium | Medium | Feature flags, parallel paths |

---

## 8. Timeline Summary

| Phase | Duration | Depends On | Deliverables |
|-------|----------|------------|--------------|
| 1 | 2-3 days | - | IntegrationAccount model, vault, backfill |
| 2 | 3-4 days | Phase 1 | Outbound uses IntegrationAccount |
| 3 | 2-3 days | Phase 1 | Inbound uses IntegrationAccount |
| 4 | 3-4 days | Phase 1 | Fiscal uses IntegrationAccount |
| 5 | 2-3 days | Phases 2-4 | Enforcement, cleanup |

**Total:** 12-17 days (phases 2-4 can partially parallelize after phase 1)

---

End of Master Plan
