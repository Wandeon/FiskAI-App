# Phase 4: Fiscalization Migration

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fiscal certificates stored in IntegrationAccount unified vault instead of separate FiscalCertificate table with envelope encryption.

**Architecture:** Feature-flagged dual path. FiscalRequest gains integrationAccountId column. Fiscalization service resolves P12 from IntegrationAccount secrets.

**Tech Stack:** Prisma 7, PostgreSQL, AES-256-GCM, TypeScript, Vitest

---

## Prerequisites

- [ ] Phase 1 complete (IntegrationAccount model exists with vault)
- [ ] Backfill script has been run (FISCALIZATION_CIS accounts created from FiscalCertificate)
- [ ] `INTEGRATION_VAULT_KEY` environment variable set
- [ ] `FISCAL_CERT_KEY` still available (for legacy path fallback)

---

## Certificate Lifecycle States

**IntegrationStatus mapping for fiscal certificates:**

| Status | Meaning | Runtime Behavior |
|--------|---------|------------------|
| ACTIVE | Valid, can sign | Allow fiscalization |
| DISABLED | Manually disabled | Hard fail, log warning |
| EXPIRED | Cert notAfter passed | Hard fail, alert owner |
| REVOKED | Cert revoked by CA | Hard fail, alert immediately |

**Expiration detection:**

```typescript
// Run daily via cron job
async function checkCertificateExpiry(): Promise<void> {
  const accounts = await db.integrationAccount.findMany({
    where: { kind: 'FISCALIZATION_CIS', status: 'ACTIVE' }
  });

  for (const account of accounts) {
    const config = account.providerConfig as FiscalProviderConfig;
    const expiresAt = new Date(config.certNotAfter);
    const daysUntilExpiry = Math.floor((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry <= 0) {
      await db.integrationAccount.update({
        where: { id: account.id },
        data: { status: 'EXPIRED' }
      });
      await sendAlert('CERT_EXPIRED', account);
    } else if (daysUntilExpiry <= 30) {
      await sendAlert('CERT_EXPIRING_SOON', account, { daysRemaining: daysUntilExpiry });
    }
  }
}
```

**Multiple certificates handling:**
- Only ONE `FISCALIZATION_CIS` per (companyId, environment) allowed
- To rotate: upload new cert, old becomes DISABLED
- Backfill takes "most recent ACTIVE" certificate

---

## Secret Payload Format (Fiscalization)

**Extended format with metadata:**

```typescript
interface FiscalizationSecrets {
  // Core secrets (encrypted)
  p12Base64: string;    // Raw P12 bytes, base64 encoded
  p12Password: string;  // P12 decryption password

  // Metadata stored in providerConfig (NOT encrypted, for queries)
  // These are duplicated in providerConfig for display/filtering without decryption
}

interface FiscalProviderConfig {
  // Certificate metadata (extracted during backfill/upload)
  certSubject: string;        // "CN=ACME d.o.o., O=ACME"
  certSerial: string;         // "1234567890ABCDEF"
  certNotBefore: string;      // ISO date
  certNotAfter: string;       // ISO date
  oibExtracted: string;       // "12345678903"

  // Migration audit trail
  migratedFrom?: string;      // "FiscalCertificate.clxyz123"
  migratedAt?: string;        // ISO timestamp
}
```

**Why this split:**
- `secretEnvelope`: Only P12 + password (decrypted at runtime)
- `providerConfig`: Metadata for UI display, expiry checks, audit (no decryption needed)
- Reduces decrypt operations for read-only queries

**Extraction during upload:**

```typescript
async function extractP12Metadata(p12Buffer: Buffer, password: string): Promise<Partial<FiscalProviderConfig>> {
  const { Certificate } = await import('crypto');
  // Parse P12, extract cert
  const cert = parseP12(p12Buffer, password);

  return {
    certSubject: cert.subject,
    certSerial: cert.serialNumber,
    certNotBefore: cert.notBefore.toISOString(),
    certNotAfter: cert.notAfter.toISOString(),
    oibExtracted: extractOibFromSubject(cert.subject)
  };
}
```

---

## Task 1: Add integrationAccountId to FiscalRequest

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add field and relation to FiscalRequest model**

Locate `model FiscalRequest` and add:

```prisma
  // Integration account used for signing (Phase 4+)
  integrationAccountId  String?
  integrationAccount    IntegrationAccount? @relation(fields: [integrationAccountId], references: [id])
```

**Step 2: Add relation in IntegrationAccount model**

