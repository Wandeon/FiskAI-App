# Phase 2: E-Invoice Outbound Migration

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Outbound e-invoices use IntegrationAccount for credential resolution instead of Company.eInvoiceApiKeyEncrypted.

**Architecture:** Feature-flagged dual path. New path resolves IntegrationAccount, old path remains active. EInvoice gains integrationAccountId column.

**Tech Stack:** Prisma 7, PostgreSQL, TypeScript, Vitest

---

## Prerequisites

- [ ] Phase 1 complete (IntegrationAccount model exists)
- [ ] Backfill script has been run (IntegrationAccounts exist for companies)
- [ ] `INTEGRATION_VAULT_KEY` environment variable set
- [ ] Phase 1 backfill invariant tests passing

---

## Provider Selection Source of Truth

**UI → Kind Mapping:**

| UI Selection | IntegrationKind | Notes |
|--------------|-----------------|-------|
| "ePoslovanje" | `EINVOICE_EPOSLOVANJE` | Croatian B2B platform |
| "FINA" | `EINVOICE_FINA` | Croatian government |
| "IE-Računi" | `EINVOICE_IE_RACUNI` | Alternative provider |

**Code mapping (single source of truth):**

```typescript
// src/lib/e-invoice/provider-mapping.ts
export const PROVIDER_NAME_TO_KIND: Record<string, IntegrationKind> = {
  'eposlovanje': 'EINVOICE_EPOSLOVANJE',
  'fina': 'EINVOICE_FINA',
  'ie-racuni': 'EINVOICE_IE_RACUNI',
}

export const KIND_TO_PROVIDER_NAME: Record<IntegrationKind, string> = {
  'EINVOICE_EPOSLOVANJE': 'eposlovanje',
  'EINVOICE_FINA': 'fina',
  'EINVOICE_IE_RACUNI': 'ie-racuni',
  'FISCALIZATION_CIS': 'cis', // Not used for e-invoice
}
```

**Multiple accounts per kind:** Impossible due to `@@unique([companyId, kind, environment])`. If UI shows multiple configs, it's a misconfig - log error and use first active.

---

## Idempotency Contract

**Idempotency key format:**
```typescript
const idempotencyKey = `einvoice:send:${companyId}:${invoiceId}:${integrationAccountId}`
```

**Why include integrationAccountId:**
- Prevents cross-wire if account changes between retries
- Audit trail shows exact credentials used
- Retry with different account = new operation (correct behavior)

**Implementation:**
- Check `EInvoice.providerRef` before sending (existing)
- Add `EInvoice.integrationAccountId` check: if set and different, reject retry
- Log mismatch as warning (should not happen in correct flow)

---

## Task 1: Add integrationAccountId to EInvoice

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add field and relation to EInvoice model (around line 1200)**

```prisma
  // Integration account used for sending (Phase 2+)
  integrationAccountId  String?
  integrationAccount    IntegrationAccount? @relation(fields: [integrationAccountId], references: [id])
```

**Step 2: Uncomment relation in IntegrationAccount model**

```prisma
  eInvoices         EInvoice[]
```

**Step 3: Generate migration**

Run: `npx prisma migrate dev --name add_einvoice_integration_account`

Expected: Migration created, nullable column added

**Step 4: Commit**

```bash
git add prisma/
git commit -m "feat(schema): add integrationAccountId to EInvoice"
```

---

## Task 2: Create Feature Flag

**Files:**
- Create: `src/lib/feature-flags.ts`

**Step 1: Create feature flags module**

```typescript
/**
 * Feature flags for phased migration.
 * Phase 5 will remove these and enforce new paths.
 */

export const FEATURE_FLAGS = {
  /**
   * Phase 2: Use IntegrationAccount for outbound e-invoice sends.
   * When false, uses legacy Company.eInvoiceApiKeyEncrypted path.
   */
  USE_INTEGRATION_ACCOUNT_OUTBOUND:
    process.env.FF_INTEGRATION_ACCOUNT_OUTBOUND === 'true',

  /**
   * Phase 3: Use IntegrationAccount for inbound e-invoice polling.
   */
  USE_INTEGRATION_ACCOUNT_INBOUND:
    process.env.FF_INTEGRATION_ACCOUNT_INBOUND === 'true',

  /**
   * Phase 4: Use IntegrationAccount for fiscalization.
   */
  USE_INTEGRATION_ACCOUNT_FISCAL:
    process.env.FF_INTEGRATION_ACCOUNT_FISCAL === 'true',

  /**
   * Phase 5: Enforce IntegrationAccount for all regulated actions.
   * When true, legacy paths throw errors.
   */
  ENFORCE_INTEGRATION_ACCOUNT:
    process.env.FF_ENFORCE_INTEGRATION_ACCOUNT === 'true'
} as const

export function isFeatureEnabled(flag: keyof typeof FEATURE_FLAGS): boolean {
  return FEATURE_FLAGS[flag]
}
```

