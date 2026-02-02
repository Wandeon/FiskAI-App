# Legacy Page Activation & UX Consolidation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove incorrect "Legacy" banners from functional pages, enable actions on these pages, and fix navigation/UX chaos to align with persona-based access control.

**Architecture:** The app incorrectly marks 6 functional pages as "Legacy" with disabled actions. These ARE the primary pages - there are no replacements. The plan: (1) remove LegacyBanner from pages, (2) fix navigation routing (Control Center is at `/cc` not `/control-center`), (3) ensure mobile nav respects entitlements, (4) fix deadline filtering by business type.

**Tech Stack:** Next.js 15 App Router, React Server Components, TypeScript, Tailwind CSS

---

## Context & Problem Analysis

### The "Legacy" Pages Issue

Six pages were incorrectly marked as "Legacy" with LegacyBanner:

- `/dashboard` - Says "View-only. Use Control Center for actions."
- `/banking` - Says "Actions are disabled."
- `/contacts` - Says "Actions are disabled."
- `/products` - Says "Actions are disabled."
- `/invoices` - Says "View-only. Create invoices from Control Center."
- `/expenses` - Says "Actions are disabled."

**Reality:** These ARE the functional pages. There are no replacements. They have existing CRUD capabilities that are being blocked by the banner's psychological effect and the redirect to Control Center.

### Navigation Issues Found

1. **Wrong Control Center Path:** Navigation links to `/control-center` but the actual Control Center is at `/cc`
2. **Mobile Nav Missing Filtering:** Desktop sidebar filters by entitlements, mobile nav does NOT
3. **Deadlines Not Filtered:** All deadlines shown (JOPPD, PDV) even for Paušalni users who don't need them
4. **Redundant Routes:** Both `/dashboard` and `/cc` exist but serve different purposes

### Current State Summary

| Page              | Current State           | Should Be                              |
| ----------------- | ----------------------- | -------------------------------------- |
| `/dashboard`      | LegacyBanner, view-only | Full dashboard with KPIs               |
| `/contacts`       | LegacyBanner            | Full CRUD                              |
| `/products`       | LegacyBanner            | Full CRUD                              |
| `/expenses`       | LegacyBanner            | Full CRUD                              |
| `/invoices`       | LegacyBanner            | Full CRUD (or redirect to /e-invoices) |
| `/banking`        | LegacyBanner            | Full CRUD                              |
| `/control-center` | 404                     | Redirect to /cc                        |
| `/cc`             | Works                   | Primary Control Center                 |

---

## Task 1: Fix Navigation Control Center Path

**Files:**

- Modify: `src/lib/navigation.ts:45`

**Step 1: Read current navigation file**

Read to understand context around line 45.

**Step 2: Fix Control Center href**

Change `/control-center` to `/cc`:

```typescript
// Before
{
  name: "Kontrolni centar",
  href: "/control-center",  // <-- Wrong path
  icon: Command,
  module: "platform-core",
},

// After
{
  name: "Kontrolni centar",
  href: "/cc",  // <-- Correct path
  icon: Command,
  module: "platform-core",
},
```

**Step 3: Commit**

```bash
git add src/lib/navigation.ts
git commit -m "$(cat <<'EOF'
fix(nav): correct Control Center path from /control-center to /cc

The actual Control Center page exists at /cc, not /control-center.
Navigation was pointing to a non-existent route.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Remove LegacyBanner from Contacts Page

**Files:**

- Modify: `src/app/(app)/contacts/page.tsx`

**Step 1: Read contacts page**

Read full file to understand structure and locate LegacyBanner usage.

**Step 2: Remove LegacyBanner import and usage**

Remove the import line:

```typescript
// Remove this line
import { LegacyBanner } from "@/components/layout/LegacyBanner"
```

Remove the LegacyBanner component usage (around line 123):

```typescript
// Remove this line
<LegacyBanner />
```

**Step 3: Verify page has working CRUD actions**

Check that the page has:

- "New Contact" button/link
- Edit action on contact cards
- Delete action on contact cards

**Step 4: Commit**

```bash
git add src/app/(app)/contacts/page.tsx
git commit -m "$(cat <<'EOF'
fix(contacts): remove incorrect Legacy banner

