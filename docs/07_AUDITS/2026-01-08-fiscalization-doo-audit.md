# Fiscalization D.O.O. Company Audit Report

**Date:** 2026-01-08
**Auditor:** Claude Code
**Scope:** Verify that fiscalization logic can never run for d.o.o. companies

---

## Executive Summary

**FINDING: NO HARD GUARD EXISTS** against fiscalization running for d.o.o. companies.

The system relies on soft protections:
1. UI-level module gating (can be bypassed via API)
2. `fiscalEnabled` database flag (can be manually set)

**Neither layer checks `company.legalForm` before executing fiscalization.**

---

## Detailed Findings

### 1. Code Paths That CAN Execute Fiscalization

| Path | File | Guard Present | Legal Form Check |
|------|------|---------------|------------------|
| Invoice creation | `src/app/actions/invoice.ts:245` | `company.fiscalEnabled` | ❌ NONE |
| POS sale | `src/app/actions/pos.ts:131` | `company.fiscalEnabled` | ❌ NONE |
| Manual fiscalize | `src/app/actions/fiscal-certificate.ts:289` | Certificate exists | ❌ NONE |
| Retry action | `src/app/actions/fiscal-certificate.ts:230` | Request status | ❌ NONE |
| Certificate upload | `src/app/actions/fiscal-certificate.ts:89` | `requireCompany()` | ❌ NONE |
| Cron processor | `src/app/api/cron/fiscal-processor/route.ts` | None (processes all) | ❌ NONE |
| Cron retry | `src/app/api/cron/fiscal-retry/route.ts` | None (processes all) | ❌ NONE |

### 2. Decision Logic Analysis

**`src/lib/fiscal/should-fiscalize.ts:16-93`**

The core fiscalization decision function checks:
- ✅ `company.fiscalEnabled` flag
- ✅ Payment method (CASH/CARD only)
- ✅ Active certificate exists
- ❌ **MISSING: `company.legalForm` check**
- ❌ **MISSING: `company.entitlements.includes("fiscalization")` check**

```typescript
export async function shouldFiscalizeInvoice(invoice) {
  // Only checks fiscalEnabled, not legalForm
  if (!company.fiscalEnabled) {
    return { shouldFiscalize: false, reason: "Fiscalisation disabled" }
  }
  // ... continues without legalForm validation
}
```

### 3. Module Entitlements System

**`src/lib/modules/definitions.ts:188-222`**

The `getEntitlementsForLegalForm()` function does NOT include `fiscalization` for DOO:

```typescript
case "DOO":
  return [...base, "vat", "corporate-tax", "reports-advanced", "reconciliation"]
  // Note: "fiscalization" is NOT included
```

However, this is **not enforced at runtime**. Server actions do not verify entitlements before proceeding.

### 4. UI Guard (Weak)

**`src/app/(app)/settings/fiscalisation/page.tsx:14`**

```typescript
if (!capabilities.modules.fiscalization?.enabled) {
  redirect("/settings?tab=plan&blocked=fiscalization")
}
```

This only protects the UI page. Direct API calls to server actions bypass this check.

### 5. Background Job Vulnerability

**Cron jobs process ALL queued requests regardless of company type:**

`src/app/api/cron/fiscal-processor/route.ts:29-46`:
```sql
UPDATE "FiscalRequest"
SET "status" = 'PROCESSING'
WHERE id IN (
  SELECT id FROM "FiscalRequest"
  WHERE "status" IN ('QUEUED', 'FAILED')
    AND "nextRetryAt" <= NOW()
  -- NO filter on company.legalForm
  -- NO filter on company.entitlements
)
```

Once a `FiscalRequest` record exists, the cron job will attempt to process it.

### 6. POS Path Analysis

**`src/lib/fiscal/pos-fiscalize.ts:39-100`**

```typescript
export async function fiscalizePosSale(input) {
  // Line 67: Only checks fiscalEnabled flag
  if (!company.fiscalEnabled || FORCE_DEMO_MODE) {
    // Demo mode - generates mock JIR/ZKI
    return { success: true, jir: demoJir, zki }
  }

  // ❌ No legalForm validation
  // Proceeds to real fiscalization
}
```

---

## Risk Assessment

| Risk | Severity | Likelihood | Description |
|------|----------|------------|-------------|
| D.O.O. real fiscalization | **HIGH** | Low | If `fiscalEnabled=true` for DOO, real tax submissions occur |
| Regulatory violation | **HIGH** | Low | Croatian tax law has different requirements for DOO vs obrt |
| Database manipulation | **MEDIUM** | Low | Admin or script could set wrong flags |
| Audit trail gap | **MEDIUM** | - | No logging of legalForm at decision point |

---

## Attack Vectors

1. **Direct database modification**:
   ```sql
   UPDATE "Company" SET "fiscalEnabled" = true WHERE "legalForm" = 'DOO';
   ```

2. **Admin API endpoint**: `fiscal-dry-run` can test any company without legalForm check

3. **Entitlement manipulation**: Adding `fiscalization` to DOO company's entitlements array

4. **Race condition**: legalForm could change after FiscalRequest creation but before processing

---

## Current Protection Layers