Add to IntegrationAccount:
```prisma
  fiscalRequests    FiscalRequest[]
```

**Step 3: Generate migration**

Run: `npx prisma migrate dev --name add_fiscal_request_integration_account`

Expected: Migration created, nullable column added

**Step 4: Commit**

```bash
git add prisma/
git commit -m "feat(schema): add integrationAccountId to FiscalRequest"
```

---

## Task 2: Create Fiscalization Secrets Parser

**Files:**
- Modify: `src/lib/integration/types.ts`
- Create: `src/lib/integration/__tests__/fiscal-types.test.ts`

**Step 1: Write the failing test**

Create `src/lib/integration/__tests__/fiscal-types.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  parseFiscalizationSecrets,
  extractP12FromSecrets,
  IntegrationSecretsError
} from '../types'

describe('Fiscalization Secrets', () => {
  describe('parseFiscalizationSecrets', () => {
    it('parses valid fiscalization secrets', () => {
      const input = {
        p12Base64: 'dGVzdA==',
        p12Password: 'password123'
      }
      const result = parseFiscalizationSecrets(input)
      expect(result).toEqual(input)
    })

    it('throws on missing p12Base64', () => {
      expect(() => parseFiscalizationSecrets({ p12Password: 'x' }))
        .toThrow(IntegrationSecretsError)
    })

    it('throws on missing p12Password', () => {
      expect(() => parseFiscalizationSecrets({ p12Base64: 'x' }))
        .toThrow(IntegrationSecretsError)
    })

    it('throws on empty p12Base64', () => {
      expect(() => parseFiscalizationSecrets({ p12Base64: '', p12Password: 'x' }))
        .toThrow(IntegrationSecretsError)
    })
  })

  describe('extractP12FromSecrets', () => {
    it('converts base64 to Buffer', () => {
      const secrets = {
        p12Base64: Buffer.from('test data').toString('base64'),
        p12Password: 'password'
      }

      const result = extractP12FromSecrets(secrets)

      expect(result.p12Buffer).toBeInstanceOf(Buffer)
      expect(result.p12Buffer.toString()).toBe('test data')
      expect(result.password).toBe('password')
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/integration/__tests__/fiscal-types.test.ts`

Expected: FAIL - extractP12FromSecrets not found

**Step 3: Add implementation to types.ts**

Add to `src/lib/integration/types.ts`:

```typescript
/**
 * Extracts P12 certificate data from fiscalization secrets.
 * Returns Buffer and password ready for crypto operations.
 */
export function extractP12FromSecrets(secrets: FiscalizationSecrets): {
  p12Buffer: Buffer
  password: string
} {
  return {
    p12Buffer: Buffer.from(secrets.p12Base64, 'base64'),
    password: secrets.p12Password
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/integration/__tests__/fiscal-types.test.ts`

Expected: All tests PASS

**Step 5: Update index.ts exports**

Add to `src/lib/integration/index.ts`:
```typescript
export { extractP12FromSecrets } from './types'
```

**Step 6: Commit**

```bash
git add src/lib/integration/
git commit -m "feat(integration): add P12 extraction from fiscalization secrets"
```

---

## Task 3: Create IntegrationAccount-Aware Fiscal Signer

**Files:**
- Create: `src/lib/fiscal/signer-v2.ts`
- Create: `src/lib/fiscal/__tests__/signer-v2.test.ts`

**Step 1: Write the failing test**

