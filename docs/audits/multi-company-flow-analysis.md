# Multi-Company User Flow Analysis

> **Audit Date:** 2025-01-08
> **Scope:** Trace active company selection, storage, persistence, and switching mechanisms
> **Finding:** Architecture is secure; UX edge cases identified

## Executive Summary

The FiskAI multi-company architecture correctly prevents cross-tenant data access through Prisma middleware-based tenant isolation. However, race conditions during company switching can cause confusing user experiences when UI state becomes stale.

**Security Status:** ✅ No data leakage vulnerabilities identified
**UX Status:** ⚠️ Edge cases cause confusing errors after background company switches

---

## Architecture Overview

### How Company Context is Stored

| Component | Storage Mechanism | Scope |
|-----------|-------------------|-------|
| User Identity | JWT Cookie (`.fiskai.hr` domain) | Cross-subdomain |
| System Role | JWT Cookie | Cross-subdomain |
| Active Company | `CompanyUser.isDefault` in DB | Per-user |
| Request Context | AsyncLocalStorage | Per-request |

**Key Design Decision:** Company ID is NOT stored in cookies or JWT. It's always fetched fresh from the database on each request via `getCurrentCompany(userId)` which queries `WHERE isDefault = true`.

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. User authenticates → JWT stored in cookie                    │
│ 2. Each server action calls requireCompany(userId)              │
│    └─ Queries: SELECT company FROM CompanyUser                  │
│       WHERE userId = X AND isDefault = true                     │
│ 3. Company context set via runWithTenant({ companyId, userId }) │
│ 4. Prisma middleware auto-injects companyId to all queries      │
└─────────────────────────────────────────────────────────────────┘
```

### Key Files

| Purpose | Location |
|---------|----------|
| Company switch action | `src/lib/actions/company-switch.ts` |
| Company resolution | `src/lib/auth-utils.ts:68-140` |
| Tenant isolation middleware | `src/lib/prisma-extensions.ts:1872-2100` |
| Company switcher UI | `src/components/layout/company-switcher.tsx` |
| Choose company page | `src/app/(app)/onboarding/choose-company/page.tsx` |

---

## Company Switching Mechanism

### Database Schema

```prisma
model CompanyUser {
  id        String   @id @default(cuid())
  userId    String
  companyId String
  role      Role     @default(MEMBER)
  isDefault Boolean  @default(false)  // ← Only ONE per user can be true

  @@unique([userId, companyId])
}
```

### Switch Operation (Atomic)

```typescript
// src/lib/actions/company-switch.ts
await db.$transaction([
  // Step 1: Clear ALL previous defaults
  db.companyUser.updateMany({
    where: { userId: user.id },
    data: { isDefault: false },
  }),
  // Step 2: Set new default
  db.companyUser.update({
    where: { id: companyUser.id },
    data: { isDefault: true },
  }),
])

revalidatePath("/")  // Invalidate Next.js cache
```

**Safety:** Transaction ensures exactly one default company at any time.

---

## Tenant Isolation Implementation

### Prisma Middleware (`withTenantIsolation`)

The middleware automatically injects `companyId` filter into all queries for tenant-scoped models:

```typescript
// Simplified from src/lib/prisma-extensions.ts
async findFirst({ model, args, query }) {
  const context = getTenantContext()
  if (context && TENANT_MODELS.includes(model)) {
    args.where = {
      ...args.where,
      companyId: context.companyId,  // Auto-injected!
    }
  }
  return query(args)
}
```

### Protected Models (TENANT_MODELS)

All 50+ business models are protected including:
- `EInvoice`, `EInvoiceLine`
- `Contact`, `Organization`
- `Product`
- `Expense`, `ExpenseLine`
- `BankAccount`, `BankTransaction`
- `SupportTicket`
- `BusinessPremises`, `PaymentDevice`
- And many more...

### Verification Pattern in Server Actions

Most actions use double protection:

```typescript
// Pattern 1: Rely on middleware (inside runWithTenant)
return requireCompanyWithContext(userId, async (company) => {
  const invoice = await db.eInvoice.findFirst({
    where: { id }  // companyId auto-added by middleware
  })
})

