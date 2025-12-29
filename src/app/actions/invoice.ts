"use server"

import { z } from "zod"
import { db } from "@/lib/db"
import {
  requireAuth,
  requireCompanyWithContext,
  requireCompanyWithPermission,
} from "@/lib/auth-utils"
import { revalidatePath } from "next/cache"
import { Prisma, InvoiceType } from "@prisma/client"
import { getNextInvoiceNumber } from "@/lib/invoice-numbering"
import { canCreateInvoice, getUsageStats } from "@/lib/billing/stripe"
import { eInvoiceSchema } from "@/lib/validations"
import { createEInvoiceProvider, generateUBLInvoice } from "@/lib/e-invoice"
import { decryptOptionalSecret } from "@/lib/secrets"
import { generateInvoicePDF } from "@/lib/pdf/generate-invoice-pdf"
import { shouldFiscalizeInvoice, queueFiscalRequest } from "@/lib/fiscal/should-fiscalize"

const Decimal = Prisma.Decimal

interface ActionResult<T = unknown> {
  success: boolean
  error?: string
  data?: T
}

interface CreateInvoiceInput {
  type: InvoiceType
  buyerId: string
  issueDate: Date
  dueDate?: Date
  currency?: string
  notes?: string
  lines: Array<{
    description: string
    quantity: number
    unit: string
    unitPrice: number
    vatRate: number
    vatCategory?: string
  }>
}

export async function createInvoice(input: CreateInvoiceInput): Promise<ActionResult> {
  try {
    const user = await requireAuth()

    return requireCompanyWithContext(user.id!, async (company) => {
      // Check invoice limit before creating
      const canCreate = await canCreateInvoice(company.id)
      if (!canCreate) {
        const usage = await getUsageStats(company.id)
        return {
          success: false,
          error: `Dostigli ste mjesečni limit računa (${usage.invoices.used}/${usage.invoices.limit}). Nadogradite plan za više računa.`,
        }
      }

      // Verify buyer belongs to company (now automatically filtered by tenant context)
      const buyer = await db.contact.findFirst({
        where: { id: input.buyerId },
      })

      if (!buyer) {
        return { success: false, error: "Kupac nije pronađen" }
      }

      // Generate invoice number
      const numbering = await getNextInvoiceNumber(company.id)

      // Calculate line totals
      const lineItems = input.lines.map((line, index) => {
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
          vatCategory: line.vatCategory || "S",
          vatAmount,
        }
      })

      // Calculate totals
      const netAmount = lineItems.reduce((sum, l) => sum.add(l.netAmount), new Decimal(0))
      const vatAmount = lineItems.reduce((sum, l) => sum.add(l.vatAmount), new Decimal(0))
      const totalAmount = netAmount.add(vatAmount)

      const invoice = await db.eInvoice.create({
        data: {
          companyId: company.id,
          type: input.type,
          direction: "OUTBOUND",
          invoiceNumber: numbering.invoiceNumber,
          internalReference: numbering.internalReference,
          buyerId: input.buyerId,
          issueDate: input.issueDate,
          dueDate: input.dueDate ?? null,
          currency: input.currency || "EUR",
          notes: input.notes ?? null,
          netAmount,
          vatAmount,
          totalAmount,
          status: "DRAFT",
          lines: { create: lineItems },
        },
        include: { lines: true, buyer: true },
      })

      // Check if invoice should be fiscalized automatically
      try {
        const fiscalDecision = await shouldFiscalizeInvoice({
          ...invoice,
          company,
        })

        if (fiscalDecision.shouldFiscalize) {
          await queueFiscalRequest(invoice.id, company.id, fiscalDecision)
          await db.eInvoice.update({
            where: { id: invoice.id },
            data: { fiscalStatus: "PENDING" },
          })
        }
      } catch (fiscalError) {
        // Log but don't fail invoice creation if fiscalization queueing fails
        console.error("[createInvoice] Fiscalization queueing error:", fiscalError)
      }

      revalidatePath("/invoices")
      return { success: true, data: invoice }
    })
  } catch (error) {
    console.error("Failed to create invoice:", error)
    return { success: false, error: "Greška pri kreiranju dokumenta" }
  }
}

