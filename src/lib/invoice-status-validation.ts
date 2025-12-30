/**
 * Invoice Status Transition Validator
 *
 * Provides validation for invoice status transitions with detailed error messages.
 */

import { EInvoiceStatus } from "@prisma/client"
import { validateStatusTransition, getTransitionError } from "./e-invoice-status"

interface TransitionValidationResult {
  valid: boolean
  error?: string
}

/**
 * Validates a status transition and returns a result object with error message if invalid.
 */
export function validateTransition(
  from: EInvoiceStatus,
  to: EInvoiceStatus
): TransitionValidationResult {
  const isValid = validateStatusTransition(from, to)

  if (isValid) {
    return { valid: true }
  }

  return {
    valid: false,
    error: getTransitionError(from, to),
  }
}
