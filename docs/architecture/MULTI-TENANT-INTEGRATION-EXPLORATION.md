# Multi-Tenant Integration Architecture Exploration

**Date:** 2026-01-04
**Purpose:** Factual inputs for multi-tenant integration design
**Scope:** B2B e-invoice intermediaries, Fiskalizacija, secrets, workers, isolation

---

## 1. Executive Factual Summary

FiskAI currently operates with:

- **Single e-invoice provider per company** stored in `Company.eInvoiceProvider` field
- **One fiscal certificate per company per environment** enforced by unique constraint
- **Two-layer envelope encryption** for fiscal certificates using master key from environment
- **Single-layer AES-256-GCM** for e-invoice API keys
- **Tenant-isolated e-invoice worker** via required `COMPANY_ID` environment variable
- **Global-scope RTL workers** (intentional - regulatory data is platform-wide)
- **Cursor-based polling** with `ProviderSyncState` table tracking `lastSuccessfulPollAt`
- **Idempotency** via unique constraint on `(companyId, providerRef)`

Current limitations:

- Cannot have multiple e-invoice intermediaries per company
- Hard-coded provider switch statements in 2 locations
- Two-environment-only enum (TEST/PROD)
- No key rotation workflow in UI
- WebhookSubscription is global (not tenant-scoped)

---

## 2. Current-State Architecture Map

### 2.1 Database Schema (Prisma)

```
prisma/schema.prisma
```

**Core tenant-scoped models:**

| Model             | companyId FK | Unique Constraint                                                          |
| ----------------- | ------------ | -------------------------------------------------------------------------- |
| FiscalCertificate | ✅           | `@@unique([companyId, environment])`                                       |
| EInvoice          | ✅           | Partial unique on `(companyId, providerRef)` WHERE providerRef IS NOT NULL |
| ProviderSyncState | ✅           | `@@unique([companyId, provider, direction])`                               |
| Contact           | ✅           | None (allows duplicates)                                                   |
| AuditLog          | ✅           | None                                                                       |
| FiscalRequest     | ✅           | None                                                                       |

**Global models (NOT tenant-scoped):**

| Model               | Issue                                               |
| ------------------- | --------------------------------------------------- |
| WebhookSubscription | No companyId - secrets stored globally              |
| Account (OAuth)     | `@@unique([provider, providerAccountId])` is global |

### 2.2 Company Model E-Invoice Fields

```prisma
// prisma/schema.prisma - Company model
eInvoiceProvider         String?  // Single provider only: "eposlovanje", "ie-racuni", "fina"
eInvoiceApiKeyEncrypted  String?  // AES-256-GCM encrypted
```

### 2.3 FiscalCertificate Model

```prisma
// prisma/schema.prisma lines 2222-2247
model FiscalCertificate {
  id                String            @id @default(cuid())
  companyId         String
  environment       FiscalEnvironment @default(PROD)
  encryptedP12      Bytes             // Envelope-encrypted PKCS#12
  encryptedDataKey  Bytes             // AES-wrapped data key
  certificatePin    String            // Certificate PIN (plaintext)
  oib               String
  serialNumber      String
  validFrom         DateTime
  validTo           DateTime
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@unique([companyId, environment])  // ONE cert per environment per company
  @@index([companyId])
}
```

### 2.4 ProviderSyncState Model

```prisma
// prisma/schema.prisma lines 5471-5485
model ProviderSyncState {
  id                   String            @id @default(cuid())
  companyId            String
  provider             String            // "eposlovanje", "moj-eracun"
  direction            EInvoiceDirection
  lastSuccessfulPollAt DateTime
  createdAt            DateTime          @default(now())
  updatedAt            DateTime          @updatedAt

  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@unique([companyId, provider, direction])
  @@index([companyId])
  @@index([provider, direction])
}
```

---

## 3. Data Model Risks

### 3.1 Single Provider Limitation

**File:** `prisma/schema.prisma` - Company model

