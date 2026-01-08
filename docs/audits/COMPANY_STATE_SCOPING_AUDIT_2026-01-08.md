# Company State Scoping Audit Report

**Date:** 2026-01-08
**Status:** CRITICAL ISSUES IDENTIFIED
**Severity:** HIGH - Potential cross-company data leakage

---

## Executive Summary

This audit examines frontend state management to identify scenarios where UI could show data from Company A while actions apply to Company B. **Several critical issues were found:**

1. **Zustand stores persist data across company switches** - localStorage keys are not company-scoped
2. **SWR cache keys lack company context** - Stale data persists after company switch
3. **No global cache invalidation on company switch** - Client state becomes stale

**Risk Assessment:** While server-side actions properly verify company ownership (preventing unauthorized access), the UI can display stale data from a previous company context, leading to confusion and potential user errors.

---

## Architecture Overview

### State Management Solutions in Use

| Solution | Purpose | Company-Scoped? |
|----------|---------|-----------------|
| Zustand + localStorage | Persistent client state | **NO** |
| SWR | Data fetching + caching | **NO** |
| React Context | UI configuration | Server-injected per request |
| sessionStorage | Staff client selection | Session-level only |

### Key Files Analyzed

- `src/stores/compliance-store.ts` - Compliance tracking
- `src/stores/visitor-store.ts` - Pre-auth journey
- `src/lib/stores/onboarding-store.ts` - Company onboarding
- `src/hooks/use-capabilities.ts` - Capabilities fetching
- `src/hooks/use-capability-resolution.ts` - Capability resolution
- `src/contexts/GuidanceContext.tsx` - Help system
- `src/lib/visibility/context.tsx` - Feature visibility
- `src/components/layout/company-switcher.tsx` - Company switching

---

## Critical Issues

### Issue 1: Compliance Store Not Company-Scoped

**File:** `src/stores/compliance-store.ts:112-114`

```typescript
persist(
  // ... state
  {
    name: "fiskai-compliance",  // PROBLEM: Same key for all companies
  }
)
```

**Impact:**
- User with multiple companies sees compliance checklist from Company A when viewing Company B
- Completed compliance steps may incorrectly show as complete for the wrong company
- Deadline acknowledgments persist across company contexts

**Risk Level:** HIGH

**Reproduction:**
1. User logs in with Company A as default
2. Completes compliance steps for Company A
3. Switches to Company B
4. Compliance store still shows Company A's completed steps

---

### Issue 2: Onboarding Store Not Company-Scoped

**File:** `src/lib/stores/onboarding-store.ts:155-162`

```typescript
persist(
  // ... state
  {
    name: "fiskai-onboarding",  // PROBLEM: Same key for all companies
    partialize: (state) => ({
      currentStep: state.currentStep,
      data: state.data,
    }),
  }
)
```

**Impact:**
- Onboarding form data from one company bleeds into another
- User could submit incorrect OIB, legal form, or tax settings
- Data integrity risk when creating new companies

**Risk Level:** HIGH

**Reproduction:**
1. User starts onboarding Company A (OBRT_PAUSAL)
2. Fills in OIB, name, legal form
3. Before completing, creates Company B (DOO)
4. Onboarding store still has Company A's data pre-filled

---

### Issue 3: SWR Cache Keys Lack Company Context

**File:** `src/hooks/use-capabilities.ts:9-13`

```typescript
const { data } = useSWR<Capabilities>("/api/capabilities", fetcher, {
  fallbackData: initial,
})
```

**File:** `src/hooks/use-capability-resolution.ts:55-60`

```typescript
function buildCacheKey(opts: UseCapabilityResolutionOptions): string {
  const parts = [CAPABILITY_CACHE_PREFIX, ...opts.capabilityIds.slice().sort()]
  if (opts.entityId) parts.push(`entity:${opts.entityId}`)
  if (opts.entityType) parts.push(`type:${opts.entityType}`)
  return parts.join(":")  // PROBLEM: No companyId in cache key
}
```

**Impact:**
- After company switch, SWR returns cached capabilities from previous company
- UI shows incorrect entitlements until cache expires or is manually invalidated
- Features may appear enabled/disabled incorrectly

**Risk Level:** MEDIUM (server-side validation prevents unauthorized actions)

---

