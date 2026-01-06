# LANE 2 ePoslovanje Operational Proof Report

**Date:** 2026-01-04
**Status:** BLOCKED - CIUS-2025 Compliance Required

## Executive Summary

Lane 2 B2B e-invoice integration with ePoslovanje v2 API has been implemented and tested. The following are proven working:

- API connectivity (ping endpoint)
- Authentication (API key)
- Request format (JSON with UBL)
- Preflight validation (blocks invalid sends)
- Client-side idempotency

**BLOCKED:** Full operational proof requires CIUS-2025 compliant UBL XML format. The Croatian CIUS-2025 specification adds mandatory fields (HR-BT-4, HR-BT-5, CPA/KPD codes) that are not fully documented in public sources.

---

## 1. Outbound Golden Path Proof (TEST)

### 1.1 API Connectivity Proof

```bash
# Ping endpoint test
$ curl -s "https://test.eposlovanje.hr/api/v2/ping" \
    -H "Authorization: [REDACTED]" | jq .

{
  "status": "OK",
  "message": "Svi servisi su pokrenuti i ispravno rade..."
}
# HTTP Status: 200
```

**Container connectivity proof:**

```javascript
// From inside app container bsswgo8ggwgkw8c88wo8wcw8-*
fetch("https://test.eposlovanje.hr/api/v2/ping", {
  headers: { Authorization: "[REDACTED]", Accept: "application/json" },
}).then((r) => console.log("HTTP:", r.status))
// Result: HTTP: 200
```

### 1.2 Send Endpoint Validation

```bash
# Store 400 response to prove API format is correct
$ cat /tmp/eposlovanje_400.json
{
  "error": "Greška pri validaciji dokumenta",
  "details": "Porezni identifikator prodavatelja (BT-32) je obavezan;
Porezni identifikator kupca (BT-48) je obavezan;
[BR-S-02]-Račun koji sadržava stavku računa..."
}
```

**Interpretation:** HTTP 400 with structured validation errors proves:

- ✓ Correct endpoint: `/api/v2/document/send`
- ✓ Correct auth: API key accepted (not 401)
- ✓ Correct format: JSON body with `document` and `softwareId` fields
- ✓ UBL parsed: Server validated document structure

### 1.3 Current Validation Failures (CIUS-2025)

After fixing EN 16931 basic fields (vatNumber for seller/buyer), Croatian CIUS-2025 validation fails:

```json
{
  "error": "Greška pri validaciji dokumenta",
  "details": "[HR-BR-37] - Račun mora sadržavati oznaku operatera (HR-BT-4);
[HR-BR-9] - Račun mora sadržavati OIB operatera (HR-BT-5);
[HR-BR-25] - Svaki artikl MORA imati identifikator klasifikacije artikla..."
}
```

| Rule     | Description              | Required Field     | Current Status   |
| -------- | ------------------------ | ------------------ | ---------------- |
| HR-BR-2  | Invoice issue time       | IssueTime element  | ✓ Added          |
| HR-BR-5  | Specification identifier | CustomizationID    | ✓ Added          |
| HR-BR-34 | Process identifier       | ProfileID (P1-P12) | ✓ Added          |
| HR-BR-37 | Operator designation     | HR-BT-4            | ✗ Format unknown |
| HR-BR-9  | Operator OIB             | HR-BT-5            | ✗ Format unknown |
| HR-BR-25 | CPA classification       | KPD code (CG)      | ✗ Format unknown |

---

## 2. Master Data Preflight (Block Invalid Sends)

### 2.1 Implementation

**File:** `src/lib/compliance/en16931-validator.ts:244-452`

```typescript
export function validateB2BEInvoicePreflight(invoice: EN16931Invoice): PreflightResult {
  // Validates:
  // - BT-31: Seller VAT identifier (Company.vatNumber)
  // - BT-32: Seller tax registration (Company.oib)
  // - BT-48: Buyer VAT identifier (Contact.vatNumber)
  // - BT-35/37/38/40: Seller address fields
  // - BT-55: Buyer country code
  // - BT-151: VAT category on line items
  // - BT-1/2/5: Invoice number, date, currency
}
```

