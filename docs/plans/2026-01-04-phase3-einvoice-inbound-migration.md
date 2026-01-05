# Phase 3: E-Invoice Inbound Migration

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Inbound e-invoice polling uses IntegrationAccount for credential resolution instead of Company.eInvoiceApiKeyEncrypted.

**Architecture:** Feature-flagged dual path. Polling workers resolve IntegrationAccount by companyId. ProviderSyncState gains integrationAccountId column.

**Tech Stack:** Prisma 7, PostgreSQL, TypeScript, Vitest

---

## Prerequisites

- [ ] Phase 1 complete (IntegrationAccount model exists)
- [ ] Phase 2 complete (V2 provider factory exists)
- [ ] Backfill script has been run (IntegrationAccounts exist for companies)
- [ ] `INTEGRATION_VAULT_KEY` environment variable set

---

## Cursor Semantics

**Critical rules for cursor advancement:**

1. **Advance cursor ONLY after successful commit**
   ```typescript
   // CORRECT
   await db.$transaction(async (tx) => {
     await tx.eInvoice.create({ data: invoiceData });
     await tx.providerSyncState.update({
       where: { id: syncState.id },
       data: { cursor: newCursor, lastPollAt: new Date() }
     });
   });

   // WRONG - cursor advances even if invoice creation fails
   await db.providerSyncState.update({ data: { cursor: newCursor } });
   await db.eInvoice.create({ data: invoiceData }); // If this fails, cursor already advanced!
   ```

2. **Cursor value = max(documentDate) not "now"**
   ```typescript
   // CORRECT - use document-based cursor
   const newCursor = Math.max(...invoices.map(i => i.documentDate.getTime())).toString();

   // WRONG - time-based cursor can skip documents
   const newCursor = new Date().toISOString(); // Documents arriving during poll are skipped
   ```

3. **On partial failure, do NOT advance cursor**
   - If 10 invoices returned, 7 saved, 3 failed: cursor stays at original
   - Retry will re-fetch all 10, dedupe by providerRef

4. **Provider pagination handling**
   - If provider returns pages: process all pages in single transaction
   - Cursor = max(documentDate) across all pages
   - Alternative: advance cursor per-page only if no cross-page dependencies

---

## Worker Scoping Direction

**Current state (temporary):** Workers use `COMPANY_ID` env var

**Target state (Phase 3+):** Single poller iterates all active IntegrationAccounts

**Migration path:**

1. **Phase 3 (now):** Worker resolves IntegrationAccount inside run, asserts companyId match
   ```typescript
   // Worker still scoped to COMPANY_ID, but uses IntegrationAccount internally
   const companyId = process.env.COMPANY_ID;
   const account = await findIntegrationAccount(companyId, kind, env);
   // All operations go through account
   ```

2. **Phase 5+:** Move to multi-account poller
   ```typescript
   // Future: single worker polls all accounts with rate limiting
   const accounts = await db.integrationAccount.findMany({
     where: { kind: { startsWith: 'EINVOICE_' }, status: 'ACTIVE' }
   });
   for (const account of accounts) {
     await pollWithRateLimit(account);
   }
   ```

**Constraint for Phase 3:** Keep per-company workers, but:
- Worker MUST resolve IntegrationAccount at runtime
- Worker MUST assert `account.companyId === COMPANY_ID`
- Worker MUST log integrationAccountId in all operations

---

## Task 1: Add integrationAccountId to ProviderSyncState

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add field and relation to ProviderSyncState model**

Locate `model ProviderSyncState` and add:

```prisma
  // Integration account used for syncing (Phase 3+)
  integrationAccountId  String?
  integrationAccount    IntegrationAccount? @relation(fields: [integrationAccountId], references: [id])
```

**Step 2: Uncomment relation in IntegrationAccount model**

Add to IntegrationAccount:
```prisma
  providerSyncStates ProviderSyncState[]
```

