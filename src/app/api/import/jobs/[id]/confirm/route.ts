import { NextResponse } from 'next/server'
import { requireAuth, requireCompany } from '@/lib/auth-utils'
import { db } from '@/lib/db'
import { setTenantContext } from '@/lib/prisma-extensions'
import { Prisma } from '@prisma/client'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)
  const { id } = await params
  const body = await request.json()

  setTenantContext({
    companyId: company.id,
    userId: user.id!,
  })

  const job = await db.importJob.findUnique({ where: { id } })

  if (!job || job.companyId !== company.id) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  if (job.status !== 'READY_FOR_REVIEW') {
    return NextResponse.json({ error: 'Job not ready for confirmation' }, { status: 400 })
  }

  if (job.documentType === 'BANK_STATEMENT') {
    // Handle bank statement confirmation
    const { transactions, bankAccountId } = body

    if (!bankAccountId) {
      return NextResponse.json({ error: 'Bank account required' }, { status: 400 })
    }

    // Write transactions to database
    if (transactions && transactions.length > 0) {
      await db.bankTransaction.createMany({
        data: transactions.map((t: any) => ({
          companyId: company.id,
          bankAccountId,
          date: new Date(t.date),
          description: t.description || '',
          amount: new Prisma.Decimal(Math.abs(t.amount)),
          balance: new Prisma.Decimal(0),
          reference: t.reference || null,
          counterpartyName: t.counterpartyName || null,
          counterpartyIban: t.counterpartyIban || null,
          matchStatus: 'UNMATCHED',
          confidenceScore: 0,
        })),
      })
    }

    // Update job status
    await db.importJob.update({
      where: { id },
      data: {
        status: 'CONFIRMED',
        bankAccountId,
      },
    })

    return NextResponse.json({
      success: true,
      transactionCount: transactions?.length || 0,
    })
  } else if (job.documentType === 'INVOICE') {
    // Handle invoice confirmation - store as Expense
    const { vendor, invoice, lineItems, subtotal, taxAmount, totalAmount, currency, payment } = body

    // Find or create vendor as a Contact
    let vendorContact = null
    if (vendor?.oib) {
      vendorContact = await db.contact.findFirst({
        where: { companyId: company.id, oib: vendor.oib },
      })
    }

    if (!vendorContact && vendor?.name) {
      vendorContact = await db.contact.create({
        data: {
          companyId: company.id,
          type: 'SUPPLIER',
          name: vendor.name,
          oib: vendor.oib || null,
          address: vendor.address || null,
        },
      })
    }

    // Find or create default expense category for imported invoices
    let category = await db.expenseCategory.findFirst({
      where: { companyId: company.id, code: 'IMPORTED' },
    })

    if (!category) {
      category = await db.expenseCategory.create({
        data: {
          companyId: company.id,
          name: 'Uvezeni računi',
          code: 'IMPORTED',
          vatDeductibleDefault: true,
        },
      })
    }

    // Build description from line items
    const lineItemsDesc = (lineItems || [])
      .map((item: any) => item.description)
      .filter(Boolean)
      .join(', ')
    const description = lineItemsDesc || `Račun ${invoice?.number || 'N/A'} - ${vendor?.name || 'Nepoznati dobavljač'}`

    // Create the Expense record
    const expense = await db.expense.create({
      data: {
        companyId: company.id,
        vendorId: vendorContact?.id || null,
        categoryId: category.id,
        description,
        date: invoice?.issueDate ? new Date(invoice.issueDate) : new Date(),
        dueDate: invoice?.dueDate ? new Date(invoice.dueDate) : null,
        netAmount: new Prisma.Decimal(subtotal || 0),
        vatAmount: new Prisma.Decimal(taxAmount || 0),
        totalAmount: new Prisma.Decimal(totalAmount || 0),
        vatDeductible: true,
        currency: currency || 'EUR',
        status: 'PENDING',
        receiptUrl: job.storagePath, // Link to the uploaded document
        notes: JSON.stringify({
          invoiceNumber: invoice?.number,
          vendorIban: payment?.iban || vendor?.iban,
          paymentModel: payment?.model,
          paymentReference: payment?.reference,
          lineItems: lineItems || [],
        }),
      },
    })

    // Update job status
    await db.importJob.update({
      where: { id },
      data: { status: 'CONFIRMED' },
    })

    return NextResponse.json({
      success: true,
      expenseId: expense.id,
      invoiceNumber: invoice?.number || 'N/A',
    })
  }

  // Unknown document type
  return NextResponse.json({ error: 'Unknown document type' }, { status: 400 })
}
