# Phase 5: Enforcement & Cleanup

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove legacy paths, enforce IntegrationAccount for all regulated actions, and clean up deprecated code.

**Architecture:** Remove feature flags, remove fallback paths, add hard assertions. Legacy columns marked deprecated but not removed (data migration deferred).

**Tech Stack:** Prisma 7, PostgreSQL, TypeScript, Vitest, ESLint

---

## Prerequisites

- [ ] Phase 1-4 complete
- [ ] All IntegrationAccounts backfilled
- [ ] Feature flags tested in production for at least 1 week
- [ ] Monitoring prerequisites met (see below)
- [ ] No incidents definition met (see below)

---

## Configurable Enforcement Date

**DO NOT hardcode dates. Use environment variable:**

```typescript
// src/lib/integration/enforcement.ts
export function getEnforcementDate(): Date {
  const dateStr = process.env.INTEGRATION_ENFORCEMENT_DATE;
  if (!dateStr) {
    // Default: far future (enforcement not active)
    return new Date('2099-12-31');
  }
  return new Date(dateStr);
}

export function isEnforcementActive(): boolean {
  return new Date() >= getEnforcementDate();
}
```

**Usage in invariant tests:**

```typescript
// Instead of: const enforcementDate = new Date('2026-01-15')
const enforcementDate = getEnforcementDate();

const invoicesWithoutAccount = await db.eInvoice.count({
  where: {
    createdAt: { gte: enforcementDate },
    integrationAccountId: null,
    status: { in: ['SENT', 'DELIVERED'] }
  }
});
```

**Deployment:**
```bash
# Enable enforcement for new records starting Jan 15
INTEGRATION_ENFORCEMENT_DATE=2026-01-15T00:00:00Z
```

---

## Monitoring Prerequisites

**Required before enabling enforcement:**

1. **Dashboard exists showing:**
   - IntegrationAccount usage per company
   - Success/failure rates by integration kind
   - TenantViolationError count (should be 0)
   - IntegrationRequiredError count

2. **Alerts configured:**
   | Alert | Threshold | Priority |
   |-------|-----------|----------|
   | TenantViolationError | > 0 | P0 (immediate) |
   | IntegrationRequiredError | > 5/hour | P1 |
   | Regulated action failure rate | > 5% | P1 |
   | E-invoice send latency | > 30s p99 | P2 |

3. **Runbook exists for:**
   - TenantViolationError investigation
   - Backfilling missing IntegrationAccounts
   - Rollback to legacy paths

---

## "No Incidents" Definition

**Production soak period: 1 week with these criteria:**

| Metric | Acceptable Range | Measured How |
|--------|------------------|--------------|
| TenantViolationError count | 0 | Alert fires if > 0 |
| IntegrationRequiredError rate | < 0.1% of requests | Dashboard metric |
| E-invoice send success rate | ≥ 99% | Existing monitoring |
| Fiscalization success rate | ≥ 99% | Existing monitoring |
| Inbound poll success rate | ≥ 99% | Existing monitoring |

**Any of these failing = do not proceed with enforcement:**
- Investigate root cause
- Fix gaps (backfill, code fix)
- Reset 1-week timer

---

## ESLint Guardrail for Legacy Fields

**Prevent writing to deprecated fields after enforcement:**

```javascript
// eslint-local-rules/no-legacy-integration-writes.js
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Prevent writes to deprecated integration fields',
    },
    messages: {
      noLegacyWrite: 'Do not write to deprecated field "{{field}}". Use IntegrationAccount instead.',
    },
  },
  create(context) {
    const deprecatedFields = [
      'eInvoiceApiKeyEncrypted',
      'eInvoiceProvider',
      // Add more as needed
    ];

    return {
      AssignmentExpression(node) {
        if (node.left.type === 'MemberExpression') {
          const fieldName = node.left.property?.name;
          if (deprecatedFields.includes(fieldName)) {
            context.report({
              node,
              messageId: 'noLegacyWrite',
              data: { field: fieldName },
            });
          }
        }
      },
      Property(node) {
        // Catch object literals like { eInvoiceProvider: 'x' }
        if (node.key?.name && deprecatedFields.includes(node.key.name)) {
          // Allow in test files
          const filename = context.getFilename();
          if (filename.includes('.test.') || filename.includes('__tests__')) {
            return;
          }
          context.report({
            node,
            messageId: 'noLegacyWrite',
            data: { field: node.key.name },
          });
        }
      },
    };
  },
};
```

