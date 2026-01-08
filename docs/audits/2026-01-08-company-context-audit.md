# Company Context Security Audit Report

**Date:** 2026-01-08
**Auditor:** Claude (Automated)
**Scope:** All API routes, server actions, background workers, and database queries
**Objective:** Identify cross-company data bleed vulnerabilities

---

## Executive Summary

This audit examined company context handling across the FiskAI codebase. The system implements tenant isolation via:
1. **Prisma middleware** (`withTenantIsolation`) that auto-filters queries on TENANT_MODELS
2. **AsyncLocalStorage** (`runWithTenant`) for request-scoped context
3. **Auth utilities** (`requireCompanyWithContext`, `requireCompanyWithPermission`)

**CRITICAL vulnerabilities were found** where tenant context is not established before accessing business data.

---

## CRITICAL Vulnerabilities

### 1. Payroll Payout Lock - Missing Tenant Context

**File:** `src/app/api/payroll/payouts/[id]/lock/route.ts`
**Lines:** 17-33

```typescript
// Line 17-20: Query without tenant context
const payout = await db.payout.findUnique({
  where: { id: payoutId },  // NO companyId verification
  select: { id: true, companyId: true, status: true },
})
// Line 33: Proceeds to lock without verifying user access to company
const updated = await lockPayout(payoutId, session.user.id)
```

**Impact:** Any authenticated user can lock payouts from ANY company by guessing/knowing payout IDs. No `setTenantContext()` or `runWithTenant()` is called, so Prisma middleware doesn't apply the automatic companyId filter.

**Severity:** CRITICAL
**CVSS Estimate:** 8.1 (High)

---

### 2. Payroll Payout Report - Missing Tenant Context

**File:** `src/app/api/payroll/payouts/[id]/report/route.ts`
**Lines:** 17-35

Identical vulnerability to above. An authenticated user can mark any company's payout as "reported to tax authority" without authorization.

**Severity:** CRITICAL
**CVSS Estimate:** 8.1 (High)

---

### 3. Contact OIB Uniqueness Check - Cross-Tenant Collision

**File:** `src/lib/actions/contact.ts`
**Lines:** 31-33, 97-102

```typescript
// Line 31-33: OIB check without explicit companyId
const existingContact = await db.contact.findFirst({
  where: { oib: validatedFields.data.oib },  // Missing companyId filter
})
```

**Context:** This runs inside `requireCompanyWithPermission()`, so tenant context IS set. However:
- The code comment says "Check for existing OIB within the same company"
- The actual query relies on implicit middleware filtering
- If middleware fails or is bypassed, cross-company OIB collision occurs

**Impact:**
- **With middleware working:** Low risk - fragile but functional
- **If middleware bypassed:** Company A cannot create contact with OIB that exists in Company B

**Severity:** MEDIUM (defense-in-depth concern)

---

## HIGH-RISK Findings

### 4. Metrics Endpoint - Unauthenticated System Metrics

**File:** `src/app/api/metrics/route.ts`
**Lines:** 8-22

```typescript
// No authentication check
export const GET = withApiLogging(async () => {
  const [userCount, companyCount, contactCount, invoiceCount, invoicesByStatus] =
    await Promise.all([
      db.user.count(),
      db.company.count(),
      db.contact.count(),
      db.eInvoice.count(),
      // ...
    ])
```

**Impact:** Exposes aggregate platform statistics (user count, company count, invoice count by status) to unauthenticated requests. Useful for reconnaissance.

**Severity:** LOW-MEDIUM (information disclosure)

---

### 5. Assistant Chat - Unvalidated Company ID from Client

**File:** `src/app/api/assistant/chat/route.ts`
**Lines:** 17-22, 50-61

```typescript
const chatRequestSchema = z.object({
  // ...
  companyId: z.string().uuid("Invalid company ID format").optional(),  // From client!
})
// Line 50-61: companyId passed to buildAnswer without validation
response = await buildAnswer(body.query.trim(), body.surface, body.companyId)
```

**Impact:** Client can potentially pass any companyId to influence assistant responses. Requires verification that `buildAnswer` only uses companyId for personalization context, not for data retrieval.

**Severity:** MEDIUM (requires deeper investigation of buildAnswer)

---

## Pattern Violations (Defense-in-Depth Concerns)

These queries work correctly due to Prisma tenant middleware but violate the explicit companyId pattern:

### 6. Support Ticket Actions - Implicit Filtering

**File:** `src/app/actions/support-ticket.ts`

| Line | Function | Issue |
|------|----------|-------|
| 184-185 | `getSupportTicket()` | `findFirst({ id })` without explicit companyId |
| 297-299 | `updateSupportTicket()` | `findFirst({ id })` without explicit companyId |
| 362-363 | `addSupportTicketMessage()` | `findFirst({ id })` without explicit companyId |
| 420-421 | `closeSupportTicket()` | `findFirst({ id })` without explicit companyId |
| 477-479 | `reopenSupportTicket()` | `findFirst({ id })` without explicit companyId |

**Note:** All these run inside `requireCompanyWithContext()`, so they ARE protected by middleware. However, explicit `companyId: company.id` in the WHERE clause is the recommended pattern for clarity and defense-in-depth.

---

## Properly Secured Areas

### API Routes (Verified Secure)
- `src/app/api/banking/reconciliation/route.ts` - Explicit companyId filtering
- `src/app/api/banking/reconciliation/match/route.ts` - Explicit companyId filtering
- `src/app/api/cash/route.ts` - Uses requireCompany + explicit filtering
- `src/app/api/staff/clients/[clientId]/route.ts` - Validates StaffAssignment before data access
- All routes using `requireCompanyWithContext()` or `requireCompanyWithPermission()`

