# FiskAI Paušalni Obrt User Audit Report

**Date:** 2026-01-17
**Auditor:** Claude Code
**Test Company:** Test Obrt Paušalni (OIB: 11111111118)
**Company Type:** OBRT_PAUSAL (Paušalni obrt / Lump-sum sole proprietorship)

## Executive Summary

**Critical Finding:** 3 out of 11 core modules are completely broken with application errors. The app is **NOT production-ready** for paušalni obrt users.

### Status Overview

| Module         | Status     | Severity | Notes                                   |
| -------------- | ---------- | -------- | --------------------------------------- |
| Control Center | WORKS      | Minor    | English text, not localized             |
| Dashboard      | WORKS      | -        | Redirects to Control Center             |
| Contacts       | **BROKEN** | CRITICAL | Application error on load               |
| Products       | **BROKEN** | CRITICAL | Application error on load               |
| Invoices       | WORKS      | Medium   | "View-only" mode, limited functionality |
| E-Invoices     | **BROKEN** | CRITICAL | Application error on load               |
| Expenses       | WORKS      | Medium   | "Actions disabled" warning              |
| Documents      | WORKS      | -        | Fully functional                        |
| Paušalni Hub   | WORKS      | Minor    | Missing 60k revenue tracker             |
| Settings       | WORKS      | -        | Fully functional                        |
| Compliance     | WORKS      | -        | Fully functional                        |

## Critical Issues (P0 - Must Fix)

### 1. Contacts Module Completely Broken

- **URL:** `/contacts`
- **Error:** "Greška u aplikaciji" (Application Error)
- **Impact:** Users cannot manage customer contacts - **blocks invoicing workflow**
- **Screenshot:** `docs/audits/pausalni-audit-contacts-ERROR.png`
- **Root cause:** Client-side React rendering error (HTTP 200 but ErrorBoundary triggers)

### 2. Products Module Completely Broken

- **URL:** `/products`
- **Error:** "Greška u aplikaciji" (Application Error)
- **Impact:** Users cannot manage products/services - **blocks invoicing workflow**

### 3. E-Invoices Module Completely Broken

- **URL:** `/e-invoices`
- **Error:** "Greška u aplikaciji" (Application Error)
- **Impact:** Users cannot send/receive e-invoices - **critical for B2B/B2G compliance**

## High Priority Issues (P1)

### 4. Invoices Module in "View-Only" Mode

- **URL:** `/invoices`
- **Message:** "Legacy view. View-only. Create invoices from Control Center."
- **Impact:** Confusing UX - users need to create invoices but are told they can't from this page
- **Recommendation:** Either enable invoice creation here or provide clearer guidance

### 5. Expenses Module Actions Disabled

- **URL:** `/expenses`
- **Message:** "Legacy view. Actions are disabled."
- **Impact:** Users can view but cannot manage expenses
- **Recommendation:** Enable expense management for paušalni users

### 6. Onboarding Shows Wrong Pricing Plans

- **URL:** `/onboarding` (Step 5: Plan & Billing)
- **Issue:** Shows D.O.O. plans (99€/199€) instead of Paušalni plans
- **Impact:** Confusing for paušalni users, may lead to wrong plan selection

## Medium Priority Issues (P2)

### 7. Localization Inconsistencies

- **Control Center:** English headings ("What Needs Attention", "Draft Invoices", etc.)
- **Invoices/Expenses:** English banner ("Legacy view...")
- **Expected:** All text should be in Croatian for Croatian users

### 8. Missing 60k Revenue Tracker in Paušalni Hub

- **Per Product Bible:** Paušalni users should have "60k limit tracker" feature
- **Current state:** Hub shows payment obligations but no revenue tracking
- **Impact:** Key feature for paušalni compliance (60k€ annual revenue limit)

### 9. Missing PO-SD Form Generator

- **Per Product Bible:** Should have "PO-SD Generator" feature
- **Current state:** Not visible in Paušalni Hub
- **Impact:** Users need this for annual tax declaration

## Minor Issues (P3)

### 10. Support Link 404

- **URL:** `/kontakt` returns 404
- **Impact:** Users on error pages can't reach support
- **Recommendation:** Fix route or update link

### 11. Dashboard/Control Center Confusion

- Both "Kontrolni centar" and "Nadzorna ploča" exist in navigation
- Both redirect to `/cc` showing same content
- **Recommendation:** Clarify purpose or consolidate

## Working Features

### Control Center (/cc)

- Shows capability-driven view with sections:
  - Draft Invoices
  - Pending Fiscalization
  - Unmatched Transactions
  - Unpaid Invoices
  - Unpaid Expenses
- Empty states display correctly

### Documents (/documents)

- Full Croatian localization
- File upload (drag & drop + button)
- Category filtering (All, Računi, E-Računi, Izvodi, Troškovi)
- Search functionality
- Document processing queue

### Paušalni Hub (/pausalni)

- Shows compliance overview
- Payment stats (Za platiti, Uskoro dospijeva, Prekoračeno, Plaćeno)
- "Generiraj mjesečne uplatnice" button
- Croatian localization

### Settings (/settings)

- Full company profile editing
- Tabs: Tvrtka, E-računi, Sigurnost, Plan, Beta, Usklađenost
- Audit log access
- All form fields functional

### Compliance (/compliance)

- FINA certificate status
- Fiscalization statistics
- Compliance checklist with action links
- Important dates (B2B: Jan 2026, B2G: Jul 2026)
- Reporting status
- Period locking

## Technical Investigation

### Error Pattern Analysis

- All broken modules (Contacts, Products, E-Invoices) show identical error
- HTTP requests return 200 OK
- Error occurs during client-side React hydration/rendering
- ErrorBoundary catches and displays generic error message

### Recommended Investigation Steps

1. Check server logs for the RSC (React Server Components) rendering
2. Look for data fetching errors in the page components
3. Check if there's a shared hook or context causing the crash
4. Verify database queries for these modules work for OBRT_PAUSAL companies

## Screenshots Captured

- `docs/audits/pausalni-audit-control-center.png`
- `docs/audits/pausalni-audit-contacts-ERROR.png`
- `docs/audits/pausalni-audit-pausalni-hub.png`

## Recommendations

### Immediate Actions

1. **Fix Contacts module** - Without this, users cannot create invoices with proper customer data
2. **Fix Products module** - Without this, users cannot add line items to invoices
3. **Fix E-Invoices module** - Required for upcoming B2B/B2G compliance deadlines

### Short-term Actions

4. Enable invoice creation from Invoices page (or remove confusing "view-only" message)
5. Enable expense management actions
6. Fix onboarding to show correct Paušalni pricing plans
7. Complete Croatian localization for Control Center

### Medium-term Actions

8. Implement 60k revenue tracker for paušalni users
9. Implement PO-SD form generator
10. Fix /kontakt route
11. Consolidate Dashboard/Control Center navigation

---

**Conclusion:** The application has critical bugs that make it unusable for paušalni obrt users. The core workflow (manage contacts → manage products → create invoices → send e-invoices) is broken at multiple points. These issues must be resolved before real users can effectively use the application.