export async function convertToInvoice(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireAuth()

    return requireCompanyWithContext(user.id!, async (company) => {
      // Check invoice limit before converting
      const canCreate = await canCreateInvoice(company.id)
      if (!canCreate) {
        const usage = await getUsageStats(company.id)
        return {
          success: false,
          error: `Dostigli ste mjesečni limit računa (${usage.invoices.used}/${usage.invoices.limit}). Nadogradite plan za više računa.`,
        }
      }

      // Get the source document (automatically filtered by tenant context)
      const source = await db.eInvoice.findFirst({
        where: { id },
        include: { lines: true },
      })

      if (!source) {
        return { success: false, error: "Dokument nije pronađen" }
      }

      if (source.type !== "QUOTE" && source.type !== "PROFORMA") {
        return { success: false, error: "Samo ponude i predračuni mogu biti pretvoreni u račune" }
      }

      // Generate new invoice number
      const numbering = await getNextInvoiceNumber(company.id)

      // Create new invoice from source
      const invoice = await db.eInvoice.create({
        data: {
          companyId: company.id,
          type: "INVOICE",
          direction: "OUTBOUND",
          invoiceNumber: numbering.invoiceNumber,
          internalReference: numbering.internalReference,
          buyerId: source.buyerId ?? null,
          issueDate: new Date(),
          dueDate: source.dueDate ?? null,
          currency: source.currency,
          notes: source.notes ?? null,
          netAmount: source.netAmount,
          vatAmount: source.vatAmount,
          totalAmount: source.totalAmount,
          status: "DRAFT",
          convertedFromId: source.id,
          lines: {
            create: source.lines.map((line) => ({
              lineNumber: line.lineNumber,
              description: line.description,
              quantity: line.quantity,
              unit: line.unit,
              unitPrice: line.unitPrice,
              netAmount: line.netAmount,
              vatRate: line.vatRate,
              vatCategory: line.vatCategory,
              vatAmount: line.vatAmount,
            })),
          },
        },
        include: { lines: true, buyer: true },
      })

      // Check if invoice should be fiscalized automatically
      try {
        const fiscalDecision = await shouldFiscalizeInvoice({
          ...invoice,
          company,
        })

        if (fiscalDecision.shouldFiscalize) {
          await queueFiscalRequest(invoice.id, company.id, fiscalDecision)
          await db.eInvoice.update({
            where: { id: invoice.id },
            data: { fiscalStatus: "PENDING" },
          })
        }
      } catch (fiscalError) {
        // Log but don't fail invoice creation if fiscalization queueing fails
        console.error("[convertToInvoice] Fiscalization queueing error:", fiscalError)
      }

      revalidatePath("/invoices")
      revalidatePath(`/invoices/${source.id}`)
      return { success: true, data: invoice }
    })
  } catch (error) {
    console.error("Failed to convert to invoice:", error)
    return { success: false, error: "Greška pri pretvaranju u račun" }
  }
}

export async function updateInvoice(
  id: string,
  input: Partial<CreateInvoiceInput>
): Promise<ActionResult> {
  try {
    const user = await requireAuth()

    return requireCompanyWithContext(user.id!, async () => {
      const existing = await db.eInvoice.findFirst({
        where: { id, status: "DRAFT" },
      })

      if (!existing) {
        return { success: false, error: "Dokument nije pronađen ili nije nacrt" }
      }

      const updateData: Prisma.EInvoiceUpdateInput = {}

      if (input.buyerId) updateData.buyer = { connect: { id: input.buyerId } }
      if (input.issueDate) updateData.issueDate = input.issueDate
      if (input.dueDate !== undefined) updateData.dueDate = input.dueDate
      if (input.currency) updateData.currency = input.currency
      if (input.notes !== undefined) updateData.notes = input.notes

      // If lines are provided, recalculate totals
      if (input.lines && input.lines.length > 0) {
        // Delete existing lines
        await db.eInvoiceLine.deleteMany({ where: { eInvoiceId: id } })

        // Create new lines
        const lineItems = input.lines.map((line, index) => {
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
            vatCategory: line.vatCategory || "S",
            vatAmount,
          }
        })

        const netAmount = lineItems.reduce((sum, l) => sum.add(l.netAmount), new Decimal(0))
        const vatAmount = lineItems.reduce((sum, l) => sum.add(l.vatAmount), new Decimal(0))
        const totalAmount = netAmount.add(vatAmount)

        updateData.netAmount = netAmount
        updateData.vatAmount = vatAmount
        updateData.totalAmount = totalAmount
        updateData.lines = { create: lineItems }
      }

      const invoice = await db.eInvoice.update({
        where: { id },
        data: updateData,
        include: { lines: true, buyer: true },
      })

      revalidatePath("/invoices")
      revalidatePath(`/invoices/${id}`)
      return { success: true, data: invoice }
    })
  } catch (error) {
    console.error("Failed to update invoice:", error)
    return { success: false, error: "Greška pri ažuriranju dokumenta" }
  }
}

export async function deleteInvoice(id: string): Promise<ActionResult> {
  try {
    const user = await requireAuth()

    return requireCompanyWithPermission(user.id!, "invoice:delete", async () => {
      const invoice = await db.eInvoice.findFirst({
        where: { id, status: "DRAFT" },
      })

      if (!invoice) {
        return { success: false, error: "Samo nacrte je moguće obrisati" }
      }

      // Check if this invoice was converted to something
      const converted = await db.eInvoice.findFirst({
        where: { convertedFromId: id },
      })

      if (converted) {
        return {
          success: false,
          error: "Nije moguće obrisati dokument koji je pretvoren u drugi dokument",
        }
      }

      await db.eInvoice.delete({ where: { id } })

      revalidatePath("/invoices")
      return { success: true }
    })
  } catch (error) {
    console.error("Failed to delete invoice:", error)

    // Check if this is a permission error
    if (error instanceof Error && error.message.includes("Permission denied")) {
      return { success: false, error: "Nemate dopuštenje za brisanje dokumenata" }
    }

    return { success: false, error: "Greška pri brisanju dokumenta" }
  }
}

