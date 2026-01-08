# Prisma Multi-Tenant Audit Report

**Date:** 2026-01-08
**Auditor:** Claude Code Agent
**Scope:** Prisma schema, migrations, and ORM logic
**Focus:** Multi-tenancy gaps that could cause data collision between companies owned by the same user

---

## Executive Summary

The FiskAI codebase uses a proper multi-tenancy model with:
- `CompanyUser` join table allowing users to belong to multiple companies
- `isDefault` flag for selecting active company context
- AsyncLocalStorage-based tenant context (`runWithTenant`)
- Prisma extensions that auto-inject `companyId` filters

**However, this audit identified 3 critical, 4 high, and 8 medium severity issues.**

---

## 1. Schema-Level Issues

### 1.1 CRITICAL: Missing Models in TENANT_MODELS Array

The `TENANT_MODELS` array in `src/lib/prisma-extensions.ts:452-530` controls automatic tenant filtering. The following models have `companyId` but are **NOT** in this array:

| Model | Risk | Location |
|-------|------|----------|
| `Person` | Cross-tenant person access | schema.prisma:908 |
| `PersonContactRole` | Cross-tenant role leak | schema.prisma:941 |
| `PersonEmployeeRole` | Cross-tenant role leak | schema.prisma:959 |
| `PersonDirectorRole` | Cross-tenant role leak | schema.prisma:976 |
| `PersonSnapshot` | Audit trail leak | schema.prisma:992 |
| `PersonEvent` | Event log leak | schema.prisma:1009 |
| `TravelOrder` | Travel data leak | schema.prisma:1701 |
| `MileageLog` | Travel data leak | schema.prisma:1739 |
| `TravelPdf` | Document leak | schema.prisma:1766 |
| `EmailConnection` | Credential leak | schema.prisma:1963 |
| `EmailImportRule` | Config leak | schema.prisma:1987 |
| `EmailAttachment` | Data leak | schema.prisma:2005 |
| `BankConnection` | Credential leak | schema.prisma:1923 |
| `PotentialDuplicate` | Data leak | schema.prisma:1945 |
| `UnappliedPayment` | Financial data leak | schema.prisma:1907 |
| `FiscalCertificate` | Certificate leak | schema.prisma:2226 |
| `FiscalRequest` | Request leak | schema.prisma:2311 |
| `IntegrationAccount` | Credential leak | schema.prisma:2255 |
| `EntitlementHistory` | Audit leak | schema.prisma:720 |
| `StaffAssignment` | Access control leak | schema.prisma:760 |
| `StaffReview` | Review data leak | schema.prisma:797 |
| `ClientInvitation` | Invitation leak | schema.prisma:776 |
| `AdminAlert` | Alert leak | schema.prisma:4593 |
| `CertificateNotification` | Notification leak | schema.prisma:2292 |
| `Document` | Document leak | schema.prisma:1581 |
| `ProviderSyncState` | Sync state leak | schema.prisma:5545 |
| `AIFeedback` | Feedback leak | schema.prisma:2381 |
| `AIUsage` | Usage tracking leak | schema.prisma:2399 |

**Impact:** Queries without explicit `companyId` in WHERE clause will return data from ALL companies.

### 1.2 HIGH: Optional companyId in ExpenseCategory

```prisma
// schema.prisma:1641
model ExpenseCategory {
  companyId String?  // OPTIONAL - allows NULL
  ...
  @@unique([companyId, code])
}
```

**Problem:** PostgreSQL treats NULL as not equal to NULL for unique constraints. This means:
- Multiple system-level categories (NULL companyId) with the same code are allowed
- This could cause ambiguity when resolving categories

**Recommendation:** Add a partial unique index for NULL companyId:
```sql
CREATE UNIQUE INDEX expense_category_code_system_unique
  ON "ExpenseCategory" (code) WHERE "companyId" IS NULL;
```