**Add to ESLint config:**
```javascript
// eslint.config.mjs
import noLegacyIntegrationWrites from './eslint-local-rules/no-legacy-integration-writes.js';

export default [
  {
    plugins: {
      'local': { rules: { 'no-legacy-integration-writes': noLegacyIntegrationWrites } }
    },
    rules: {
      'local/no-legacy-integration-writes': 'error'
    }
  }
];
```

---

## Task 1: Enable Enforcement Flag

**Files:**
- Modify: `.env.production` (or Coolify environment)

**Step 1: Set enforcement flag**

```bash
FF_ENFORCE_INTEGRATION_ACCOUNT=true
```

**Step 2: Deploy and monitor for 24-48 hours**

**Step 3: Document in CLAUDE.md**

Add note that IntegrationAccount is now the only path for regulated actions.

**Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: note IntegrationAccount enforcement is active"
```

---

## Task 2: Remove Feature Flag Checks

**Files:**
- Modify: `src/lib/e-invoice/send-invoice.ts`
- Modify: `src/lib/e-invoice/poll-inbound.ts`
- Modify: `src/lib/fiscal/fiscalize-invoice.ts`

**Step 1: Update sendEInvoice to always use new path**

Replace:
```typescript
const useNewPath = isFeatureEnabled('USE_INTEGRATION_ACCOUNT_OUTBOUND')

if (useNewPath) {
  return sendViaIntegrationAccount(invoice, ublXml)
} else {
  return sendViaLegacyPath(invoice, ublXml)
}
```

With:
```typescript
// Phase 5: IntegrationAccount is now mandatory
return sendViaIntegrationAccount(invoice, ublXml)
```

**Step 2: Update pollInbound to always use new path**

Replace:
```typescript
const useNewPath = isFeatureEnabled('USE_INTEGRATION_ACCOUNT_INBOUND')

if (useNewPath) {
  // new path
} else {
  return pollInboundLegacy(input)
}
```

With:
```typescript
// Phase 5: IntegrationAccount is now mandatory
const kind = mapProviderNameToKind(providerName)
return pollInboundForCompany(companyId, kind, 'PROD')
```

**Step 3: Update fiscalizeInvoice to always use new path**

Replace:
```typescript
const useNewPath = isFeatureEnabled('USE_INTEGRATION_ACCOUNT_FISCAL')

if (useNewPath) {
  return fiscalizeViaIntegrationAccount(input)
} else {
  return fiscalizeViaLegacy(input)
}
```

With:
```typescript
// Phase 5: IntegrationAccount is now mandatory
return fiscalizeViaIntegrationAccount(input)
```

**Step 4: Run tests**

Run: `npx vitest run`

Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/lib/e-invoice/ src/lib/fiscal/
git commit -m "feat(integration): remove feature flags, enforce IntegrationAccount"
```

---

## Task 3: Remove Legacy Path Functions

**Files:**
- Modify: `src/lib/e-invoice/send-invoice.ts`
- Modify: `src/lib/e-invoice/poll-inbound.ts`
- Modify: `src/lib/fiscal/fiscalize-invoice.ts`

**Step 1: Remove sendViaLegacyPath function**

Delete the entire `sendViaLegacyPath` function from `send-invoice.ts`.

**Step 2: Remove pollInboundLegacy function**

Delete the entire `pollInboundLegacy` function from `poll-inbound.ts`.

**Step 3: Remove fiscalizeViaLegacy function**

Delete the entire `fiscalizeViaLegacy` function from `fiscalize-invoice.ts`.

**Step 4: Remove unused imports**

Remove imports that are no longer needed:
- `createEInvoiceProvider` (legacy factory)
- `decryptSecret` (legacy decryption)
- `getFiscalCertificateForCompany` (legacy cert lookup)
- `decryptFiscalCertificate` (legacy cert decryption)

**Step 5: Run tests and type check**

Run: `npx vitest run && npx tsc --noEmit`

