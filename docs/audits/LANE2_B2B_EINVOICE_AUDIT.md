# LANE 2 B2B E-Invoice Audit Report

**Date:** 2026-01-04
**Auditor:** Claude (AI Assistant)
**Scope:** D.O.O. B2B e-invoice sending + receiving via intermediary
**Constraint:** No fiscalization (ignore JIR/ZKI/CIS)

---

## Section 1: Executive Verdict

### **NOT READY**

**Reason:** CODE blocker prevents e-invoice sending even with API key configured.

| Component               | Status     | Blocker Type |
| ----------------------- | ---------- | ------------ |
| UBL Generation          | ✅ READY   | -            |
| EN16931 Validation      | ✅ READY   | -            |
| Inbound Receive         | ✅ READY   | -            |
| Deduplication           | ✅ READY   | -            |
| Provider Interface      | ⚠️ DEFINED | -            |
| Provider Implementation | ❌ BLOCKED | CODE         |
| Outbound Send           | ❌ BLOCKED | CODE         |

**Bottom Line:** The system correctly generates UBL XML, validates EN16931 compliance, and handles inbound invoices. However, sending outbound invoices is blocked by unimplemented provider code.

---

## Section 2: Outbound Lane (Send) – Evidence

### Tested Flow

1. Create B2B invoice (paymentMethod: TRANSFER)
2. Generate UBL XML
3. Validate EN16931 compliance
4. Attempt send via provider

### Results

| Step               | Result     | Evidence                                            |
| ------------------ | ---------- | --------------------------------------------------- |
| Invoice creation   | ✅ SUCCESS | `E-DRY-RUN-1767544936235` created with status DRAFT |
| UBL generation     | ✅ SUCCESS | 4236 bytes stored in `ublXml` column                |
| EN16931 validation | ✅ SUCCESS | 0 errors, 0 warnings                                |
| Provider send      | ❌ BLOCKED | See below                                           |

### Provider Behavior

**Without API key:**

```
providerStatus: PROVIDER_NOT_CONFIGURED
providerError: "No API key configured for provider: ie-racuni"
```

**With API key:**

```
providerStatus: PROVIDER_NOT_IMPLEMENTED
providerError: "IE Računi provider not yet implemented"
```

### SQL Evidence

```sql
SELECT id, "invoiceNumber", status, "providerStatus", "providerError", "ublXml" IS NOT NULL as ubl_stored
FROM "EInvoice" WHERE id = 'cmjzym9h80000auwacv48iaqo';

            id             |      invoiceNumber      | status |     providerStatus      | ubl_stored
---------------------------+-------------------------+--------+-------------------------+------------
 cmjzym9h80000auwacv48iaqo | E-DRY-RUN-1767544936235 | ERROR  | PROVIDER_NOT_CONFIGURED | t

SELECT id, "invoiceNumber", status, "providerStatus", "providerError", "ublXml" IS NOT NULL as ubl_stored
FROM "EInvoice" WHERE id = 'cmjzyr0140000x6wam9s71ux4';

            id             |      invoiceNumber      | status |      providerStatus      | ubl_stored
---------------------------+-------------------------+--------+--------------------------+------------
 cmjzyr0140000x6wam9s71ux4 | E-DRY-RUN-1767545157238 | ERROR  | PROVIDER_NOT_IMPLEMENTED | t
```

---

## Section 3: Inbound Lane (Receive) – Evidence

### Tested Flow

1. Receive invoice payload with seller info
2. Create/find seller contact
3. Create inbound invoice with direction=INBOUND
4. Store UBL XML from payload
5. Test deduplication

### Results

| Step             | Result     | Evidence                                 |
| ---------------- | ---------- | ---------------------------------------- |
| Contact creation | ✅ SUCCESS | Seller contact created/linked            |
| Invoice creation | ✅ SUCCESS | `IN-1767545075006` with status DELIVERED |
| UBL storage      | ✅ SUCCESS | xmlData stored in ublXml column          |
| Deduplication    | ✅ SUCCESS | Duplicate detected by providerRef        |

### SQL Evidence

```sql
SELECT id, "invoiceNumber", direction, status, "providerRef", "providerStatus", "ublXml" IS NOT NULL as ubl_stored
FROM "EInvoice" WHERE id = 'cmjzyp8kv00006hwauop19l10';

            id             |  invoiceNumber   | direction |  status   |    providerRef     | providerStatus | ubl_stored
---------------------------+------------------+-----------+-----------+--------------------+----------------+------------
 cmjzyp8kv00006hwauop19l10 | IN-1767545075006 | INBOUND   | DELIVERED | PROV-1767545075006 | RECEIVED       | t

SELECT direction, count(*) FROM "EInvoice" WHERE "companyId" = 'test-doo-lane2' GROUP BY direction;

 direction | count
-----------+-------
 OUTBOUND  |     2
 INBOUND   |     1
```

---

## Section 4: Provider Boundary Contract – Evidence

### Interface Definition

**File:** `/home/admin/FiskAI/src/lib/e-invoice/provider.ts:10-22`

```typescript
export interface EInvoiceProvider {
  readonly name: string
  sendInvoice(invoice: EInvoiceWithRelations, ublXml: string): Promise<SendInvoiceResult>
  fetchIncomingInvoices(): Promise<IncomingInvoice[]>
  getInvoiceStatus(providerRef: string): Promise<InvoiceStatusResult>
  archiveInvoice(invoice: EInvoiceWithRelations): Promise<ArchiveResult>
  testConnection(): Promise<boolean>
}
```

### Factory Implementation

