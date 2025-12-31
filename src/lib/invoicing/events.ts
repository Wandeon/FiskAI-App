import { Prisma, InvoiceEventType } from "@prisma/client"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"

const ISSUED_STATUSES = ["FISCALIZED", "SENT", "DELIVERED", "ACCEPTED"] as const

export async function emitInvoiceEvent(params: {
  companyId: string
  invoiceId: string
  type: InvoiceEventType
  payload?: Prisma.JsonValue
}): Promise<void> {
  try {
    await db.invoiceEvent.create({
      data: {
        companyId: params.companyId,
        invoiceId: params.invoiceId,
        type: params.type,
        payload: params.payload ?? undefined,
      },
    })
  } catch (error) {
    const prismaError = error as { code?: string }
    if (prismaError.code !== "P2002") {
      logger.warn({ error, invoiceId: params.invoiceId }, "Failed to emit invoice event")
    }
  }
}

export async function recordRevenueRegisterEntry(invoiceId: string): Promise<void> {
  const invoice = await db.eInvoice.findFirst({
    where: { id: invoiceId, status: { in: [...ISSUED_STATUSES] } },
    select: {
      id: true,
      companyId: true,
      issueDate: true,
      netAmount: true,
      vatAmount: true,
      totalAmount: true,
      currency: true,
    },
  })

  if (!invoice) return

  await db.revenueRegisterEntry.upsert({
    where: { invoiceId: invoice.id },
    create: {
      companyId: invoice.companyId,
      invoiceId: invoice.id,
      issueDate: invoice.issueDate,
      netAmount: invoice.netAmount,
      vatAmount: invoice.vatAmount,
      totalAmount: invoice.totalAmount,
      currency: invoice.currency,
    },
    update: {
      issueDate: invoice.issueDate,
      netAmount: invoice.netAmount,
      vatAmount: invoice.vatAmount,
      totalAmount: invoice.totalAmount,
      currency: invoice.currency,
    },
  })

  await emitInvoiceEvent({
    companyId: invoice.companyId,
    invoiceId: invoice.id,
    type: "REVENUE_REGISTERED",
  })
}
