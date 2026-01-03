# PHASE 3: Workflow Completion UX

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable workflow completion directly from Control Center queues with proper confirmation dialogs, feedback, and error handling.

**Architecture:** Add missing action handlers for all queue capabilities. Implement confirmation dialogs for irreversible actions. Enhance feedback with success states and next-step guidance.

**Tech Stack:** Next.js 15 App Router, React Server Components, Capability Action System

---

## Context

**Design Document Mandate (Section 9, Phase 3):**
> Workflow Completion UX
> - Actions execute from Control Center
> - Confirmation for irreversible actions
> - Clear success/failure feedback

**Current State:**
- Control Center renders queues with items
- ActionButton executes via useCapabilityAction hook
- Only some invoice handlers exist (send_email, send_einvoice, fiscalize, create_credit_note)
- Missing handlers for: issue, mark_paid (invoice/expense), match/ignore (bank)

**Target State:**
- All queue capabilities have working action handlers
- Irreversible actions show confirmation dialog
- Success states show next steps
- Error states show recovery options

---

## Task 1: Add Issue Invoice Action Handler

**Files:**
- Modify: `src/lib/capabilities/actions/handlers/invoice.ts`

**Step 1: Add the issue invoice handler**

Add INV-004:issue handler that transitions DRAFT → PENDING_FISCALIZATION:

```typescript
import { issueInvoice } from "@/app/actions/invoice"

/**
 * INV-004:issue - Issue a draft invoice
 *
 * Transitions invoice from DRAFT to PENDING_FISCALIZATION.
 * After issuing, the invoice must be fiscalized within 48 hours.
 *
 * @permission invoice:update
 */
registerActionHandler({
  capabilityId: "INV-004",
  actionId: "issue",
  permission: "invoice:update",
  handler: async (_context: ActionContext, params?: ActionParams): Promise<ActionResult> => {
    if (!params?.id) {
      return { success: false, error: "Invoice ID required", code: "VALIDATION_ERROR" }
    }

    const result = await issueInvoice(params.id as string)

    if (result.success) {
      return { success: true }
    }

    return { success: false, error: result.error || "Failed to issue invoice" }
  },
})
```

**Step 2: Verify issueInvoice action exists**

Check if `issueInvoice` action exists in `src/app/actions/invoice.ts`. If not, create it:

```typescript
export async function issueInvoice(invoiceId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" }
  }

  const invoice = await db.eInvoice.findUnique({
    where: { id: invoiceId },
    select: { status: true, companyId: true },
  })

  if (!invoice) {
    return { success: false, error: "Invoice not found" }
  }

  if (invoice.status !== "DRAFT") {
    return { success: false, error: "Invoice must be in DRAFT status" }
  }

  await db.eInvoice.update({
    where: { id: invoiceId },
    data: { status: "PENDING_FISCALIZATION" },
  })

  return { success: true }
}
```

**Step 3: Commit**

```
feat(capabilities): add issue invoice action handler

Adds INV-004:issue handler to transition invoices from DRAFT to
PENDING_FISCALIZATION status.
```

---

## Task 2: Add Mark Invoice Paid Action Handler

**Files:**
- Modify: `src/lib/capabilities/actions/handlers/invoice.ts`

**Step 1: Add the mark paid handler**

```typescript
import { markInvoicePaid } from "@/app/actions/invoice"

/**
 * INV-008:mark_paid - Mark invoice as paid
 *
 * Records payment for an invoice, optionally with payment date.
 *
 * @permission invoice:update
 */
registerActionHandler({
  capabilityId: "INV-008",
  actionId: "mark_paid",
  permission: "invoice:update",
  handler: async (_context: ActionContext, params?: ActionParams): Promise<ActionResult> => {
    if (!params?.id) {
      return { success: false, error: "Invoice ID required", code: "VALIDATION_ERROR" }
    }

    const paymentDate = params.paymentDate
      ? new Date(params.paymentDate as string)
      : new Date()

    const result = await markInvoicePaid(params.id as string, paymentDate)

    if (result.success) {
      return { success: true }
    }

    return { success: false, error: result.error || "Failed to mark invoice as paid" }
  },
})
```

**Step 2: Verify markInvoicePaid action exists**

If not in `src/app/actions/invoice.ts`, create it.

**Step 3: Commit**

```
feat(capabilities): add mark invoice paid action handler

Adds INV-008:mark_paid handler to record invoice payments.
```

---

## Task 3: Add Expense Action Handlers

**Files:**
- Create: `src/lib/capabilities/actions/handlers/expense.ts`

**Step 1: Create expense handlers file**