```prisma
eInvoiceProvider String?  // Only ONE provider per company
```

**Impact:** Cannot support multiple intermediaries per tenant.

### 3.2 WebhookSubscription Global Scope

**File:** `prisma/schema.prisma`

```prisma
model WebhookSubscription {
  id         String   @id @default(cuid())
  name       String
  url        String
  secretKey  String?  // Stored unencrypted
  authToken  String?  // Stored unencrypted
  events     String[]
  // NO companyId field
}
```

**Impact:** Webhook secrets are platform-wide, not tenant-isolated.

### 3.3 Account OAuth Global Uniqueness

**File:** `prisma/schema.prisma`

```prisma
model Account {
  @@unique([provider, providerAccountId])  // Global, not per-tenant
}
```

**Impact:** Same OAuth account cannot link to multiple tenants.

### 3.4 Two-Environment Enum

**File:** `prisma/schema.prisma`

```prisma
enum FiscalEnvironment {
  TEST
  PROD
}
```

**Impact:** No staging, UAT, or custom environments possible.

---

## 4. Secret & Config Sourcing Map

### 4.1 Environment Variables (Plaintext Master Keys)

| Variable             | Purpose                        | Format            | Location      |
| -------------------- | ------------------------------ | ----------------- | ------------- |
| FISCAL_CERT_KEY      | Envelope encryption master key | 64 hex chars      | .env, Coolify |
| EINVOICE_KEY_SECRET  | E-invoice API key encryption   | 32+ chars         | .env, Coolify |
| EPOSLOVANJE_API_BASE | Global API base URL            | URL               | .env, Coolify |
| EPOSLOVANJE_API_KEY  | Global API authentication      | Bearer token      | .env, Coolify |
| DATABASE_URL         | PostgreSQL with password       | Connection string | .env, Coolify |

### 4.2 Database-Encrypted Secrets

| Table             | Field                     | Encryption                | Key Source          |
| ----------------- | ------------------------- | ------------------------- | ------------------- |
| FiscalCertificate | encryptedP12              | Envelope (AES-256-GCM x2) | FISCAL_CERT_KEY     |
| FiscalCertificate | encryptedDataKey          | AES-256-GCM               | FISCAL_CERT_KEY     |
| Company           | eInvoiceApiKeyEncrypted   | AES-256-GCM               | EINVOICE_KEY_SECRET |
| EmailConnection   | accessToken, refreshToken | AES-256-GCM               | EINVOICE_KEY_SECRET |

### 4.3 Unencrypted Secrets in Database

| Table               | Field          | Content                 |
| ------------------- | -------------- | ----------------------- |
| FiscalCertificate   | certificatePin | PKCS#12 PIN (plaintext) |
| WebhookSubscription | secretKey      | HMAC signing key        |
| WebhookSubscription | authToken      | Bearer token            |

### 4.4 Encryption Implementation Files

**Envelope Encryption (2-layer):**

```
src/lib/fiscal/envelope-encryption.ts
  - encryptWithEnvelope(plainP12: Buffer): { encrypted, dataKey }
  - decryptWithEnvelope(encrypted: Buffer, dataKey: Buffer): Buffer
  - Algorithm: AES-256-GCM with random IV
```

**Single-Layer Encryption:**

```
src/lib/secrets.ts
  - encryptSecret(plaintext: string): string
  - decryptSecret(encrypted: string): string
  - Algorithm: AES-256-GCM, base64 encoded
```

---

## 5. Execution Flow Maps

### 5.1 Lane A: Outbound E-Invoice

