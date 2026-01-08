# Legal Form Gating Audit

**Date:** 2026-01-08
**Auditor:** Claude (Opus 4.5)
**Scope:** Verify that Fiskalizacija, VAT, corporate tax, and subsidiary logic are structurally impossible to activate for the wrong legal form.

---

## Executive Summary

**Status: CRITICAL GAPS IDENTIFIED**

The audit found significant mismatches between UI visibility rules and backend authorization. While the UI correctly hides features based on legal form, many API routes and server actions lack equivalent backend enforcement, allowing potential bypass via direct API calls.

### Key Findings

| Feature | UI Gating | Backend Enforcement | Status |
|---------|-----------|---------------------|--------|
| Pausalni Hub | Direct `legalForm` check | API routes check `legalForm` | **SECURE** |
| VAT Reports | `protectRoute("page:vat")` | **NO legal form check** | **GAP** |
| Corporate Tax | Direct `legalForm` check | Page-level check only | **PARTIAL** |
| Fiscalization | No UI gating | **NO legal form check** | **GAP** |
| Module Entitlements | Assigned at onboarding | **NOT enforced in APIs** | **GAP** |
| Subsidiary Logic | N/A (not implemented) | N/A | N/A |

---

## 1. Legal Form Model

### 1.1 Legal Form Enum Values

**Source:** `src/domain/identity/LegalForm.ts` and `src/lib/capabilities.ts`

| Enum Value | Display Name | Description |
|------------|--------------|-------------|
| `OBRT_PAUSAL` | Obrt (pausalni) | Sole proprietor with flat-rate taxation |
| `OBRT_REAL` | Obrt (realni) | Sole proprietor with real income taxation |
| `OBRT_VAT` | Obrt (VAT) | Sole proprietor registered for VAT |
| `JDOO` | j.d.o.o. | Simplified limited liability company |
| `DOO` | d.o.o. | Limited liability company |

### 1.2 Entitlements by Legal Form

**Source:** `src/lib/modules/definitions.ts:188-222`

```typescript
OBRT_PAUSAL: [...base, "pausalni"]
OBRT_REAL:   [...base, "expenses"]
OBRT_VAT:    [...base, "vat", "expenses"]
JDOO:        [...base, "vat", "corporate-tax", "reports-advanced"]
DOO:         [...base, "vat", "corporate-tax", "reports-advanced", "reconciliation"]
```

**Critical Finding:** Entitlements are assigned at company creation but **NOT enforced in API routes**.

---

## 2. Audit by Feature

### 2.1 Pausalni Module

**UI Gating:**
- **Page:** `src/app/(app)/pausalni/page.tsx:15` - Direct `legalForm !== "OBRT_PAUSAL"` check
- **Visibility:** `BUSINESS_TYPE_HIDDEN` matrix hides `card:pausalni-status` for non-OBRT_PAUSAL

**Backend Enforcement:**
- **API routes:** `src/app/api/pausalni/forms/route.ts:52-54` checks `company.legalForm !== "OBRT_PAUSAL"`
- All pausalni API routes have consistent legal form checks

**Status: SECURE**

The pausalni module correctly enforces legal form at both UI and API levels.

---

### 2.2 VAT Module

**UI Gating:**
- **Page:** `src/app/(app)/reports/vat/page.tsx:16` - Uses `protectRoute("page:vat")`
- **Visibility Rules:** `src/lib/visibility/rules.ts:78-99`
  - `OBRT_PAUSAL`: Hidden `page:vat`, `nav:vat`, `card:vat-overview`
  - `OBRT_REAL`: Hidden `page:vat`, `nav:vat`, `card:vat-overview`

**Backend Enforcement:**
- **VAT PDF route:** `src/app/api/reports/vat/pdf/route.ts:19`
  - Uses `requireCompanyWithPermission(user.id!, "reports:export", ...)`
  - **NO legal form or VAT payer check**
- **VAT XML route:** Similar - only RBAC permission check
- **VAT Excel route:** Similar - only RBAC permission check

**Status: GAP - UI-ONLY GATING**

**Risk:** An `OBRT_PAUSAL` company can bypass UI and directly call:
```
GET /api/reports/vat/pdf
GET /api/reports/vat/xml
GET /api/reports/vat/excel
```

These routes will generate VAT reports even for companies that should not have VAT access.

**Recommendation:** Add to VAT API routes:
```typescript
if (!["OBRT_VAT", "JDOO", "DOO"].includes(company.legalForm || "")) {
  return NextResponse.json({ error: "VAT module not available for this legal form" }, { status: 403 })
}
```

---

### 2.3 Corporate Tax Module

**UI Gating:**
- **Page:** `src/app/(app)/corporate-tax/page.tsx:17-19`
  ```typescript
  if (company.legalForm !== "DOO" && company.legalForm !== "JDOO") {
    redirect("/")
  }
  ```
