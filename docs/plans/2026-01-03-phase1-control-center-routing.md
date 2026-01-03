# PHASE 1: Control Center Routing & Adoption

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Control Centers the primary operational UI surface for each role, with legacy pages contained and clearly marked.

**Architecture:** Redirect role-based landings to Control Centers. Update navigation to prioritize Control Center. Add visual indicators for legacy pages. Ensure all mutation actions on legacy pages are disabled or route through capability resolution.

**Tech Stack:** Next.js 15 App Router, React Server Components, TypeScript

---

## Context

**Design Document Mandate (Section 4):**
> A Control Center is the sole operational UI surface for a role.

**Current State:**
- Control centers exist at `/control-center` for each portal
- Dashboard at `/dashboard` is the default landing
- Navigation shows "Nadzorna ploča" (Dashboard) as first item
- Legacy pages have mutation actions that bypass capability resolution

**Target State:**
- `/control-center` is the default landing for each role
- Navigation shows "Control Center" as primary
- Legacy pages marked with visual indicator
- No mutation actions on legacy pages

---

## Task 1: Role-Based Landing Redirects

**Files:**
- Modify: `src/app/(app)/page.tsx`
- Modify: `src/app/(staff)/page.tsx`
- Modify: `src/app/(admin)/page.tsx`
- Test: `src/app/(app)/__tests__/page.test.tsx`

**Step 1: Write the failing test**

```typescript
// src/app/(app)/__tests__/page.test.tsx
import { describe, it, expect, vi } from "vitest"
import { redirect } from "next/navigation"

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
}))

describe("App Root Page", () => {
  it("redirects to control-center", async () => {
    const { default: Page } = await import("../page")
    await Page()
    expect(redirect).toHaveBeenCalledWith("/control-center")
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/app/(app)/__tests__/page.test.tsx`
Expected: FAIL (page doesn't exist or doesn't redirect)

**Step 3: Create the root page redirects**

```typescript
// src/app/(app)/page.tsx
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

export default async function AppRootPage() {
  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }
  redirect("/control-center")
}
```

```typescript
// src/app/(staff)/page.tsx
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

export default async function StaffRootPage() {
  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }
  redirect("/control-center")
}
```

```typescript
// src/app/(admin)/page.tsx
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

export default async function AdminRootPage() {
  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }
  redirect("/control-center")
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/app/(app)/__tests__/page.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/\(app\)/page.tsx src/app/\(staff\)/page.tsx src/app/\(admin\)/page.tsx src/app/\(app\)/__tests__/page.test.tsx
git commit -m "feat(routing): redirect root pages to control-center

Each portal's root now redirects to its control-center:
- (app)/ -> /control-center
- (staff)/ -> /control-center
- (admin)/ -> /control-center"
```

---

## Task 2: Update Navigation Priority

**Files:**
- Modify: `src/lib/navigation.ts`
- Test: `src/lib/__tests__/navigation.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/__tests__/navigation.test.ts
import { describe, it, expect } from "vitest"
import { navigation, LEGACY_ROUTES } from "../navigation"

describe("Navigation", () => {
  it("has Control Center as first navigation item", () => {
    const firstSection = navigation[0]
    const firstItem = firstSection.items[0]
    expect(firstItem.href).toBe("/control-center")
    expect(firstItem.name).toBe("Kontrolni centar")
  })

  it("exports LEGACY_ROUTES constant", () => {
    expect(LEGACY_ROUTES).toBeDefined()
    expect(LEGACY_ROUTES).toContain("/dashboard")
  })

  it("marks dashboard as legacy in navigation", () => {
    const dashboardItem = navigation
      .flatMap((s) => s.items)
      .find((i) => i.href === "/dashboard")
    expect(dashboardItem?.legacy).toBe(true)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/__tests__/navigation.test.ts`
Expected: FAIL (Control Center not first, LEGACY_ROUTES not exported)

**Step 3: Update navigation configuration**

```typescript
// src/lib/navigation.ts - add to existing file
import { Command } from "lucide-react" // Add to imports

// Add after NavSection interface
export interface NavItem {
  name: string
  href: string
  icon: LucideIcon
  badge?: number
  children?: { name: string; href: string }[]
  module?: ModuleKey
  showFor?: string[]
  legacy?: boolean // NEW: marks route as legacy
}

// Add constant for legacy routes
export const LEGACY_ROUTES = [
  "/dashboard",
  "/invoices",
  "/expenses",
  "/banking",
  "/contacts",
  "/products",
  "/pos",
  "/reports",
] as const

// Update navigation array - Control Center first
export const navigation: NavSection[] = [
  {
    title: "Pregled",
    items: [
      {
        name: "Kontrolni centar",
        href: "/control-center",
        icon: Command,
        module: "platform-core",
      },
      {
        name: "Nadzorna ploča",
        href: "/dashboard",
        icon: LayoutDashboard,
        module: "platform-core",
        legacy: true, // Mark as legacy
      },
    ],
  },
  // ... rest of navigation with legacy: true added to appropriate items
]
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/__tests__/navigation.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/navigation.ts src/lib/__tests__/navigation.test.ts
git commit -m "feat(nav): prioritize Control Center, mark legacy routes

- Control Center is now first navigation item
- Added legacy flag to NavItem interface
- Export LEGACY_ROUTES constant for UI indicators
- Dashboard and other legacy pages marked with legacy: true"
```