Create `src/lib/fiscal/__tests__/signer-v2.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createSignerFromIntegrationAccount } from '../signer-v2'
import { findIntegrationAccountById } from '@/lib/integration/repository'
import type { IntegrationAccountWithSecrets } from '@/lib/integration/repository'

vi.mock('@/lib/integration/repository')

describe('Fiscal Signer V2', () => {
  const mockP12Base64 = Buffer.from('mock-p12-data').toString('base64')

  const mockAccount: IntegrationAccountWithSecrets = {
    id: 'acc-fiscal-123',
    companyId: 'comp-456',
    kind: 'FISCALIZATION_CIS',
    environment: 'TEST',
    status: 'ACTIVE',
    providerConfig: {
      certSubject: 'CN=Test Company',
      certSerial: '12345',
      oibExtracted: '12345678903'
    },
    secrets: {
      p12Base64: mockP12Base64,
      p12Password: 'test-password'
    },
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

  describe('createSignerFromIntegrationAccount', () => {
    it('throws TenantViolationError if companyId mismatch', async () => {
      await expect(
        createSignerFromIntegrationAccount('acc-fiscal-123', 'wrong-company')
      ).rejects.toThrow('Tenant violation')
    })

    it('throws IntegrationNotFoundError if account not found', async () => {
      vi.mocked(findIntegrationAccountById).mockResolvedValue(null)

      await expect(
        createSignerFromIntegrationAccount('nonexistent', 'comp-456')
      ).rejects.toThrow('Integration account not found')
    })

    it('throws IntegrationDisabledError if account expired', async () => {
      vi.mocked(findIntegrationAccountById).mockResolvedValue({
        ...mockAccount,
        status: 'EXPIRED'
      })

      await expect(
        createSignerFromIntegrationAccount('acc-fiscal-123', 'comp-456')
      ).rejects.toThrow('Integration account disabled')
    })

    it('returns signer with certificate data', async () => {
      const signer = await createSignerFromIntegrationAccount('acc-fiscal-123', 'comp-456')

      expect(signer.oib).toBe('12345678903')
      expect(signer.integrationAccountId).toBe('acc-fiscal-123')
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/fiscal/__tests__/signer-v2.test.ts`

Expected: FAIL - module not found

**Step 3: Create implementation**

Create `src/lib/fiscal/signer-v2.ts`:

```typescript
import { findIntegrationAccountById, touchIntegrationAccount } from '@/lib/integration/repository'
import { parseFiscalizationSecrets, extractP12FromSecrets } from '@/lib/integration/types'
import { TenantViolationError, IntegrationNotFoundError, IntegrationDisabledError } from '@/lib/e-invoice/provider-v2'
import { logger } from '@/lib/logger'
import { signXml, computeZKI } from './signing'
import type { FiscalCertificateInfo } from './types'

export interface FiscalSignerV2 {
  integrationAccountId: string
  companyId: string
  oib: string
  certSubject: string
  certSerial: string

  /**
   * Signs XML document with the P12 certificate.
   */
  sign(xmlContent: string): Promise<string>

  /**
   * Computes ZKI (Zaštitni Kod Izdavatelja).
   */
  computeZKI(data: ZKIInputData): Promise<string>
}

interface ZKIInputData {
  oib: string
  datumRacuna: string
  oznakaProstoraId: string
  oznakaNaplatnogUredajaId: string
  brojRacuna: string
  iznosUkupno: string
}

interface FiscalProviderConfig {
  certSubject?: string
  certSerial?: string
  oibExtracted?: string
}

/**
 * Creates a fiscal signer from an IntegrationAccount.
 * This is the V2 path that enforces tenant isolation.
 *
 * @throws TenantViolationError if companyId doesn't match
 * @throws IntegrationNotFoundError if account not found
 * @throws IntegrationDisabledError if account not active
 */
export async function createSignerFromIntegrationAccount(
  integrationAccountId: string,
  companyId: string
): Promise<FiscalSignerV2> {
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

  if (account.kind !== 'FISCALIZATION_CIS') {
    throw new Error(`Invalid integration kind for fiscal signer: ${account.kind}`)
  }

  logger.info('fiscal_signer_created', {
    companyId,
    integrationAccountId,
    environment: account.environment
  })

  const secrets = parseFiscalizationSecrets(account.secrets)
  const { p12Buffer, password } = extractP12FromSecrets(secrets)
  const config = account.providerConfig as FiscalProviderConfig | null

  // Update lastUsedAt
  void touchIntegrationAccount(integrationAccountId)

  return {
    integrationAccountId,
    companyId,
    oib: config?.oibExtracted ?? '',
    certSubject: config?.certSubject ?? '',
    certSerial: config?.certSerial ?? '',

    async sign(xmlContent: string): Promise<string> {
      logger.debug('fiscal_sign_start', { integrationAccountId })
      const signed = await signXml(xmlContent, p12Buffer, password)
      logger.debug('fiscal_sign_complete', { integrationAccountId })
      return signed
    },

    async computeZKI(data: ZKIInputData): Promise<string> {
      logger.debug('fiscal_zki_start', { integrationAccountId })
      const zki = await computeZKI(data, p12Buffer, password)
      logger.debug('fiscal_zki_complete', { integrationAccountId })
      return zki
    }
  }
}

/**
 * Resolves IntegrationAccount for a company and creates signer.
 * Used when integrationAccountId is not yet known.
 */
export async function resolveSignerForCompany(
  companyId: string,
  environment: 'TEST' | 'PROD'
): Promise<FiscalSignerV2> {
  const { findIntegrationAccount } = await import('@/lib/integration/repository')

  const account = await findIntegrationAccount(companyId, 'FISCALIZATION_CIS', environment)

  if (!account) {
    throw new IntegrationNotFoundError(`FISCALIZATION_CIS/${environment} for company ${companyId}`)
  }

  return createSignerFromIntegrationAccount(account.id, companyId)
}

/**
 * Gets certificate info from IntegrationAccount.
 * Used for display/verification without signing.
 */
export async function getCertificateInfoFromAccount(
  integrationAccountId: string,
  companyId: string
): Promise<FiscalCertificateInfo> {
  const account = await findIntegrationAccountById(integrationAccountId)

  if (!account) {
    throw new IntegrationNotFoundError(integrationAccountId)
  }

  if (account.companyId !== companyId) {
    throw new TenantViolationError(companyId, account.companyId)
  }

  const config = account.providerConfig as FiscalProviderConfig | null

  return {
    subject: config?.certSubject ?? '',
    serialNumber: config?.certSerial ?? '',
    oib: config?.oibExtracted ?? '',
    status: account.status,
    environment: account.environment
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/fiscal/__tests__/signer-v2.test.ts`

Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/lib/fiscal/signer-v2.ts src/lib/fiscal/__tests__/signer-v2.test.ts
git commit -m "feat(fiscal): add V2 signer with IntegrationAccount"
```

---

## Task 4: Create Dual-Path Fiscalization Service

**Files:**
- Create: `src/lib/fiscal/fiscalize-invoice.ts`

**Step 1: Create fiscalization service with feature flag**

```typescript
import { db } from '@/lib/db'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { createSignerFromIntegrationAccount, resolveSignerForCompany } from './signer-v2'
import { getFiscalCertificateForCompany } from './certificate'
import { signXml, computeZKI } from './signing'
import { buildFiscalXml } from './xml-builder'
import { submitToCIS } from './cis-client'
import { logger } from '@/lib/logger'
import type { Invoice } from '@prisma/client'