```typescript
/**
 * Expense Action Handlers
 *
 * Registers action handlers for expense-related capabilities.
 *
 * @module capabilities/actions/handlers
 * @since PHASE 3 - Workflow Completion UX
 */

import { registerActionHandler } from "../registry"
import type { ActionContext, ActionParams, ActionResult } from "../types"
import { markExpensePaid } from "@/app/actions/expense"

/**
 * EXP-004:mark_paid - Mark expense as paid
 *
 * Records payment for an expense with payment method and date.
 *
 * @permission expense:update
 */
registerActionHandler({
  capabilityId: "EXP-004",
  actionId: "mark_paid",
  permission: "expense:update",
  handler: async (_context: ActionContext, params?: ActionParams): Promise<ActionResult> => {
    if (!params?.id) {
      return { success: false, error: "Expense ID required", code: "VALIDATION_ERROR" }
    }

    const result = await markExpensePaid(params.id as string, {
      paymentMethod: (params.paymentMethod as string) || "TRANSFER",
      paymentDate: params.paymentDate
        ? new Date(params.paymentDate as string)
        : new Date(),
    })

    if (result.success) {
      return { success: true }
    }

    return { success: false, error: result.error || "Failed to mark expense as paid" }
  },
})
```

**Step 2: Verify markExpensePaid action exists**

If not in `src/app/actions/expense.ts`, create it.

**Step 3: Register expense handlers in index**

Add import to `src/lib/capabilities/actions/handlers/index.ts`:

```typescript
export * from "./invoice"
export * from "./expense"
```

**Step 4: Commit**

```
feat(capabilities): add expense action handlers

Adds EXP-004:mark_paid handler for marking expenses as paid.
```

---

## Task 4: Add Bank Transaction Action Handlers

**Files:**
- Create: `src/lib/capabilities/actions/handlers/bank.ts`

**Step 1: Create bank handlers file**

```typescript
/**
 * Bank Transaction Action Handlers
 *
 * Registers action handlers for bank-related capabilities.
 *
 * @module capabilities/actions/handlers
 * @since PHASE 3 - Workflow Completion UX
 */

import { registerActionHandler } from "../registry"
import type { ActionContext, ActionParams, ActionResult } from "../types"
import { matchTransaction, ignoreTransaction } from "@/app/actions/banking"

/**
 * BNK-005:manual_match - Manually match a bank transaction
 *
 * Matches a transaction to an invoice or expense.
 *
 * @permission banking:update
 */
registerActionHandler({
  capabilityId: "BNK-005",
  actionId: "manual_match",
  permission: "banking:update",
  handler: async (_context: ActionContext, params?: ActionParams): Promise<ActionResult> => {
    if (!params?.id) {
      return { success: false, error: "Transaction ID required", code: "VALIDATION_ERROR" }
    }
    if (!params?.matchType || !params?.matchId) {
      return { success: false, error: "Match type and ID required", code: "VALIDATION_ERROR" }
    }

    const result = await matchTransaction(
      params.id as string,
      params.matchType as "invoice" | "expense",
      params.matchId as string
    )

    if (result.success) {
      return { success: true }
    }

    return { success: false, error: result.error || "Failed to match transaction" }
  },
})

/**
 * BNK-007:ignore - Ignore a bank transaction
 *
 * Marks a transaction as ignored (won't appear in reconciliation).
 *
 * @permission banking:update
 */
registerActionHandler({
  capabilityId: "BNK-007",
  actionId: "ignore",
  permission: "banking:update",
  handler: async (_context: ActionContext, params?: ActionParams): Promise<ActionResult> => {
    if (!params?.id) {
      return { success: false, error: "Transaction ID required", code: "VALIDATION_ERROR" }
    }

    const result = await ignoreTransaction(params.id as string)

    if (result.success) {
      return { success: true }
    }

    return { success: false, error: result.error || "Failed to ignore transaction" }
  },
})
```

**Step 2: Verify banking actions exist**

If not in `src/app/actions/banking.ts`, create stubs.

**Step 3: Register bank handlers**

Add to `src/lib/capabilities/actions/handlers/index.ts`:

```typescript
export * from "./invoice"
export * from "./expense"
export * from "./bank"
```

**Step 4: Commit**

```
feat(capabilities): add bank transaction action handlers

Adds BNK-005:manual_match and BNK-007:ignore handlers.
```

---

## Task 5: Add Confirmation Dialog Component

**Files:**
- Create: `src/components/capability/ConfirmationDialog.tsx`

**Step 1: Create confirmation dialog**