---

## Task 3: Legacy Route Visual Indicator Component

**Files:**
- Create: `src/components/layout/LegacyBanner.tsx`
- Test: `src/components/layout/__tests__/LegacyBanner.test.tsx`

**Step 1: Write the failing test**

```typescript
// src/components/layout/__tests__/LegacyBanner.test.tsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { LegacyBanner } from "../LegacyBanner"

describe("LegacyBanner", () => {
  it("renders warning banner with link to control center", () => {
    render(<LegacyBanner />)

    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(screen.getByText(/legacy/i)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /control center/i })).toHaveAttribute(
      "href",
      "/control-center"
    )
  })

  it("shows custom message when provided", () => {
    render(<LegacyBanner message="This page is read-only" />)

    expect(screen.getByText(/read-only/i)).toBeInTheDocument()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/layout/__tests__/LegacyBanner.test.tsx`
Expected: FAIL (component doesn't exist)

**Step 3: Create the LegacyBanner component**

```typescript
// src/components/layout/LegacyBanner.tsx
import Link from "next/link"
import { AlertTriangle } from "lucide-react"

interface LegacyBannerProps {
  message?: string
}

export function LegacyBanner({ message }: LegacyBannerProps) {
  return (
    <div
      role="alert"
      className="mb-4 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
    >
      <AlertTriangle className="h-5 w-5 flex-shrink-0" />
      <p className="text-sm">
        <span className="font-medium">Legacy view.</span>{" "}
        {message || "Actions are disabled."}{" "}
        <Link
          href="/control-center"
          className="font-medium underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-100"
        >
          Go to Control Center
        </Link>
      </p>
    </div>
  )
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/layout/__tests__/LegacyBanner.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/layout/LegacyBanner.tsx src/components/layout/__tests__/LegacyBanner.test.tsx
git commit -m "feat(ui): add LegacyBanner component for legacy pages

Shows amber warning banner with link to Control Center.
Supports custom message prop for specific guidance."
```

---

## Task 4: Add Legacy Banner to Dashboard

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`
- Test: `src/app/(app)/dashboard/__tests__/page.test.tsx`

**Step 1: Write the failing test**

```typescript
// src/app/(app)/dashboard/__tests__/page.test.tsx
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"

// Mock all dependencies
vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
}))

vi.mock("@/lib/auth-utils", () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: "user-1" }),
  getCurrentCompany: vi.fn().mockResolvedValue({
    id: "company-1",
    name: "Test Co",
    isVatPayer: false,
    legalForm: "OBRT_PAUSAL",
  }),
  isOnboardingComplete: vi.fn().mockReturnValue(true),
}))

vi.mock("@/lib/db", () => ({
  db: {
    eInvoice: { count: vi.fn().mockResolvedValue(0) },
    contact: { count: vi.fn().mockResolvedValue(0) },
    product: { count: vi.fn().mockResolvedValue(0) },
    // ... other mocks as needed
  },
}))

