# PHASE 2: Minimal Entity Editors (Draft Only)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create capability-gated entity editors for top workflows (invoices, expenses) that only allow draft creation - no issuing or submission from editor.

**Architecture:** Wrap existing forms with capability resolution checks. Remove or disable any "Issue/Submit" actions from editors. Editors only save as DRAFT. All workflow actions (fiscalize, issue, submit) must happen from Control Center queue actions.

**Tech Stack:** Next.js 15 App Router, React Server Components, Capability Resolution API

---

## Context

**Design Document Mandate (Section 9, Phase 2):**
> Minimal Entity Editors (Draft Only)
> - Only for top workflows
> - Draft state only
> - Fully capability-gated

**Current State:**
- Invoice form exists at `/invoices/new` but doesn't check capabilities
- Expense form exists at `/expenses/new`
- Forms may have "Issue" or "Submit" buttons

**Target State:**
- Invoice editor gated by INV-001 (Create Draft Invoice) capability
- Expense editor gated by EXP-001 (Create Draft Expense) capability
- No "Issue", "Fiscalize", or "Submit" buttons on editors
- Clear messaging: "Save as Draft" only
- Post-save redirect to Control Center

---

## Task 1: Capability Gate for Invoice Creation

**Files:**
- Modify: `src/app/(app)/invoices/new/page.tsx`
- Create: `src/app/(app)/invoices/new/__tests__/page.test.tsx`

**Step 1: Update page to check capability**

Add capability check at the top of the page:

```typescript
import { resolveCapabilityForUser } from "@/lib/capabilities/server"

export default async function NewInvoicePage({ searchParams }) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  // Check capability before allowing access
  const capability = await resolveCapabilityForUser("INV-001", {
    entityType: "EInvoice",
  })

  if (capability.state === "UNAUTHORIZED") {
    redirect("/control-center")
  }

  if (capability.state === "BLOCKED") {
    return (
      <div className="space-y-6">
        <BlockerDisplay blockers={capability.blockers} />
        <Link href="/control-center">
          <Button>Return to Control Center</Button>
        </Link>
      </div>
    )
  }

  // ... rest of page
}
```

**Step 2: Commit**

```
feat(invoice-editor): add capability gate for invoice creation

Invoice creation page now checks INV-001 capability before rendering.
- UNAUTHORIZED: redirects to Control Center
- BLOCKED: shows blocker display with return link
- READY: shows form
```

---

## Task 2: Remove Issue Action from Invoice Form

**Files:**
- Modify: `src/app/(app)/invoices/new/invoice-form.tsx`

**Step 1: Find and remove "Issue" or "Fiscalize" buttons**

Search for buttons like:
- "Izdaj" (Issue)
- "Fiskaliziraj" (Fiscalize)
- Any button that changes status to non-DRAFT

Replace with or ensure only "Save as Draft" remains:

```typescript
<Button type="submit" disabled={isSubmitting}>
  {isSubmitting ? "Spremanje..." : "Spremi kao nacrt"}
</Button>
```

**Step 2: Ensure form only saves as DRAFT status**

In the form submission handler, verify:
```typescript
const formData = {
  ...data,
  status: "DRAFT", // Always DRAFT from editor
}
```

**Step 3: Commit**

```
feat(invoice-editor): restrict to draft-only saves

Invoice editor now only allows saving as DRAFT.
Removed issue/fiscalize actions from form.
All workflow actions happen from Control Center.
```

---

## Task 3: Post-Save Redirect to Control Center

**Files:**
- Modify: `src/app/(app)/invoices/new/invoice-form.tsx`

**Step 1: Update success redirect**

After successful save, redirect to Control Center:

```typescript
// After successful save
router.push("/control-center")
toast.success("Nacrt spremljen. Koristite Kontrolni centar za izdavanje.")
```

**Step 2: Commit**

```
feat(invoice-editor): redirect to control center after save

After saving draft invoice, user is redirected to Control Center
with a toast message indicating they should use Control Center
for issuing/fiscalizing.
```

---

## Task 4: Capability Gate for Expense Creation

**Files:**
- Modify: `src/app/(app)/expenses/new/page.tsx`

**Step 1: Add capability check**

Similar to invoice, check EXP-001 capability:

```typescript
import { resolveCapabilityForUser } from "@/lib/capabilities/server"

export default async function NewExpensePage() {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  const capability = await resolveCapabilityForUser("EXP-001", {
    entityType: "Expense",
  })

  if (capability.state === "UNAUTHORIZED") {
    redirect("/control-center")
  }

  if (capability.state === "BLOCKED") {
    return (
      <BlockerDisplay blockers={capability.blockers} />
    )
  }

  // ... rest of page
}
```

**Step 2: Commit**

```
feat(expense-editor): add capability gate for expense creation

Expense creation page now checks EXP-001 capability.
```

---

## Task 5: Restrict Expense Form to Draft Only

**Files:**
- Modify: `src/app/(app)/expenses/new/page.tsx` or expense form component

**Step 1: Ensure only draft saves**

- Remove any "Submit" or "Approve" buttons
- Ensure status is always "DRAFT" on save
- Update success redirect to Control Center

**Step 2: Commit**

```
feat(expense-editor): restrict to draft-only saves

Expense editor only allows saving as DRAFT.
Redirects to Control Center after save.
```

---

## Task 6: Add Control Center Link to Editors

**Files:**
- Modify: `src/app/(app)/invoices/new/page.tsx`
- Modify: `src/app/(app)/expenses/new/page.tsx`

**Step 1: Add return link in page header**

```typescript
<div className="flex items-center justify-between">
  <div>
    <h1>{title}</h1>
    <p className="text-muted-foreground">
      Spremi nacrt, zatim koristi Kontrolni centar za daljnje akcije.
    </p>
  </div>
  <Link href="/control-center">
    <Button variant="outline">
      <ArrowLeft className="mr-2 h-4 w-4" />
      Kontrolni centar
    </Button>
  </Link>
</div>
```

**Step 2: Commit**

```
feat(editors): add Control Center navigation links

Both invoice and expense editors now have visible link
back to Control Center and messaging about draft workflow.
```

---

## Task 7: Final Verification

**Step 1: Run all tests**

```bash
npm test
```

**Step 2: Verify capability check works**

Manually test:
1. Visit `/invoices/new` - should work if user has capability
2. Check that only "Save as Draft" button exists
3. Save and verify redirect to Control Center

**Step 3: Commit any fixes**

---

## Summary

### Files Modified
- `src/app/(app)/invoices/new/page.tsx` - Capability gate, Control Center link
- `src/app/(app)/invoices/new/invoice-form.tsx` - Draft-only saves, redirect
- `src/app/(app)/expenses/new/page.tsx` - Capability gate, Control Center link
- Expense form component - Draft-only saves, redirect

### What This Implements
- Entity editors gated by capability resolution
- Draft-only saves (no issuing from editor)
- Clear user guidance: Control Center for workflow actions

### Definition of Done (from Design Document)
- ✅ No UI action bypasses capability resolution
- ✅ No redundant input (use existing form, gate access)
- ✅ Only DRAFT state from editors
- ✅ All workflow actions reserved for Control Center