```typescript
"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface ConfirmationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  isLoading?: boolean
  variant?: "default" | "destructive"
}

export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  isLoading = false,
  variant = "default",
}: ConfirmationDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isLoading}
            className={variant === "destructive" ? "bg-destructive text-destructive-foreground" : ""}
          >
            {isLoading ? "Processing..." : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

**Step 2: Export from capability index**

Add to `src/components/capability/index.ts`.

**Step 3: Commit**

```
feat(capability): add confirmation dialog component

Adds ConfirmationDialog for irreversible actions with loading state.
```

---

## Task 6: Update ActionButton with Confirmation

**Files:**
- Modify: `src/components/capability/ActionButton.tsx`
- Modify: `src/components/capability/types.ts`

**Step 1: Add requiresConfirmation to action type**

In types.ts, update ActionDefinition:

```typescript
export interface ActionDefinition {
  id: string
  label: string
  enabled: boolean
  primary?: boolean
  disabledReason?: string
  requiresConfirmation?: boolean
  confirmationMessage?: string
}
```

**Step 2: Update ActionButton to show confirmation**

```typescript
"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Loader2 } from "lucide-react"
import { useCapabilityAction } from "@/lib/capabilities/actions/useCapabilityAction"
import { toast } from "@/lib/toast"
import { ConfirmationDialog } from "./ConfirmationDialog"
import type { ActionButtonProps } from "./types"

export function ActionButton({
  action,
  capabilityId,
  entityId,
  entityType,
  showDiagnostics = false,
  params,
  onSuccess,
  onError,
}: ActionButtonProps) {
  const [showConfirmation, setShowConfirmation] = useState(false)

  const { execute, isLoading } = useCapabilityAction({
    capabilityId,
    actionId: action.id,
    entityId,
    entityType,
    onSuccess: () => {
      setShowConfirmation(false)
      toast.success("Success", `${action.label} completed`)
      onSuccess?.()
    },
    onError: (err) => {
      setShowConfirmation(false)
      toast.error("Error", err)
      onError?.(err)
    },
  })

  const handleClick = async () => {
    if (!action.enabled || isLoading) return

    if (action.requiresConfirmation) {
      setShowConfirmation(true)
    } else {
      await execute({ id: entityId, ...params })
    }
  }

  const handleConfirm = async () => {
    await execute({ id: entityId, ...params })
  }

  const isDisabled = !action.enabled || isLoading

  const button = (
    <Button
      variant={action.primary ? "default" : "outline"}
      disabled={isDisabled}
      onClick={handleClick}
      className="relative"
    >
      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {action.label}
      {showDiagnostics && (
        <span className="absolute -top-2 -right-2 text-[10px] font-mono bg-muted px-1 rounded">
          {capabilityId}
        </span>
      )}
    </Button>
  )

  return (
    <>
      {!action.enabled && action.disabledReason ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent>
              <p>{action.disabledReason}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        button
      )}

      {action.requiresConfirmation && (
        <ConfirmationDialog
          open={showConfirmation}
          onOpenChange={setShowConfirmation}
          title={`Confirm ${action.label}`}
          description={action.confirmationMessage || "Are you sure you want to proceed?"}
          confirmLabel={action.label}
          onConfirm={handleConfirm}
          isLoading={isLoading}
        />
      )}
    </>
  )
}
```

**Step 3: Commit**

```
feat(capability): add confirmation support to ActionButton

Actions with requiresConfirmation show dialog before executing.
```

---

## Task 7: Final Verification

**Step 1: Run tests**

```bash
npm test
```

**Step 2: Verify handlers are registered**

Check that all handlers load without errors by importing them.

**Step 3: Manual verification**

- Visit `/control-center`
- Verify queue items show action buttons
- Test an action execution

**Step 4: Commit any fixes**

---

## Summary

### Files Created
- `src/lib/capabilities/actions/handlers/expense.ts`
- `src/lib/capabilities/actions/handlers/bank.ts`
- `src/components/capability/ConfirmationDialog.tsx`

### Files Modified
- `src/lib/capabilities/actions/handlers/invoice.ts` - Added issue, mark_paid handlers
- `src/lib/capabilities/actions/handlers/index.ts` - Export new handlers
- `src/components/capability/ActionButton.tsx` - Confirmation dialog support
- `src/components/capability/types.ts` - Added requiresConfirmation
- `src/components/capability/index.ts` - Export ConfirmationDialog

### What This Implements
- All queue actions have working handlers
- Confirmation dialogs for irreversible actions
- Clear success/error feedback

### Definition of Done (from Design Document)
- ✅ Actions execute from Control Center
- ✅ Confirmation for irreversible actions
- ✅ Clear success/failure feedback