// Pattern 2: Explicit + middleware (belt and suspenders)
const invoice = await db.eInvoice.findFirst({
  where: { id, companyId: company.id }  // Explicit check
})
```

---

## Identified Failure Modes

### 1. Race Condition During Company Switch (Medium Severity)

**Scenario:**
1. User has Company A as default, views invoice INV-001
2. User switches to Company B in another tab
3. User clicks "Fiscalize" on INV-001 in original tab

**Result:**
- Server action fetches Company B (new default)
- Query: `WHERE id='INV-001' AND companyId='company-B'`
- Invoice not found → Confusing error message

**Impact:** UX confusion, no data leakage

### 2. Deep Link Access After Company Change (Medium Severity)

**Scenario:**
1. User bookmarks `/invoices/INV-001` (Company A)
2. User's default changes to Company B
3. User clicks bookmark

**Result:** 404 "Not Found" for a valid resource

**Impact:** Bookmarks break silently

### 3. Form Submission with Stale References (Medium Severity)

**Scenario:**
1. User opens "Create Invoice" form with Company A
2. User selects Contact from Company A's list
3. Company switches to B in background
4. User submits form

**Result:** "Contact not found" error (Contact ID valid only in Company A)

**Impact:** Lost form data, user confusion

---

## Step-by-Step Reproducible Failure

```
PRECONDITIONS:
- User "marko@example.com" is member of:
  - Company A (OIB: 12345678901) - currently default
  - Company B (OIB: 98765432109)
- Company A has invoice INV-2024-0001

REPRODUCTION:
1. Login as marko@example.com
2. Navigate to /invoices → See Company A's invoices
3. Click on INV-2024-0001 → Invoice detail page loads
4. Open new browser tab, navigate to /invoices
5. Click company switcher → Select Company B
6. See toast: "Aktivna tvrtka promijenjena"
7. Return to first tab (still showing INV-2024-0001)
8. Click "Fiskaliziraj" button

EXPECTED (IDEAL):
- Warning about company context change, OR
- Action succeeds for the visible invoice

ACTUAL:
- Error: "Račun nije pronađen" (Invoice not found)
- Invoice is still visible on screen
- No indication that company changed
```

---

## Recommendations

### Short-term: Add Company Context Validation

Pass expected company ID from client to validate server-side:

```typescript
// Client sends current company context
const result = await fiscalizeInvoice(invoiceId, {
  expectedCompanyId: currentCompanyId
})

// Server validates
if (expectedCompanyId && company.id !== expectedCompanyId) {
  return {
    error: "COMPANY_CONTEXT_CHANGED",
    message: "Aktivna tvrtka je promijenjena. Osvježite stranicu."
  }
}
```

### Medium-term: Cross-Tab Synchronization

Use BroadcastChannel API to sync company changes:

```typescript
// After successful switch
const channel = new BroadcastChannel('fiskai-company-switch')
channel.postMessage({ companyId: newCompanyId, timestamp: Date.now() })

// In other tabs
channel.onmessage = (e) => {
  if (e.data.companyId !== currentCompanyId) {
    toast.warning("Tvrtka promijenjena u drugoj kartici")
    router.refresh()
  }
}
```

### Long-term: Company-Scoped URLs

Include company identifier in URLs for unambiguous resource access:

```
Current:  /invoices/[id]
Proposed: /c/[companySlug]/invoices/[id]

Example:  /c/acme-doo/invoices/INV-2024-0001
```

This makes deep links resilient to company context changes.

---

## Security Audit Summary

| Aspect | Status | Evidence |
|--------|--------|----------|
| Data Isolation | ✅ Secure | Prisma middleware enforces companyId on all TENANT_MODELS |
| Cross-Company Reads | ✅ Secure | findFirst/findMany auto-filtered; findUnique verified post-fetch |
| Cross-Company Writes | ✅ Secure | create operations inject companyId from context |
| Session Security | ✅ Secure | JWT + HttpOnly cookie on `.fiskai.hr` domain |
| Company Switch | ✅ Secure | Atomic DB transaction prevents dual defaults |
| Permission Checks | ✅ Secure | `requireCompanyWithPermission` validates RBAC before actions |

---

## Test Coverage

Existing tests in `src/lib/__tests__/tenant-isolation.test.ts` cover:
- ✅ Context isolation via AsyncLocalStorage
- ✅ Concurrent request isolation
- ✅ Auto-injection of companyId filters
- ✅ Cross-tenant read prevention
- ✅ Cross-tenant write prevention
- ✅ Aggregate operation isolation

**Gap:** No tests for race conditions during company switch (integration-level concern).

---

## Conclusion

The multi-company architecture is **secure by design**. The Prisma middleware provides robust tenant isolation that prevents data leakage even when UI state is stale.

The identified failure modes are **UX issues**, not security vulnerabilities:
- Actions fail safely with "not found" errors
- No cross-tenant data exposure occurs
- Users experience confusion, not data breaches

Implementing the recommended improvements would enhance user experience for users with multiple company memberships.