### Background Workers (Verified Secure)
- Regulatory Truth workers - Process shared regulatory data (no tenant context needed)
- E-invoice poller - Uses explicit COMPANY_ID env var
- Bank sync cron - Iterates per-account with companyId in each operation

### Server Actions (Mostly Secure)
- `src/app/actions/expense.ts` - Explicit companyId checks
- `src/app/actions/banking.ts` - Uses runWithTenant + explicit checks
- `src/app/actions/premises.ts` - Explicit companyId in WHERE

---

## Architectural Observations

### Tenant Isolation Mechanism

The system uses a two-layer isolation approach:

1. **Prisma Middleware** (`src/lib/prisma-extensions.ts:1872-3363`)
   - Intercepts all queries on TENANT_MODELS
   - Auto-adds `companyId` filter when `getTenantContext()` returns non-null
   - TENANT_MODELS includes 60+ models (Contact, Invoice, Expense, Payout, etc.)

2. **Context Establishment** (`src/lib/auth-utils.ts`)
   - `requireCompanyWithContext()` wraps code in `runWithTenant()`
   - `requireCompanyWithPermission()` adds permission check + tenant context
   - `setTenantContext()` updates context within existing AsyncLocalStorage

**CRITICAL:** The middleware only works if context is established. Routes that skip `requireCompanyWithContext()` or `runWithTenant()` bypass ALL automatic filtering.

---

## Remediation Recommendations

### Immediate (P0) - Fix Critical Vulnerabilities

#### Payroll Routes
Add company verification to `src/app/api/payroll/payouts/[id]/lock/route.ts`:

```typescript
import { requireCompany } from "@/lib/auth-utils"

export async function POST(request: NextRequest, { params }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const company = await requireCompany(session.user.id)  // ADD THIS
  const { id: payoutId } = await params

  const payout = await db.payout.findUnique({
    where: { id: payoutId },
  })

  if (!payout || payout.companyId !== company.id) {  // ADD THIS CHECK
    return NextResponse.json({ error: "Payout not found" }, { status: 404 })
  }
  // ... rest of handler
}
```

Apply same fix to `src/app/api/payroll/payouts/[id]/report/route.ts`.

### Short-Term (P1) - Strengthen Defense-in-Depth

1. **Contact Actions:** Add explicit companyId to OIB uniqueness check
2. **Support Ticket Actions:** Add explicit `companyId: company.id` to all findFirst queries
3. **Metrics Endpoint:** Add authentication or restrict to internal network

### Medium-Term (P2) - Architectural Improvements

1. **ESLint Rule:** Flag `findFirst`/`findUnique` on TENANT_MODELS without explicit companyId
2. **Runtime Assertion:** Log warning when tenant context is null during TENANT_MODEL query
3. **Integration Tests:** Add cross-tenant access tests for all API routes

---

## Verification Checklist

- [ ] `src/app/api/payroll/payouts/[id]/lock/route.ts` - Add company verification
- [ ] `src/app/api/payroll/payouts/[id]/report/route.ts` - Add company verification
- [ ] `src/lib/actions/contact.ts:31-33` - Add explicit companyId to OIB check
- [ ] `src/lib/actions/contact.ts:97-102` - Add explicit companyId to OIB conflict check
- [ ] `src/app/actions/support-ticket.ts` - Add explicit companyId to all queries
- [ ] `src/app/api/metrics/route.ts` - Add authentication
- [ ] `src/app/api/assistant/chat/route.ts` - Validate companyId against user access

---

## Files Requiring Immediate Review

| File | Line(s) | Severity | Issue |
|------|---------|----------|-------|
| `src/app/api/payroll/payouts/[id]/lock/route.ts` | 17-33 | CRITICAL | No tenant context, cross-company modification |
| `src/app/api/payroll/payouts/[id]/report/route.ts` | 17-35 | CRITICAL | No tenant context, cross-company modification |
| `src/lib/actions/contact.ts` | 31-33, 97-102 | MEDIUM | Implicit filtering for OIB check |
| `src/app/api/metrics/route.ts` | 8-22 | LOW | Unauthenticated system metrics |
| `src/app/api/assistant/chat/route.ts` | 21, 50-61 | MEDIUM | Unvalidated client-provided companyId |

---

## Appendix: TENANT_MODELS List

Models automatically filtered by Prisma middleware (from `src/lib/prisma-extensions.ts:452-530`):

Contact, Organization, Address, TaxIdentity, Product, EInvoice, EInvoiceLine, RevenueRegisterEntry, InvoiceEvent, AuditLog, AccountingPeriod, Artifact, CashIn, CashOut, CashDayClose, CashLimitSetting, BankAccount, BankTransaction, MatchRecord, StatementImport, ImportJob, Statement, StatementPage, Transaction, Expense, ExpenseLine, UraInput, SupplierBill, Attachment, ExpenseCorrection, FixedAssetCandidate, FixedAsset, DisposalEvent, AssetCandidate, ExpenseCategory, RecurringExpense, SavedReport, SupportTicket, SupportTicketMessage, BusinessPremises, PaymentDevice, InvoiceSequence, ChartOfAccounts, JournalEntry, TrialBalance, PostingRule, OperationalEvent, AccountMapping, ExportProfile, ExportJob, Payout, PayoutLine, Payslip, JoppdSubmission, PayslipArtifact, CalculationSnapshot, AppliedRuleSnapshot, BankPaymentExport, BankPaymentLine, ReportingStatus, ReviewQueueItem, ReviewDecision, Employee, EmployeeRole, EmploymentContract, EmploymentContractVersion, EmploymentTerminationEvent, Dependent, Allowance, PensionPillar, Warehouse, StockItem, StockMovement, ValuationSnapshot

**Note:** CompanyUser intentionally excluded - filtered by userId, not companyId.
