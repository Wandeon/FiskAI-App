import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { postJournalEntry, type PostingLineInput } from "./posting-service"

export type OperationalEventProcessingResult = {
  eventId: string
  status: "POSTED" | "FAILED"
  journalEntryId?: string
  error?: string
}

type PostingRuleRecord = {
  debitAccountId: string
  creditAccountId: string
  vatAccountId?: string | null
}

async function loadPostingRule(event: {
  companyId: string
  sourceType: string
  eventType: string
}): Promise<PostingRuleRecord> {
  const rule = await db.postingRule.findFirst({
    where: {
      companyId: event.companyId,
      sourceType: event.sourceType,
      eventType: event.eventType,
      isActive: true,
    },
    select: {
      debitAccountId: true,
      creditAccountId: true,
      vatAccountId: true,
    },
  })

  if (!rule) {
    throw new Error(
      `Missing posting rule for operational event: ${event.sourceType} / ${event.eventType}`
    )
  }

  return rule
}

function buildSplitLines(
  total: Prisma.Decimal,
  net: Prisma.Decimal,
  vat: Prisma.Decimal,
  rule: PostingRuleRecord,
  isInvoice: boolean
): PostingLineInput[] {
  const lines: PostingLineInput[] = []
  const zero = new Prisma.Decimal(0)

  // LOGIC:
  // For INVOICE (Revenue):
  //  - Debit: Receivables (Total) -> rule.debitAccountId
  //  - Credit: Revenue (Net)      -> rule.creditAccountId
  //  - Credit: VAT (Tax)          -> rule.vatAccountId

  // For EXPENSE (Cost):
  //  - Debit: Cost (Net)          -> rule.debitAccountId
  //  - Debit: VAT (Input Tax)     -> rule.vatAccountId
  //  - Credit: Payables (Total)   -> rule.creditAccountId

  if (isInvoice) {
    // 1. Debit Receivables (Total)
    lines.push({
      accountId: rule.debitAccountId,
      debit: total,
      credit: zero,
      lineNumber: 1,
    })

    // 2. Credit Revenue (Net)
    lines.push({
      accountId: rule.creditAccountId,
      debit: zero,
      credit: net,
      lineNumber: 2,
    })

    // 3. Credit VAT (Tax)
    if (vat.gt(0)) {
      if (!rule.vatAccountId) {
        throw new Error("VAT amount present but no VAT Account defined in Posting Rule")
      }
      lines.push({
        accountId: rule.vatAccountId,
        debit: zero,
        credit: vat,
        lineNumber: 3,
      })
    }
  } else {
    // EXPENSE
    // 1. Debit Cost (Net)
    lines.push({
      accountId: rule.debitAccountId,
      debit: net,
      credit: zero,
      lineNumber: 1,
    })

    // 2. Debit VAT (Input Tax)
    if (vat.gt(0)) {
      if (!rule.vatAccountId) {
        throw new Error("VAT amount present but no VAT Account defined in Posting Rule")
      }
      lines.push({
        accountId: rule.vatAccountId,
        debit: vat,
        credit: zero,
        lineNumber: 2,
      })
    }

    // 3. Credit Payables (Total)
    lines.push({
      accountId: rule.creditAccountId,
      debit: zero,
      credit: total,
      lineNumber: 3, // or 2 if no VAT
    })
  }

  return lines
}

async function buildPostingRequest(event: {
  id: string
  companyId: string
  sourceType: string
  eventType: string
  sourceId: string
  entryDate: Date
}) {
  const rule = await loadPostingRule(event)

  if (event.sourceType === "INVOICE") {
    const invoice = await db.eInvoice.findUnique({
      where: { id: event.sourceId },
      select: {
        id: true,
        invoiceNumber: true,
        totalAmount: true,
        netAmount: true,
        vatAmount: true,
        issueDate: true,
      },
    })

    if (!invoice) {
      throw new Error("Invoice not found for operational event.")
    }

    const lines = buildSplitLines(
      new Prisma.Decimal(invoice.totalAmount),
      new Prisma.Decimal(invoice.netAmount),
      new Prisma.Decimal(invoice.vatAmount),
      rule,
      true
    )

    return {
      companyId: event.companyId,
      entryDate: invoice.issueDate,
      description: `Invoice ${invoice.invoiceNumber ?? invoice.id}`,
      reference: invoice.invoiceNumber ?? invoice.id,
      lines,
    }
  }

  if (event.sourceType === "EXPENSE") {
    const expense = await db.expense.findUnique({
      where: { id: event.sourceId },
      select: {
        id: true,
        description: true,
        totalAmount: true,
        netAmount: true,
        vatAmount: true,
        date: true,
      },
    })

    if (!expense) {
      throw new Error("Expense not found for operational event.")
    }

    const lines = buildSplitLines(
      new Prisma.Decimal(expense.totalAmount),
      new Prisma.Decimal(expense.netAmount),
      new Prisma.Decimal(expense.vatAmount),
      rule,
      false
    )

    return {
      companyId: event.companyId,
      entryDate: expense.date,
      description: expense.description,
      reference: expense.id,
      lines,
    }
  }

  if (event.sourceType === "BANK_TRANSACTION") {
    const transaction = await db.transaction.findUnique({
      where: { id: event.sourceId },
      select: { id: true, amount: true, date: true, description: true, reference: true },
    })

    if (!transaction) {
      throw new Error("Bank transaction not found for operational event.")
    }

    // Bank transactions are usually simple transfers, no VAT split at this level
    // (VAT is handled via Invoice/Expense matching)
    const amount = new Prisma.Decimal(transaction.amount)
    const zero = new Prisma.Decimal(0)

    // For now, simple 2-line entry
    const lines = [
      {
        accountId: rule.debitAccountId,
        debit: amount,
        credit: zero,
        lineNumber: 1,
      },
      {
        accountId: rule.creditAccountId,
        debit: zero,
        credit: amount,
        lineNumber: 2,
      },
    ]

    return {
      companyId: event.companyId,
      entryDate: transaction.date,
      description: transaction.description ?? `Bank transaction ${transaction.id}`,
      reference: transaction.reference ?? transaction.id,
      lines,
    }
  }

  throw new Error("Unsupported operational event source type.")
}

export async function processOperationalEvents(
  limit = 50
): Promise<OperationalEventProcessingResult[]> {
  const events = await db.operationalEvent.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: limit,
  })

  const results: OperationalEventProcessingResult[] = []

  for (const event of events) {
    try {
      const request = await buildPostingRequest(event)
      const result = await postJournalEntry(request)

      await db.operationalEvent.update({
        where: { id: event.id },
        data: {
          status: "POSTED",
          journalEntryId: result.journalEntry.id,
          processedAt: new Date(),
          errorMessage: null,
        },
      })

      results.push({
        eventId: event.id,
        status: "POSTED",
        journalEntryId: result.journalEntry.id,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"

      await db.operationalEvent.update({
        where: { id: event.id },
        data: {
          status: "FAILED",
          processedAt: new Date(),
          errorMessage: message,
        },
      })

      results.push({
        eventId: event.id,
        status: "FAILED",
        error: message,
      })
    }
  }

  return results
}
