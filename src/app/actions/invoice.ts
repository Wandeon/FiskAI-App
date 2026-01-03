"use server"

import { z } from "zod"
import { db } from "@/lib/db"
import {
  requireAuth,
  requireCompanyWithContext,
  requireCompanyWithPermission,
} from "@/lib/auth-utils"
import { ensureOrganizationForContact } from "@/lib/master-data/contact-master-data"
import { revalidatePath } from "next/cache"
import { Prisma, InvoiceType, type Company, type EInvoice } from "@prisma/client"
import { getNextInvoiceNumber } from "@/lib/invoice-numbering"
import { canCreateInvoice, getUsageStats } from "@/lib/billing/stripe"
import { eInvoiceSchema } from "@/lib/validations"
import { createEInvoiceProvider, generateUBLInvoice } from "@/lib/e-invoice"
import { decryptOptionalSecret } from "@/lib/secrets"
import { generateInvoicePDF } from "@/lib/pdf/generate-invoice-pdf"
import { shouldFiscalizeInvoice, queueFiscalRequest } from "@/lib/fiscal/should-fiscalize"
import { validateStatusTransition, getTransitionError } from "@/lib/e-invoice-status"
import { validateTransition } from "@/lib/invoice-status-validation"
import { buildVatLineTotals } from "@/lib/vat/output-calculator"
import { emitInvoiceEvent, recordRevenueRegisterEntry } from "@/lib/invoicing/events"
import type { FiscalDecision } from "@/lib/fiscal/should-fiscalize"

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

async function queueFiscalizationOrThrow(params: {
  invoice: EInvoice & {
    companyId: string
    invoiceNumber: string | null
    issueDate: Date
    totalAmount: Prisma.Decimal
  }
  company: Company
  context: string
}): Promise<FiscalDecision> {
  const fiscalDecision = await shouldFiscalizeInvoice({
    ...params.invoice,
    company: params.company,
  })

  if (!fiscalDecision.shouldFiscalize) {
    return fiscalDecision
  }

  const requestId = await queueFiscalRequest(
    params.invoice,
    { id: params.company.id, oib: params.company.oib },
    fiscalDecision
  )

  if (!requestId) {
    throw new Error(
      `${params.context}: Neuspješno pokretanje fiskalizacije. Provjerite certifikat i pokušajte ponovno.`
    )
  }

  await db.eInvoice.update({
    where: { id: params.invoice.id },
    data: { fiscalStatus: "PENDING" },
  })

  await emitInvoiceEvent({
    companyId: params.company.id,
    invoiceId: params.invoice.id,
    type: "FISCALIZATION_TRIGGERED",
    payload: fiscalDecision as unknown as Prisma.JsonValue,
  })

  return fiscalDecision
}

export async function createCreditNote(
  originalInvoiceId: string,
  reason?: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireAuth()

    return requireCompanyWithPermission(user.id!, "invoice:create", async (company) => {
      const original = await db.eInvoice.findFirst({
        where: { id: originalInvoiceId },
        include: { lines: true },
      })

      if (!original) {
        return { success: false, error: "Originalni račun nije pronađen" }
      }

      if (original.status === "DRAFT") {
        return {
          success: false,
          error: "Storno je moguće tek nakon izdavanja računa",
        }
      }

      const issueDate = new Date()
      const numbering = await getNextInvoiceNumber(company.id, undefined, undefined, issueDate)

      const lineItems = original.lines.map((line) => ({
        lineNumber: line.lineNumber,
        description: line.description,
        quantity: line.quantity.mul(-1),
        unit: line.unit,
        unitPrice: line.unitPrice,
        netAmount: line.netAmount.mul(-1),
        vatRate: line.vatRate,
        vatCategory: line.vatCategory,
        vatAmount: line.vatAmount.mul(-1),
        vatRuleId: line.vatRuleId,
      }))

      const netAmount = lineItems.reduce((sum, l) => sum.add(l.netAmount), new Decimal(0))
      const vatAmount = lineItems.reduce((sum, l) => sum.add(l.vatAmount), new Decimal(0))
      const totalAmount = netAmount.add(vatAmount)

      const creditNote = await db.eInvoice.create({
        data: {
          companyId: company.id,
          type: "CREDIT_NOTE",
          direction: "OUTBOUND",
          invoiceNumber: numbering.invoiceNumber,
          internalReference: numbering.internalReference,
          buyerId: original.buyerId,
          issueDate,
          dueDate: null,
          currency: original.currency,
          notes: reason ?? `Storno za račun ${original.invoiceNumber}`,
          netAmount,
          vatAmount,
          totalAmount,
          status: "DRAFT",
          correctsInvoiceId: original.id,
          lines: { create: lineItems },
        },
        include: { lines: true, buyer: true },
      })

      revalidatePath("/invoices")
      return { success: true, data: creditNote }
    })
  } catch (error) {
    console.error("Failed to create credit note:", error)
    return { success: false, error: "Greška pri kreiranju storna" }
  }
}

