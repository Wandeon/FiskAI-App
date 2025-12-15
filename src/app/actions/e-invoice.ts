"use server"

import { z } from "zod"
import { db } from "@/lib/db"
import { requireAuth, requireCompanyWithContext } from "@/lib/auth-utils"
import { eInvoiceSchema } from "@/lib/validations"
import { createEInvoiceProvider, generateUBLInvoice } from "@/lib/e-invoice"
import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"
import { decryptOptionalSecret } from "@/lib/secrets"
import { getNextInvoiceNumber } from "@/lib/invoice-numbering"
import { shouldFiscalizeInvoice, queueFiscalRequest } from "@/lib/fiscal/should-fiscalize"
import { canCreateInvoice, getUsageStats } from "@/lib/billing/stripe"
const Decimal = Prisma.Decimal

export async function createEInvoice(formData: z.input<typeof eInvoiceSchema>) {
  const user = await requireAuth()

  return requireCompanyWithContext(user.id!, async (company) => {
    // Check invoice limit before creating
    const canCreate = await canCreateInvoice(company.id)
    if (!canCreate) {
      const usage = await getUsageStats(company.id)
      return {
        error: "Dostigli ste mjesečni limit računa",
        limitReached: true,
        usage: {
          used: usage.invoices.used,
          limit: usage.invoices.limit,
          plan: usage.plan,
        },
      }
    }

    const validatedFields = eInvoiceSchema.safeParse(formData)

    if (!validatedFields.success) {
      return { error: "Invalid fields", details: validatedFields.error.flatten() }
    }

    const { buyerId, lines, ...invoiceData } = validatedFields.data

    // Verify buyer belongs to this company (automatically filtered by tenant context)
    const buyerExists = await db.contact.findFirst({
      where: { id: buyerId },
      select: { id: true }
    })

    if (!buyerExists) {
      return { error: "Invalid buyer - contact not found or doesn't belong to your company" }
    }

    // Generate invoice number if not provided (using Croatian format)
    let invoiceNumber = invoiceData.invoiceNumber
    let internalReference: string | undefined

    if (!invoiceNumber || invoiceNumber.trim() === "") {
      const numbering = await getNextInvoiceNumber(company.id)
      invoiceNumber = numbering.invoiceNumber
      internalReference = numbering.internalReference
    }

    // Calculate totals using Decimal for all money calculations
    const lineItems = lines.map((line, index) => {
      // Use Decimal for all money calculations
      const quantity = new Decimal(line.quantity)
      const unitPrice = new Decimal(line.unitPrice)
      const vatRate = new Decimal(line.vatRate)

      const netAmount = quantity.mul(unitPrice)
      const vatAmount = netAmount.mul(vatRate).div(100)

      return {
        lineNumber: index + 1,
        description: line.description,
        quantity,
        unit: line.unit,
        unitPrice,
        netAmount,
        vatRate,
        vatCategory: line.vatCategory,
        vatAmount,
      }
    })

    // Calculate totals using Decimal
    const netAmount = lineItems.reduce(
      (sum, line) => sum.add(line.netAmount),
      new Decimal(0)
    )
    const vatAmount = lineItems.reduce(
      (sum, line) => sum.add(line.vatAmount),
      new Decimal(0)
    )
    const totalAmount = netAmount.add(vatAmount)

    const eInvoice = await db.eInvoice.create({
      data: {
        direction: "OUTBOUND",
        buyerId,
        invoiceNumber,
        issueDate: invoiceData.issueDate,
        dueDate: invoiceData.dueDate,
        currency: invoiceData.currency,
        buyerReference: internalReference || invoiceData.buyerReference,
        bankAccount: invoiceData.bankAccount?.trim() || null,
        includeBarcode: invoiceData.includeBarcode ?? true,
        netAmount,
        vatAmount,
        totalAmount,
        status: "DRAFT",
        lines: {
          create: lineItems,
        },
      },
      include: {
        lines: true,
        buyer: true,
        seller: true,
        company: true,
      },
    })

    revalidatePath("/e-invoices")
    return { success: "E-Invoice created", data: eInvoice }
  })
}