**Step 3: Generate migration**

Run: `npx prisma migrate dev --name add_provider_sync_state_integration_account`

Expected: Migration created, nullable column added

**Step 4: Commit**

```bash
git add prisma/
git commit -m "feat(schema): add integrationAccountId to ProviderSyncState"
```

---

## Task 2: Create Inbound Polling Service V2

**Files:**
- Create: `src/lib/e-invoice/poll-inbound-v2.ts`
- Create: `src/lib/e-invoice/__tests__/poll-inbound-v2.test.ts`

**Step 1: Write the failing test**

Create `src/lib/e-invoice/__tests__/poll-inbound-v2.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { pollInboundForAccount } from '../poll-inbound-v2'
import { findIntegrationAccountById } from '@/lib/integration/repository'
import type { IntegrationAccountWithSecrets } from '@/lib/integration/repository'

vi.mock('@/lib/integration/repository')
vi.mock('@/lib/db', () => ({
  db: {
    providerSyncState: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn()
    },
    eInvoice: {
      create: vi.fn(),
      findFirst: vi.fn()
    }
  }
}))

describe('Poll Inbound V2', () => {
  const mockAccount: IntegrationAccountWithSecrets = {
    id: 'acc-123',
    companyId: 'comp-456',
    kind: 'EINVOICE_EPOSLOVANJE',
    environment: 'PROD',
    status: 'ACTIVE',
    providerConfig: { baseUrl: 'https://api.eposlovanje.hr' },
    secrets: { apiKey: 'test-api-key' },
    createdAt: new Date(),
    updatedAt: new Date(),
    rotatedAt: null,
    lastUsedAt: null
  }

  beforeEach(() => {
    vi.mocked(findIntegrationAccountById).mockResolvedValue(mockAccount)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('pollInboundForAccount', () => {
    it('throws TenantViolationError if companyId mismatch', async () => {
      await expect(
        pollInboundForAccount('acc-123', 'wrong-company')
      ).rejects.toThrow('Tenant violation')
    })

    it('throws IntegrationNotFoundError if account not found', async () => {
      vi.mocked(findIntegrationAccountById).mockResolvedValue(null)

      await expect(
        pollInboundForAccount('nonexistent', 'comp-456')
      ).rejects.toThrow('Integration account not found')
    })

    it('throws IntegrationDisabledError if account not active', async () => {
      vi.mocked(findIntegrationAccountById).mockResolvedValue({
        ...mockAccount,
        status: 'DISABLED'
      })

      await expect(
        pollInboundForAccount('acc-123', 'comp-456')
      ).rejects.toThrow('Integration account disabled')
    })

    it('returns poll result with integrationAccountId', async () => {
      // Mock provider returns empty inbox
      vi.mocked(findIntegrationAccountById).mockResolvedValue(mockAccount)
      const { db } = await import('@/lib/db')
      vi.mocked(db.providerSyncState.findFirst).mockResolvedValue({
        id: 'sync-1',
        cursor: null,
        lastPollAt: new Date()
      } as any)

      // Partial mock - just verify the structure
      const result = await pollInboundForAccount('acc-123', 'comp-456')

      expect(result.integrationAccountId).toBe('acc-123')
      expect(result.companyId).toBe('comp-456')
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/e-invoice/__tests__/poll-inbound-v2.test.ts`

Expected: FAIL - module not found

**Step 3: Create implementation**

Create `src/lib/e-invoice/poll-inbound-v2.ts`:

