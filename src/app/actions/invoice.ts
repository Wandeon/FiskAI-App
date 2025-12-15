'use server'

import { db } from '@/lib/db'
import { requireAuth, requireCompanyWithContext } from '@/lib/auth-utils'
import { revalidatePath } from 'next/cache'
import { Prisma, InvoiceType } from '@prisma/client'
import { getNextInvoiceNumber } from '@/lib/invoice-numbering'
import { canCreateInvoice, getUsageStats } from '@/lib/billing/stripe'

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
        return { success: false, error: 'Kupac nije pronađen' }
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
          vatCategory: line.vatCategory || 'S',
          vatAmount,
        }
      })

      // Calculate totals
      const netAmount = lineItems.reduce((sum, l) => sum.add(l.netAmount), new Decimal(0))
      const vatAmount = lineItems.reduce((sum, l) => sum.add(l.vatAmount), new Decimal(0))
      const totalAmount = netAmount.add(vatAmount)

      const invoice = await db.eInvoice.create({
        data: {
          type: input.type,
          direction: 'OUTBOUND',
          invoiceNumber: numbering.invoiceNumber,
          internalReference: numbering.internalReference,
          buyerId: input.buyerId,
          issueDate: input.issueDate,
          dueDate: input.dueDate,
          currency: input.currency || 'EUR',
          notes: input.notes,
          netAmount,
          vatAmount,
          totalAmount,
          status: 'DRAFT',
          lines: { create: lineItems },
        },
        include: { lines: true, buyer: true },
      })

      revalidatePath('/invoices')
      return { success: true, data: invoice }
    })
  } catch (error) {
    console.error('Failed to create invoice:', error)
    return { success: false, error: 'Greška pri kreiranju dokumenta' }
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
        return { success: false, error: 'Dokument nije pronađen' }
      }

      if (source.type !== 'QUOTE' && source.type !== 'PROFORMA') {
        return { success: false, error: 'Samo ponude i predračuni mogu biti pretvoreni u račune' }
      }

      // Generate new invoice number
      const numbering = await getNextInvoiceNumber(company.id)

      // Create new invoice from source
      const invoice = await db.eInvoice.create({
        data: {
          type: 'INVOICE',
          direction: 'OUTBOUND',
          invoiceNumber: numbering.invoiceNumber,
          internalReference: numbering.internalReference,
          buyerId: source.buyerId,
          issueDate: new Date(),
          dueDate: source.dueDate,
          currency: source.currency,
          notes: source.notes,
          netAmount: source.netAmount,
          vatAmount: source.vatAmount,
          totalAmount: source.totalAmount,
          status: 'DRAFT',
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

      revalidatePath('/invoices')
      revalidatePath(`/invoices/${source.id}`)
      return { success: true, data: invoice }
    })
  } catch (error) {
    console.error('Failed to convert to invoice:', error)
    return { success: false, error: 'Greška pri pretvaranju u račun' }
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
        where: { id, status: 'DRAFT' },
      })

      if (!existing) {
        return { success: false, error: 'Dokument nije pronađen ili nije nacrt' }
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
            vatCategory: line.vatCategory || 'S',
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

      revalidatePath('/invoices')
      revalidatePath(`/invoices/${id}`)
      return { success: true, data: invoice }
    })
  } catch (error) {
    console.error('Failed to update invoice:', error)
    return { success: false, error: 'Greška pri ažuriranju dokumenta' }
  }
}

export async function deleteInvoice(id: string): Promise<ActionResult> {
  try {
    const user = await requireAuth()

    return requireCompanyWithContext(user.id!, async () => {
      const invoice = await db.eInvoice.findFirst({
        where: { id, status: 'DRAFT' },
      })

      if (!invoice) {
        return { success: false, error: 'Samo nacrte je moguće obrisati' }
      }

      // Check if this invoice was converted to something
      const converted = await db.eInvoice.findFirst({
        where: { convertedFromId: id },
      })

      if (converted) {
        return { success: false, error: 'Nije moguće obrisati dokument koji je pretvoren u drugi dokument' }
      }

      await db.eInvoice.delete({ where: { id } })

      revalidatePath('/invoices')
      return { success: true }
    })
  } catch (error) {
    console.error('Failed to delete invoice:', error)
    return { success: false, error: 'Greška pri brisanju dokumenta' }
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
        lines: { orderBy: { lineNumber: 'asc' } },
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
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(options?.cursor && { cursor: { id: options.cursor }, skip: 1 }),
    })

    const hasMore = invoices.length > limit
    const items = hasMore ? invoices.slice(0, -1) : invoices
    const nextCursor = hasMore ? items[items.length - 1]?.id : undefined

    return { items, nextCursor, hasMore }
  })
}