interface FiscalizeInvoiceInput {
  invoice: Invoice
  companyId: string
}

interface FiscalizeInvoiceOutput {
  jir: string
  zki: string
  integrationAccountId?: string
  xmlContent: string
}

/**
 * Fiscalizes an invoice via CIS.
 * Uses IntegrationAccount if feature flag enabled, otherwise legacy FiscalCertificate path.
 */
export async function fiscalizeInvoice(input: FiscalizeInvoiceInput): Promise<FiscalizeInvoiceOutput> {
  const { invoice, companyId } = input

  const useNewPath = isFeatureEnabled('USE_INTEGRATION_ACCOUNT_FISCAL')

  logger.info('fiscalize_start', {
    companyId,
    invoiceId: invoice.id,
    useIntegrationAccount: useNewPath
  })

  if (useNewPath) {
    return fiscalizeViaIntegrationAccount(input)
  } else {
    return fiscalizeViaLegacy(input)
  }
}

async function fiscalizeViaIntegrationAccount(
  input: FiscalizeInvoiceInput
): Promise<FiscalizeInvoiceOutput> {
  const { invoice, companyId } = input

  // Determine environment (could be from invoice, company settings, or config)
  const environment = process.env.FISCAL_ENVIRONMENT === 'TEST' ? 'TEST' : 'PROD' as const

  // Resolve signer
  const signer = await resolveSignerForCompany(companyId, environment)

  // Build ZKI data
  const zkiData = {
    oib: signer.oib,
    datumRacuna: invoice.issueDate.toISOString().split('T')[0],
    oznakaProstoraId: invoice.businessPremiseId || '1',
    oznakaNaplatnogUredajaId: invoice.electronicDeviceId || '1',
    brojRacuna: invoice.invoiceNumber,
    iznosUkupno: invoice.totalAmount.toString()
  }

  // Compute ZKI
  const zki = await signer.computeZKI(zkiData)

  // Build XML
  const xmlContent = buildFiscalXml({
    ...invoice,
    zki,
    oib: signer.oib
  })

  // Sign XML
  const signedXml = await signer.sign(xmlContent)

  // Submit to CIS
  const jir = await submitToCIS(signedXml, environment)

  // Create FiscalRequest record
  await db.fiscalRequest.create({
    data: {
      companyId,
      invoiceId: invoice.id,
      integrationAccountId: signer.integrationAccountId,
      zki,
      jir,
      xmlContent: signedXml,
      status: 'SUCCESS',
      submittedAt: new Date()
    }
  })

  logger.info('fiscalize_complete', {
    companyId,
    invoiceId: invoice.id,
    integrationAccountId: signer.integrationAccountId,
    jir,
    zki
  })

  return {
    jir,
    zki,
    integrationAccountId: signer.integrationAccountId,
    xmlContent: signedXml
  }
}

