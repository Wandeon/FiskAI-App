/**
 * Invoice Action Handlers
 *
 * Registers action handlers for invoice-related capabilities.
 * These handlers wrap existing server actions and transform their results
 * to the standard ActionResult format.
 *
 * @module capabilities/actions/handlers
 * @since PHASE 2 - Capability-Driven Actions
 */

import { registerActionHandler } from "../registry"
import type { ActionContext, ActionParams, ActionResult } from "../types"
import {
  sendInvoiceEmail,
  sendEInvoice,
  createCreditNote,
  issueInvoice,
  markInvoiceAsPaid,
} from "@/app/actions/invoice"
import { fiscalizeInvoice } from "@/app/actions/fiscalize"

/**
 * INV-002:send_email - Send invoice via email
 *
 * Sends an invoice to the buyer via email with PDF attachment.
 * Requires the invoice to be fiscalized first.
 *
 * @permission invoice:update
 */
registerActionHandler({
  capabilityId: "INV-002",
  actionId: "send_email",
  permission: "invoice:update",
  handler: async (_context: ActionContext, params?: ActionParams): Promise<ActionResult> => {
    if (!params?.id) {
      return { success: false, error: "Invoice ID required", code: "VALIDATION_ERROR" }
    }

    const result = await sendInvoiceEmail(params.id as string)

    // Check for success indicator in result
    if ("success" in result && typeof result.success === "string") {
      return { success: true }
    }

    return { success: false, error: result.error || "Failed to send email" }
  },
})

/**
 * INV-002:send_einvoice - Send e-invoice via provider
 *
 * Sends an invoice electronically through the configured e-invoice provider.
 * Generates UBL XML and transmits to the provider.
 *
 * @permission invoice:update
 */
registerActionHandler({
  capabilityId: "INV-002",
  actionId: "send_einvoice",
  permission: "invoice:update",
  handler: async (_context: ActionContext, params?: ActionParams): Promise<ActionResult> => {
    if (!params?.id) {
      return { success: false, error: "Invoice ID required", code: "VALIDATION_ERROR" }
    }

    const result = await sendEInvoice(params.id as string)

    // Check for success indicator in result
    if ("success" in result && typeof result.success === "string") {
      return { success: true }
    }

    return { success: false, error: result.error || "Failed to send e-invoice" }
  },
})

/**
 * INV-003:fiscalize - Fiscalize invoice with Croatian Tax Authority
 *
 * Submits the invoice to the Croatian Tax Authority (CIS) for fiscalization.
 * Calculates ZKI, generates fiscal request, and receives JIR.
 *
 * @permission invoice:fiscalize
 */
registerActionHandler({
  capabilityId: "INV-003",
  actionId: "fiscalize",
  permission: "invoice:fiscalize",
  handler: async (
    _context: ActionContext,
    params?: ActionParams
  ): Promise<ActionResult<{ jir: string; zki: string }>> => {
    if (!params?.id) {
      return { success: false, error: "Invoice ID required", code: "VALIDATION_ERROR" }
    }

    const result = await fiscalizeInvoice(params.id as string)

    if (result.success === true) {
      return {
        success: true,
        data: {
          jir: result.jir as string,
          zki: result.zki as string,
        },
      }
    }

    return { success: false, error: result.error || "Failed to fiscalize invoice" }
  },
})

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

/**
 * INV-004:create_credit_note - Create a credit note for an invoice
 *
 * Creates a credit note (storno) for an existing invoice.
 * The credit note reverses the amounts from the original invoice.
 *
 * @permission invoice:create
 */
registerActionHandler({
  capabilityId: "INV-004",
  actionId: "create_credit_note",
  permission: "invoice:create",
  handler: async (
    _context: ActionContext,
    params?: ActionParams
  ): Promise<ActionResult<{ id: string }>> => {
    if (!params?.id) {
      return { success: false, error: "Invoice ID required", code: "VALIDATION_ERROR" }
    }

    const reason = params.reason as string | undefined
    const result = await createCreditNote(params.id as string, reason)

    if (result.success) {
      return {
        success: true,
        data: result.data,
      }
    }

    return { success: false, error: result.error || "Failed to create credit note" }
  },
})

/**
 * INV-008:mark_paid - Mark invoice as paid
 *
 * Records payment for an invoice.
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

    const result = await markInvoiceAsPaid(params.id as string)

    // Check for success indicator in result
    if ("success" in result && typeof result.success === "string") {
      return { success: true }
    }

    return { success: false, error: result.error || "Failed to mark invoice as paid" }
  },
})