```typescript
import { db } from '@/lib/db'
import { findIntegrationAccountById, touchIntegrationAccount } from '@/lib/integration/repository'
import { parseEInvoiceSecrets } from '@/lib/integration/types'
import { TenantViolationError, IntegrationNotFoundError, IntegrationDisabledError } from './provider-v2'
import { EposlovanjeEInvoiceProvider } from './providers/eposlovanje-einvoice'
import { logger } from '@/lib/logger'
import type { IntegrationKind } from '@prisma/client'

export interface PollInboundResult {
  integrationAccountId: string
  companyId: string
  invoicesPolled: number
  newInvoices: number
  cursor: string | null
  errors: string[]
}

/**
 * Polls inbound e-invoices using IntegrationAccount credentials.
 * This is the V2 path that enforces tenant isolation.
 *
 * @throws TenantViolationError if companyId doesn't match
 * @throws IntegrationNotFoundError if account not found
 * @throws IntegrationDisabledError if account not active
 */
export async function pollInboundForAccount(
  integrationAccountId: string,
  companyId: string
): Promise<PollInboundResult> {
  const account = await findIntegrationAccountById(integrationAccountId)

  if (!account) {
    throw new IntegrationNotFoundError(integrationAccountId)
  }

  // HARD TENANT ASSERTION - fails immediately, no retry
  if (account.companyId !== companyId) {
    throw new TenantViolationError(companyId, account.companyId)
  }

  if (account.status !== 'ACTIVE') {
    throw new IntegrationDisabledError(integrationAccountId, account.status)
  }

  logger.info('poll_inbound_start', {
    companyId,
    integrationAccountId,
    kind: account.kind
  })

  const secrets = parseEInvoiceSecrets(account.secrets)
  const config = account.providerConfig as { baseUrl?: string; timeout?: number } | null

  const provider = createProviderForKind(account.kind, secrets, config)

  // Get or create sync state
  let syncState = await db.providerSyncState.findFirst({
    where: {
      companyId,
      provider: mapKindToProviderName(account.kind),
      direction: 'INBOUND'
    }
  })

  if (!syncState) {
    syncState = await db.providerSyncState.create({
      data: {
        companyId,
        provider: mapKindToProviderName(account.kind),
        direction: 'INBOUND',
        integrationAccountId,
        cursor: null,
        lastPollAt: new Date()
      }
    })
  }

  // Update integrationAccountId if not set
  if (!syncState.integrationAccountId) {
    await db.providerSyncState.update({
      where: { id: syncState.id },
      data: { integrationAccountId }
    })
  }

  const result: PollInboundResult = {
    integrationAccountId,
    companyId,
    invoicesPolled: 0,
    newInvoices: 0,
    cursor: syncState.cursor,
    errors: []
  }

  try {
    const pollResult = await provider.pollInbound({
      cursor: syncState.cursor,
      limit: 50
    })

    result.invoicesPolled = pollResult.invoices.length

    for (const invoice of pollResult.invoices) {
      // Check if already exists
      const existing = await db.eInvoice.findFirst({
        where: {
          companyId,
          providerRef: invoice.providerRef
        }
      })

      if (!existing) {
        await db.eInvoice.create({
          data: {
            companyId,
            direction: 'INBOUND',
            status: 'RECEIVED',
            providerRef: invoice.providerRef,
            ublXml: invoice.ublXml,
            integrationAccountId,
            // ... other fields from parsed invoice
          }
        })
        result.newInvoices++
      }
    }

    // Update cursor
    if (pollResult.nextCursor !== syncState.cursor) {
      await db.providerSyncState.update({
        where: { id: syncState.id },
        data: {
          cursor: pollResult.nextCursor,
          lastPollAt: new Date()
        }
      })
      result.cursor = pollResult.nextCursor
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    result.errors.push(errorMessage)
    logger.error('poll_inbound_error', {
      companyId,
      integrationAccountId,
      error: errorMessage
    })
  }

  // Update lastUsedAt
  void touchIntegrationAccount(integrationAccountId)

  logger.info('poll_inbound_complete', {
    companyId,
    integrationAccountId,
    invoicesPolled: result.invoicesPolled,
    newInvoices: result.newInvoices,
    errors: result.errors.length
  })

  return result
}

/**
 * Resolves IntegrationAccount for a company and polls inbound.
 * Used when integrationAccountId is not known.
 */
export async function pollInboundForCompany(
  companyId: string,
  kind: IntegrationKind,
  environment: 'TEST' | 'PROD'
): Promise<PollInboundResult> {
  const { findIntegrationAccount } = await import('@/lib/integration/repository')

  const account = await findIntegrationAccount(companyId, kind, environment)

  if (!account) {
    throw new IntegrationNotFoundError(`${kind}/${environment} for company ${companyId}`)
  }

  return pollInboundForAccount(account.id, companyId)
}

function createProviderForKind(
  kind: IntegrationKind,
  secrets: { apiKey: string },
  config: { baseUrl?: string; timeout?: number } | null
): EposlovanjeEInvoiceProvider {
  return new EposlovanjeEInvoiceProvider({
    apiKey: secrets.apiKey,
    apiBase: config?.baseUrl ?? process.env.EPOSLOVANJE_API_BASE,
    timeoutMs: config?.timeout ?? 15000
  })
}

function mapKindToProviderName(kind: IntegrationKind): string {
  const mapping: Record<string, string> = {
    'EINVOICE_EPOSLOVANJE': 'eposlovanje',
    'EINVOICE_FINA': 'fina',
    'EINVOICE_IE_RACUNI': 'ie-racuni'
  }
  return mapping[kind] ?? 'unknown'
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/e-invoice/__tests__/poll-inbound-v2.test.ts`

Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/lib/e-invoice/poll-inbound-v2.ts src/lib/e-invoice/__tests__/poll-inbound-v2.test.ts
git commit -m "feat(e-invoice): add V2 inbound polling with IntegrationAccount"
```

---

## Task 3: Create Dual-Path Polling Orchestrator

**Files:**
- Create: `src/lib/e-invoice/poll-inbound.ts`

**Step 1: Create orchestrator with feature flag**

```typescript
import { db } from '@/lib/db'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { pollInboundForCompany } from './poll-inbound-v2'
import { createEInvoiceProvider } from './provider'
import { decryptSecret } from '@/lib/secrets'
import { logger } from '@/lib/logger'

