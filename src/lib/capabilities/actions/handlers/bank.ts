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

    // matchTransaction(transactionId, type, matchId)
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

    // ignoreTransaction(transactionId)
    const result = await ignoreTransaction(params.id as string)

    if (result.success) {
      return { success: true }
    }

    return { success: false, error: result.error || "Failed to ignore transaction" }
  },
})