The contacts page is the primary page for contact management.
There is no replacement - removing the banner enables full CRUD.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Remove LegacyBanner from Products Page

**Files:**

- Modify: `src/app/(app)/products/page.tsx`

**Step 1: Read products page**

Read full file to understand structure.

**Step 2: Remove LegacyBanner import and usage**

Remove import:

```typescript
import { LegacyBanner } from "@/components/layout/LegacyBanner"
```

Remove usage (around line 56):

```typescript
<LegacyBanner />
```

**Step 3: Commit**

```bash
git add src/app/(app)/products/page.tsx
git commit -m "$(cat <<'EOF'
fix(products): remove incorrect Legacy banner

The products page is the primary page for product management.
There is no replacement - removing the banner enables full CRUD.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Remove LegacyBanner from Expenses Page

**Files:**

- Modify: `src/app/(app)/expenses/page.tsx`

**Step 1: Read expenses page**

Read full file.

**Step 2: Remove LegacyBanner import and usage**

Remove import and usage (around line 183).

**Step 3: Commit**

```bash
git add src/app/(app)/expenses/page.tsx
git commit -m "$(cat <<'EOF'
fix(expenses): remove incorrect Legacy banner

The expenses page is the primary page for expense management.
There is no replacement - removing the banner enables full CRUD.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Remove LegacyBanner from Banking Page

**Files:**

- Modify: `src/app/(app)/banking/page.tsx`

**Step 1: Read banking page**

Read full file.

**Step 2: Remove LegacyBanner import and usage**

Remove import and usage (around line 88).

**Step 3: Commit**

```bash
git add src/app/(app)/banking/page.tsx
git commit -m "$(cat <<'EOF'
fix(banking): remove incorrect Legacy banner

The banking page is the primary page for bank account management.
There is no replacement - removing the banner enables full CRUD.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Remove LegacyBanner from Invoices Page

**Files:**

- Modify: `src/app/(app)/invoices/page.tsx`

**Step 1: Read invoices page**

Read full file.

**Step 2: Remove LegacyBanner import and usage**

Remove import and usage (around line 182).

**Step 3: Decide on action button behavior**

The invoices page should:

- Show "New Invoice" button linking to `/e-invoices/new` (for e-invoices) OR `/invoices/new` (for regular)
- Keep the list view functional

**Step 4: Commit**

```bash
git add src/app/(app)/invoices/page.tsx
git commit -m "$(cat <<'EOF'
fix(invoices): remove incorrect Legacy banner

The invoices page is the primary page for viewing invoices.
Users should be able to create new invoices from here.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Fix Dashboard Page

**Files:**

- Modify: `src/app/(app)/dashboard/page.tsx`

**Step 1: Read dashboard page**

Read full file to understand current state.

**Step 2: Remove LegacyBanner import and usage**

Remove import and usage (around line 338).

**Step 3: Consider dashboard purpose**

Dashboard should show:

- KPIs and metrics
- Quick actions
- Recent activity
- Deadlines (filtered by business type - separate task)

The Control Center (`/cc`) is for actionable queues.
The Dashboard (`/dashboard`) is for overview/KPIs.
Both can coexist.

**Step 4: Commit**

```bash
git add src/app/(app)/dashboard/page.tsx
git commit -m "$(cat <<'EOF'
fix(dashboard): remove incorrect Legacy banner

The dashboard shows KPIs and overview metrics.
Control Center (/cc) handles actionable queues.
Both serve different purposes and can coexist.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Add Control Center Redirect

**Files:**

- Create: `src/app/(app)/control-center/page.tsx`

**Step 1: Create redirect page**

```typescript
// src/app/(app)/control-center/page.tsx
import { redirect } from "next/navigation"

export default function ControlCenterRedirect() {
  redirect("/cc")
}
```

This ensures any old links to `/control-center` work.

**Step 2: Commit**

```bash
git add src/app/(app)/control-center/page.tsx
git commit -m "$(cat <<'EOF'
feat(routing): add redirect from /control-center to /cc

Old navigation and external links may reference /control-center.
This redirect ensures they work correctly.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Add Entitlement Filtering to Mobile Nav

**Files:**

- Modify: `src/components/layout/mobile-nav.tsx`
- Reference: `src/components/layout/sidebar.tsx` (for pattern)

**Step 1: Read sidebar to understand entitlement filtering pattern**