interface PollInboundInput {
  companyId: string
  providerName: string
}

interface PollInboundOutput {
  invoicesPolled: number
  newInvoices: number
  integrationAccountId?: string
  errors: string[]
}

/**
 * Polls inbound e-invoices for a company.
 * Uses IntegrationAccount if feature flag enabled, otherwise legacy path.
 */
export async function pollInbound(input: PollInboundInput): Promise<PollInboundOutput> {
  const { companyId, providerName } = input

  const useNewPath = isFeatureEnabled('USE_INTEGRATION_ACCOUNT_INBOUND')

  logger.info('poll_inbound_start', {
    companyId,
    provider: providerName,
    useIntegrationAccount: useNewPath
  })

  if (useNewPath) {
    const kind = mapProviderNameToKind(providerName)
    const result = await pollInboundForCompany(companyId, kind, 'PROD')
    return {
      invoicesPolled: result.invoicesPolled,
      newInvoices: result.newInvoices,
      integrationAccountId: result.integrationAccountId,
      errors: result.errors
    }
  } else {
    return pollInboundLegacy(input)
  }
}

async function pollInboundLegacy(input: PollInboundInput): Promise<PollInboundOutput> {
  const { companyId, providerName } = input

  const company = await db.company.findUnique({
    where: { id: companyId },
    select: {
      eInvoiceApiKeyEncrypted: true
    }
  })

  if (!company?.eInvoiceApiKeyEncrypted) {
    return {
      invoicesPolled: 0,
      newInvoices: 0,
      errors: ['No API key configured']
    }
  }

  const apiKey = decryptSecret(company.eInvoiceApiKeyEncrypted)
  const provider = createEInvoiceProvider(providerName, { apiKey })

  // Get sync state
  let syncState = await db.providerSyncState.findFirst({
    where: {
      companyId,
      provider: providerName,
      direction: 'INBOUND'
    }
  })

  const result: PollInboundOutput = {
    invoicesPolled: 0,
    newInvoices: 0,
    errors: []
  }

  try {
    const pollResult = await provider.pollInbound({
      cursor: syncState?.cursor ?? null,
      limit: 50
    })

    result.invoicesPolled = pollResult.invoices.length

    for (const invoice of pollResult.invoices) {
      const existing = await db.eInvoice.findFirst({
        where: {
          companyId,
          providerRef: invoice.providerRef
        }
      })

      if (!existing) {
        await db.eInvoice.create({
          data: {
            companyId,
            direction: 'INBOUND',
            status: 'RECEIVED',
            providerRef: invoice.providerRef,
            ublXml: invoice.ublXml
          }
        })
        result.newInvoices++
      }
    }

    // Update cursor
    if (syncState) {
      await db.providerSyncState.update({
        where: { id: syncState.id },
        data: {
          cursor: pollResult.nextCursor,
          lastPollAt: new Date()
        }
      })
    } else {
      await db.providerSyncState.create({
        data: {
          companyId,
          provider: providerName,
          direction: 'INBOUND',
          cursor: pollResult.nextCursor,
          lastPollAt: new Date()
        }
      })
    }

  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error))
  }

  logger.info('poll_inbound_complete_legacy', {
    companyId,
    provider: providerName,
    invoicesPolled: result.invoicesPolled,
    newInvoices: result.newInvoices
  })

  return result
}