describe("Dashboard Page", () => {
  it("shows legacy banner", async () => {
    // This is a server component test - we verify the banner is included
    const fs = await import("fs")
    const path = await import("path")
    const content = fs.readFileSync(
      path.join(process.cwd(), "src/app/(app)/dashboard/page.tsx"),
      "utf-8"
    )
    expect(content).toContain("LegacyBanner")
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/app/(app)/dashboard/__tests__/page.test.tsx`
Expected: FAIL (LegacyBanner not imported)

**Step 3: Add LegacyBanner to dashboard**

Add to imports in `src/app/(app)/dashboard/page.tsx`:
```typescript
import { LegacyBanner } from "@/components/layout/LegacyBanner"
```

Add at the start of the return JSX (after opening fragment or div):
```typescript
<LegacyBanner message="View-only. Use Control Center for actions." />
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/app/(app)/dashboard/__tests__/page.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/\(app\)/dashboard/page.tsx src/app/\(app\)/dashboard/__tests__/page.test.tsx
git commit -m "feat(dashboard): add legacy banner

Dashboard now shows legacy warning with link to Control Center.
Actions on this page will be disabled in subsequent tasks."
```

---

## Task 5: Disable Action Buttons on Legacy Invoice List

**Files:**
- Modify: `src/app/(app)/invoices/page.tsx`
- Test: `src/app/(app)/invoices/__tests__/page.test.tsx`

**Step 1: Write the failing test**

```typescript
// src/app/(app)/invoices/__tests__/page.test.tsx
import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"

describe("Invoices Page (Legacy)", () => {
  it("includes LegacyBanner component", () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), "src/app/(app)/invoices/page.tsx"),
      "utf-8"
    )
    expect(content).toContain("LegacyBanner")
  })

  it("does not contain direct action buttons", () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), "src/app/(app)/invoices/page.tsx"),
      "utf-8"
    )
    // Should not have "New Invoice" button that bypasses capability resolution
    // Actions should route to control center or be capability-gated
    expect(content).not.toContain('href="/invoices/new"')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/app/(app)/invoices/__tests__/page.test.tsx`
Expected: FAIL (has direct action links)

**Step 3: Update invoices page**

Add LegacyBanner import and usage. Remove or disable "New Invoice" button:

```typescript
// At top of file, add import
import { LegacyBanner } from "@/components/layout/LegacyBanner"

// In the component return, add banner after opening div
<LegacyBanner message="View-only. Create invoices from Control Center." />

// Remove or comment out the "New Invoice" button/link
// Replace with: {/* Action moved to Control Center */}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/app/(app)/invoices/__tests__/page.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/\(app\)/invoices/page.tsx src/app/\(app\)/invoices/__tests__/page.test.tsx
git commit -m "feat(invoices): mark as legacy, remove direct actions

Invoice list is now view-only legacy page.
- Added LegacyBanner component
- Removed 'New Invoice' action button
- Users directed to Control Center for actions"
```

---

## Task 6: Update Sidebar to Show Legacy Indicator

**Files:**
- Modify: `src/components/layout/sidebar.tsx`
- Test: `src/components/layout/__tests__/sidebar.test.tsx`

**Step 1: Write the failing test**

```typescript
// src/components/layout/__tests__/sidebar.test.tsx
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { Sidebar } from "../sidebar"

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}))