```
User clicks "Send E-Invoice"
         │
         ▼
src/app/actions/einvoice/send-einvoice.ts:sendEInvoice()
         │
         ├── requireCompanyWithPermission("finance:write")
         │
         ├── db.company.findUnique({ where: { id: companyId } })
         │   └── Returns: eInvoiceProvider, eInvoiceApiKeyEncrypted
         │
         ├── decryptSecret(eInvoiceApiKeyEncrypted)
         │   └── Uses: EINVOICE_KEY_SECRET
         │
         ├── createEInvoiceProvider(provider, apiKey)
         │   └── src/lib/e-invoice/provider.ts:39-68
         │       └── switch(providerType):
         │           case "eposlovanje", "ie-racuni", "fina":
         │             return new EposlovanjeEInvoiceProvider()
         │
         ▼
src/lib/e-invoice/providers/eposlovanje-einvoice.ts:sendInvoice()
         │
         ├── fetch(apiUrl + "/api/v2/document/outgoing", {
         │     headers: { Authorization: apiKey }
         │   })
         │
         └── Returns: providerRef, status
```

**Tenant Isolation:** Verified via `requireCompanyWithPermission()` at entry point.

### 5.2 Lane B: Inbound E-Invoice Polling

```
Worker startup (container)
         │
         ├── Requires: COMPANY_ID environment variable
         │   └── Exit 1 if not set
         │
         ▼
src/lib/e-invoice/workers/eposlovanje-inbound-poller.worker.ts:main()
         │
         ├── db.company.findUnique({ where: { id: COMPANY_ID } })
         │   └── Exit 1 if not found
         │
         ├── getOrCreateSyncState(companyId)
         │   └── db.providerSyncState.findUnique({
         │         where: { companyId_provider_direction }
         │       })
         │
         ▼
pollIncomingInvoices(companyId)
         │
         ├── EposlovanjeEInvoiceProvider.fetchIncomingInvoices({
         │     fromDate: syncState.lastSuccessfulPollAt,
         │     toDate: now()
         │   })
         │
         ├── For each invoice:
         │   ├── Find/create Contact by sellerOib
         │   └── db.eInvoice.create({ companyId, providerRef, ... })
         │       └── P2002 = duplicate, skip
         │
         └── advanceCursor(syncState.id, toDate)
```

**Tenant Isolation:** Enforced by required `COMPANY_ID` env var. One worker instance per tenant.

### 5.3 Lane C: Fiscalization

```
User clicks "Fiscalize" (or auto-trigger on invoice save)
         │
         ▼
src/app/actions/fiscal-certificate.ts:manualFiscalizeAction()
         │
         ├── requireCompanyWithPermission("finance:write")
         │
         ├── db.fiscalCertificate.findFirst({
         │     where: { companyId, environment }
         │   })
         │
         ├── decryptWithEnvelope(encryptedP12, encryptedDataKey)
         │   └── Uses: FISCAL_CERT_KEY
         │
         ▼
src/lib/fiscal/fiscal-pipeline.ts:fiscalize()
         │
         ├── Parse P12 with certificatePin
         │
         ├── Build SOAP XML with:
         │   └── OIB, invoice number, amounts, payment method
         │
         ├── Sign XML with certificate private key
         │
         ├── fetch(POREZNA_URL, { body: signedXml })
         │   └── TEST: https://cistest.apis-it.hr:8449/FiskalizacijaServiceTest
         │   └── PROD: https://cis.porezna-uprava.hr:8449/FiskalizacijaService
         │
         ├── Parse response for JIR (jedinstveni identifikator računa)
         │
         ├── db.fiscalRequest.create({ companyId, requestXml, responseXml, jir })
         │
         └── randomFillSync(p12Buffer)  // Memory cleanup
```

**Tenant Isolation:** Verified via `requireCompanyWithPermission()` and `companyId` in certificate lookup.

---

## 6. Worker Isolation Analysis

### 6.1 RTL Workers (Global Scope - Intentional)