export async function sendEInvoice(eInvoiceId: string) {
  const user = await requireAuth()

  return requireCompanyWithContext(user.id!, async (company) => {
    const eInvoice = await db.eInvoice.findFirst({
      where: {
        id: eInvoiceId,
        direction: "OUTBOUND",
        status: "DRAFT",
      },
      include: {
        lines: true,
        buyer: true,
        seller: true,
        company: true,
      },
    })

    if (!eInvoice) {
      return { error: "E-Invoice not found or already sent" }
    }

    // Generate UBL XML
    const ublXml = generateUBLInvoice(eInvoice)

    // Get provider (use mock for now)
    const providerName = company.eInvoiceProvider || "mock"

    // Decrypt API key with error handling
    let apiKey = ""
    try {
      apiKey = decryptOptionalSecret(company.eInvoiceApiKeyEncrypted) || ""
    } catch {
      return { error: "Failed to decrypt API key. Please reconfigure your e-invoice settings." }
    }

    const provider = createEInvoiceProvider(providerName, { apiKey })

    // Send via provider
    const result = await provider.sendInvoice(eInvoice, ublXml)

    if (!result.success) {
      await db.eInvoice.update({
        where: { id: eInvoiceId },
        data: {
          status: "ERROR",
          providerError: result.error,
        },
      })
      return { error: result.error || "Failed to send invoice" }
    }

    // Update invoice with fiscalization data
    const updatedInvoice = await db.eInvoice.update({
      where: { id: eInvoiceId },
      data: {
        status: "SENT",
        ublXml,
        providerRef: result.providerRef,
        jir: result.jir,
        zki: result.zki,
        fiscalizedAt: result.jir ? new Date() : null,
        sentAt: new Date(),
      },
      include: {
        company: true,
      },
    })

    // After invoice is sent, check if it needs fiscalization
    try {
      const fiscalDecision = await shouldFiscalizeInvoice({
        ...updatedInvoice,
        company,
      })

      if (fiscalDecision.shouldFiscalize) {
        await queueFiscalRequest(updatedInvoice.id, company.id, fiscalDecision)
        await db.eInvoice.update({
          where: { id: updatedInvoice.id },
          data: { fiscalStatus: 'PENDING' }
        })
      }
    } catch (fiscalError) {
      // Log but don't fail the invoice send if fiscalization queueing fails
      console.error('[sendEInvoice] Fiscalization queueing error:', fiscalError)
    }

    revalidatePath("/e-invoices")
    return { success: "E-Invoice sent successfully", data: result }
  })
}

export async function getEInvoices(options?: {
  direction?: "OUTBOUND" | "INBOUND"
  status?: string
  cursor?: string
  limit?: number
}) {
  const user = await requireAuth()

  return requireCompanyWithContext(user.id!, async () => {
    const limit = Math.min(options?.limit ?? 20, 100)

    const invoices = await db.eInvoice.findMany({
      where: {
        ...(options?.direction && { direction: options.direction }),
        ...(options?.status && { status: options.status as "DRAFT" | "PENDING_FISCALIZATION" | "FISCALIZED" | "SENT" | "DELIVERED" | "ACCEPTED" | "REJECTED" | "ARCHIVED" | "ERROR" }),
      },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        totalAmount: true,
        vatAmount: true,
        issueDate: true,
        dueDate: true,
        jir: true,
        currency: true,
        createdAt: true,
        buyer: {
          select: { name: true, oib: true }
        }
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(options?.cursor && {
        cursor: { id: options.cursor },
        skip: 1,
      }),
    })

    const hasMore = invoices.length > limit
    const items = hasMore ? invoices.slice(0, -1) : invoices
    const nextCursor = hasMore ? items[items.length - 1]?.id : undefined

    return { items, nextCursor, hasMore }
  })
}

export async function getEInvoice(eInvoiceId: string) {
  const user = await requireAuth()

  return requireCompanyWithContext(user.id!, async () => {
    return db.eInvoice.findFirst({
      where: { id: eInvoiceId },
      include: {
        buyer: true,
        seller: true,
        company: true,
        lines: true,
      },
    })
  })
}

export async function deleteEInvoice(eInvoiceId: string) {
  const user = await requireAuth()

  return requireCompanyWithContext(user.id!, async () => {
    const eInvoice = await db.eInvoice.findFirst({
      where: {
        id: eInvoiceId,
        status: "DRAFT",
      },
    })

    if (!eInvoice) {
      return { error: "Can only delete draft invoices" }
    }

    await db.eInvoice.delete({
      where: { id: eInvoiceId },
    })

    revalidatePath("/e-invoices")
    return { success: "E-Invoice deleted" }
  })
}