**Step 2: Commit**

```bash
git add src/lib/feature-flags.ts
git commit -m "feat(flags): add feature flags for phased migration"
```

---

## Task 3: Create IntegrationAccount-Aware Provider Factory

**Files:**
- Create: `src/lib/e-invoice/provider-v2.ts`
- Create: `src/lib/e-invoice/__tests__/provider-v2.test.ts`

**Step 1: Write the failing test**

Create `src/lib/e-invoice/__tests__/provider-v2.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createProviderFromIntegrationAccount } from '../provider-v2'
import { findIntegrationAccountById } from '@/lib/integration/repository'
import type { IntegrationAccountWithSecrets } from '@/lib/integration/repository'

vi.mock('@/lib/integration/repository')

describe('Provider V2 Factory', () => {
  const mockAccount: IntegrationAccountWithSecrets = {
    id: 'acc-123',
    companyId: 'comp-456',
    kind: 'EINVOICE_EPOSLOVANJE',
    environment: 'TEST',
    status: 'ACTIVE',
    providerConfig: { baseUrl: 'https://test.eposlovanje.hr' },
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

  describe('createProviderFromIntegrationAccount', () => {
    it('creates ePoslovanje provider for EINVOICE_EPOSLOVANJE kind', async () => {
      const provider = await createProviderFromIntegrationAccount('acc-123', 'comp-456')

      expect(provider.name).toBe('eposlovanje')
    })

    it('throws TenantViolationError if companyId mismatch', async () => {
      await expect(
        createProviderFromIntegrationAccount('acc-123', 'wrong-company')
      ).rejects.toThrow('Tenant violation')
    })

    it('throws IntegrationNotFoundError if account not found', async () => {
      vi.mocked(findIntegrationAccountById).mockResolvedValue(null)

      await expect(
        createProviderFromIntegrationAccount('nonexistent', 'comp-456')
      ).rejects.toThrow('Integration account not found')
    })

    it('throws IntegrationDisabledError if account not active', async () => {
      vi.mocked(findIntegrationAccountById).mockResolvedValue({
        ...mockAccount,
        status: 'DISABLED'
      })

      await expect(
        createProviderFromIntegrationAccount('acc-123', 'comp-456')
      ).rejects.toThrow('Integration account disabled')
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/e-invoice/__tests__/provider-v2.test.ts`

Expected: FAIL - module not found

**Step 3: Create implementation**

Create `src/lib/e-invoice/provider-v2.ts`:

