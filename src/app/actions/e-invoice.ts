"use server"

import { z } from "zod"
import { db } from "@/lib/db"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { eInvoiceSchema } from "@/lib/validations"
import { createEInvoiceProvider, generateUBLInvoice } from "@/lib/e-invoice"
import { revalidatePath } from "next/cache"
import { Decimal } from "@prisma/client/runtime/library"

export async function createEInvoice(formData: z.infer<typeof eInvoiceSchema>) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  const validatedFields = eInvoiceSchema.safeParse(formData)

  if (!validatedFields.success) {
    return { error: "Invalid fields", details: validatedFields.error.flatten() }
  }

  const { buyerId, lines, ...invoiceData } = validatedFields.data

  // Calculate totals
  const lineItems = lines.map((line, index) => {
    const netAmount = line.quantity * line.unitPrice
    const vatAmount = netAmount * (line.vatRate / 100)
    return {
      lineNumber: index + 1,
      description: line.description,
      quantity: new Decimal(line.quantity),
      unit: line.unit,
      unitPrice: new Decimal(line.unitPrice),
      netAmount: new Decimal(netAmount),
      vatRate: new Decimal(line.vatRate),
      vatCategory: line.vatCategory,
      vatAmount: new Decimal(vatAmount),
    }
  })

  const netAmount = lineItems.reduce(
    (sum, line) => sum + Number(line.netAmount),
    0
  )
  const vatAmount = lineItems.reduce(
    (sum, line) => sum + Number(line.vatAmount),
    0
  )
  const totalAmount = netAmount + vatAmount

  const eInvoice = await db.eInvoice.create({
    data: {
      companyId: company.id,
      direction: "OUTBOUND",
      buyerId,
      invoiceNumber: invoiceData.invoiceNumber,
      issueDate: invoiceData.issueDate,
      dueDate: invoiceData.dueDate,
      currency: invoiceData.currency,
      buyerReference: invoiceData.buyerReference,
      netAmount: new Decimal(netAmount),
      vatAmount: new Decimal(vatAmount),
      totalAmount: new Decimal(totalAmount),
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
  const provider = createEInvoiceProvider(providerName, {
    apiKey: company.eInvoiceApiKey || "",
  })

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

export async function getEInvoices(
  direction?: "OUTBOUND" | "INBOUND",
  status?: string
) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  return db.eInvoice.findMany({
    where: {
      companyId: company.id,
      ...(direction && { direction }),
      ...(status && { status: status as any }),
    },
    include: {
      buyer: true,
      seller: true,
      lines: true,
    },
    orderBy: { createdAt: "desc" },
  })
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