| Worker             | Queue            | Scope  | Rationale                        |
| ------------------ | ---------------- | ------ | -------------------------------- |
| orchestrator       | rtl:orchestrator | Global | Regulatory data is platform-wide |
| sentinel           | rtl:sentinel     | Global | Source monitoring is shared      |
| extractor          | rtl:extractor    | Global | LLM extraction is shared         |
| ocr                | rtl:ocr          | Global | OCR processing is shared         |
| composer           | rtl:composer     | Global | Rule composition is shared       |
| reviewer           | rtl:reviewer     | Global | Review workflow is shared        |
| arbiter            | rtl:arbiter      | Global | Conflict resolution is shared    |
| releaser           | rtl:releaser     | Global | Publishing is shared             |
| embedding          | rtl:embedding    | Global | Vector embeddings are shared     |
| article            | rtl:article      | Global | Article generation is shared     |
| content-sync       | rtl:content-sync | Global | MDX patching is shared           |
| continuous-drainer | rtl:drainer      | Global | Queue draining is shared         |

**Implementation:** BullMQ queue-based job claiming. No tenant context needed.

### 6.2 E-Invoice Worker (Tenant Scope)

| Worker           | Scope         | Isolation Mechanism         |
| ---------------- | ------------- | --------------------------- |
| einvoice-inbound | Single tenant | Required COMPANY_ID env var |

**Implementation:**

```typescript
// src/lib/e-invoice/workers/eposlovanje-inbound-poller.worker.ts
const COMPANY_ID = process.env.COMPANY_ID
if (!COMPANY_ID) {
  console.error("FATAL: COMPANY_ID not set")
  process.exit(1)
}
```

**Scaling:** One container instance per company. Docker Compose service with `COMPANY_ID=${EINVOICE_COMPANY_ID}`.

### 6.3 Cross-Tenant Isolation Verification

| Vector             | Status | Evidence                                   |
| ------------------ | ------ | ------------------------------------------ |
| Database queries   | ✅     | All queries include `where: { companyId }` |
| API authorization  | ✅     | `requireCompanyWithPermission()` at entry  |
| Worker data access | ✅     | RTL global, e-invoice tenant-scoped        |
| Session context    | ✅     | AsyncLocalStorage tenant isolation         |
| Webhook secrets    | ⚠️     | WebhookSubscription is global              |

---

## 7. Audit Invariants

### 7.1 AuditLog Table

```prisma
// prisma/schema.prisma lines 1298-1317
model AuditLog {
  id          String    @id @default(cuid())
  companyId   String?
  userId      String?
  action      String
  entityType  String
  entityId    String?
  oldValue    Json?
  newValue    Json?
  checksum    String?   // SHA-256 of serialized change
  ipAddress   String?
  userAgent   String?
  createdAt   DateTime  @default(now())
}
```

### 7.2 Fiscal Request Audit Trail

```prisma
model FiscalRequest {
  id            String   @id @default(cuid())
  companyId     String
  invoiceId     String?
  requestXml    String   // Full SOAP request (no secrets)
  responseXml   String?  // Full SOAP response
  jir           String?  // Porezna-assigned identifier
  zki           String?  // Computed signature
  status        String
  errorMessage  String?
  createdAt     DateTime @default(now())
}
```

### 7.3 Evidence Immutability

```prisma
model Evidence {
  id          String   @id @default(cuid())
  rawContent  Bytes    // Immutable - verified by hash
  checksum    String   // SHA-256 of rawContent
  // No update method exposed
}
```

### 7.4 Legal Requirements (Croatia)

| Requirement               | Implementation                      |
| ------------------------- | ----------------------------------- |
| 11-year retention         | No TTL on fiscal records            |
| Tamper evidence           | Checksums on AuditLog, Evidence     |
| Complete request/response | FiscalRequest stores full XML       |
| JIR/ZKI preservation      | Stored in FiscalRequest and Invoice |

---

## 8. UI/Config Gaps

### 8.1 E-Invoice Settings

**File:** `src/app/(app)/settings/einvoice-settings-form.tsx:21-46`

```typescript
const PROVIDERS = [
  { value: "ie-racuni", label: "ie-Računi" },
  { value: "fina", label: "FINA" },
  { value: "ddd-invoices", label: "DDD Invoices" },
  { value: "mock", label: "Mock Provider (Testing)" },
]
```

