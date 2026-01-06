# Phase 1: IntegrationAccount Foundation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Introduce IntegrationAccount model and unified vault without changing existing behavior.

**Architecture:** Additive-only changes. New model, new encryption utilities, backfill script. All existing flows continue unchanged.

**Tech Stack:** Prisma 7, PostgreSQL, AES-256-GCM, TypeScript, Vitest

---

## Prerequisites

- [ ] `INTEGRATION_VAULT_KEY` environment variable set (32-byte hex = 64 characters)
- [ ] Feature flag infrastructure in place (or use simple env var)

---

## Key Rotation Contract

**Rule:** Key rotation is "write new version + keep old decrypt for N days"

1. When rotating `INTEGRATION_VAULT_KEY`:
   - Generate new key, set as `INTEGRATION_VAULT_KEY_V2`
   - New encryptions use V2, set `secretKeyVersion = 2`
   - Old decryptions still work (V1 key retained in `INTEGRATION_VAULT_KEY_V1`)
   - After 30 days, re-encrypt all V1 records to V2
   - After 60 days, remove V1 key

2. The `secretKeyVersion` field enables this:
   - Decryption reads version, selects appropriate key
   - No "re-encrypt everything now" migration required

---

## Environment Mapping Rules

**Source of truth for TEST vs PROD:**

| Source | Environment | Notes |
|--------|-------------|-------|
| `EPOSLOVANJE_API_BASE` contains `test.` | TEST | URL inspection |
| FiscalCertificate.environment | Use as-is | Already TEST/PROD |
| Company with no explicit env | PROD | Default assumption |

**Backfill must:**
- Parse provider base URL to determine environment
- Never create PROD account with TEST URL
- Log warning if URL pattern doesn't match expected environment

---

## Task 1: Create IntegrationAccount Schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add enums after existing enums (around line 3380)**

```prisma
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

**Step 2: Add IntegrationAccount model (after FiscalCertificate model)**

```prisma
/// Tenant-owned integration identity with encrypted secrets
/// All regulated actions MUST resolve through this model
model IntegrationAccount {
  id            String   @id @default(cuid())
  companyId     String
  company       Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)

  // Integration identity
  kind          IntegrationKind
  environment   IntegrationEnv   @default(PROD)
  status        IntegrationStatus @default(ACTIVE)

  // Provider configuration (non-sensitive JSON)
  providerConfig Json?

  // Encrypted secrets (unified vault)
  // Format: envelope-encrypted JSON payload
  secretEnvelope    String?
  secretKeyVersion  Int      @default(1)

  // Audit fields
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  rotatedAt     DateTime?
  lastUsedAt    DateTime?

  // Relations (to be populated in later phases)
  // eInvoices         EInvoice[]
  // fiscalRequests    FiscalRequest[]
  // providerSyncStates ProviderSyncState[]

  // Constraints
  @@unique([companyId, kind, environment], map: "integration_account_company_kind_env_key")
  @@index([companyId], map: "integration_account_company_idx")
  @@index([status], map: "integration_account_status_idx")
  @@map("integration_account")
}
```

**Step 3: Add relation to Company model (around line 183)**

Add to Company model:
```prisma
  integrationAccounts   IntegrationAccount[]
```

**Step 4: Generate migration**

Run: `npx prisma migrate dev --name add_integration_account`

Expected: Migration created successfully, no data changes

**Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add IntegrationAccount model for unified integration management"
```

---

## Task 2: Create Unified Vault Encryption Utility

**Files:**
- Create: `src/lib/integration/vault.ts`
- Create: `src/lib/integration/vault.test.ts`

**Step 1: Write the failing test**