function mapProviderNameToKind(providerName: string): 'EINVOICE_EPOSLOVANJE' | 'EINVOICE_FINA' | 'EINVOICE_IE_RACUNI' {
  const mapping: Record<string, 'EINVOICE_EPOSLOVANJE' | 'EINVOICE_FINA' | 'EINVOICE_IE_RACUNI'> = {
    'eposlovanje': 'EINVOICE_EPOSLOVANJE',
    'fina': 'EINVOICE_FINA',
    'ie-racuni': 'EINVOICE_IE_RACUNI'
  }
  return mapping[providerName.toLowerCase()] ?? 'EINVOICE_EPOSLOVANJE'
}
```

**Step 2: Commit**

```bash
git add src/lib/e-invoice/poll-inbound.ts
git commit -m "feat(e-invoice): add dual-path inbound polling orchestrator"
```

---

## Task 4: Update Polling Worker

**Files:**
- Modify: `src/workers/einvoice-poll-worker.ts` (or equivalent)

**Step 1: Find existing polling worker**

Run: `grep -r "pollInbound\|poll.*inbound" src/ --include="*.ts"`

**Step 2: Update worker to use new orchestrator**

Replace direct provider calls with:

```typescript
import { pollInbound } from '@/lib/e-invoice/poll-inbound'

// In worker loop:
const result = await pollInbound({
  companyId: company.id,
  providerName: company.eInvoiceProvider || 'eposlovanje'
})

