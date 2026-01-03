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
import { markExpenseAsPaid } from "@/app/actions/expense"
import type { PaymentMethod } from "@prisma/client"

/**
 * EXP-004:mark_paid - Mark expense as paid
 *
 * Records payment for an expense with payment method.
 * Defaults to BANK_TRANSFER if no payment method specified.
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

    // Default payment method to BANK_TRANSFER if not specified
    const paymentMethod = (params.paymentMethod as PaymentMethod) || "BANK_TRANSFER"

    const result = await markExpenseAsPaid(params.id as string, paymentMethod)

    if (result.success) {
      return { success: true }
    }

    return { success: false, error: result.error || "Failed to mark expense as paid" }
  },
})