| Layer | Location | Strength | Bypassable |
|-------|----------|----------|------------|
| UI redirect | `settings/fiscalisation/page.tsx:14` | Weak | Yes (API calls) |
| Module definition | `definitions.ts:60-68` | None (not enforced) | N/A |
| Flag check | `should-fiscalize.ts:22` | Strong | Via DB manipulation |
| Certificate check | `should-fiscalize.ts:57-71` | Strong | Not applicable |

---

## Webhook Analysis

No webhooks trigger fiscalization directly:
- `billing/webhook` - Stripe subscription events only
- `webhooks/resend` - Email tracking only
- `webhooks/regulatory-truth` - RTL pipeline only

---

## Shared Utilities Analysis

### Queues & Workers

| Component | Location | Isolation | Risk |
|-----------|----------|-----------|------|
| FiscalRequest queue | Database table | By `companyId` only | ❌ No legalForm filter |
| fiscal-processor | `api/cron/fiscal-processor` | Row-level locks | ❌ Processes all companies |
| fiscal-retry | `api/cron/fiscal-retry` | By status | ❌ Processes all companies |

### Shared Functions

| Function | File | Called By | Guard |
|----------|------|-----------|-------|
| `executeFiscalRequest` | `fiscal-pipeline.ts` | All fiscal paths | ❌ None |
| `shouldFiscalizeInvoice` | `should-fiscalize.ts` | Invoice actions | ❌ fiscalEnabled only |
| `queueFiscalRequest` | `should-fiscalize.ts` | Invoice actions | ❌ None |
| `fiscalizePosSale` | `pos-fiscalize.ts` | POS action | ❌ fiscalEnabled only |

---

## Legal Form Definitions

**`src/domain/identity/LegalForm.ts`**

| Value | Display Name | Should Fiscalize |
|-------|--------------|------------------|
| `OBRT_PAUSAL` | Obrt (pausalni) | ✅ Yes |
| `OBRT_REAL` | Obrt (realni) | ✅ Yes |
| `DOO` | d.o.o. | ❌ No |
| `DIONICKO_DRUSTVO` | d.d. | ❌ No |

---

## Recommendations

### Immediate Actions

1. **Add legalForm guard in `shouldFiscalizeInvoice()`**:
   ```typescript
   const FISCALIZABLE_LEGAL_FORMS = ['OBRT_PAUSAL', 'OBRT_REAL'] as const

   if (!FISCALIZABLE_LEGAL_FORMS.includes(company.legalForm as any)) {
     return { shouldFiscalize: false, reason: "Company type not eligible" }
   }
   ```

2. **Add legalForm guard in `fiscalizePosSale()`**

3. **Add entitlement enforcement in server actions**:
   ```typescript
   const capabilities = deriveCapabilities(company)
   if (!capabilities.modules.fiscalization?.enabled) {
     return { error: "Fiscalization not enabled for this company" }
   }
   ```

4. **Add legalForm filter in cron job queries**:
   ```sql
   WHERE "status" IN ('QUEUED', 'FAILED')
     AND EXISTS (
       SELECT 1 FROM "Company" c
       WHERE c.id = fr."companyId"
         AND c."legalForm" IN ('OBRT_PAUSAL', 'OBRT_REAL')
     )
   ```

### Guardrails to Add

1. **Database constraint** (recommended):
   ```sql
   ALTER TABLE "FiscalRequest" ADD CONSTRAINT fiscal_legal_form_check
     CHECK (
       companyId IN (
         SELECT id FROM "Company"
         WHERE "legalForm" IN ('OBRT_PAUSAL', 'OBRT_REAL')
       )
     );
   ```

2. **Domain invariant assertion** in `executeFiscalRequest()`:
   ```typescript
   const company = await db.company.findUnique({ where: { id: request.companyId } })
   if (company?.legalForm === 'DOO' || company?.legalForm === 'DIONICKO_DRUSTVO') {
     throw new Error('INVARIANT VIOLATION: Fiscalization not allowed for DOO/DD')
   }
   ```

3. **CI test** to verify no DOO companies have fiscalization enabled:
   ```typescript
   test('no DOO companies should have fiscalization entitlement', async () => {
     const invalid = await db.company.findMany({
       where: {
         legalForm: 'DOO',
         OR: [
           { fiscalEnabled: true },
           { entitlements: { has: 'fiscalization' } }
         ]
       }
     })
     expect(invalid).toHaveLength(0)
   })
   ```

---

## Conclusion

The fiscalization system currently has **NO HARD GUARD** preventing execution for d.o.o. companies.

Protection relies entirely on:
1. Default entitlements not including `fiscalization` for DOO
2. UI page redirecting users without module access
3. `fiscalEnabled` flag being `false` by default

These are all "soft" guards that can be bypassed through database manipulation, admin tools, or API calls.

**Once a `FiscalRequest` is created in the queue, the cron jobs will process it regardless of company type.**

---

## Verification Checklist

- [x] Mapped all fiscalization code locations
- [x] Verified no legalForm checks in shouldFiscalizeInvoice()
- [x] Verified no legalForm checks in fiscalizePosSale()
- [x] Verified no legalForm filters in cron job queries
- [x] Verified no entitlement enforcement in server actions
- [x] Confirmed webhooks do not trigger fiscalization
- [x] Documented all attack vectors
- [x] Provided remediation recommendations