**File:** `/home/admin/FiskAI/src/lib/e-invoice/provider.ts:24-40`

```typescript
export function createEInvoiceProvider(
  providerName: string,
  config: ProviderConfig
): EInvoiceProvider {
  switch (providerName) {
    case "mock":
      return new MockProvider(config) // ← Works
    case "ie-racuni":
      throw new Error("IE Računi provider not yet implemented") // ← BLOCKER
    case "fina":
      throw new Error("Fina provider not yet implemented") // ← BLOCKER
    default:
      throw new Error(`Unknown provider: ${providerName}`)
  }
}
```

### BLOCKER LOCATION

- **File:** `/home/admin/FiskAI/src/lib/e-invoice/provider.ts`
- **Lines:** 33-36
- **Type:** CODE
- **Impact:** Cannot send e-invoices with real provider

---

## Section 5: State Machine & Idempotency – Evidence

### EInvoice Status Enum

**File:** `/home/admin/FiskAI/prisma/schema.prisma`

```
enum EInvoiceStatus {
  DRAFT
  PENDING_FISCALIZATION
  FISCALIZED
  SENT
  DELIVERED
  ACCEPTED
  REJECTED
  ARCHIVED
  ERROR
}
```

### State Transitions Observed

- DRAFT → ERROR (when provider fails)
- DRAFT → DELIVERED (for inbound invoices)

### Idempotency

- **Deduplication:** By `providerRef` (works)
- **Unique constraint:** `companyId + invoiceNumber` (enforced by DB)

---

## Section 6: Storage & Audit Artifacts – Evidence

### Data Stored

| Field            | Purpose               | Populated        |
| ---------------- | --------------------- | ---------------- |
| `ublXml`         | Full UBL XML document | ✅ Yes           |
| `providerRef`    | Provider reference ID | ✅ Yes           |
| `providerStatus` | Status from provider  | ✅ Yes           |
| `providerError`  | Error message         | ✅ Yes           |
| `sentAt`         | Send timestamp        | Only on success  |
| `receivedAt`     | Receive timestamp     | Only for inbound |

### File Locations

| Purpose            | Location                                  |
| ------------------ | ----------------------------------------- |
| UBL Generator      | `src/lib/e-invoice/ubl-generator.ts`      |
| EN16931 Validator  | `src/lib/compliance/en16931-validator.ts` |
| Provider Interface | `src/lib/e-invoice/provider.ts`           |
| Mock Provider      | `src/lib/e-invoice/providers/mock.ts`     |
| Send Action        | `src/app/actions/invoice.ts:680-756`      |
| Receive Endpoint   | `src/app/api/e-invoices/receive/route.ts` |

---

## Section 7: Blockers

### BLOCKER #1: Provider Not Implemented

| Attribute        | Value                                                       |
| ---------------- | ----------------------------------------------------------- |
| Type             | CODE                                                        |
| File             | `/home/admin/FiskAI/src/lib/e-invoice/provider.ts`          |
| Lines            | 33-36                                                       |
| Current Behavior | `throw new Error("IE Računi provider not yet implemented")` |
| Impact           | Cannot send e-invoices even with API key                    |

### Fix Steps

1. Create `src/lib/e-invoice/providers/ie-racuni-einvoice.ts`
2. Implement `EInvoiceProvider` interface for IE Računi
3. Update factory in `provider.ts` to instantiate new class
4. Add environment variables for IE Računi API endpoints
5. Test with mock/sandbox API

### Estimated Effort

- Development: 1-2 days
- Testing: 1 day
- Total: 2-3 days

---

## Section 8: Final Simulation – "Tomorrow API key appears"

### Current State

Company has:

- `eInvoiceProvider = "ie-racuni"`
- `eInvoiceApiKeyEncrypted = <set>`

### What Happens Tomorrow

1. User creates B2B invoice ✅
2. System generates UBL XML ✅
3. System validates EN16931 ✅
4. System calls `createEInvoiceProvider("ie-racuni", { apiKey })` ❌
5. **Error:** "IE Računi provider not yet implemented"
6. Invoice saved with status ERROR

### Required Changes

To go live with API key:

1. Implement `IeRacuniEInvoiceProvider` class
2. Add to factory switch statement
3. Configure API endpoints in environment
4. Deploy

---

## Summary Table

| Question                       | Answer   | Evidence                   |
| ------------------------------ | -------- | -------------------------- |
| Can d.o.o. send e-invoices?    | NO       | Provider throws at line 34 |
| Can d.o.o. receive e-invoices? | YES      | Inbound flow works         |
| Is UBL generation ready?       | YES      | 4236 bytes generated       |
| Is EN16931 validation ready?   | YES      | 0 errors, 0 warnings       |
| Is deduplication working?      | YES      | By providerRef             |
| What blocks sending?           | CODE     | provider.ts:33-36          |
| What is the fix type?          | CODE     | Implement provider class   |
| Estimated fix time?            | 2-3 days | Development + testing      |

---

## Final Answer

**Is LANE 2 (B2B e-invoice via intermediary) ready for d.o.o. once API key is configured?**

# NO

**Reason:** The provider implementation is missing. Lines 33-36 of `provider.ts` throw an error for all real providers (ie-racuni, fina). Only the mock provider works.

**What works:**

- UBL XML generation
- EN16931 validation
- Inbound invoice receiving
- Deduplication by providerRef
- State persistence

**What's blocked:**

- Outbound sending via real provider

**Fix required:**

- Implement `EInvoiceProvider` for ie-racuni
- Estimated: 2-3 days of development