- **Visibility Rules:** `BUSINESS_TYPE_HIDDEN` hides `page:corporate-tax` for all OBRT types

**Backend Enforcement:**
- **NO API routes found** for corporate tax - page-level only
- Data fetching via `fetchCorporateTaxBaseInputs()` happens after page-level check

**Status: PARTIAL**

The page correctly gates access, but if API routes are added later, they need explicit enforcement.

**Recommendation:** Document the pattern requirement for any future corporate tax API routes.

---

### 2.4 Fiskalizacija

**UI Gating:**
- No specific UI visibility rules for fiscalization based on legal form
- Fiscalization is available to all company types (business decision, not legal requirement)

**Backend Enforcement:**
- **Fiscalize action:** `src/app/actions/fiscalize.ts:30-31`
  ```typescript
  const user = await requireAuth()
  const company = await requireCompany(user.id!)
  // NO legal form check
  // NO entitlement check for "fiscalization" module
  ```

- **Fiscal rules endpoint:** `src/app/api/fiscal/rules/calculate/route.ts`
  - **COMPLETELY UNAUTHENTICATED** - No auth check at all
  - Public endpoint that calculates fiscal rules

**Status: GAP**

**Issues:**
1. `fiscalizeInvoice()` action has no legal form gating (intentional - all types can fiscalize)
2. `fiscalization` module entitlement is NOT checked
3. `/api/fiscal/rules/calculate` is public (security concern, though read-only)

**Recommendation:**
1. Add entitlement check to fiscalize action:
   ```typescript
   import { isModuleEnabled } from "@/lib/modules/permissions"

   if (!isModuleEnabled(company.entitlements, "fiscalization")) {
     return { success: false, error: "Fiskalizacija module not enabled" }
   }
   ```
2. Add authentication to `/api/fiscal/rules/calculate` if it contains sensitive data

---

### 2.5 Subsidiary/Holding Company Logic

**Finding:** No subsidiary or holding company logic exists in the codebase.

**Search terms checked:**
- subsidiary, holding, parent company, child company, koncern, matična, podružnica

**Result:** Only documentation references found (content MDX files), no functional implementation.

**Status: N/A** - Not applicable as feature doesn't exist.

---

## 3. UI-Only Gating Without Backend Enforcement

### 3.1 Complete List of Gaps

| Element ID | UI Hidden For | API Route | Backend Check |
|------------|---------------|-----------|---------------|
| `page:vat` | OBRT_PAUSAL, OBRT_REAL | `/api/reports/vat/*` | **MISSING** |
| `nav:vat` | OBRT_PAUSAL, OBRT_REAL | N/A (nav only) | N/A |
| `card:vat-overview` | OBRT_PAUSAL, OBRT_REAL | N/A (card only) | N/A |
| `page:corporate-tax` | OBRT_* types | No API routes | Page-level only |
| `nav:corporate-tax` | OBRT_* types | N/A (nav only) | N/A |
| `card:corporate-tax` | OBRT_* types | N/A (card only) | N/A |
| Module: fiscalization | Not gated | Fiscalize action | **MISSING** |

### 3.2 Entitlement System Gap

**Source:** `src/lib/modules/permissions.ts`

The module entitlement system has well-designed functions:
- `isModuleEnabled(entitlements, moduleKey)`
- `hasPermission(entitlements, moduleKey, action)`
- `getModulePermissions(entitlements, moduleKey)`

**Problem:** These functions are **NOT called in any API routes**.

**Current enforcement:**
- RBAC permissions (`requireCompanyWithPermission`) - role-based only
- `requireAuth()` / `requireCompany()` - authentication only

**Missing:**
- Module entitlement enforcement
- Legal form validation in API routes

---

## 4. Authorization Flow Analysis

### 4.1 Current Flow

```
User Request → API Route
                  ↓
              requireAuth() ← Checks session
                  ↓
              requireCompany() ← Gets company, checks onboarding
                  ↓
              requireCompanyWithPermission() ← Checks RBAC role
                  ↓
              Business Logic ← NO entitlement check
```

### 4.2 Required Flow

```
User Request → API Route
                  ↓
              requireAuth()
                  ↓
              requireCompany()
                  ↓
              requireCompanyWithPermission()
                  ↓
              checkModuleEntitlement() ← NEW: Check module is enabled
                  ↓
              checkLegalFormRestriction() ← NEW: Check legal form allows action
                  ↓
              Business Logic
```

---

## 5. Recommendations

### 5.1 Critical (P0)

1. **Add legal form check to VAT API routes**
   - Files: `src/app/api/reports/vat/*.ts`
   - Check: `["OBRT_VAT", "JDOO", "DOO"].includes(company.legalForm)`