```typescript
import { findIntegrationAccountById, touchIntegrationAccount } from '@/lib/integration/repository'
import { parseEInvoiceSecrets, type EInvoiceSecrets } from '@/lib/integration/types'
import { EposlovanjeEInvoiceProvider } from './providers/eposlovanje-einvoice'
import { MockProvider } from './providers/mock'
import type { EInvoiceProvider } from './provider'
import type { IntegrationKind } from '@prisma/client'

export class TenantViolationError extends Error {
  constructor(expectedCompanyId: string, actualCompanyId: string) {
    super(`Tenant violation: expected ${expectedCompanyId}, got ${actualCompanyId}`)
    this.name = 'TenantViolationError'
  }
}

export class IntegrationNotFoundError extends Error {
  constructor(integrationAccountId: string) {
    super(`Integration account not found: ${integrationAccountId}`)
    this.name = 'IntegrationNotFoundError'
  }
}

export class IntegrationDisabledError extends Error {
  constructor(integrationAccountId: string, status: string) {
    super(`Integration account disabled: ${integrationAccountId} (status: ${status})`)
    this.name = 'IntegrationDisabledError'
  }
}

/**
 * Creates an e-invoice provider from an IntegrationAccount.
 * This is the V2 path that enforces tenant isolation.
 *
 * @throws TenantViolationError if companyId doesn't match
 * @throws IntegrationNotFoundError if account not found
 * @throws IntegrationDisabledError if account not active
 */
export async function createProviderFromIntegrationAccount(
  integrationAccountId: string,
  companyId: string
): Promise<EInvoiceProvider> {
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

  const secrets = parseEInvoiceSecrets(account.secrets)
  const config = account.providerConfig as { baseUrl?: string; timeout?: number } | null

  const provider = createProviderForKind(account.kind, secrets, config)

  // Update lastUsedAt asynchronously (fire-and-forget)
  void touchIntegrationAccount(integrationAccountId)

  return provider
}

function createProviderForKind(
  kind: IntegrationKind,
  secrets: EInvoiceSecrets,
  config: { baseUrl?: string; timeout?: number } | null
): EInvoiceProvider {
  switch (kind) {
    case 'EINVOICE_EPOSLOVANJE':
      return new EposlovanjeEInvoiceProvider({
        apiKey: secrets.apiKey,
        apiBase: config?.baseUrl ?? process.env.EPOSLOVANJE_API_BASE,
        timeoutMs: config?.timeout ?? 15000
      })

    case 'EINVOICE_FINA':
      // FINA uses ePoslovanje adapter
      return new EposlovanjeEInvoiceProvider({
        apiKey: secrets.apiKey,
        apiBase: config?.baseUrl ?? process.env.EPOSLOVANJE_API_BASE,
        timeoutMs: config?.timeout ?? 15000
      })

    case 'EINVOICE_IE_RACUNI':
      // IE-Računi uses ePoslovanje adapter
      return new EposlovanjeEInvoiceProvider({
        apiKey: secrets.apiKey,
        apiBase: config?.baseUrl ?? process.env.EPOSLOVANJE_API_BASE,
        timeoutMs: config?.timeout ?? 15000
      })

    default:
      // Mock provider for unknown kinds (shouldn't happen in production)
      return new MockProvider({ apiKey: secrets.apiKey })
  }
}

/**
 * Resolves IntegrationAccount for a company and creates provider.
 * Used when integrationAccountId is not yet known.
 */
export async function resolveProviderForCompany(
  companyId: string,
  kind: IntegrationKind,
  environment: 'TEST' | 'PROD'
): Promise<{ provider: EInvoiceProvider; integrationAccountId: string }> {
  const { findIntegrationAccount } = await import('@/lib/integration/repository')

  const account = await findIntegrationAccount(companyId, kind, environment)

  if (!account) {
    throw new IntegrationNotFoundError(`${kind}/${environment} for company ${companyId}`)
  }

  const secrets = parseEInvoiceSecrets(account.secrets)
  const config = account.providerConfig as { baseUrl?: string; timeout?: number } | null

  const provider = createProviderForKind(account.kind, secrets, config)

  void touchIntegrationAccount(account.id)

  return {
    provider,
    integrationAccountId: account.id
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/e-invoice/__tests__/provider-v2.test.ts`

Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/lib/e-invoice/provider-v2.ts src/lib/e-invoice/__tests__/provider-v2.test.ts
git commit -m "feat(e-invoice): add V2 provider factory with IntegrationAccount"
```

---

## Task 4: Create Dual-Path Send Function

**Files:**
- Modify: `src/lib/e-invoice/send.ts` (or create if doesn't exist)

**Step 1: Create send function with feature flag**

Create `src/lib/e-invoice/send-invoice.ts`:

```typescript
import { db } from '@/lib/db'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { createEInvoiceProvider } from './provider'
import { createProviderFromIntegrationAccount, resolveProviderForCompany } from './provider-v2'
import { decryptSecret } from '@/lib/secrets'
import { logger } from '@/lib/logger'
import type { EInvoiceWithRelations, SendInvoiceResult } from './types'

interface SendInvoiceInput {
  invoice: EInvoiceWithRelations
  ublXml: string
}

interface SendInvoiceOutput extends SendInvoiceResult {
  integrationAccountId?: string
}

/**
 * Sends an e-invoice via the appropriate provider.
 * Uses IntegrationAccount if feature flag enabled, otherwise legacy path.
 */
export async function sendEInvoice(input: SendInvoiceInput): Promise<SendInvoiceOutput> {
  const { invoice, ublXml } = input
  const companyId = invoice.companyId

  // Log which path we're using
  const useNewPath = isFeatureEnabled('USE_INTEGRATION_ACCOUNT_OUTBOUND')

  logger.info('send_einvoice_start', {
    companyId,
    invoiceId: invoice.id,
    useIntegrationAccount: useNewPath
  })

  if (useNewPath) {
    return sendViaIntegrationAccount(invoice, ublXml)
  } else {
    return sendViaLegacyPath(invoice, ublXml)
  }
}