Create `src/lib/integration/__tests__/vault.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { encryptSecretEnvelope, decryptSecretEnvelope, VaultError } from '../vault'

describe('Integration Vault', () => {
  const originalEnv = process.env.INTEGRATION_VAULT_KEY

  beforeEach(() => {
    // 32-byte key = 64 hex chars
    process.env.INTEGRATION_VAULT_KEY = 'a'.repeat(64)
  })

  afterEach(() => {
    process.env.INTEGRATION_VAULT_KEY = originalEnv
  })

  describe('encryptSecretEnvelope', () => {
    it('encrypts JSON payload and returns envelope with key version', () => {
      const secrets = { apiKey: 'test-api-key-12345' }

      const result = encryptSecretEnvelope(secrets)

      expect(result.envelope).toBeDefined()
      expect(result.envelope).not.toContain('test-api-key')
      expect(result.keyVersion).toBe(1)
    })

    it('produces different ciphertext for same input (random IV)', () => {
      const secrets = { apiKey: 'same-key' }

      const result1 = encryptSecretEnvelope(secrets)
      const result2 = encryptSecretEnvelope(secrets)

      expect(result1.envelope).not.toBe(result2.envelope)
    })

    it('throws VaultError if master key not configured', () => {
      delete process.env.INTEGRATION_VAULT_KEY

      expect(() => encryptSecretEnvelope({ apiKey: 'x' }))
        .toThrow(VaultError)
    })

    it('throws VaultError if master key is wrong length', () => {
      process.env.INTEGRATION_VAULT_KEY = 'tooshort'

      expect(() => encryptSecretEnvelope({ apiKey: 'x' }))
        .toThrow(VaultError)
    })
  })

  describe('decryptSecretEnvelope', () => {
    it('decrypts what was encrypted', () => {
      const original = { apiKey: 'secret-123', nested: { value: 42 } }
      const { envelope, keyVersion } = encryptSecretEnvelope(original)

      const decrypted = decryptSecretEnvelope(envelope, keyVersion)

      expect(decrypted).toEqual(original)
    })

    it('throws VaultError on tampered ciphertext', () => {
      const { envelope, keyVersion } = encryptSecretEnvelope({ apiKey: 'x' })
      const tampered = envelope.slice(0, -2) + 'ff'

      expect(() => decryptSecretEnvelope(tampered, keyVersion))
        .toThrow(VaultError)
    })

    it('throws VaultError on invalid format', () => {
      expect(() => decryptSecretEnvelope('not:valid:format:here', 1))
        .toThrow(VaultError)
    })
  })

  describe('key version handling', () => {
    it('includes version in encrypted result for future rotation', () => {
      const { keyVersion } = encryptSecretEnvelope({ apiKey: 'x' })

      expect(keyVersion).toBe(1)
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/integration/__tests__/vault.test.ts`

Expected: FAIL - module not found

**Step 3: Create directory and implementation**

Create `src/lib/integration/vault.ts`:

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16
const KEY_LENGTH = 32

export class VaultError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message)
    this.name = 'VaultError'
  }
}

function getMasterKey(): Buffer {
  const keyHex = process.env.INTEGRATION_VAULT_KEY

  if (!keyHex) {
    throw new VaultError(
      'INTEGRATION_VAULT_KEY environment variable not set',
      'VAULT_KEY_MISSING'
    )
  }

  if (keyHex.length !== KEY_LENGTH * 2) {
    throw new VaultError(
      `INTEGRATION_VAULT_KEY must be ${KEY_LENGTH * 2} hex characters (${KEY_LENGTH} bytes)`,
      'VAULT_KEY_INVALID_LENGTH'
    )
  }

  return Buffer.from(keyHex, 'hex')
}

export interface EncryptedEnvelope {
  envelope: string
  keyVersion: number
}

/**
 * Encrypts a secrets object using AES-256-GCM.
 * Format: iv:ciphertext:authTag (all hex-encoded)
 */
export function encryptSecretEnvelope<T extends Record<string, unknown>>(
  secrets: T
): EncryptedEnvelope {
  const masterKey = getMasterKey()
  const iv = randomBytes(IV_LENGTH)
  const plaintext = JSON.stringify(secrets)

  const cipher = createCipheriv(ALGORITHM, masterKey, iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ])
  const authTag = cipher.getAuthTag()

  const envelope = [
    iv.toString('hex'),
    encrypted.toString('hex'),
    authTag.toString('hex')
  ].join(':')

  return {
    envelope,
    keyVersion: 1 // Future: support key rotation
  }
}

/**
 * Decrypts a secrets envelope.
 * @throws VaultError on decryption failure
 */
export function decryptSecretEnvelope<T = Record<string, unknown>>(
  envelope: string,
  keyVersion: number
): T {
  // Future: support multiple key versions for rotation
  if (keyVersion !== 1) {
    throw new VaultError(
      `Unsupported key version: ${keyVersion}`,
      'VAULT_UNSUPPORTED_KEY_VERSION'
    )
  }

  const masterKey = getMasterKey()
  const parts = envelope.split(':')

  if (parts.length !== 3) {
    throw new VaultError(
      'Invalid envelope format: expected iv:ciphertext:authTag',
      'VAULT_INVALID_FORMAT'
    )
  }

  const [ivHex, encryptedHex, authTagHex] = parts

  try {
    const iv = Buffer.from(ivHex, 'hex')
    const encrypted = Buffer.from(encryptedHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')

    if (iv.length !== IV_LENGTH) {
      throw new VaultError('Invalid IV length', 'VAULT_INVALID_IV')
    }

    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new VaultError('Invalid auth tag length', 'VAULT_INVALID_AUTH_TAG')
    }

    const decipher = createDecipheriv(ALGORITHM, masterKey, iv)
    decipher.setAuthTag(authTag)

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ])

    return JSON.parse(decrypted.toString('utf8')) as T
  } catch (error) {
    if (error instanceof VaultError) {
      throw error
    }
    throw new VaultError(
      'Decryption failed: invalid ciphertext or key',
      'VAULT_DECRYPTION_FAILED'
    )
  }
}