Expected: All pass, no unused imports

**Step 6: Commit**

```bash
git add src/lib/e-invoice/ src/lib/fiscal/
git commit -m "refactor: remove legacy path functions"
```

---

## Task 4: Remove Feature Flags Module (Optional)

**Files:**
- Modify: `src/lib/feature-flags.ts`

**Step 1: Remove migration-specific flags**

Keep only flags that are still needed:

```typescript
/**
 * Feature flags for runtime configuration.
 * Migration flags have been removed - IntegrationAccount is now enforced.
 */

export const FEATURE_FLAGS = {
  // Add any remaining non-migration flags here
} as const

export function isFeatureEnabled(flag: keyof typeof FEATURE_FLAGS): boolean {
  return FEATURE_FLAGS[flag] ?? false
}
```

Or if no flags remain, delete the file entirely.

**Step 2: Commit**

```bash
git add src/lib/feature-flags.ts
git commit -m "refactor: remove migration feature flags"
```

---

## Task 5: Add Hard Assertions

**Files:**
- Create: `src/lib/integration/assertions.ts`

**Step 1: Create assertions module**

```typescript
import { logger } from '@/lib/logger'

export class TenantViolationError extends Error {
  constructor(
    public readonly expectedCompanyId: string,
    public readonly actualCompanyId: string,
    public readonly context?: string
  ) {
    super(`Tenant violation: expected ${expectedCompanyId}, got ${actualCompanyId}${context ? ` (${context})` : ''}`)
    this.name = 'TenantViolationError'

    // Log immediately - this is a critical security event
    logger.error('TENANT_VIOLATION', {
      expectedCompanyId,
      actualCompanyId,
      context,
      stack: this.stack
    })
  }
}

export class IntegrationRequiredError extends Error {
  constructor(
    public readonly companyId: string,
    public readonly requiredKind: string,
    public readonly context?: string
  ) {
    super(`IntegrationAccount required: company=${companyId}, kind=${requiredKind}${context ? ` (${context})` : ''}`)
    this.name = 'IntegrationRequiredError'

    logger.error('INTEGRATION_REQUIRED', {
      companyId,
      requiredKind,
      context
    })
  }
}

/**
 * Assert that an IntegrationAccount exists for a regulated action.
 * Fails hard if not found - there is no fallback.
 */
export function assertIntegrationExists(
  account: unknown,
  companyId: string,
  kind: string,
  context?: string
): asserts account {
  if (!account) {
    throw new IntegrationRequiredError(companyId, kind, context)
  }
}

/**
 * Assert tenant matches.
 * Fails hard on mismatch - this is a security boundary.
 */
export function assertTenantMatch(
  expectedCompanyId: string,
  actualCompanyId: string,
  context?: string
): void {
  if (expectedCompanyId !== actualCompanyId) {
    throw new TenantViolationError(expectedCompanyId, actualCompanyId, context)
  }
}
```

**Step 2: Add tests**

Create `src/lib/integration/__tests__/assertions.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  TenantViolationError,
  IntegrationRequiredError,
  assertIntegrationExists,
  assertTenantMatch
} from '../assertions'

describe('Integration Assertions', () => {
  describe('assertIntegrationExists', () => {
    it('passes when account exists', () => {
      const account = { id: 'acc-123' }
      expect(() => assertIntegrationExists(account, 'comp-1', 'EINVOICE_EPOSLOVANJE')).not.toThrow()
    })

    it('throws IntegrationRequiredError when account is null', () => {
      expect(() => assertIntegrationExists(null, 'comp-1', 'EINVOICE_EPOSLOVANJE', 'send_invoice'))
        .toThrow(IntegrationRequiredError)
    })

    it('throws IntegrationRequiredError when account is undefined', () => {
      expect(() => assertIntegrationExists(undefined, 'comp-1', 'FISCALIZATION_CIS'))
        .toThrow(IntegrationRequiredError)
    })
  })

  describe('assertTenantMatch', () => {
    it('passes when tenants match', () => {
      expect(() => assertTenantMatch('comp-1', 'comp-1')).not.toThrow()
    })

    it('throws TenantViolationError when tenants mismatch', () => {
      expect(() => assertTenantMatch('comp-1', 'comp-2', 'fiscal_sign'))
        .toThrow(TenantViolationError)
    })

    it('includes context in error message', () => {
      try {
        assertTenantMatch('comp-1', 'comp-2', 'critical_operation')
      } catch (e) {
        expect(e).toBeInstanceOf(TenantViolationError)
        expect((e as Error).message).toContain('critical_operation')
      }
    })
  })
})
```

