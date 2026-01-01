// src/infrastructure/invoicing/PrismaInvoiceRepository.ts
import { Prisma, EInvoiceStatus } from "@prisma/client"
import { prisma } from "@/lib/db"
import { InvoiceRepository } from "@/domain/invoicing/InvoiceRepository"
import { Invoice, InvoiceId, InvoiceNumber, InvoiceStatus, InvoiceLine } from "@/domain/invoicing"
import { Quantity, VatRate } from "@/domain/shared"
import { MoneyMapper } from "@/infrastructure/mappers/MoneyMapper"

/**
 * Map domain InvoiceStatus to Prisma EInvoiceStatus.
 * Domain uses CANCELED, DB uses REJECTED.
 */
function toPrismaStatus(status: InvoiceStatus): EInvoiceStatus {
  if (status === InvoiceStatus.CANCELED) return EInvoiceStatus.REJECTED
  return status as unknown as EInvoiceStatus
}

/**
 * Map Prisma EInvoiceStatus to domain InvoiceStatus.
 * DB uses REJECTED and ERROR, domain uses CANCELED and DRAFT.
 */
function toDomainStatus(status: EInvoiceStatus): InvoiceStatus {
  if (status === EInvoiceStatus.REJECTED) return InvoiceStatus.CANCELED
  if (status === EInvoiceStatus.ERROR) return InvoiceStatus.DRAFT // fallback
  return status as unknown as InvoiceStatus
}

type EInvoiceWithLines = Prisma.EInvoiceGetPayload<{
  include: { lines: true }
}>

export class PrismaInvoiceRepository implements InvoiceRepository {
  async save(invoice: Invoice): Promise<void> {
    const lines = invoice.getLines()

    // For new drafts without invoice number, use a placeholder
    const invoiceNumberStr = invoice.invoiceNumber?.format() ?? `DRAFT-${invoice.id.toString()}`

    await prisma.eInvoice.upsert({
      where: { id: invoice.id.toString() },
      create: {
        id: invoice.id.toString(),
        companyId: invoice.sellerId,
        direction: "OUTBOUND",
        sellerId: invoice.sellerId,
        buyerId: invoice.buyerId,
        invoiceNumber: invoiceNumberStr,
        issueDate: invoice.issueDate ?? new Date(),
        dueDate: invoice.dueDate ?? null,
        netAmount: MoneyMapper.toPrismaDecimal(invoice.netTotal()),
        vatAmount: MoneyMapper.toPrismaDecimal(invoice.vatTotal()),
        totalAmount: MoneyMapper.toPrismaDecimal(invoice.grossTotal()),
        status: toPrismaStatus(invoice.status),
        jir: invoice.jir ?? null,
        zki: invoice.zki ?? null,
        type: "INVOICE",
        lines: {
          create: lines.map((line, index) => ({
            id: line.id,
            lineNumber: index + 1,
            description: line.description,
            quantity: new Prisma.Decimal(line.quantity.toNumber()),
            unitPrice: MoneyMapper.toPrismaDecimal(line.unitPrice),
            netAmount: MoneyMapper.toPrismaDecimal(line.netTotal()),
            vatRate: new Prisma.Decimal(line.vatRate.rateAsDecimal().toString()),
            vatAmount: MoneyMapper.toPrismaDecimal(line.vatAmount()),
          })),
        },
      },
      update: {
        buyerId: invoice.buyerId,
        invoiceNumber: invoiceNumberStr,
        issueDate: invoice.issueDate ?? new Date(),
        dueDate: invoice.dueDate ?? null,
        netAmount: MoneyMapper.toPrismaDecimal(invoice.netTotal()),
        vatAmount: MoneyMapper.toPrismaDecimal(invoice.vatTotal()),
        totalAmount: MoneyMapper.toPrismaDecimal(invoice.grossTotal()),
        status: toPrismaStatus(invoice.status),
        jir: invoice.jir ?? null,
        zki: invoice.zki ?? null,
      },
    })

    // For updates, we need to handle lines separately
    // Delete existing lines and recreate them
    const existing = await prisma.eInvoice.findUnique({
      where: { id: invoice.id.toString() },
      select: { id: true },
    })

    if (existing) {
      // Delete old lines and create new ones
      await prisma.eInvoiceLine.deleteMany({
        where: { eInvoiceId: invoice.id.toString() },
      })

      if (lines.length > 0) {
        await prisma.eInvoiceLine.createMany({
          data: lines.map((line, index) => ({
            id: line.id,
            eInvoiceId: invoice.id.toString(),
            lineNumber: index + 1,
            description: line.description,
            quantity: new Prisma.Decimal(line.quantity.toNumber()),
            unitPrice: MoneyMapper.toPrismaDecimal(line.unitPrice),
            netAmount: MoneyMapper.toPrismaDecimal(line.netTotal()),
            vatRate: new Prisma.Decimal(line.vatRate.rateAsDecimal().toString()),
            vatAmount: MoneyMapper.toPrismaDecimal(line.vatAmount()),
          })),
        })
      }
    }
  }

  async findById(id: InvoiceId): Promise<Invoice | null> {
    const record = await prisma.eInvoice.findUnique({
      where: { id: id.toString() },
      include: { lines: true },
    })
    if (!record) return null
    return this.toDomain(record)
  }

  async findByNumber(number: string, companyId: string): Promise<Invoice | null> {
    const record = await prisma.eInvoice.findFirst({
      where: { invoiceNumber: number, companyId },
      include: { lines: true },
    })
    if (!record) return null
    return this.toDomain(record)
  }

  async nextSequenceNumber(
    companyId: string,
    _premiseCode: number,
    _deviceCode: number
  ): Promise<number> {
    // For now, use a simpler approach - count existing invoices + 1
    // The actual InvoiceSequence table uses businessPremisesId which we'd need to resolve
    const count = await prisma.eInvoice.count({
      where: {
        companyId,
        invoiceNumber: { not: { startsWith: "DRAFT-" } },
        issueDate: {
          gte: new Date(new Date().getFullYear(), 0, 1),
          lt: new Date(new Date().getFullYear() + 1, 0, 1),
        },
      },
    })
    return count + 1
  }

  private toDomain(record: EInvoiceWithLines): Invoice {
    const lines = (record.lines || []).map((line) =>
      InvoiceLine.create({
        id: line.id,
        description: line.description,
        quantity: Quantity.of(Number(line.quantity)),
        unitPrice: MoneyMapper.fromPrismaDecimal(line.unitPrice),
        vatRate: VatRate.standard(line.vatRate.toString()),
      })
    )

    const invoiceNumber = record.invoiceNumber.startsWith("DRAFT-")
      ? undefined
      : InvoiceNumber.parse(record.invoiceNumber)

    return Invoice.reconstitute({
      id: InvoiceId.fromString(record.id),
      invoiceNumber,
      status: toDomainStatus(record.status),
      buyerId: record.buyerId ?? "",
      sellerId: record.sellerId ?? record.companyId,
      issueDate: record.issueDate ?? undefined,
      dueDate: record.dueDate ?? undefined,
      lines,
      jir: record.jir ?? undefined,
      zki: record.zki ?? undefined,
      fiscalizedAt: record.fiscalizedAt ?? undefined,
      version: 1, // DB doesn't have version, default to 1
    })
  }
}