export async function getInvoice(id: string) {
  const user = await requireAuth()

  return requireCompanyWithContext(user.id!, async () => {
    return db.eInvoice.findFirst({
      where: { id },
      include: {
        buyer: true,
        seller: true,
        lines: { orderBy: { lineNumber: "asc" } },
        convertedFrom: true,
        convertedTo: true,
      },
    })
  })
}

export async function getInvoices(options?: {
  type?: InvoiceType
  status?: string
  cursor?: string
  limit?: number
}) {
  const user = await requireAuth()

  return requireCompanyWithContext(user.id!, async () => {
    const limit = Math.min(options?.limit ?? 20, 100)

    const where: Prisma.EInvoiceWhereInput = {
      ...(options?.type && { type: options.type }),
      ...(options?.status && { status: options.status as Prisma.EnumEInvoiceStatusFilter }),
    }

    const invoices = await db.eInvoice.findMany({
      where,
      include: { buyer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(options?.cursor && { cursor: { id: options.cursor }, skip: 1 }),
    })

    const hasMore = invoices.length > limit
    const items = hasMore ? invoices.slice(0, -1) : invoices
    const nextCursor = hasMore ? items[items.length - 1]?.id : undefined

    return { items, nextCursor, hasMore }
  })
}

// Legacy e-invoice functions migrated with proper RBAC

export async function createEInvoice(formData: z.input<typeof eInvoiceSchema>) {
  const user = await requireAuth()

  return requireCompanyWithPermission(user.id!, "invoice:create", async (company) => {
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
      select: { id: true },
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
    const netAmount = lineItems.reduce((sum, line) => sum.add(line.netAmount), new Decimal(0))
    const vatAmount = lineItems.reduce((sum, line) => sum.add(line.vatAmount), new Decimal(0))
    const totalAmount = netAmount.add(vatAmount)

    const eInvoice = await db.eInvoice.create({
      data: {
        companyId: company.id,
        direction: "OUTBOUND",
        buyerId,
        invoiceNumber,
        issueDate: invoiceData.issueDate,
        dueDate: invoiceData.dueDate ?? null,
        currency: invoiceData.currency,
        buyerReference: internalReference || invoiceData.buyerReference || null,
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

    // Check if invoice should be fiscalized automatically
    try {
      const fiscalDecision = await shouldFiscalizeInvoice({
        ...eInvoice,
        company,
      })

      if (fiscalDecision.shouldFiscalize) {
        await queueFiscalRequest(eInvoice.id, company.id, fiscalDecision)
        await db.eInvoice.update({
          where: { id: eInvoice.id },
          data: { fiscalStatus: "PENDING" },
        })
      }
    } catch (fiscalError) {
      // Log but don't fail invoice creation if fiscalization queueing fails
      console.error("[createEInvoice] Fiscalization queueing error:", fiscalError)
    }

    revalidatePath("/e-invoices")
    return { success: "E-Invoice created", data: eInvoice }
  })
}

export async function sendEInvoice(eInvoiceId: string) {
  const user = await requireAuth()

  return requireCompanyWithPermission(user.id!, "invoice:update", async (company) => {
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
          data: { fiscalStatus: "PENDING" },
        })
      }
    } catch (fiscalError) {
      // Log but don't fail the invoice send if fiscalization queueing fails
      console.error("[sendEInvoice] Fiscalization queueing error:", fiscalError)
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

  return requireCompanyWithPermission(user.id!, "invoice:read", async () => {
    const limit = Math.min(options?.limit ?? 20, 100)

    const invoices = await db.eInvoice.findMany({
      where: {
        ...(options?.direction && { direction: options.direction }),
        ...(options?.status && {
          status: options.status as
            | "DRAFT"
            | "PENDING_FISCALIZATION"
            | "FISCALIZED"
            | "SENT"
            | "DELIVERED"
            | "ACCEPTED"
            | "REJECTED"
            | "ARCHIVED"
            | "ERROR",
        }),
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
          select: { name: true, oib: true },
        },
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

  return requireCompanyWithPermission(user.id!, "invoice:read", async () => {
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

  return requireCompanyWithPermission(user.id!, "invoice:delete", async () => {
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

  return requireCompanyWithPermission(user.id!, "invoice:update", async () => {
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

  return requireCompanyWithPermission(user.id!, "invoice:update", async (company) => {
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
      // Generate PDF directly using shared module (no loopback HTTP call)
      const { buffer: pdfBuffer } = await generateInvoicePDF({
        invoiceId,
        companyId: company.id,
      })

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
          dueDate: invoice.dueDate
            ? new Date(invoice.dueDate).toLocaleDateString("hr-HR")
            : undefined,
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