async function fiscalizeViaLegacy(
  input: FiscalizeInvoiceInput
): Promise<FiscalizeInvoiceOutput> {
  const { invoice, companyId } = input

  // Get certificate from legacy table
  const cert = await getFiscalCertificateForCompany(companyId)

  if (!cert) {
    throw new Error(`No fiscal certificate found for company ${companyId}`)
  }

  // Decrypt P12 using envelope encryption
  const { p12Buffer, password } = await decryptFiscalCertificate(cert)

  // Build ZKI data
  const zkiData = {
    oib: cert.oibExtracted,
    datumRacuna: invoice.issueDate.toISOString().split('T')[0],
    oznakaProstoraId: invoice.businessPremiseId || '1',
    oznakaNaplatnogUredajaId: invoice.electronicDeviceId || '1',
    brojRacuna: invoice.invoiceNumber,
    iznosUkupno: invoice.totalAmount.toString()
  }

  // Compute ZKI
  const zki = await computeZKI(zkiData, p12Buffer, password)

  // Build XML
  const xmlContent = buildFiscalXml({
    ...invoice,
    zki,
    oib: cert.oibExtracted
  })

  // Sign XML
  const signedXml = await signXml(xmlContent, p12Buffer, password)

  // Submit to CIS
  const environment = cert.environment === 'TEST' ? 'TEST' : 'PROD'
  const jir = await submitToCIS(signedXml, environment)

  // Create FiscalRequest record
  await db.fiscalRequest.create({
    data: {
      companyId,
      invoiceId: invoice.id,
      fiscalCertificateId: cert.id,
      zki,
      jir,
      xmlContent: signedXml,
      status: 'SUCCESS',
      submittedAt: new Date()
    }
  })

  logger.info('fiscalize_complete_legacy', {
    companyId,
    invoiceId: invoice.id,
    certificateId: cert.id,
    jir,
    zki
  })

  return {
    jir,
    zki,
    xmlContent: signedXml
  }
}