/**
 * Type guard to check if envelope is present
 */
export function hasSecretEnvelope(
  account: { secretEnvelope: string | null; secretKeyVersion: number }
): account is { secretEnvelope: string; secretKeyVersion: number } {
  return account.secretEnvelope !== null
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/integration/__tests__/vault.test.ts`

Expected: All tests PASS

**Step 5: Add index file**

Create `src/lib/integration/index.ts`:

```typescript
export {
  encryptSecretEnvelope,
  decryptSecretEnvelope,
  hasSecretEnvelope,
  VaultError,
  type EncryptedEnvelope
} from './vault'
```

**Step 6: Commit**

```bash
git add src/lib/integration/
git commit -m "feat(vault): add unified integration vault encryption"
```

---

## Task 3: Create IntegrationAccount Types and Secrets Schemas

**Files:**
- Create: `src/lib/integration/types.ts`
- Create: `src/lib/integration/types.test.ts`

**Step 1: Write the failing test**

Create `src/lib/integration/__tests__/types.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  parseEInvoiceSecrets,
  parseFiscalizationSecrets,
  validateIntegrationKind,
  IntegrationSecretsError
} from '../types'

describe('Integration Types', () => {
  describe('parseEInvoiceSecrets', () => {
    it('parses valid e-invoice secrets', () => {
      const input = { apiKey: 'test-key-123' }
      const result = parseEInvoiceSecrets(input)
      expect(result).toEqual({ apiKey: 'test-key-123' })
    })

    it('throws on missing apiKey', () => {
      expect(() => parseEInvoiceSecrets({}))
        .toThrow(IntegrationSecretsError)
    })

    it('throws on empty apiKey', () => {
      expect(() => parseEInvoiceSecrets({ apiKey: '' }))
        .toThrow(IntegrationSecretsError)
    })
  })

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
  })

  describe('validateIntegrationKind', () => {
    it('returns true for valid e-invoice kinds', () => {
      expect(validateIntegrationKind('EINVOICE_EPOSLOVANJE')).toBe(true)
      expect(validateIntegrationKind('EINVOICE_FINA')).toBe(true)
      expect(validateIntegrationKind('EINVOICE_IE_RACUNI')).toBe(true)
    })

    it('returns true for fiscalization kind', () => {
      expect(validateIntegrationKind('FISCALIZATION_CIS')).toBe(true)
    })

    it('returns false for invalid kind', () => {
      expect(validateIntegrationKind('INVALID')).toBe(false)
      expect(validateIntegrationKind('')).toBe(false)
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/integration/__tests__/types.test.ts`

Expected: FAIL - module not found

**Step 3: Create implementation**

Create `src/lib/integration/types.ts`:

```typescript
import { z } from 'zod'

// Re-export Prisma enums for convenience
export type { IntegrationKind, IntegrationEnv, IntegrationStatus } from '@prisma/client'

export class IntegrationSecretsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IntegrationSecretsError'
  }
}

// E-Invoice secrets schema
const eInvoiceSecretsSchema = z.object({
  apiKey: z.string().min(1, 'apiKey is required')
})

export type EInvoiceSecrets = z.infer<typeof eInvoiceSecretsSchema>

export function parseEInvoiceSecrets(input: unknown): EInvoiceSecrets {
  const result = eInvoiceSecretsSchema.safeParse(input)
  if (!result.success) {
    throw new IntegrationSecretsError(
      `Invalid e-invoice secrets: ${result.error.message}`
    )
  }
  return result.data
}

// Fiscalization secrets schema
const fiscalizationSecretsSchema = z.object({
  p12Base64: z.string().min(1, 'p12Base64 is required'),
  p12Password: z.string().min(1, 'p12Password is required')
})

export type FiscalizationSecrets = z.infer<typeof fiscalizationSecretsSchema>

export function parseFiscalizationSecrets(input: unknown): FiscalizationSecrets {
  const result = fiscalizationSecretsSchema.safeParse(input)
  if (!result.success) {
    throw new IntegrationSecretsError(
      `Invalid fiscalization secrets: ${result.error.message}`
    )
  }
  return result.data
}

// Provider config schemas (non-sensitive)
export interface EInvoiceProviderConfig {
  baseUrl?: string
  timeout?: number
  softwareId?: string
}

export interface FiscalizationProviderConfig {
  endpoint?: string
  timeout?: number
}

// Valid integration kinds
const VALID_KINDS = [
  'EINVOICE_EPOSLOVANJE',
  'EINVOICE_FINA',
  'EINVOICE_IE_RACUNI',
  'FISCALIZATION_CIS'
] as const

export function validateIntegrationKind(kind: string): kind is typeof VALID_KINDS[number] {
  return VALID_KINDS.includes(kind as typeof VALID_KINDS[number])
}

export function isEInvoiceKind(kind: string): boolean {
  return kind.startsWith('EINVOICE_')
}

export function isFiscalizationKind(kind: string): boolean {
  return kind.startsWith('FISCALIZATION_')
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/integration/__tests__/types.test.ts`

Expected: All tests PASS

**Step 5: Update index file**

Update `src/lib/integration/index.ts`:

```typescript
export {
  encryptSecretEnvelope,
  decryptSecretEnvelope,
  hasSecretEnvelope,
  VaultError,
  type EncryptedEnvelope
} from './vault'

export {
  parseEInvoiceSecrets,
  parseFiscalizationSecrets,
  validateIntegrationKind,
  isEInvoiceKind,
  isFiscalizationKind,
  IntegrationSecretsError,
  type EInvoiceSecrets,
  type FiscalizationSecrets,
  type EInvoiceProviderConfig,
  type FiscalizationProviderConfig,
  type IntegrationKind,
  type IntegrationEnv,
  type IntegrationStatus
} from './types'
```

**Step 6: Commit**

```bash
git add src/lib/integration/
git commit -m "feat(integration): add secrets type schemas with validation"
```

---

## Task 4: Create IntegrationAccount Repository

**Files:**
- Create: `src/lib/integration/repository.ts`
- Create: `src/lib/integration/__tests__/repository.test.ts`

**Step 1: Write the failing test**

Create `src/lib/integration/__tests__/repository.db.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { db } from '@/lib/db'
import {
  createIntegrationAccount,
  findIntegrationAccount,
  updateIntegrationAccountSecrets,
  disableIntegrationAccount
} from '../repository'

describe('IntegrationAccount Repository', () => {
  let testCompanyId: string

  beforeAll(async () => {
    // Create test company
    const company = await db.company.create({
      data: {
        name: 'Integration Test Co',
        oib: '12345678903',
        address: 'Test Address',
        city: 'Zagreb',
        postalCode: '10000',
        country: 'HR'
      }
    })
    testCompanyId = company.id
  })

  afterAll(async () => {
    // Cleanup
    await db.integrationAccount.deleteMany({ where: { companyId: testCompanyId } })
    await db.company.delete({ where: { id: testCompanyId } })
    await db.$disconnect()
  })

  beforeEach(async () => {
    // Clean integration accounts before each test
    await db.integrationAccount.deleteMany({ where: { companyId: testCompanyId } })
  })

  describe('createIntegrationAccount', () => {
    it('creates account with encrypted secrets', async () => {
      const account = await createIntegrationAccount({
        companyId: testCompanyId,
        kind: 'EINVOICE_EPOSLOVANJE',
        environment: 'TEST',
        secrets: { apiKey: 'test-key-123' },
        providerConfig: { baseUrl: 'https://test.example.com' }
      })

      expect(account.id).toBeDefined()
      expect(account.companyId).toBe(testCompanyId)
      expect(account.kind).toBe('EINVOICE_EPOSLOVANJE')
      expect(account.status).toBe('ACTIVE')
      expect(account.secretEnvelope).toBeDefined()
      expect(account.secretEnvelope).not.toContain('test-key-123')
    })

    it('enforces unique constraint on (companyId, kind, environment)', async () => {
      await createIntegrationAccount({
        companyId: testCompanyId,
        kind: 'EINVOICE_EPOSLOVANJE',
        environment: 'TEST',
        secrets: { apiKey: 'key1' }
      })

      await expect(
        createIntegrationAccount({
          companyId: testCompanyId,
          kind: 'EINVOICE_EPOSLOVANJE',
          environment: 'TEST',
          secrets: { apiKey: 'key2' }
        })
      ).rejects.toThrow()
    })
  })

  describe('findIntegrationAccount', () => {
    it('returns null for non-existent account', async () => {
      const account = await findIntegrationAccount(
        testCompanyId,
        'EINVOICE_EPOSLOVANJE',
        'PROD'
      )
      expect(account).toBeNull()
    })

    it('returns account with decrypted secrets', async () => {
      await createIntegrationAccount({
        companyId: testCompanyId,
        kind: 'EINVOICE_FINA',
        environment: 'PROD',
        secrets: { apiKey: 'my-secret-key' }
      })

      const account = await findIntegrationAccount(
        testCompanyId,
        'EINVOICE_FINA',
        'PROD'
      )

      expect(account).not.toBeNull()
      expect(account!.secrets).toEqual({ apiKey: 'my-secret-key' })
    })

    it('returns null for disabled account', async () => {
      const created = await createIntegrationAccount({
        companyId: testCompanyId,
        kind: 'EINVOICE_EPOSLOVANJE',
        environment: 'TEST',
        secrets: { apiKey: 'x' }
      })

      await disableIntegrationAccount(created.id)

      const found = await findIntegrationAccount(
        testCompanyId,
        'EINVOICE_EPOSLOVANJE',
        'TEST'
      )
      expect(found).toBeNull()
    })
  })

  describe('updateIntegrationAccountSecrets', () => {
    it('rotates secrets and updates rotatedAt', async () => {
      const account = await createIntegrationAccount({
        companyId: testCompanyId,
        kind: 'EINVOICE_EPOSLOVANJE',
        environment: 'TEST',
        secrets: { apiKey: 'old-key' }
      })

      const originalEnvelope = account.secretEnvelope

      const updated = await updateIntegrationAccountSecrets(
        account.id,
        { apiKey: 'new-key' }
      )

      expect(updated.secretEnvelope).not.toBe(originalEnvelope)
      expect(updated.rotatedAt).not.toBeNull()
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/integration/__tests__/repository.db.test.ts`

Expected: FAIL - module not found

**Step 3: Create implementation**

Create `src/lib/integration/repository.ts`:

```typescript
import { db } from '@/lib/db'
import { IntegrationKind, IntegrationEnv, IntegrationStatus, Prisma } from '@prisma/client'
import { encryptSecretEnvelope, decryptSecretEnvelope, hasSecretEnvelope } from './vault'
import type { EInvoiceSecrets, FiscalizationSecrets } from './types'

export interface CreateIntegrationAccountInput {
  companyId: string
  kind: IntegrationKind
  environment: IntegrationEnv
  secrets: EInvoiceSecrets | FiscalizationSecrets
  providerConfig?: Prisma.JsonValue
}

export interface IntegrationAccountWithSecrets {
  id: string
  companyId: string
  kind: IntegrationKind
  environment: IntegrationEnv
  status: IntegrationStatus
  providerConfig: Prisma.JsonValue | null
  secrets: EInvoiceSecrets | FiscalizationSecrets
  createdAt: Date
  updatedAt: Date
  rotatedAt: Date | null
  lastUsedAt: Date | null
}

/**
 * Creates a new IntegrationAccount with encrypted secrets.
 */
export async function createIntegrationAccount(
  input: CreateIntegrationAccountInput
): Promise<{ id: string; secretEnvelope: string } & Omit<CreateIntegrationAccountInput, 'secrets'>> {
  const { envelope, keyVersion } = encryptSecretEnvelope(input.secrets)

  const account = await db.integrationAccount.create({
    data: {
      companyId: input.companyId,
      kind: input.kind,
      environment: input.environment,
      status: 'ACTIVE',
      providerConfig: input.providerConfig ?? Prisma.JsonNull,
      secretEnvelope: envelope,
      secretKeyVersion: keyVersion
    }
  })

  return {
    id: account.id,
    companyId: account.companyId,
    kind: account.kind,
    environment: account.environment,
    providerConfig: account.providerConfig,
    secretEnvelope: account.secretEnvelope!
  }
}

/**
 * Finds an active IntegrationAccount and decrypts its secrets.
 * Returns null if not found or not active.
 */
export async function findIntegrationAccount(
  companyId: string,
  kind: IntegrationKind,
  environment: IntegrationEnv
): Promise<IntegrationAccountWithSecrets | null> {
  const account = await db.integrationAccount.findUnique({
    where: {
      companyId_kind_environment: { companyId, kind, environment }
    }
  })

  if (!account || account.status !== 'ACTIVE') {
    return null
  }

  if (!hasSecretEnvelope(account)) {
    return null
  }

  const secrets = decryptSecretEnvelope<EInvoiceSecrets | FiscalizationSecrets>(
    account.secretEnvelope,
    account.secretKeyVersion
  )

  return {
    id: account.id,
    companyId: account.companyId,
    kind: account.kind,
    environment: account.environment,
    status: account.status,
    providerConfig: account.providerConfig,
    secrets,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    rotatedAt: account.rotatedAt,
    lastUsedAt: account.lastUsedAt
  }
}

/**
 * Finds IntegrationAccount by ID (for use when ID is already known).
 */
export async function findIntegrationAccountById(
  id: string
): Promise<IntegrationAccountWithSecrets | null> {
  const account = await db.integrationAccount.findUnique({
    where: { id }
  })

  if (!account || !hasSecretEnvelope(account)) {
    return null
  }

  const secrets = decryptSecretEnvelope<EInvoiceSecrets | FiscalizationSecrets>(
    account.secretEnvelope,
    account.secretKeyVersion
  )

  return {
    id: account.id,
    companyId: account.companyId,
    kind: account.kind,
    environment: account.environment,
    status: account.status,
    providerConfig: account.providerConfig,
    secrets,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    rotatedAt: account.rotatedAt,
    lastUsedAt: account.lastUsedAt
  }
}

/**
 * Updates secrets (key rotation).
 */
export async function updateIntegrationAccountSecrets(
  id: string,
  secrets: EInvoiceSecrets | FiscalizationSecrets
): Promise<{ id: string; secretEnvelope: string; rotatedAt: Date }> {
  const { envelope, keyVersion } = encryptSecretEnvelope(secrets)

  const account = await db.integrationAccount.update({
    where: { id },
    data: {
      secretEnvelope: envelope,
      secretKeyVersion: keyVersion,
      rotatedAt: new Date()
    }
  })

  return {
    id: account.id,
    secretEnvelope: account.secretEnvelope!,
    rotatedAt: account.rotatedAt!
  }
}

/**
 * Disables an IntegrationAccount.
 */
export async function disableIntegrationAccount(id: string): Promise<void> {
  await db.integrationAccount.update({
    where: { id },
    data: { status: 'DISABLED' }
  })
}

/**
 * Updates lastUsedAt timestamp.
 */
export async function touchIntegrationAccount(id: string): Promise<void> {
  await db.integrationAccount.update({
    where: { id },
    data: { lastUsedAt: new Date() }
  })
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/integration/__tests__/repository.db.test.ts`

Expected: All tests PASS

**Step 5: Update index file**

Update `src/lib/integration/index.ts` to include repository exports.

**Step 6: Commit**

```bash
git add src/lib/integration/
git commit -m "feat(integration): add IntegrationAccount repository with encryption"
```

---

## Task 5: Create Backfill Script

**Files:**
- Create: `scripts/backfill-integration-accounts.ts`

**Step 1: Create the backfill script**

```typescript
#!/usr/bin/env npx tsx
/**
 * Backfill IntegrationAccounts from existing Company and FiscalCertificate data.
 *
 * This script:
 * 1. Creates EINVOICE_* accounts from Company.eInvoiceProvider + eInvoiceApiKeyEncrypted
 * 2. Creates FISCALIZATION_CIS accounts from FiscalCertificate records
 *
 * Safe to run multiple times (uses upsert pattern).
 *
 * Usage:
 *   npx tsx scripts/backfill-integration-accounts.ts [--dry-run]
 */

import { db } from '../src/lib/db'
import { decryptSecret } from '../src/lib/secrets'
import { decryptWithEnvelope } from '../src/lib/fiscal/envelope-encryption'
import { encryptSecretEnvelope } from '../src/lib/integration/vault'
import { IntegrationKind, IntegrationEnv } from '@prisma/client'

const isDryRun = process.argv.includes('--dry-run')

interface BackfillStats {
  companiesProcessed: number
  eInvoiceAccountsCreated: number
  eInvoiceAccountsSkipped: number
  fiscalAccountsCreated: number
  fiscalAccountsSkipped: number
  errors: string[]
}

async function backfillEInvoiceAccounts(stats: BackfillStats): Promise<void> {
  console.log('\n=== Backfilling E-Invoice Accounts ===')

  const companies = await db.company.findMany({
    where: {
      eInvoiceProvider: { not: null },
      eInvoiceApiKeyEncrypted: { not: null }
    },
    select: {
      id: true,
      name: true,
      eInvoiceProvider: true,
      eInvoiceApiKeyEncrypted: true
    }
  })

  console.log(`Found ${companies.length} companies with e-invoice configuration`)

  for (const company of companies) {
    stats.companiesProcessed++

    try {
      // Map provider name to IntegrationKind
      const kind = mapProviderToKind(company.eInvoiceProvider!)
      if (!kind) {
        console.log(`  [SKIP] ${company.name}: Unknown provider ${company.eInvoiceProvider}`)
        stats.eInvoiceAccountsSkipped++
        continue
      }

      // Check if account already exists
      const existing = await db.integrationAccount.findUnique({
        where: {
          companyId_kind_environment: {
            companyId: company.id,
            kind,
            environment: 'PROD'
          }
        }
      })

      if (existing) {
        console.log(`  [SKIP] ${company.name}: Account already exists`)
        stats.eInvoiceAccountsSkipped++
        continue
      }

      // Decrypt existing key and re-encrypt with vault
      const apiKey = decryptSecret(company.eInvoiceApiKeyEncrypted!)
      const { envelope, keyVersion } = encryptSecretEnvelope({ apiKey })

      if (isDryRun) {
        console.log(`  [DRY-RUN] Would create ${kind} account for ${company.name}`)
        stats.eInvoiceAccountsCreated++
        continue
      }

      await db.integrationAccount.create({
        data: {
          companyId: company.id,
          kind,
          environment: 'PROD',
          status: 'ACTIVE',
          secretEnvelope: envelope,
          secretKeyVersion: keyVersion,
          providerConfig: {
            migratedFrom: 'Company.eInvoiceApiKeyEncrypted',
            migratedAt: new Date().toISOString()
          }
        }
      })

      console.log(`  [OK] Created ${kind} account for ${company.name}`)
      stats.eInvoiceAccountsCreated++

    } catch (error) {
      const msg = `Error processing ${company.name}: ${error instanceof Error ? error.message : error}`
      console.error(`  [ERROR] ${msg}`)
      stats.errors.push(msg)
    }
  }
}

async function backfillFiscalAccounts(stats: BackfillStats): Promise<void> {
  console.log('\n=== Backfilling Fiscalization Accounts ===')

  const certificates = await db.fiscalCertificate.findMany({
    where: {
      status: 'ACTIVE'
    },
    include: {
      company: { select: { id: true, name: true } }
    }
  })

  console.log(`Found ${certificates.length} active fiscal certificates`)

  for (const cert of certificates) {
    try {
      const environment: IntegrationEnv = cert.environment === 'TEST' ? 'TEST' : 'PROD'

      // Check if account already exists
      const existing = await db.integrationAccount.findUnique({
        where: {
          companyId_kind_environment: {
            companyId: cert.companyId,
            kind: 'FISCALIZATION_CIS',
            environment
          }
        }
      })

      if (existing) {
        console.log(`  [SKIP] ${cert.company.name} (${environment}): Account already exists`)
        stats.fiscalAccountsSkipped++
        continue
      }

      // Decrypt existing P12 and re-encrypt with vault
      const p12Json = decryptWithEnvelope(cert.encryptedP12, cert.encryptedDataKey)
      const { p12Base64, password: p12Password } = JSON.parse(p12Json)

      const { envelope, keyVersion } = encryptSecretEnvelope({
        p12Base64,
        p12Password
      })

      if (isDryRun) {
        console.log(`  [DRY-RUN] Would create FISCALIZATION_CIS (${environment}) for ${cert.company.name}`)
        stats.fiscalAccountsCreated++
        continue
      }

      await db.integrationAccount.create({
        data: {
          companyId: cert.companyId,
          kind: 'FISCALIZATION_CIS',
          environment,
          status: 'ACTIVE',
          secretEnvelope: envelope,
          secretKeyVersion: keyVersion,
          providerConfig: {
            certSubject: cert.certSubject,
            certSerial: cert.certSerial,
            certNotBefore: cert.certNotBefore.toISOString(),
            certNotAfter: cert.certNotAfter.toISOString(),
            oibExtracted: cert.oibExtracted,
            migratedFrom: `FiscalCertificate.${cert.id}`,
            migratedAt: new Date().toISOString()
          }
        }
      })

      console.log(`  [OK] Created FISCALIZATION_CIS (${environment}) for ${cert.company.name}`)
      stats.fiscalAccountsCreated++

    } catch (error) {
      const msg = `Error processing cert ${cert.id}: ${error instanceof Error ? error.message : error}`
      console.error(`  [ERROR] ${msg}`)
      stats.errors.push(msg)
    }
  }
}

function mapProviderToKind(provider: string): IntegrationKind | null {
  const mapping: Record<string, IntegrationKind> = {
    'eposlovanje': 'EINVOICE_EPOSLOVANJE',
    'fina': 'EINVOICE_FINA',
    'ie-racuni': 'EINVOICE_IE_RACUNI'
  }
  return mapping[provider.toLowerCase()] ?? null
}

async function main() {
  console.log('=== IntegrationAccount Backfill ===')
  console.log(`Mode: ${isDryRun ? 'DRY-RUN' : 'LIVE'}`)
  console.log(`Timestamp: ${new Date().toISOString()}`)

  const stats: BackfillStats = {
    companiesProcessed: 0,
    eInvoiceAccountsCreated: 0,
    eInvoiceAccountsSkipped: 0,
    fiscalAccountsCreated: 0,
    fiscalAccountsSkipped: 0,
    errors: []
  }

  await backfillEInvoiceAccounts(stats)
  await backfillFiscalAccounts(stats)

  console.log('\n=== Summary ===')
  console.log(`Companies processed: ${stats.companiesProcessed}`)
  console.log(`E-Invoice accounts created: ${stats.eInvoiceAccountsCreated}`)
  console.log(`E-Invoice accounts skipped: ${stats.eInvoiceAccountsSkipped}`)
  console.log(`Fiscal accounts created: ${stats.fiscalAccountsCreated}`)
  console.log(`Fiscal accounts skipped: ${stats.fiscalAccountsSkipped}`)
  console.log(`Errors: ${stats.errors.length}`)

  if (stats.errors.length > 0) {
    console.log('\nErrors:')
    stats.errors.forEach(e => console.log(`  - ${e}`))
  }

  await db.$disconnect()
}

main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})

export {}
```

**Step 2: Test the script in dry-run mode**

Run: `npx tsx scripts/backfill-integration-accounts.ts --dry-run`

Expected: Script runs without errors, shows what would be created

**Step 3: Commit**

```bash
git add scripts/backfill-integration-accounts.ts
git commit -m "feat(backfill): add IntegrationAccount migration script"
```

---

## Task 6: Add Environment Variable Documentation

**Files:**
- Modify: `CLAUDE.md` or `.env.example`

**Step 1: Add documentation for new env var**

Add to environment documentation:

```markdown
## Integration Vault

- `INTEGRATION_VAULT_KEY` - Master encryption key for IntegrationAccount secrets (32-byte hex = 64 characters)

Generate with: `openssl rand -hex 32`
```

**Step 2: Commit**

```bash
git add CLAUDE.md  # or .env.example
git commit -m "docs: add INTEGRATION_VAULT_KEY environment variable documentation"
```

---

## Phase 1 Completion Checklist

- [ ] IntegrationAccount model in schema
- [ ] Migration applied successfully
- [ ] Vault encryption utility with tests
- [ ] Types and validation schemas with tests
- [ ] Repository with CRUD operations
- [ ] Backfill script (tested in dry-run)
- [ ] Environment variable documented
- [ ] All tests passing
- [ ] No behavior changes to existing flows

---

## Backfill Acceptance Criteria (Early Validation)

**Run these checks immediately after backfill:**

```bash
# Check 1: All e-invoice companies have IntegrationAccount
npx tsx -e "
const { db } = require('./src/lib/db');
(async () => {
  const companies = await db.company.findMany({
    where: { eInvoiceProvider: { not: null }, eInvoiceApiKeyEncrypted: { not: null } }
  });
  for (const c of companies) {
    const account = await db.integrationAccount.findFirst({
      where: { companyId: c.id, kind: { startsWith: 'EINVOICE_' } }
    });
    if (!account) console.log('MISSING:', c.name, c.id);
  }
  console.log('Checked', companies.length, 'companies');
  await db.\$disconnect();
})();
"

# Check 2: All ACTIVE fiscal certificates have IntegrationAccount
npx tsx -e "
const { db } = require('./src/lib/db');
(async () => {
  const certs = await db.fiscalCertificate.findMany({
    where: { status: 'ACTIVE' },
    include: { company: true }
  });
  for (const c of certs) {
    const account = await db.integrationAccount.findFirst({
      where: { companyId: c.companyId, kind: 'FISCALIZATION_CIS' }
    });
    if (!account) console.log('MISSING FISCAL:', c.company.name, c.companyId);
  }
  console.log('Checked', certs.length, 'certificates');
  await db.\$disconnect();
})();
"
```

**Expected output:** No "MISSING" lines. If any appear, backfill has gaps.

**Add as invariant test (run in CI):**

```typescript
// src/lib/integration/__tests__/backfill-invariants.db.test.ts
describe('Backfill Invariants', () => {
  it('all e-invoice companies have IntegrationAccount', async () => {
    const companies = await db.company.findMany({
      where: { eInvoiceProvider: { not: null }, eInvoiceApiKeyEncrypted: { not: null } }
    });
    for (const c of companies) {
      const account = await db.integrationAccount.findFirst({
        where: { companyId: c.id, kind: { startsWith: 'EINVOICE_' } }
      });
      expect(account, `${c.name} missing e-invoice account`).not.toBeNull();
    }
  });

  it('all ACTIVE fiscal certs have IntegrationAccount', async () => {
    const certs = await db.fiscalCertificate.findMany({ where: { status: 'ACTIVE' } });
    for (const c of certs) {
      const account = await db.integrationAccount.findFirst({
        where: { companyId: c.companyId, kind: 'FISCALIZATION_CIS' }
      });
      expect(account, `Cert ${c.id} missing fiscal account`).not.toBeNull();
    }
  });
});
```

---

## Rollback Procedure

If issues arise:

1. **Schema rollback:** `npx prisma migrate rollback` (or manual SQL to drop table)
2. **Code rollback:** `git revert` the commits
3. **No data impact:** Phase 1 is additive only

---

## Next Phase

Proceed to `2026-01-04-phase2-einvoice-outbound-migration.md`

---

End of Phase 1 Plan