**Gaps:**

- Single dropdown = one provider only
- No multi-intermediary support
- No key rotation workflow
- No disable without delete

### 8.2 Fiscal Certificate Settings

**File:** `src/app/(app)/settings/fiscal-settings-form.tsx`

**Gaps:**

- Upload replaces existing (upsert behavior)
- No certificate history/versioning
- No expiry warnings
- No bulk operations

### 8.3 Audit Log Access

**File:** `src/app/(admin)/audit-logs/page.tsx`

**Gaps:**

- No search functionality
- No date range filter
- No export to CSV/JSON
- No entity-type filtering

---

## 9. Hard Constraints for Future Design

### 9.1 Database Constraints

| Constraint                                   | Location          | Impact                              |
| -------------------------------------------- | ----------------- | ----------------------------------- |
| `@@unique([companyId, environment])`         | FiscalCertificate | One cert per env per company        |
| `@@unique([companyId, provider, direction])` | ProviderSyncState | One cursor per provider per company |
| Partial unique on `(companyId, providerRef)` | EInvoice          | Deduplication by provider ref       |
| Single `eInvoiceProvider` field              | Company           | One provider per company            |

### 9.2 Code Constraints

| Constraint                   | Location                               | Impact                                |
| ---------------------------- | -------------------------------------- | ------------------------------------- |
| Hard-coded provider switch   | src/lib/e-invoice/provider.ts:39-68    | Adding providers requires code change |
| Hard-coded provider switch   | src/lib/e-invoice/factory.ts           | Duplicate logic                       |
| Two-environment enum         | prisma/schema.prisma:FiscalEnvironment | No staging/UAT                        |
| COMPANY_ID as single env var | eposlovanje-inbound-poller.worker.ts   | One worker per tenant                 |

### 9.3 Encryption Constraints

| Constraint                 | Impact                                   |
| -------------------------- | ---------------------------------------- |
| Master keys in environment | Key rotation requires redeployment       |
| No key versioning          | Cannot migrate to new keys incrementally |
| PIN stored plaintext       | Risk if DB compromised                   |

### 9.4 Operational Constraints

| Constraint         | Impact                                     |
| ------------------ | ------------------------------------------ |
| 11-year retention  | Cannot delete fiscal records               |
| JIR immutability   | Cannot modify after Porezna assignment     |
| UBL stored as blob | Must preserve exact XML for legal validity |

---

## 10. File Reference Index

| File                                                           | Purpose                          |
| -------------------------------------------------------------- | -------------------------------- |
| prisma/schema.prisma                                           | Data model definitions           |
| src/lib/fiscal/envelope-encryption.ts                          | Two-layer certificate encryption |
| src/lib/secrets.ts                                             | Single-layer API key encryption  |
| src/lib/e-invoice/provider.ts                                  | Provider factory (hard-coded)    |
| src/lib/e-invoice/providers/eposlovanje-einvoice.ts            | ePoslovanje v2 implementation    |
| src/lib/e-invoice/workers/eposlovanje-inbound-poller.worker.ts | Tenant-isolated polling worker   |
| src/lib/fiscal/fiscal-pipeline.ts                              | Fiscalization execution          |
| src/lib/fiscal/should-fiscalize.ts                             | Fiscalization decision logic     |
| src/app/actions/fiscal-certificate.ts                          | Certificate management actions   |
| src/app/actions/einvoice/send-einvoice.ts                      | Outbound e-invoice action        |
| src/app/(app)/settings/einvoice-settings-form.tsx              | E-invoice UI (single provider)   |
| src/app/(app)/settings/fiscal-settings-form.tsx                | Fiscal certificate UI            |
| docker-compose.workers.yml                                     | Worker container definitions     |
| scripts/lane2-inbound-poll-once.ts                             | Manual polling script            |

---

**Exploration complete. Ready for design phase.**