**Step 3: Run tests**

Run: `npx vitest run src/lib/integration/__tests__/assertions.test.ts`

**Step 4: Commit**

```bash
git add src/lib/integration/assertions.ts src/lib/integration/__tests__/assertions.test.ts
git commit -m "feat(integration): add hard assertions for tenant isolation"
```

---

## Task 6: Update Repository to Use Assertions

**Files:**
- Modify: `src/lib/integration/repository.ts`

**Step 1: Add assertions to findIntegrationAccountById**

```typescript
import { assertTenantMatch } from './assertions'

export async function findIntegrationAccountByIdStrict(
  id: string,
  expectedCompanyId: string
): Promise<IntegrationAccountWithSecrets> {
  const account = await findIntegrationAccountById(id)

  if (!account) {
    throw new IntegrationRequiredError(expectedCompanyId, 'unknown', `id=${id}`)
  }

  assertTenantMatch(expectedCompanyId, account.companyId, `account_id=${id}`)

  return account
}
```

**Step 2: Commit**

```bash
git add src/lib/integration/repository.ts
git commit -m "feat(integration): add strict lookup with tenant assertion"
```

---

## Task 7: Deprecate Legacy Columns

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `docs/plans/deprecation-legacy-columns.md`

**Step 1: Add deprecation comments to schema**

```prisma
model Company {
  // ... existing fields ...

  /// @deprecated Use IntegrationAccount instead. Will be removed in v3.0.
  eInvoiceProvider          String?
  /// @deprecated Use IntegrationAccount instead. Will be removed in v3.0.
  eInvoiceApiKeyEncrypted   String?
}
```

**Step 2: Create deprecation plan document**

```markdown
# Deprecation Plan: Legacy Integration Columns

## Overview

The following columns are deprecated and will be removed in v3.0:

### Company Table
- `eInvoiceProvider` - Replaced by IntegrationAccount.kind
- `eInvoiceApiKeyEncrypted` - Replaced by IntegrationAccount.secretEnvelope

### FiscalCertificate Table
- Entire table to be deprecated (data migrated to IntegrationAccount)

## Migration Status

- [ ] All production companies have IntegrationAccounts
- [ ] No code paths read legacy columns
- [ ] Monitoring confirms zero usage
- [ ] Data migration complete

## Removal Timeline

1. **v2.x (Current)**: Columns exist but unused
2. **v3.0-alpha**: Add NOT NULL warnings
3. **v3.0**: Remove columns via migration

## Rollback

If removal causes issues:
1. Restore columns via migration
2. Run backfill in reverse (IntegrationAccount → legacy)
```

**Step 3: Commit**

```bash
git add prisma/schema.prisma docs/plans/deprecation-legacy-columns.md
git commit -m "docs: mark legacy integration columns as deprecated"
```

---

## Task 8: Add ESLint Rule for Legacy Imports

**Files:**
- Modify: `.eslintrc.js` or `eslint.config.mjs`

**Step 1: Add rule to prevent legacy import**

```javascript
// In ESLint config
rules: {
  'no-restricted-imports': ['error', {
    paths: [
      {
        name: '@/lib/secrets',
        importNames: ['decryptSecret'],
        message: 'Use IntegrationAccount vault instead of direct secret decryption.'
      }
    ],
    patterns: [
      {
        group: ['**/envelope-encryption'],
        message: 'Legacy envelope encryption deprecated. Use IntegrationAccount vault.'
      }
    ]
  }]
}
```

**Step 2: Run ESLint**

Run: `npx eslint src/ --fix`

Expected: Any remaining legacy imports flagged

**Step 3: Commit**

```bash
git add .eslintrc.js  # or eslint.config.mjs
git commit -m "chore(lint): add rules preventing legacy integration imports"
```