### 2.2 Preflight Integration

**File:** `scripts/lane2-outbound-dry-run.ts:205-284`

Preflight runs BEFORE calling provider. If preflight fails:

- Invoice status set to ERROR
- providerStatus set to PREFLIGHT_FAILED
- providerError contains field-level errors
- Provider is NOT called

### 2.3 Preflight Proof

```sql
-- Invoice with preflight failure (no vatNumber)
SELECT id, status, "providerStatus", substring("providerError", 1, 100)
FROM "EInvoice" WHERE id = 'cmk016qc7000021waf6ug4sqx';

            id             | status |  providerStatus  | substring
---------------------------+--------+------------------+-----------
 cmk016qc7000021waf6ug4sqx | ERROR  | PREFLIGHT_FAILED | Preflight validation failed: [BT-31] Seller VAT...
```

**Log proof (no HTTP call made):**

```json
{ "msg": "B2B e-invoice preflight FAILED", "errorCount": 2 }
// No subsequent "Sending invoice via ePoslovanje" log
```

---

## 3. Status Refresh Proof

### 3.1 Implementation

**File:** `src/lib/e-invoice/providers/eposlovanje-einvoice.ts:464-517`

```typescript
async getInvoiceStatus(providerRef: string): Promise<InvoiceStatusResult> {
  const url = this.buildUrl(`/api/v2/document/${providerRef}/status`)
  // GET request with Authorization header
}
```

### 3.2 Status Proof

**NOT PROVEN** - Requires successful send to get providerRef first.

**Unit test proof (mocked):**

```typescript
// src/lib/e-invoice/providers/__tests__/eposlovanje-einvoice.test.ts:441-451
it("returns error when not configured", async () => {
  const result = await provider.getInvoiceStatus("test-ref")
  expect(result.status).toBe("error")
  expect(result.message).toContain("PROVIDER_NOT_CONFIGURED")
})
```

---

## 4. Inbound Proof

**NOT IMPLEMENTED**

Requires choosing between:

- **Webhook:** Implement `src/app/api/e-invoice/webhooks/eposlovanje/route.ts`
- **Polling:** Implement `provider.pollIncoming()` using `/api/v2/document/incoming`

**Blocker:** Cannot test inbound without successful outbound first.

---

## 5. Idempotency Proof

### 5.1 Client-Side Idempotency (PROVEN)

**File:** `src/lib/e-invoice/providers/eposlovanje-einvoice.ts:268-278`

```typescript
// Skip re-send if invoice already has providerRef and success status
if (invoice.providerRef && ["QUEUED", "SENT", "DELIVERED"].includes(invoice.providerStatus || "")) {
  return { success: true, providerRef: invoice.providerRef }
}
```

**Proof:**

```
Invoice: E-DRY-RUN-1767548348973
ProviderRef: TEST-REF-123
ProviderStatus: SENT

Attempting to send (should be idempotent)...
{"msg":"Invoice already sent - returning existing providerRef"}

Result:
  Success: true
  ProviderRef: TEST-REF-123 (unchanged)
  Duplicate count: 1 (no duplicates)

✓ IDEMPOTENCY VERIFIED
```

### 5.2 Server-Side Idempotency

**File:** `src/lib/e-invoice/providers/eposlovanje-einvoice.ts:346-361`

HTTP 409 treated as idempotent success:

```typescript
if (response.status === 409) {
  const providerRef = responseBody?.messageId || ...
  return { success: true, providerRef }
}
```

**Unit test proof:**

```typescript
// eposlovanje-einvoice.test.ts:286-302
it("treats 409 as idempotent success", async () => {
  expect(result.success).toBe(true)
  expect(result.providerRef).toBe("EXISTING-123")
})
```