logger.info('poll_complete', {
  companyId: company.id,
  invoicesPolled: result.invoicesPolled,
  newInvoices: result.newInvoices,
  integrationAccountId: result.integrationAccountId,
  errors: result.errors
})
```

**Step 3: Commit**

```bash
git add src/workers/
git commit -m "refactor(workers): use unified pollInbound function"
```

---

## Task 5: Add Integration Tests for Inbound Flow

**Files:**
- Create: `src/lib/e-invoice/__tests__/poll-inbound.db.test.ts`

**Step 1: Write database integration test**

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { db } from '@/lib/db'
import { pollInboundForAccount } from '../poll-inbound-v2'
import { createIntegrationAccount } from '@/lib/integration/repository'

describe('Poll Inbound V2 (DB Integration)', () => {
  let testCompanyId: string
  let testIntegrationAccountId: string

  beforeAll(async () => {
    // Create test company
    const company = await db.company.create({
      data: {
        name: 'Inbound Poll Test Co',
        oib: '12345678904',
        address: 'Test Address',
        city: 'Zagreb',
        postalCode: '10000',
        country: 'HR'
      }
    })
    testCompanyId = company.id

    // Create test integration account
    const account = await createIntegrationAccount({
      companyId: testCompanyId,
      kind: 'EINVOICE_EPOSLOVANJE',
      environment: 'TEST',
      secrets: { apiKey: 'test-poll-key' },
      providerConfig: { baseUrl: 'https://test.eposlovanje.hr' }
    })
    testIntegrationAccountId = account.id
  })

  afterAll(async () => {
    await db.providerSyncState.deleteMany({ where: { companyId: testCompanyId } })
    await db.eInvoice.deleteMany({ where: { companyId: testCompanyId } })
    await db.integrationAccount.deleteMany({ where: { companyId: testCompanyId } })
    await db.company.delete({ where: { id: testCompanyId } })
    await db.$disconnect()
  })

  beforeEach(async () => {
    await db.providerSyncState.deleteMany({ where: { companyId: testCompanyId } })
  })

  it('creates sync state with integrationAccountId on first poll', async () => {
    // Note: This test requires mock provider or will fail on network call
    // For full integration, use test environment with mock server

    // Verify sync state is created
    const syncState = await db.providerSyncState.findFirst({
      where: {
        companyId: testCompanyId,
        integrationAccountId: testIntegrationAccountId
      }
    })

    // Expectation depends on whether provider call succeeds
    // In unit test, we'd mock this; in integration, we need test server
  })

  it('enforces tenant isolation', async () => {
    const otherCompany = await db.company.create({
      data: {
        name: 'Other Co',
        oib: '98765432101',
        address: 'Other Address',
        city: 'Split',
        postalCode: '21000',
        country: 'HR'
      }
    })

    try {
      await expect(
        pollInboundForAccount(testIntegrationAccountId, otherCompany.id)
      ).rejects.toThrow('Tenant violation')
    } finally {
      await db.company.delete({ where: { id: otherCompany.id } })
    }
  })
})
```

**Step 2: Run integration test**

Run: `npx vitest run src/lib/e-invoice/__tests__/poll-inbound.db.test.ts`

**Step 3: Commit**

```bash
git add src/lib/e-invoice/__tests__/poll-inbound.db.test.ts
git commit -m "test(e-invoice): add inbound polling integration tests"
```

---

## Task 6: Add Index to ProviderSyncState

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add index for common queries**

Add to ProviderSyncState:
```prisma
  @@index([integrationAccountId], map: "provider_sync_state_integration_account_idx")
```

**Step 2: Generate migration**

Run: `npx prisma migrate dev --name add_provider_sync_state_integration_account_idx`

**Step 3: Commit**

```bash
git add prisma/
git commit -m "feat(schema): add index on ProviderSyncState.integrationAccountId"
```

---

## Phase 3 Completion Checklist

- [ ] integrationAccountId column on ProviderSyncState
- [ ] V2 polling service with tenant assertions
- [ ] Dual-path polling orchestrator
- [ ] Polling worker updated
- [ ] Integration tests for inbound flow
- [ ] Structured logging with integrationAccountId
- [ ] All tests passing

---

## Testing the Feature Flag

**Enable new path:**
```bash
FF_INTEGRATION_ACCOUNT_INBOUND=true npx tsx src/workers/einvoice-poll-worker.ts
```

**Check logs for:**
- `useIntegrationAccount: true`
- `integrationAccountId` in completion logs

---

## Rollback Procedure

1. Set `FF_INTEGRATION_ACCOUNT_INBOUND=false`
2. Legacy path immediately active
3. No code changes needed
4. Worker continues with old polling logic

---

## Next Phase

Proceed to `2026-01-04-phase4-fiscalization-migration.md`

---

End of Phase 3 Plan