### Issue 4: Company Switcher Does Not Invalidate Client State

**File:** `src/components/layout/company-switcher.tsx:40-52`

```typescript
const handleSwitch = (companyId: string) => {
  startTransition(async () => {
    const result = await switchCompany(companyId)
    if (result?.success) {
      toast.success(...)
      router.refresh()  // Only refreshes RSC, not client caches
    }
    // PROBLEM: No SWR cache clear
    // PROBLEM: No Zustand store reset
    setIsOpen(false)
  })
}
```

**Impact:**
- `router.refresh()` only refreshes React Server Components
- Client-side SWR cache retains stale data
- Zustand stores retain previous company's data
- GuidanceContext state not refreshed

**Risk Level:** HIGH

---

### Issue 5: Banking Reconciliation State Mismatch Risk

**File:** `src/app/(app)/banking/reconciliation/dashboard-client.tsx:41-56`

```typescript
const [selectedAccount, setSelectedAccount] = useState(
  defaultBankAccountId || accounts[0]?.id || ""
)

const queryKey = useMemo(() => {
  if (!selectedAccount) return null
  const params = new URLSearchParams({
    bankAccountId: selectedAccount,
    matchStatus: statusFilter,
  })
  return `/api/banking/reconciliation?${params}`
}, [selectedAccount, statusFilter])
```

**Issue:**
- `selectedAccount` persists in component state after company switch
- If user doesn't unmount, could attempt to query old company's bank account
- API should reject (server-side validation), but UX is degraded

**Risk Level:** LOW (server validates, but poor UX)

---

## Security Analysis

### Server-Side Protections (WORKING)

Server actions properly validate company ownership:

```typescript
// src/app/actions/invoice.ts - Example of proper validation
const invoice = await db.eInvoice.findFirst({
  where: {
    id: validatedInvoiceId,
    companyId: company.id,  // Company from auth context
  },
})
```

All server actions use `requireCompanyWithContext` or similar patterns that:
1. Get company from authenticated session
2. Verify user has access to company
3. Scope all database queries to that company

**Result:** Even if UI shows wrong data, server rejects cross-company mutations.

### Client-Side Protections (MISSING)

| Protection | Status |
|------------|--------|
| Company-scoped localStorage keys | MISSING |
| Company-scoped SWR cache keys | MISSING |
| Cache invalidation on switch | MISSING |
| Store reset on switch | MISSING |

---

## Scenarios: UI Shows A, Actions Apply to B

### Scenario 1: Compliance Mismatch

1. User logs in → Company A default
2. Views compliance dashboard → shows A's data
3. Marks "bank-account" step complete → stored in Zustand
4. Switches to Company B via company-switcher
5. Views compliance dashboard → **still shows A's completed steps**
6. User thinks B's compliance is done when it isn't

### Scenario 2: Capabilities Stale Cache

1. User logs in with Company A (has `fiscalization` entitlement)
2. SWR caches capabilities at key `/api/capabilities`
3. Switches to Company B (no `fiscalization` entitlement)
4. RSC refreshes but SWR cache not cleared
5. UI shows `fiscalization` as available
6. User clicks fiscalize → server rejects (no capability)
7. User confused about why "available" action failed

### Scenario 3: Onboarding Data Leak

1. User creates Company A via onboarding
2. Fills legal form as OBRT_PAUSAL, enters OIB
3. Navigates away before completing
4. Creates new Company B (different legal form)
5. Onboarding shows A's data pre-filled
6. User accidentally submits wrong OIB/legal form

---

## Recommendations

### Immediate (High Priority)

#### 1. Add Company ID to Zustand Storage Keys

```typescript
// src/stores/compliance-store.ts
export const useComplianceStore = create<ComplianceState>()(
  persist(
    (set, _get) => ({...}),
    {
      name: "fiskai-compliance",
      // Add partialize to include companyId in key
    }
  )
)

// Better: Create company-scoped store factory
export function createComplianceStore(companyId: string) {
  return create<ComplianceState>()(
    persist(
      (set) => ({...}),
      { name: `fiskai-compliance-${companyId}` }
    )
  )
}
```

#### 2. Add Company ID to SWR Cache Keys