---

## 6. Remaining Blockers

| Blocker                    | Severity | Fix Type  | Details                                                 |
| -------------------------- | -------- | --------- | ------------------------------------------------------- |
| CIUS-2025 HR-BT-4/5 format | CRITICAL | CODE      | UBL generator needs correct format for operator fields  |
| CIUS-2025 CPA/KPD codes    | CRITICAL | CODE+DATA | Need CommodityClassification format + product CPA codes |
| Official CIUS-2025 docs    | CRITICAL | EXTERNAL  | Need access to Croatian Ministry specification          |
| Status refresh             | LOW      | DEFERRED  | Blocked by outbound success                             |
| Inbound                    | LOW      | DEFERRED  | Blocked by outbound success                             |

### 6.1 Fix Type Details

**CODE (UBL Generator):**

- File: `src/lib/e-invoice/ubl-generator.ts`
- Required: Correct XML structure for HR-BT-4, HR-BT-5
- Source: Croatian Ministry of Finance CIUS-2025 specification

**DATA (CPA Codes):**

- Requires: Product classification codes (KPD/CPA)
- Schema change: Add `cpaCode` field to Product/EInvoiceLine
- Alternative: Default codes for service invoices

---

## 7. Files Changed in This Session

| File                                                  | Change                                 | Lines                          |
| ----------------------------------------------------- | -------------------------------------- | ------------------------------ |
| `src/lib/compliance/en16931-validator.ts`             | Added `validateB2BEInvoicePreflight()` | 244-452                        |
| `src/lib/e-invoice/ubl-generator.ts`                  | Added CIUS-2025 fields (partial)       | 10-21, 36-39, 101-128, 157-186 |
| `src/lib/e-invoice/providers/eposlovanje-einvoice.ts` | Added error details capture            | 367, 371-373                   |
| `scripts/lane2-outbound-dry-run.ts`                   | Added preflight integration            | 23, 205-289                    |
| `scripts/eposlovanje-ping.ts`                         | New ping test script                   | All                            |
| `scripts/test-idempotency.ts`                         | New idempotency test script            | All                            |

---

## 8. Unit Test Status

```
✓ 27 tests pass (eposlovanje-einvoice.test.ts)
```

---

## 9. Environment Configuration

| Variable               | Value                         | Status           |
| ---------------------- | ----------------------------- | ---------------- |
| `EPOSLOVANJE_API_BASE` | `https://test.eposlovanje.hr` | ✓ SET in Coolify |
| `EPOSLOVANJE_API_KEY`  | `[REDACTED - 64 chars]`       | ✓ SET in Coolify |

---

## Final Answer

**"Without further code changes, if we switch EPOSLOVANJE_API_BASE to production and set production key, will d.o.o. be able to send and receive B2B e-invoices via ePoslovanje?"**

## **NO**

### Remaining Blockers Preventing Production Use:

1. **CODE BLOCKER:** UBL generator (`src/lib/e-invoice/ubl-generator.ts`) does not produce CIUS-2025 compliant XML
   - Missing correct format for HR-BT-4 (operator designation)
   - Missing correct format for HR-BT-5 (operator OIB)
   - Missing correct format for CPA/KPD classification codes

2. **EXTERNAL BLOCKER:** Official Croatian Ministry CIUS-2025 specification needed to determine correct XML structure

### What IS Working:

- ✓ API connectivity
- ✓ Authentication
- ✓ Request format (JSON + UBL)
- ✓ Preflight validation
- ✓ Client-side idempotency
- ✓ Error handling
- ✓ Provider factory wiring

### Next Steps:

1. Obtain official CIUS-2025 sample files from Croatian Ministry of Finance
2. Update UBL generator with correct HR-BT field structure
3. Add CPA code support to product/line items
4. Re-test outbound golden path
5. Complete inbound proof