async function decryptFiscalCertificate(cert: any): Promise<{ p12Buffer: Buffer; password: string }> {
  const { decryptWithEnvelope } = await import('./envelope-encryption')
  const json = decryptWithEnvelope(cert.encryptedP12, cert.encryptedDataKey)
  const { p12Base64, password } = JSON.parse(json)
  return {
    p12Buffer: Buffer.from(p12Base64, 'base64'),
    password
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/fiscal/fiscalize-invoice.ts
git commit -m "feat(fiscal): add dual-path fiscalization with feature flag"
```

---

## Task 5: Update Fiscalization Callers

**Files:**
- Search and update all places calling fiscalization

**Step 1: Find existing fiscalization callers**

Run: `grep -r "fiscalize\|submitToCIS\|computeZKI" src/ --include="*.ts"`

**Step 2: Update each caller to use the new fiscalizeInvoice function**

Replace direct calls with:

```typescript
import { fiscalizeInvoice } from '@/lib/fiscal/fiscalize-invoice'

const result = await fiscalizeInvoice({
  invoice,
  companyId: invoice.companyId
})

// result.jir, result.zki, result.integrationAccountId available
```

**Step 3: Commit**

```bash
git add src/
git commit -m "refactor(fiscal): use unified fiscalizeInvoice function"
```

---

## Task 6: Add Integration Tests for Fiscalization Flow

**Files:**
- Create: `src/lib/fiscal/__tests__/fiscalize-invoice.db.test.ts`

**Step 1: Write database integration test**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { db } from '@/lib/db'
import { createSignerFromIntegrationAccount } from '../signer-v2'
import { createIntegrationAccount } from '@/lib/integration/repository'

describe('Fiscalization V2 (DB Integration)', () => {
  let testCompanyId: string
  let testIntegrationAccountId: string

  // Use a real but test P12 for integration testing
  const testP12Base64 = process.env.TEST_FISCAL_P12_BASE64 || ''
  const testP12Password = process.env.TEST_FISCAL_P12_PASSWORD || ''

  beforeAll(async () => {
    if (!testP12Base64 || !testP12Password) {
      console.log('Skipping fiscal integration tests - no test P12 configured')
      return
    }

    // Create test company
    const company = await db.company.create({
      data: {
        name: 'Fiscal Test Co',
        oib: '12345678905',
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
      kind: 'FISCALIZATION_CIS',
      environment: 'TEST',
      secrets: {
        p12Base64: testP12Base64,
        p12Password: testP12Password
      },
      providerConfig: {
        certSubject: 'CN=Test Company',
        certSerial: '12345',
        oibExtracted: '12345678905'
      }
    })
    testIntegrationAccountId = account.id
  })

  afterAll(async () => {
    if (testCompanyId) {
      await db.fiscalRequest.deleteMany({ where: { companyId: testCompanyId } })
      await db.integrationAccount.deleteMany({ where: { companyId: testCompanyId } })
      await db.company.delete({ where: { id: testCompanyId } })
    }
    await db.$disconnect()
  })

  it('creates signer with correct OIB from IntegrationAccount', async () => {
    if (!testP12Base64) return

    const signer = await createSignerFromIntegrationAccount(
      testIntegrationAccountId,
      testCompanyId
    )

    expect(signer.oib).toBe('12345678905')
    expect(signer.integrationAccountId).toBe(testIntegrationAccountId)
  })

  it('enforces tenant isolation', async () => {
    if (!testP12Base64) return

    const otherCompany = await db.company.create({
      data: {
        name: 'Other Fiscal Co',
        oib: '98765432102',
        address: 'Other Address',
        city: 'Split',
        postalCode: '21000',
        country: 'HR'
      }
    })

    try {
      await expect(
        createSignerFromIntegrationAccount(testIntegrationAccountId, otherCompany.id)
      ).rejects.toThrow('Tenant violation')
    } finally {
      await db.company.delete({ where: { id: otherCompany.id } })
    }
  })
})
```

**Step 2: Run integration test**

Run: `npx vitest run src/lib/fiscal/__tests__/fiscalize-invoice.db.test.ts`

**Step 3: Commit**

```bash
git add src/lib/fiscal/__tests__/fiscalize-invoice.db.test.ts
git commit -m "test(fiscal): add fiscalization integration tests"
```

---

## Task 7: Add Index to FiscalRequest

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add index for common queries**

Add to FiscalRequest:
```prisma
  @@index([integrationAccountId], map: "fiscal_request_integration_account_idx")
```

**Step 2: Generate migration**

Run: `npx prisma migrate dev --name add_fiscal_request_integration_account_idx`

**Step 3: Commit**

```bash
git add prisma/
git commit -m "feat(schema): add index on FiscalRequest.integrationAccountId"
```

---

## Phase 4 Completion Checklist

- [ ] integrationAccountId column on FiscalRequest
- [ ] Fiscalization secrets parser with P12 extraction
- [ ] V2 fiscal signer with tenant assertions
- [ ] Dual-path fiscalization service
- [ ] All callers updated to use unified function
- [ ] Integration tests for fiscalization flow
- [ ] Structured logging with integrationAccountId
- [ ] All tests passing

---

## Testing the Feature Flag

**Enable new path:**
```bash
FF_INTEGRATION_ACCOUNT_FISCAL=true npx tsx scripts/fiscal-dry-run.ts <companyId>
```

**Check logs for:**
- `useIntegrationAccount: true`
- `integrationAccountId` in completion logs

**Verify ZKI computation matches:**
```bash
# Run with both paths and compare ZKI values
FF_INTEGRATION_ACCOUNT_FISCAL=false npx tsx scripts/fiscal-dry-run.ts <companyId>
FF_INTEGRATION_ACCOUNT_FISCAL=true npx tsx scripts/fiscal-dry-run.ts <companyId>
```

---

## Rollback Procedure

1. Set `FF_INTEGRATION_ACCOUNT_FISCAL=false`
2. Legacy FiscalCertificate path immediately active
3. No code changes needed
4. FiscalCertificate table remains source of truth

---

## Security Considerations

- P12 certificates now in unified vault with same encryption strength
- `INTEGRATION_VAULT_KEY` must have same security as `FISCAL_CERT_KEY`
- Key rotation supported via `secretKeyVersion` field
- Audit trail via `lastUsedAt` and structured logging

---

## Next Phase

Proceed to `2026-01-04-phase5-enforcement-cleanup.md`

---

End of Phase 4 Plan