```typescript
// src/hooks/use-capabilities.ts
export function useCapabilities(initial?: Capabilities, companyId?: string) {
  const cacheKey = companyId
    ? `/api/capabilities?companyId=${companyId}`
    : null

  const { data } = useSWR<Capabilities>(cacheKey, fetcher, {
    fallbackData: initial,
  })
  return data ?? deriveCapabilities(null)
}
```

#### 3. Invalidate All Caches on Company Switch

```typescript
// src/components/layout/company-switcher.tsx
import { mutate } from "swr"
import { useComplianceStore } from "@/stores/compliance-store"
import { useOnboardingStore } from "@/lib/stores/onboarding-store"

const handleSwitch = (companyId: string) => {
  startTransition(async () => {
    const result = await switchCompany(companyId)
    if (result?.success) {
      // 1. Clear all SWR cache
      await mutate(() => true, undefined, { revalidate: false })

      // 2. Reset Zustand stores
      useComplianceStore.getState().reset()
      useOnboardingStore.getState().reset()

      // 3. Then refresh RSC
      router.refresh()

      toast.success(...)
    }
  })
}
```

### Medium Priority

#### 4. Create Company Context Provider

```typescript
// src/contexts/company-context.tsx
export function CompanyProvider({
  company,
  children
}: {
  company: Company | null
  children: ReactNode
}) {
  const prevCompanyRef = useRef(company?.id)

  useEffect(() => {
    if (prevCompanyRef.current !== company?.id) {
      // Company changed - clear all caches
      clearAllClientState()
      prevCompanyRef.current = company?.id
    }
  }, [company?.id])

  return (
    <CompanyContext.Provider value={company}>
      {children}
    </CompanyContext.Provider>
  )
}
```

#### 5. Add Warning Banner When Data May Be Stale

```typescript
// Show warning when company switch detected but page not fully refreshed
{isStaleContext && (
  <Banner variant="warning">
    Please refresh to see data for {currentCompany.name}
  </Banner>
)}
```

### Low Priority

#### 6. Add E2E Tests for Company Switching

```typescript
test('company switch clears stale data', async ({ page }) => {
  await loginWithMultipleCompanies(page)
  await markComplianceComplete(page)
  await switchCompany(page)
  await expect(complianceStore).not.toContainPreviousData()
})
```

---

## Implementation Priority Matrix

| Issue | Severity | Effort | Priority |
|-------|----------|--------|----------|
| Cache invalidation on switch | HIGH | LOW | P0 |
| Company-scoped Zustand keys | HIGH | MEDIUM | P0 |
| Company-scoped SWR keys | MEDIUM | MEDIUM | P1 |
| Company context provider | MEDIUM | MEDIUM | P1 |
| Stale data warning | LOW | LOW | P2 |
| E2E tests | LOW | HIGH | P2 |

---

## Verification Checklist

After implementing fixes:

- [ ] Switch companies → compliance store is empty/reset
- [ ] Switch companies → onboarding store is empty/reset
- [ ] Switch companies → SWR refetches capabilities
- [ ] Switch companies → VisibilityContext updates
- [ ] Switch companies → GuidanceContext refreshes
- [ ] Actions fail gracefully with clear error if context mismatch detected

---

## Appendix: Files Requiring Changes

### Must Change
1. `src/components/layout/company-switcher.tsx` - Add cache/store invalidation
2. `src/stores/compliance-store.ts` - Company-scope storage key
3. `src/lib/stores/onboarding-store.ts` - Company-scope storage key

### Should Change
4. `src/hooks/use-capabilities.ts` - Add companyId to cache key
5. `src/hooks/use-capability-resolution.ts` - Add companyId to cache key
6. `src/app/(app)/layout.tsx` - Pass companyId to hooks/providers

### Consider Changing
7. `src/contexts/GuidanceContext.tsx` - Re-fetch on company change
8. `src/app/(app)/banking/reconciliation/dashboard-client.tsx` - Reset on company change

---

## Conclusion

The codebase has **strong server-side multi-tenancy protections** - all database queries are company-scoped and actions validate ownership. However, **client-side state management does not account for company switching**, leading to potential data leakage in the UI.

The immediate fix is to invalidate all client caches when `switchCompany` is called. The longer-term fix is to company-scope all persistent client state (localStorage/sessionStorage keys, SWR cache keys).

**Recommended Action:** Implement P0 fixes before next release to prevent user confusion and potential data entry errors.