export async function markInvoiceAsPaid(invoiceId: string) {
  const user = await requireAuth()

  return requireCompanyWithContext(user.id!, async () => {
    // Find invoice and validate ownership (automatically filtered by tenant context)
    const eInvoice = await db.eInvoice.findFirst({
      where: { id: invoiceId },
    })

    if (!eInvoice) {
      return { error: "Invoice not found or you don't have permission to access it" }
    }

    // Check if invoice is in a valid status to be marked as paid
    const validStatuses = ["FISCALIZED", "SENT", "DELIVERED"]
    if (!validStatuses.includes(eInvoice.status)) {
      return { error: "Invoice must be fiscalized, sent, or delivered to mark as paid" }
    }

    // Check if already paid
    if (eInvoice.paidAt) {
      return { error: "Invoice is already marked as paid" }
    }

    // Update invoice
    await db.eInvoice.update({
      where: { id: invoiceId },
      data: {
        paidAt: new Date(),
        status: "ACCEPTED",
      },
    })

    revalidatePath("/e-invoices")
    revalidatePath(`/e-invoices/${invoiceId}`)
    return { success: "Invoice marked as paid" }
  })
}

export async function sendInvoiceEmail(invoiceId: string) {
  const user = await requireAuth()

  return requireCompanyWithContext(user.id!, async () => {
    // Fetch invoice with buyer contact email (automatically filtered by tenant context)
    const invoice = await db.eInvoice.findFirst({
      where: { id: invoiceId },
      include: {
        buyer: true,
        company: true,
        lines: true,
      },
    })

    if (!invoice) {
      return { error: "Invoice not found or you don't have permission to access it" }
    }

    // Check if buyer has email
    if (!invoice.buyer?.email) {
      return { error: "Buyer does not have an email address" }
    }

    // Check if invoice is in a valid status to be sent
    const validStatuses = ["FISCALIZED", "SENT", "DELIVERED"]
    if (!validStatuses.includes(invoice.status)) {
      return { error: "Invoice must be fiscalized before sending via email" }
    }

    try {
      // Generate PDF using existing API endpoint
      const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002"
      const pdfUrl = `${baseUrl}/api/invoices/${invoiceId}/pdf`

      // For server-side, we need to use absolute URL
      const pdfResponse = await fetch(pdfUrl, {
        headers: {
          "x-invoice-id": invoiceId,
        },
      })

      if (!pdfResponse.ok) {
        return { error: "Failed to generate PDF" }
      }

      const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer())

      // Prepare email
      const { sendEmail } = await import("@/lib/email")
      const InvoiceEmail = (await import("@/lib/email/templates/invoice-email")).default

      // Check if buyer is B2B (has OIB and is a company)
      const isB2B = !!invoice.buyer.oib && invoice.buyer.oib.length === 11

      // Send email with PDF attachment
      const result = await sendEmail({
        to: invoice.buyer.email,
        subject: `Račun ${invoice.invoiceNumber} - ${invoice.company.name}`,
        react: InvoiceEmail({
          invoiceNumber: invoice.invoiceNumber,
          buyerName: invoice.buyer.name,
          issueDate: new Date(invoice.issueDate).toLocaleDateString("hr-HR"),
          dueDate: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("hr-HR") : undefined,
          totalAmount: Number(invoice.totalAmount).toFixed(2),
          currency: invoice.currency,
          companyName: invoice.company.name,
          jir: invoice.jir || undefined,
          isB2B,
        }),
        attachments: [
          {
            filename: `racun-${invoice.invoiceNumber.replace(/\//g, "-")}.pdf`,
            content: pdfBuffer,
          },
        ],
      })

      if (!result.success) {
        return { error: result.error || "Failed to send email" }
      }

      // Track sentAt timestamp and email message ID for webhook tracking
      await db.eInvoice.update({
        where: { id: invoiceId },
        data: {
          sentAt: new Date(),
          emailMessageId: result.data?.id || null,
        },
      })

      revalidatePath(`/invoices/${invoiceId}`)
      return { success: "Email sent successfully" }
    } catch (error) {
      console.error("Error sending invoice email:", error)
      return { error: error instanceof Error ? error.message : "Failed to send email" }
    }
  })
}
