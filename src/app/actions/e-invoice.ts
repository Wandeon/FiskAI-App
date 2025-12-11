"use server"

import { z } from "zod"
import { db } from "@/lib/db"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { eInvoiceSchema } from "@/lib/validations"
import { createEInvoiceProvider, generateUBLInvoice } from "@/lib/e-invoice"
import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"
import { decryptOptionalSecret } from "@/lib/secrets"
import { getNextInvoiceNumber } from "@/lib/invoice-numbering"
const Decimal = Prisma.Decimal

export async function createEInvoice(formData: z.input<typeof eInvoiceSchema>) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  const validatedFields = eInvoiceSchema.safeParse(formData)

  if (!validatedFields.success) {
    return { error: "Invalid fields", details: validatedFields.error.flatten() }
  }

  const { buyerId, lines, ...invoiceData } = validatedFields.data

  // Verify buyer belongs to this company (prevent cross-tenant data access)
  const buyerExists = await db.contact.findFirst({
    where: {
      id: buyerId,
      companyId: company.id
    },
    select: { id: true }  // Only select what's needed for existence check
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
      companyId: company.id,
      direction: "OUTBOUND",
      buyerId,
      invoiceNumber,  // Use generated or provided invoice number
      issueDate: invoiceData.issueDate,
      dueDate: invoiceData.dueDate,
      currency: invoiceData.currency,
      buyerReference: internalReference || invoiceData.buyerReference,  // Store internal ref in buyerReference for now
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
}

export async function sendEInvoice(eInvoiceId: string) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  const eInvoice = await db.eInvoice.findFirst({
    where: {
      id: eInvoiceId,
      companyId: company.id,
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
  await db.eInvoice.update({
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
  })

  revalidatePath("/e-invoices")
  return { success: "E-Invoice sent successfully", data: result }
}

export async function getEInvoices(options?: {
  direction?: "OUTBOUND" | "INBOUND"
  status?: string
  cursor?: string
  limit?: number
}) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  const limit = Math.min(options?.limit ?? 20, 100)  // Cap at 100 to prevent abuse

  const invoices = await db.eInvoice.findMany({
    where: {
      companyId: company.id,
      ...(options?.direction && { direction: options.direction }),
      ...(options?.status && { status: options.status as "DRAFT" | "PENDING_FISCALIZATION" | "FISCALIZED" | "SENT" | "DELIVERED" | "ACCEPTED" | "REJECTED" | "ARCHIVED" | "ERROR" }),
    },
    // Only select fields needed for list view
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
}

export async function getEInvoice(eInvoiceId: string) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  return db.eInvoice.findFirst({
    where: {
      id: eInvoiceId,
      companyId: company.id,
    },
    include: {
      buyer: true,
      seller: true,
      company: true,
      lines: true,
    },
  })
}

export async function deleteEInvoice(eInvoiceId: string) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  const eInvoice = await db.eInvoice.findFirst({
    where: {
      id: eInvoiceId,
      companyId: company.id,
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
}

export async function markInvoiceAsPaid(invoiceId: string) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  // Find invoice and validate ownership
  const eInvoice = await db.eInvoice.findFirst({
    where: {
      id: invoiceId,
      companyId: company.id,
    },
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
}