export async function createInvoice(input: CreateInvoiceInput): Promise<ActionResult> {
  try {
    const user = await requireAuth()

    return requireCompanyWithPermission(user.id!, "invoice:create", async (company) => {
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

      const buyerOrganizationId = await ensureOrganizationForContact(company.id, buyer.id)

      // Generate invoice number
      const numbering = await getNextInvoiceNumber(
        company.id,
        undefined,
        undefined,
        input.issueDate
      )

      // Calculate line totals
      const lineItems = await Promise.all(
        input.lines.map(async (line, index) => {
          const totals = await buildVatLineTotals(line, input.issueDate)
          return {
            lineNumber: index + 1,
            ...totals,
          }
        })
      )

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
          buyerOrganizationId,
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

      try {
        await queueFiscalizationOrThrow({
          invoice,
          company,
          context: "Kreiranje računa",
        })
      } catch (fiscalError) {
        await db.eInvoice.delete({ where: { id: invoice.id } })
        return {
          success: false,
          error:
            fiscalError instanceof Error
              ? fiscalError.message
              : "Neuspješno pokretanje fiskalizacije.",
        }
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

    return requireCompanyWithPermission(user.id!, "invoice:create", async (company) => {
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
      const numbering = await getNextInvoiceNumber(company.id, undefined, undefined, new Date())

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
              vatRuleId: line.vatRuleId,
            })),
          },
        },
        include: { lines: true, buyer: true },
      })

      try {
        await queueFiscalizationOrThrow({
          invoice,
          company,
          context: "Pretvaranje u račun",
        })
      } catch (fiscalError) {
        await db.eInvoice.delete({ where: { id: invoice.id } })
        return {
          success: false,
          error:
            fiscalError instanceof Error
              ? fiscalError.message
              : "Neuspješno pokretanje fiskalizacije.",
        }
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

    return requireCompanyWithPermission(user.id!, "invoice:update", async () => {
      const existing = await db.eInvoice.findFirst({
        where: { id, status: "DRAFT" },
        select: { id: true, issueDate: true, jir: true, fiscalizedAt: true },
      })

      if (!existing) {
        return {
          success: false,
          error:
            "Dokument nije pronađen ili nije nacrt. Korekcije se rade isključivo kroz storno (kreditnu notu).",
        }
      }

      if (existing.jir || existing.fiscalizedAt) {
        return { success: false, error: "Fiskalizirani račun nije moguće mijenjati" }
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
        const effectiveIssueDate = input.issueDate ?? existing.issueDate
        const lineItems = await Promise.all(
          input.lines.map(async (line, index) => {
            const totals = await buildVatLineTotals(line, effectiveIssueDate)
            return {
              lineNumber: index + 1,
              ...totals,
            }
          })
        )

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

      if (invoice.jir || invoice.fiscalizedAt) {
        return { success: false, error: "Fiskalizirani račun nije moguće obrisati" }
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

    const buyerOrganizationId = await ensureOrganizationForContact(company.id, buyerId)

    // Generate invoice number if not provided (using Croatian format)
    let invoiceNumber = invoiceData.invoiceNumber
    let internalReference: string | undefined

    if (!invoiceNumber || invoiceNumber.trim() === "") {
      const numbering = await getNextInvoiceNumber(
        company.id,
        undefined,
        undefined,
        invoiceData.issueDate
      )
      invoiceNumber = numbering.invoiceNumber
      internalReference = numbering.internalReference
    }

    // Calculate totals using Decimal for all money calculations
    const lineItems = await Promise.all(
      lines.map(async (line, index) => {
        const totals = await buildVatLineTotals(line, invoiceData.issueDate)
        return {
          lineNumber: index + 1,
          ...totals,
        }
      })
    )

    // Calculate totals using Decimal
    const netAmount = lineItems.reduce((sum, line) => sum.add(line.netAmount), new Decimal(0))
    const vatAmount = lineItems.reduce((sum, line) => sum.add(line.vatAmount), new Decimal(0))
    const totalAmount = netAmount.add(vatAmount)

    const eInvoice = await db.eInvoice.create({
      data: {
        companyId: company.id,
        direction: "OUTBOUND",
        buyerId,
        buyerOrganizationId,
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

    try {
      await queueFiscalizationOrThrow({
        invoice: eInvoice,
        company,
        context: "Kreiranje e-računa",
      })
    } catch (fiscalError) {
      await db.eInvoice.delete({ where: { id: eInvoice.id } })
      return {
        error:
          fiscalError instanceof Error
            ? fiscalError.message
            : "Neuspješno pokretanje fiskalizacije.",
      }
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

    // Validate status transition
    const transitionValidation = validateTransition(eInvoice.status, "SENT")
    if (!transitionValidation.valid) {
      return { error: transitionValidation.error }
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

    try {
      await queueFiscalizationOrThrow({
        invoice: updatedInvoice,
        company,
        context: "Slanje e-računa",
      })
    } catch (fiscalError) {
      const message =
        fiscalError instanceof Error ? fiscalError.message : "Neuspješno pokretanje fiskalizacije."
      await db.eInvoice.update({
        where: { id: eInvoiceId },
        data: {
          status: "ERROR",
          providerError: message,
        },
      })
      return { error: message }
    }

    await recordRevenueRegisterEntry(updatedInvoice.id)

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

    if (eInvoice.jir || eInvoice.fiscalizedAt) {
      return { error: "Fiskalizirani račun nije moguće obrisati" }
    }

    await db.eInvoice.delete({
      where: { id: eInvoiceId },
    })

    revalidatePath("/e-invoices")
    return { success: "E-Invoice deleted" }
  })
}

export async function issueInvoice(invoiceId: string): Promise<ActionResult> {
  try {
    const user = await requireAuth()

    return requireCompanyWithPermission(user.id!, "invoice:update", async () => {
      const invoice = await db.eInvoice.findUnique({
        where: { id: invoiceId },
        select: { status: true, companyId: true, lines: { select: { id: true } } },
      })

      if (!invoice) {
        return { success: false, error: "Invoice not found" }
      }

      if (invoice.status !== "DRAFT") {
        return { success: false, error: "Invoice must be in DRAFT status to issue" }
      }

      if (invoice.lines.length === 0) {
        return { success: false, error: "Invoice must have at least one line item" }
      }

      await db.eInvoice.update({
        where: { id: invoiceId },
        data: { status: "PENDING_FISCALIZATION" },
      })

      revalidatePath("/invoices")
      revalidatePath(`/invoices/${invoiceId}`)
      return { success: true }
    })
  } catch (error) {
    console.error("Failed to issue invoice:", error)
    return { success: false, error: "Failed to issue invoice" }
  }
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

    // Validate status transition
    const transitionValidation = validateTransition(eInvoice.status, "ACCEPTED")
    if (!transitionValidation.valid) {
      return { error: transitionValidation.error }
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
