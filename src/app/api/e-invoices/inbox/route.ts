// src/app/api/e-invoices/inbox/route.ts
// API endpoint for managing received e-invoices inbox

import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { EInvoiceStatus } from "@prisma/client"
import { logger } from "@/lib/logger"
import { validateStatusTransition, getTransitionError } from "@/lib/e-invoice-status"
import { validateTransition } from "@/lib/invoice-status-validation"

const acceptInvoiceSchema = z.object({
  accept: z.boolean(), // true to accept, false to reject
  reason: z.string().optional(), // reason for rejection
})

export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)

    // Get received invoices that need action (DELIVERED status)
    const inboxInvoices = await db.eInvoice.findMany({
      where: {
        companyId: company.id,
        direction: "INBOUND", // Only received invoices
        status: "DELIVERED", // Only delivered (not yet accepted/rejected)
      },
      include: {
        lines: { orderBy: { lineNumber: "asc" } },
        buyer: true,
      },
      orderBy: { createdAt: "desc" },
    })

    logger.info(
      {
        userId: user.id,
        companyId: company.id,
        count: inboxInvoices.length,
        operation: "inbox_invoices_fetched",
      },
      "Inbox e-invoices fetched successfully"
    )

    return NextResponse.json({
      invoices: inboxInvoices,
      count: inboxInvoices.length,
    })
  } catch (error) {
    logger.error({ error }, "Failed to fetch inbox e-invoices")

    return NextResponse.json({ error: "Failed to fetch inbox e-invoices" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)

    const url = new URL(request.url)
    const invoiceId = url.searchParams.get("invoiceId")

    if (!invoiceId) {
      return NextResponse.json({ error: "Invoice ID is required" }, { status: 400 })
    }

    // Verify invoice belongs to company and is in inbox
    const invoice = await db.eInvoice.findFirst({
      where: {
        id: invoiceId,
        companyId: company.id,
        direction: "INBOUND", // Only received invoices
        status: "DELIVERED", // Only delivered (not yet accepted/rejected)
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found or already processed" }, { status: 404 })
    }

    const body = await request.json()
    const parsed = acceptInvoiceSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: parsed.error.issues },
        { status: 400 }
      )
    }

    const { accept, reason } = parsed.data

    // Update invoice status based on action
    let newStatus: EInvoiceStatus
    let providerStatus: string

    if (accept) {
      newStatus = "ACCEPTED"
      providerStatus = "ACCEPTED"
    } else {
      newStatus = "REJECTED"
      providerStatus = "REJECTED"
    }

    // Validate status transition
    const transitionValidation = validateTransition(invoice.status, newStatus)
    if (!transitionValidation.valid) {
      return NextResponse.json({ error: transitionValidation.error }, { status: 400 })
    }

    const updatedInvoice = await db.eInvoice.update({
      where: { id: invoiceId },
      data: {
        status: newStatus,
        providerStatus,
        notes: reason
          ? `${invoice.notes || ""}\n\nOdluka: ${accept ? "Prihvaćen" : "Odbijen"} - Razlog: ${reason}`.trim()
          : `${invoice.notes || ""}\n\nOdluka: ${accept ? "Prihvaćen" : "Odbijen"}`.trim(),
        providerError: !accept ? reason : null, // Store rejection reason as provider error
      },
      include: {
        lines: { orderBy: { lineNumber: "asc" } },
        buyer: true,
      },
    })

    logger.info(
      {
        userId: user.id,
        companyId: company.id,
        invoiceId,
        action: accept ? "accepted" : "rejected",
        reason,
        operation: "inbox_invoice_processed",
      },
      `Inbox e-invoice ${accept ? "accepted" : "rejected"}`
    )

    return NextResponse.json({
      success: true,
      invoice: updatedInvoice,
      message: `E-invoice ${accept ? "accepted" : "rejected"} successfully`,
    })
  } catch (error) {
    logger.error({ error }, "Failed to process inbox e-invoice")

    return NextResponse.json({ error: "Failed to process inbox e-invoice" }, { status: 500 })
  }
}

// Additional endpoint for archiving invoices
export async function PATCH(request: Request) {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)

    const url = new URL(request.url)
    const invoiceId = url.searchParams.get("invoiceId")
    const action = url.searchParams.get("action") // archive, unarchive

    if (!invoiceId) {
      return NextResponse.json({ error: "Invoice ID is required" }, { status: 400 })
    }

    if (!action || !["archive", "unarchive"].includes(action)) {
      return NextResponse.json(
        { error: "Valid action is required: 'archive' or 'unarchive'" },
        { status: 400 }
      )
    }

    // Verify invoice belongs to company
    const invoice = await db.eInvoice.findFirst({
      where: {
        id: invoiceId,
        companyId: company.id,
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    let updatedInvoice
    if (action === "archive") {
      // Validate status transition
      const transitionValidation = validateTransition(invoice.status, "ARCHIVED")
      if (!transitionValidation.valid) {
        return NextResponse.json({ error: transitionValidation.error }, { status: 400 })
      }

      // Archive the invoice
      updatedInvoice = await db.eInvoice.update({
        where: { id: invoiceId },
        data: {
          status: "ARCHIVED",
          archivedAt: new Date(),
          archiveRef: `ARCHIVE-${invoiceId}-${Date.now()}`, // Create archive reference
        },
      })
    } else {
      // Validate status transition (unarchiving is not allowed per the state machine)
      const transitionValidation = validateTransition(invoice.status, "DELIVERED")
      if (!transitionValidation.valid) {
        return NextResponse.json({ error: transitionValidation.error }, { status: 400 })
      }

      // Unarchive the invoice - restore to original status
      updatedInvoice = await db.eInvoice.update({
        where: { id: invoiceId },
        data: {
          status: "DELIVERED", // Restore to delivered status for inbox
          archivedAt: null,
          archiveRef: null,
        },
      })
    }

    logger.info(
      {
        userId: user.id,
        companyId: company.id,
        invoiceId,
        action,
        operation: `e_invoice_${action}d`,
      },
      `E-invoice ${action}d successfully`
    )

    return NextResponse.json({
      success: true,
      invoice: updatedInvoice,
      message: `E-invoice ${action}d successfully`,
    })
  } catch (error) {
    logger.error({ error }, "Failed to archive/unarchive e-invoice")

    return NextResponse.json({ error: "Failed to archive/unarchive e-invoice" }, { status: 500 })
  }
}