async function sendViaIntegrationAccount(
  invoice: EInvoiceWithRelations,
  ublXml: string
): Promise<SendInvoiceOutput> {
  const company = invoice.company

  // Determine integration kind from company settings
  const kind = mapProviderNameToKind(company.eInvoiceProvider || 'mock')
  const environment = 'PROD' as const // TODO: support TEST environment

  // If invoice already has integrationAccountId, use it
  let integrationAccountId = invoice.integrationAccountId
  let provider

  if (integrationAccountId) {
    provider = await createProviderFromIntegrationAccount(integrationAccountId, invoice.companyId)
  } else {
    // Resolve from company
    const resolved = await resolveProviderForCompany(invoice.companyId, kind, environment)
    provider = resolved.provider
    integrationAccountId = resolved.integrationAccountId

    // Store integrationAccountId on invoice for audit
    await db.eInvoice.update({
      where: { id: invoice.id },
      data: { integrationAccountId }
    })
  }

  const result = await provider.sendInvoice(invoice, ublXml)

  logger.info('send_einvoice_complete', {
    companyId: invoice.companyId,
    invoiceId: invoice.id,
    integrationAccountId,
    success: result.success,
    providerRef: result.providerRef
  })

  return {
    ...result,
    integrationAccountId
  }
}

async function sendViaLegacyPath(
  invoice: EInvoiceWithRelations,
  ublXml: string
): Promise<SendInvoiceOutput> {
  const company = invoice.company
  const providerName = company.eInvoiceProvider || 'mock'

  // Decrypt API key from company
  const apiKey = company.eInvoiceApiKeyEncrypted
    ? decryptSecret(company.eInvoiceApiKeyEncrypted)
    : ''

  const provider = createEInvoiceProvider(providerName, { apiKey })
  const result = await provider.sendInvoice(invoice, ublXml)

  logger.info('send_einvoice_complete_legacy', {
    companyId: invoice.companyId,
    invoiceId: invoice.id,
    provider: providerName,
    success: result.success,
    providerRef: result.providerRef
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

**Step 2: Write test for dual-path behavior**

Create `src/lib/e-invoice/__tests__/send-invoice.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sendEInvoice } from '../send-invoice'

// Mock dependencies
vi.mock('@/lib/feature-flags', () => ({
  isFeatureEnabled: vi.fn()
}))

vi.mock('../provider', () => ({
  createEInvoiceProvider: vi.fn()
}))

vi.mock('../provider-v2', () => ({
  resolveProviderForCompany: vi.fn()
}))

vi.mock('@/lib/secrets', () => ({
  decryptSecret: vi.fn()
}))

vi.mock('@/lib/db', () => ({
  db: {
    eInvoice: {
      update: vi.fn()
    }
  }
}))

describe('sendEInvoice', () => {
  const mockInvoice = {
    id: 'inv-123',
    companyId: 'comp-456',
    integrationAccountId: null,
    company: {
      id: 'comp-456',
      eInvoiceProvider: 'eposlovanje',
      eInvoiceApiKeyEncrypted: 'encrypted-key'
    }
  } as any

  const mockUblXml = '<Invoice>...</Invoice>'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses legacy path when feature flag is off', async () => {
    const { isFeatureEnabled } = await import('@/lib/feature-flags')
    const { createEInvoiceProvider } = await import('../provider')
    const { decryptSecret } = await import('@/lib/secrets')

    vi.mocked(isFeatureEnabled).mockReturnValue(false)
    vi.mocked(decryptSecret).mockReturnValue('decrypted-key')
    vi.mocked(createEInvoiceProvider).mockReturnValue({
      name: 'eposlovanje',
      sendInvoice: vi.fn().mockResolvedValue({ success: true, providerRef: 'ref-123' })
    } as any)

    const result = await sendEInvoice({ invoice: mockInvoice, ublXml: mockUblXml })

    expect(isFeatureEnabled).toHaveBeenCalledWith('USE_INTEGRATION_ACCOUNT_OUTBOUND')
    expect(createEInvoiceProvider).toHaveBeenCalled()
    expect(result.success).toBe(true)
  })

  it('uses new path when feature flag is on', async () => {
    const { isFeatureEnabled } = await import('@/lib/feature-flags')
    const { resolveProviderForCompany } = await import('../provider-v2')

    vi.mocked(isFeatureEnabled).mockReturnValue(true)
    vi.mocked(resolveProviderForCompany).mockResolvedValue({
      provider: {
        name: 'eposlovanje',
        sendInvoice: vi.fn().mockResolvedValue({ success: true, providerRef: 'ref-456' })
      } as any,
      integrationAccountId: 'acc-789'
    })

    const result = await sendEInvoice({ invoice: mockInvoice, ublXml: mockUblXml })

    expect(resolveProviderForCompany).toHaveBeenCalled()
    expect(result.integrationAccountId).toBe('acc-789')
    expect(result.success).toBe(true)
  })
})
```

**Step 3: Run tests**

Run: `npx vitest run src/lib/e-invoice/__tests__/send-invoice.test.ts`

Expected: All tests PASS

**Step 4: Commit**

```bash
git add src/lib/e-invoice/send-invoice.ts src/lib/e-invoice/__tests__/send-invoice.test.ts
git commit -m "feat(e-invoice): add dual-path send with feature flag"
```

---

## Task 5: Update Existing Send Callers

**Files:**
- Identify and update all places that call the old send flow

**Step 1: Search for existing send callers**

Run: `grep -r "sendInvoice\|provider.send" src/ --include="*.ts"`

**Step 2: Update each caller to use the new sendEInvoice function**

(This will depend on current code structure - update each file to import and use `sendEInvoice` instead of direct provider calls)

**Step 3: Commit**

```bash
git add src/
git commit -m "refactor(e-invoice): use unified sendEInvoice function"
```

---

## Task 6: Add Index to EInvoice for integrationAccountId

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add index for common queries**

```prisma
  @@index([integrationAccountId], map: "einvoice_integration_account_idx")
```

**Step 2: Generate migration**

Run: `npx prisma migrate dev --name add_einvoice_integration_account_idx`

**Step 3: Commit**

```bash
git add prisma/
git commit -m "feat(schema): add index on EInvoice.integrationAccountId"
```

---

## Phase 2 Completion Checklist

- [ ] integrationAccountId column on EInvoice
- [ ] Feature flag infrastructure
- [ ] Provider mapping module created
- [ ] V2 provider factory with tenant assertions
- [ ] Dual-path send function with idempotency check
- [ ] All send callers updated
- [ ] Tests passing for both paths
- [ ] Structured logging with integrationAccountId
- [ ] Call-site inventory gate passes (see below)

---

## Call-Site Inventory Gate

**HARD GATE: No direct provider sends allowed outside sendEInvoice()**

Run before marking Phase 2 complete:

```bash
# Find all direct provider.sendInvoice calls
grep -r "\.sendInvoice\(" src/ --include="*.ts" \
  | grep -v "__tests__" \
  | grep -v "send-invoice.ts" \
  | grep -v "provider-v2.ts"

# Expected: 0 results
# If any results: refactor to use sendEInvoice()
```

**Also check:**
```bash
# Find legacy provider factory usage
grep -r "createEInvoiceProvider\(" src/ --include="*.ts" \
  | grep -v "__tests__" \
  | grep -v "send-invoice.ts" \
  | grep -v "poll-inbound.ts"

# Expected: 0 results outside dual-path functions
```

**Add as CI check:**
```yaml
# .github/workflows/ci.yml
- name: Check no legacy provider calls
  run: |
    COUNT=$(grep -r "createEInvoiceProvider\(" src/ --include="*.ts" \
      | grep -v "__tests__" \
      | grep -v "send-invoice.ts" \
      | grep -v "poll-inbound.ts" \
      | wc -l)
    if [ "$COUNT" -gt 0 ]; then
      echo "ERROR: Found $COUNT legacy provider calls"
      exit 1
    fi
```

---

## Testing the Feature Flag

**Enable new path:**
```bash
FF_INTEGRATION_ACCOUNT_OUTBOUND=true npx tsx scripts/lane2-outbound-dry-run.ts <companyId>
```

**Check logs for:**
- `useIntegrationAccount: true`
- `integrationAccountId` in completion logs

---

## Rollback Procedure

1. Set `FF_INTEGRATION_ACCOUNT_OUTBOUND=false`
2. Legacy path immediately active
3. No code changes needed
4. integrationAccountId column can stay (nullable, unused)

---

## Next Phase

Proceed to `2026-01-04-phase3-einvoice-inbound-migration.md`

---

End of Phase 2 Plan