### 1.3 MEDIUM: JoppdSubmissionLine Missing companyId

```prisma
// schema.prisma:2787
model JoppdSubmissionLine {
  // NO companyId field!
  submissionId String
  ...
}
```

The model relies on `JoppdSubmission.companyId` for tenant scoping. While this works via relation, it requires:
1. Always joining through parent
2. Custom tenant check in prisma-extensions (lines 1908-1912)

This is handled correctly but is fragile.

### 1.4 MEDIUM: FiscalResponse Missing companyId

```prisma
// schema.prisma:2358
model FiscalResponse {
  // NO companyId field!
  requestId String
  ...
}
```

Similar to JoppdSubmissionLine - relies on FiscalRequest.companyId. Not in TENANT_MODELS.

### 1.5 MEDIUM: JoppdSubmissionEvent Missing companyId

```prisma
// schema.prisma:2813
model JoppdSubmissionEvent {
  // NO companyId field!
  submissionId String
  ...
}
```

---

## 2. ORM-Level Issues

### 2.1 CRITICAL: Post-Fetch Validation for findUnique

In `src/lib/prisma-extensions.ts:1932-1972`, `findUnique` queries execute WITHOUT companyId filter, then validate afterward:

```typescript
async findUnique({ model, args, query }) {
  const result = await query(args)  // Queries ALL companies!
  // ...
  if (context && result && TENANT_MODELS.includes(model)) {
    if (result.companyId !== context.companyId) {
      return null  // Hides after fetch
    }
  }
}
```

**Risks:**
- Database scanned across all companies
- Timing attacks could reveal record existence
- Wastes database resources

**Recommendation:** Add companyId to unique queries where composite unique exists:
```typescript
// For models with @@unique([companyId, ...])
args.where = { ...args.where, companyId: context.companyId }
```

### 2.2 CRITICAL: No Company Validation in invoice-numbering.ts

**File:** `src/lib/invoice-numbering.ts`

```typescript
// Line 47 - No companyId validation
await db.businessPremises.findUnique({ where: { id: businessPremisesId } })

// Line 67 - No companyId validation
await db.paymentDevice.findUnique({ where: { id: paymentDeviceId } })

// Line 160, 178 - Same issues in previewNextInvoiceNumber()
```

**Impact:** A user with multiple companies could reference BusinessPremises or PaymentDevice from a different company when generating invoice numbers.

### 2.3 HIGH: Post-Fetch Validation Pattern in Application Code

The following locations fetch by ID then validate companyId afterward:

| File | Line | Model | Risk |
|------|------|-------|------|
| `src/app/(app)/contacts/[id]/page.tsx` | 50-68 | Contact | Cross-tenant access window |
| `src/app/(app)/banking/documents/[id]/page.tsx` | 26-41 | ImportJob | Cross-tenant access window |
| `src/lib/review-queue/service.ts` | 69, 114 | ReviewQueueItem | Cross-tenant access window |
| `src/lib/period-locking/service.ts` | 86, 136 | AccountingPeriod | Cross-tenant access window |
| `src/lib/reporting/status-service.ts` | 76, 135, 194 | ReportingStatus | Cross-tenant access window |

---

## 3. Constraint Gap Analysis

### 3.1 Models Missing Compound Unique with companyId

These models have business-significant fields that should be unique per company but lack proper constraints:

| Model | Missing Constraint | Current State |
|-------|-------------------|---------------|
| `Expense` | `@@unique([companyId, ???])` | Only index, no unique |
| `BankTransaction` | `@@unique([companyId, externalId])` | Only index |
| `ImportJob` | `@@unique([companyId, fileChecksum])` | Only composite index without unique |
| `Payout` | `@@unique([companyId, periodYear, periodMonth])` | Only index |

### 3.2 Existing Proper Constraints (Good)

These models correctly implement company-scoped uniqueness:

- `EInvoice`: `@@unique([companyId, invoiceNumber])`
- `Contact`: `@@unique([companyId, oib])`
- `Employee`: `@@unique([companyId, oib])`
- `Product`: `@@unique([companyId, sku])`
- `BankAccount`: `@@unique([companyId, iban])`
- `TravelOrder`: `@@unique([companyId, orderNumber])`
- `FiscalCertificate`: `@@unique([companyId, environment])`

---

## 4. Recommendations

### Priority 1 (Immediate - Data Security)

1. **Add missing models to TENANT_MODELS array** in `src/lib/prisma-extensions.ts`:
   ```typescript
   const TENANT_MODELS = [
     // ... existing ...
     "Person",
     "PersonContactRole",
     "PersonEmployeeRole",
     "PersonDirectorRole",
     "PersonSnapshot",
     "PersonEvent",
     "TravelOrder",
     "MileageLog",
     "TravelPdf",
     "EmailConnection",
     "EmailImportRule",
     "EmailAttachment",
     "BankConnection",
     "PotentialDuplicate",
     "UnappliedPayment",
     "FiscalCertificate",
     "FiscalRequest",
     "IntegrationAccount",
     "EntitlementHistory",
     "StaffAssignment",
     "StaffReview",
     "Document",
     "ProviderSyncState",
     "AIFeedback",
     "AIUsage",
     "AdminAlert",
     "CertificateNotification",
   ] as const
   ```

2. **Fix invoice-numbering.ts** - Add companyId validation:
   ```typescript
   const premises = await db.businessPremises.findFirst({
     where: { id: businessPremisesId, companyId }
   })
   if (!premises) throw new Error("Invalid business premises")
   ```

### Priority 2 (Important - Defense in Depth)

3. **Refactor post-fetch validation to pre-query filtering** where composite unique keys exist.

4. **Add ESLint rule** to prevent `findUnique({ where: { id } })` on company-scoped models.

5. **Add companyId to models that rely on parent relations:**
   - `JoppdSubmissionLine`
   - `FiscalResponse`
   - `JoppdSubmissionEvent`
   - `DepreciationSchedule`
   - `DepreciationEntry`
   - `DisposalEvent`

### Priority 3 (Enhancement - Robustness)

6. **Add partial unique index for ExpenseCategory:**
   ```sql
   CREATE UNIQUE INDEX expense_category_code_system_unique
     ON "ExpenseCategory" (code) WHERE "companyId" IS NULL;
   ```

7. **Add missing compound unique constraints** to Expense, BankTransaction, etc.

8. **Add tenant isolation integration tests** for all missing models.

---

## 5. Test Coverage Gaps

The following test files should be created/enhanced:

- `src/lib/__tests__/person-tenant-isolation.test.ts`
- `src/lib/__tests__/travel-tenant-isolation.test.ts`
- `src/lib/__tests__/email-tenant-isolation.test.ts`
- `src/lib/__tests__/fiscal-tenant-isolation.test.ts`
- `src/lib/__tests__/invoice-numbering-tenant-isolation.test.ts`

---

## Appendix: TENANT_MODELS Coverage Matrix

| Model | Has companyId | In TENANT_MODELS | Status |
|-------|--------------|------------------|--------|
| Contact | ✓ | ✓ | OK |
| Organization | ✓ | ✓ | OK |
| Person | ✓ | ✗ | **MISSING** |
| PersonContactRole | ✓ | ✗ | **MISSING** |
| Product | ✓ | ✓ | OK |
| EInvoice | ✓ | ✓ | OK |
| Expense | ✓ | ✓ | OK |
| BankAccount | ✓ | ✓ | OK |
| TravelOrder | ✓ | ✗ | **MISSING** |
| FiscalCertificate | ✓ | ✗ | **MISSING** |
| IntegrationAccount | ✓ | ✗ | **MISSING** |
| ... | ... | ... | ... |

(See Section 1.1 for full list of missing models)