2. **Create `requireModuleAccess` utility**
   ```typescript
   // src/lib/auth-utils.ts
   export async function requireModuleAccess(
     companyId: string,
     moduleKey: ModuleKey
   ): Promise<void> {
     const company = await db.company.findUnique({
       where: { id: companyId },
       select: { entitlements: true }
     })
     if (!isModuleEnabled(company?.entitlements, moduleKey)) {
       throw new Error(`Module ${moduleKey} not enabled`)
     }
   }
   ```

3. **Add entitlement check to fiscalization action**
   - File: `src/app/actions/fiscalize.ts`
   - Add: `isModuleEnabled(company.entitlements, "fiscalization")`

### 5.2 High Priority (P1)

4. **Authenticate fiscal rules endpoint**
   - File: `src/app/api/fiscal/rules/calculate/route.ts`
   - Add: `requireAuth()` at minimum

5. **Create middleware for module enforcement**
   - New file: `src/lib/middleware/module-access.ts`
   - Pattern: Map API routes to required modules

### 5.3 Medium Priority (P2)

6. **Add integration tests for entitlement bypass**
   - Test: OBRT_PAUSAL calling VAT endpoints
   - Test: Non-entitled company calling module-specific routes

7. **Document enforcement patterns**
   - Update CLAUDE.md with authorization requirements
   - Create enforcement checklist for new routes

---

## 6. Files Requiring Changes

### Immediate Fixes

| File | Change Required |
|------|-----------------|
| `src/app/api/reports/vat/pdf/route.ts` | Add legal form check |
| `src/app/api/reports/vat/xml/route.ts` | Add legal form check |
| `src/app/api/reports/vat/excel/route.ts` | Add legal form check |
| `src/app/api/reports/vat/return/route.ts` | Add legal form check |
| `src/app/actions/fiscalize.ts` | Add entitlement check |
| `src/app/api/fiscal/rules/calculate/route.ts` | Add authentication |

### New Files Needed

| File | Purpose |
|------|---------|
| `src/lib/auth-utils.ts` | Add `requireModuleAccess()` function |
| `src/__tests__/entitlement-bypass.test.ts` | Test for API bypass scenarios |

---

## 7. Verification Checklist

After implementing fixes, verify:

- [ ] OBRT_PAUSAL cannot access `/api/reports/vat/*` routes
- [ ] OBRT_REAL cannot access `/api/reports/vat/*` routes
- [ ] Non-DOO/JDOO cannot access corporate tax (if APIs added)
- [ ] Companies without `fiscalization` entitlement cannot fiscalize
- [ ] `/api/fiscal/rules/calculate` requires authentication
- [ ] All module-specific routes check entitlements

---

## Appendix A: Legal Form to Entitlement Mapping

```typescript
// From src/lib/modules/definitions.ts
const LEGAL_FORM_ENTITLEMENTS = {
  OBRT_PAUSAL: ["platform-core", "invoicing", "e-invoicing", "contacts",
                "products", "expenses", "documents", "reports-basic", "pausalni"],
  OBRT_REAL:   ["platform-core", "invoicing", "e-invoicing", "contacts",
                "products", "expenses", "documents", "reports-basic", "expenses"],
  OBRT_VAT:    ["platform-core", "invoicing", "e-invoicing", "contacts",
                "products", "expenses", "documents", "reports-basic", "vat", "expenses"],
  JDOO:        ["platform-core", "invoicing", "e-invoicing", "contacts",
                "products", "expenses", "documents", "reports-basic",
                "vat", "corporate-tax", "reports-advanced"],
  DOO:         ["platform-core", "invoicing", "e-invoicing", "contacts",
                "products", "expenses", "documents", "reports-basic",
                "vat", "corporate-tax", "reports-advanced", "reconciliation"],
}
```

## Appendix B: Visibility Rules Matrix

```typescript
// From src/lib/visibility/rules.ts
const BUSINESS_TYPE_HIDDEN = {
  OBRT_PAUSAL: ["card:vat-overview", "nav:vat", "page:vat",
                "card:corporate-tax", "nav:corporate-tax", "page:corporate-tax"],
  OBRT_REAL:   ["card:vat-overview", "nav:vat", "page:vat", "card:pausalni-status",
                "card:corporate-tax", "nav:corporate-tax", "page:corporate-tax"],
  OBRT_VAT:    ["card:pausalni-status",
                "card:corporate-tax", "nav:corporate-tax", "page:corporate-tax"],
  JDOO:        ["card:pausalni-status", "card:doprinosi", "nav:doprinosi",
                "page:doprinosi", "card:posd-reminder"],
  DOO:         ["card:pausalni-status", "card:doprinosi", "nav:doprinosi",
                "page:doprinosi", "card:posd-reminder"],
}
```

---

**End of Audit Report**