---

## Task 9: Final Test Suite

**Files:**
- Create: `src/lib/integration/__tests__/invariants.test.ts`

**Step 1: Create invariant test suite**

```typescript
import { describe, it, expect } from 'vitest'
import { db } from '@/lib/db'

describe('Integration Invariants', () => {
  it('all companies with e-invoice have IntegrationAccount', async () => {
    const companiesWithEInvoice = await db.company.findMany({
      where: {
        eInvoiceProvider: { not: null }
      },
      select: { id: true, name: true }
    })

    for (const company of companiesWithEInvoice) {
      const account = await db.integrationAccount.findFirst({
        where: {
          companyId: company.id,
          kind: { startsWith: 'EINVOICE_' }
        }
      })
      expect(account, `Company ${company.name} missing e-invoice IntegrationAccount`).not.toBeNull()
    }
  })

  it('all companies with FiscalCertificate have IntegrationAccount', async () => {
    const companiesWithFiscal = await db.fiscalCertificate.findMany({
      where: { status: 'ACTIVE' },
      select: { companyId: true }
    })

    const uniqueCompanyIds = [...new Set(companiesWithFiscal.map(c => c.companyId))]

    for (const companyId of uniqueCompanyIds) {
      const account = await db.integrationAccount.findFirst({
        where: {
          companyId,
          kind: 'FISCALIZATION_CIS'
        }
      })
      expect(account, `Company ${companyId} missing fiscal IntegrationAccount`).not.toBeNull()
    }
  })

  it('no EInvoice records without integrationAccountId after enforcement date', async () => {
    const enforcementDate = new Date('2026-01-15') // Adjust based on actual date

    const invoicesWithoutAccount = await db.eInvoice.count({
      where: {
        createdAt: { gte: enforcementDate },
        integrationAccountId: null,
        status: { in: ['SENT', 'DELIVERED'] }
      }
    })

    expect(invoicesWithoutAccount).toBe(0)
  })

  it('no FiscalRequest records without integrationAccountId after enforcement date', async () => {
    const enforcementDate = new Date('2026-01-15') // Adjust based on actual date

    const requestsWithoutAccount = await db.fiscalRequest.count({
      where: {
        createdAt: { gte: enforcementDate },
        integrationAccountId: null,
        status: 'SUCCESS'
      }
    })

    expect(requestsWithoutAccount).toBe(0)
  })
})
```

**Step 2: Run invariant tests**

Run: `npx vitest run src/lib/integration/__tests__/invariants.test.ts`

**Step 3: Commit**

```bash
git add src/lib/integration/__tests__/invariants.test.ts
git commit -m "test(integration): add invariant tests for enforcement"
```

---

## Phase 5 Completion Checklist

- [ ] Enforcement flag enabled in production
- [ ] Feature flag checks removed
- [ ] Legacy path functions removed
- [ ] Unused imports cleaned up
- [ ] Hard assertions added
- [ ] Repository updated with strict lookups
- [ ] Legacy columns marked deprecated
- [ ] ESLint rules prevent legacy usage
- [ ] Invariant tests passing
- [ ] No incidents for 1 week

---

## Post-Enforcement Monitoring

**Key Metrics to Watch:**
- Error rate on IntegrationRequiredError
- Error rate on TenantViolationError
- E-invoice send success rate
- Fiscalization success rate
- Inbound polling success rate

**Alerts to Configure:**
- Any TenantViolationError (P0 - immediate investigation)
- >1% IntegrationRequiredError (P1 - backfill missing accounts)
- >5% increase in regulated action failures (P1)

---

## Future Work (v3.0)

1. **Remove legacy columns** (after 6+ months)
2. **Archive FiscalCertificate table**
3. **Remove legacy encryption code** (envelope-encryption.ts)
4. **Simplify backfill script** (no longer needs dual-path)

---

## Rollback Procedure (Last Resort)

If critical issues arise after enforcement:

1. Set `FF_ENFORCE_INTEGRATION_ACCOUNT=false`
2. Revert commits that removed feature flag checks
3. Redeploy
4. Legacy paths immediately active
5. Investigate root cause
6. Fix and re-enable gradually

---

End of Phase 5 Plan