The sidebar filters nav items by module entitlements. Mobile nav should do the same.

**Step 2: Read mobile-nav.tsx**

Understand current structure.

**Step 3: Add useCapabilities hook**

```typescript
import { useCapabilities } from "@/hooks/use-capabilities"
```

**Step 4: Filter nav items by module**

Before rendering each nav item, check if the module is enabled:

```typescript
const capabilities = useCapabilities()

// Filter items by module
{section.items
  .filter((item) =>
    item.module
      ? capabilities.modules[item.module as keyof typeof capabilities.modules]?.enabled !== false
      : true
  )
  .filter((item) =>
    item.showFor
      ? item.showFor.includes(company?.legalForm ?? "")
      : true
  )
  .map((item) => { ... })}
```

**Step 5: Commit**

```bash
git add src/components/layout/mobile-nav.tsx
git commit -m "$(cat <<'EOF'
fix(mobile-nav): filter nav items by module entitlements

Desktop sidebar already filters navigation by entitlements.
Mobile nav was showing all items regardless of access.
Now applies same filtering as sidebar.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Fix /e-invoices/new Error

**Files:**

- Investigate: `src/app/(app)/e-invoices/new/page.tsx`
- Investigate: `src/app/(app)/e-invoices/new/invoice-form.tsx`

**Step 1: Test the page locally**

```bash
npm run dev
# Navigate to /e-invoices/new
# Check browser console and terminal for errors
```

**Step 2: Identify error cause**

Common causes:

- Missing data (contacts, products, company)
- Type mismatch in props
- Server action error
- Missing environment variables

**Step 3: Fix identified issue**

Apply fix based on error diagnosis.

**Step 4: Commit**

```bash
git add [files-changed]
git commit -m "$(cat <<'EOF'
fix(e-invoices): resolve application error on /e-invoices/new

[Description of actual fix based on diagnosis]

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Create PR and Verify

**Step 1: Create feature branch**

```bash
git checkout -b fix/legacy-pages-ux-cleanup
```

**Step 2: Run all commits**

Execute tasks 1-10 on this branch.

**Step 3: Push and create PR**

```bash
git push -u origin fix/legacy-pages-ux-cleanup
gh pr create --title "fix: remove incorrect Legacy banners and fix navigation" --body "$(cat <<'EOF'
## Summary

- Remove LegacyBanner from 6 pages that are actually functional
- Fix Control Center navigation path (/control-center → /cc)
- Add redirect for old /control-center links
- Add module entitlement filtering to mobile nav
- Fix /e-invoices/new application error

## Why These Pages Are Not Legacy

The LegacyBanner was added as part of a Control Center transition plan, but:
1. These pages ARE the primary pages - there are no replacements
2. The Control Center (/cc) handles actionable queues, not CRUD
3. Dashboard and Control Center serve different purposes
4. Actions on these pages should be enabled

## Test Plan

- [ ] Navigate to /contacts - verify no Legacy banner, CRUD works
- [ ] Navigate to /products - verify no Legacy banner, CRUD works
- [ ] Navigate to /expenses - verify no Legacy banner, CRUD works
- [ ] Navigate to /banking - verify no Legacy banner, actions work
- [ ] Navigate to /invoices - verify no Legacy banner, create works
- [ ] Navigate to /dashboard - verify no Legacy banner, metrics show
- [ ] Click "Kontrolni centar" in nav - goes to /cc
- [ ] Navigate to /control-center - redirects to /cc
- [ ] Mobile nav - only shows items user has entitlements for
- [ ] /e-invoices/new - works without error

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Future Work (Not In This PR)

1. **Deadline Filtering by Business Type** - Show JOPPD/PDV only for relevant business types
2. **Navigation Cleanup** - Review which items should be shown per persona
3. **Remove LegacyBanner Component** - Once all usages are removed, delete the component
4. **Control Center Enhancement** - Make /cc more useful with persona-specific queues
5. **Unified Invoice Flow** - Decide on /invoices vs /e-invoices separation

---

## Success Criteria

- [ ] All 6 pages functional without Legacy banner
- [ ] Control Center accessible via navigation
- [ ] Mobile nav respects entitlements
- [ ] /e-invoices/new works
- [ ] CI passes
- [ ] No regression in existing functionality