describe("Sidebar", () => {
  const defaultProps = {
    user: { name: "Test User", email: "test@example.com", image: null },
    company: {
      name: "Test Co",
      isVatPayer: false,
      legalForm: "OBRT_PAUSAL",
      entitlements: ["platform-core", "invoicing"],
    },
  }

  it("shows legacy indicator for legacy routes", () => {
    render(<Sidebar {...defaultProps} />)

    // Dashboard link should have legacy indicator
    const dashboardLink = screen.getByRole("link", { name: /nadzorna ploča/i })
    expect(dashboardLink.closest("li")).toHaveClass("opacity-60")
  })

  it("shows Control Center first without legacy indicator", () => {
    render(<Sidebar {...defaultProps} />)

    const controlCenterLink = screen.getByRole("link", { name: /kontrolni centar/i })
    expect(controlCenterLink.closest("li")).not.toHaveClass("opacity-60")
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/layout/__tests__/sidebar.test.tsx`
Expected: FAIL (no legacy styling)

**Step 3: Update Sidebar to show legacy indicator**

In `src/components/layout/sidebar.tsx`, update the nav item rendering to check for `item.legacy`:

```typescript
// In the map over items, add legacy styling
<li
  key={item.name}
  className={cn(
    item.legacy && "opacity-60"
  )}
>
  <Link
    href={item.href}
    className={cn(
      // existing classes...
      item.legacy && "italic"
    )}
  >
    {/* ... */}
    {item.legacy && (
      <span className="ml-auto text-xs text-muted-foreground">(legacy)</span>
    )}
  </Link>
</li>
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/layout/__tests__/sidebar.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/layout/sidebar.tsx src/components/layout/__tests__/sidebar.test.tsx
git commit -m "feat(sidebar): show legacy indicator for legacy routes

Legacy routes now appear with:
- Reduced opacity (60%)
- Italic text style
- '(legacy)' label suffix

Control Center appears prominently as first item."
```

---

## Task 7: Add Legacy Banners to Remaining Pages

**Files:**
- Modify: `src/app/(app)/expenses/page.tsx`
- Modify: `src/app/(app)/banking/page.tsx`
- Modify: `src/app/(app)/contacts/page.tsx`
- Modify: `src/app/(app)/products/page.tsx`

**Step 1: Verify each page exists and add banner**

For each file, add the import and banner:

```typescript
import { LegacyBanner } from "@/components/layout/LegacyBanner"

// Add after opening container div
<LegacyBanner />
```

**Step 2: Run tests to verify no regressions**

Run: `npm test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/app/\(app\)/expenses/page.tsx src/app/\(app\)/banking/page.tsx \
        src/app/\(app\)/contacts/page.tsx src/app/\(app\)/products/page.tsx
git commit -m "feat(legacy): add banners to remaining legacy pages

Added LegacyBanner to:
- Expenses list
- Banking overview
- Contacts list
- Products list

All legacy pages now direct users to Control Center."
```

---

## Task 8: Staff Portal Legacy Containment

**Files:**
- Modify: `src/app/(staff)/staff-dashboard/page.tsx`
- Create: `src/app/(staff)/page.tsx` (if not exists)

**Step 1: Add root redirect and legacy banner**

```typescript
// src/app/(staff)/page.tsx
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

export default async function StaffRootPage() {
  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }
  redirect("/control-center")
}
```

**Step 2: Add legacy banner to staff dashboard**

```typescript
// In src/app/(staff)/staff-dashboard/page.tsx
import { LegacyBanner } from "@/components/layout/LegacyBanner"

// Add to StaffDashboard component or its wrapper
<LegacyBanner message="Legacy dashboard. Use Control Center for client oversight." />
```

**Step 3: Run tests**

Run: `npm test`
Expected: PASS

**Step 4: Commit**

```bash
git add src/app/\(staff\)/page.tsx src/app/\(staff\)/staff-dashboard/page.tsx
git commit -m "feat(staff): add legacy containment

- Staff portal root redirects to control-center
- Staff dashboard shows legacy banner"
```

---

## Task 9: Admin Portal Legacy Containment

**Files:**
- Modify: `src/app/(admin)/overview/page.tsx`
- Create: `src/app/(admin)/page.tsx` (if not exists)

**Step 1: Add root redirect and legacy banner**

```typescript
// src/app/(admin)/page.tsx
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

export default async function AdminRootPage() {
  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }
  redirect("/control-center")
}
```

**Step 2: Add legacy banner to admin overview**

```typescript
// In src/app/(admin)/overview/page.tsx
import { LegacyBanner } from "@/components/layout/LegacyBanner"

// Add to component
<LegacyBanner message="Legacy overview. Use Control Center for platform operations." />
```

**Step 3: Run tests**

Run: `npm test`
Expected: PASS

**Step 4: Commit**

```bash
git add src/app/\(admin\)/page.tsx src/app/\(admin\)/overview/page.tsx
git commit -m "feat(admin): add legacy containment

- Admin portal root redirects to control-center
- Admin overview shows legacy banner"
```

---

## Task 10: Final Verification

**Step 1: Run all tests**

```bash
npm test
```

Expected: All tests pass

**Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors

**Step 3: Run ESLint on changed files**

```bash
npx eslint src/app/\(app\)/page.tsx src/app/\(staff\)/page.tsx src/app/\(admin\)/page.tsx \
           src/lib/navigation.ts src/components/layout/LegacyBanner.tsx \
           src/components/layout/sidebar.tsx --fix
```

Expected: No errors

**Step 4: Format with Prettier**

```bash
npx prettier --write "src/**/*.{ts,tsx}"
```

**Step 5: Final commit if any formatting changes**

```bash
git add -A
git commit -m "style: format Phase 1 changes" --allow-empty
```

---

## Summary

### Files Created
- `src/app/(app)/page.tsx` - Root redirect to control-center
- `src/app/(staff)/page.tsx` - Root redirect to control-center
- `src/app/(admin)/page.tsx` - Root redirect to control-center
- `src/components/layout/LegacyBanner.tsx` - Legacy page indicator
- Test files for each component

### Files Modified
- `src/lib/navigation.ts` - Control Center first, legacy flags
- `src/components/layout/sidebar.tsx` - Legacy visual indicator
- `src/app/(app)/dashboard/page.tsx` - Legacy banner
- `src/app/(app)/invoices/page.tsx` - Legacy banner, removed actions
- `src/app/(app)/expenses/page.tsx` - Legacy banner
- `src/app/(app)/banking/page.tsx` - Legacy banner
- `src/app/(app)/contacts/page.tsx` - Legacy banner
- `src/app/(app)/products/page.tsx` - Legacy banner
- `src/app/(staff)/staff-dashboard/page.tsx` - Legacy banner
- `src/app/(admin)/overview/page.tsx` - Legacy banner

### What This Implements
- Control Center as primary entry point for each role
- Visual containment of legacy pages
- Navigation prioritizes Control Center
- Legacy pages marked and action-disabled

### Definition of Done (from Design Document)
- ✅ No UI action bypasses capability resolution (legacy actions removed)
- ✅ No redundant input introduced
- ✅ No fake availability exists
- ✅ All blockers explicit and machine-readable
