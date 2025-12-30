import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { postJournalEntry } from "./posting-service"

export type OperationalEventProcessingResult = {
  eventId: string
  status: "POSTED" | "FAILED"
  journalEntryId?: string
  error?: string
}

type PostingRuleRecord = {
  debitAccountId: string
  creditAccountId: string
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
    select: { debitAccountId: true, creditAccountId: true },
  })

  if (!rule) {
    throw new Error("Missing posting rule for operational event.")
  }

  return rule
}

function buildBalancedLines(amount: Prisma.Decimal, rule: PostingRuleRecord) {
  return [
    {
      accountId: rule.debitAccountId,
      debit: amount,
      credit: new Prisma.Decimal(0),
      lineNumber: 1,
    },
    {
      accountId: rule.creditAccountId,
      debit: new Prisma.Decimal(0),
      credit: amount,
      lineNumber: 2,
    },
  ]
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
      select: { id: true, invoiceNumber: true, totalAmount: true, issueDate: true },
    })

    if (!invoice) {
      throw new Error("Invoice not found for operational event.")
    }

    const amount = new Prisma.Decimal(invoice.totalAmount)

    return {
      companyId: event.companyId,
      entryDate: invoice.issueDate,
      description: `Invoice ${invoice.invoiceNumber ?? invoice.id}`,
      reference: invoice.invoiceNumber ?? invoice.id,
      lines: buildBalancedLines(amount, rule),
    }
  }

  if (event.sourceType === "EXPENSE") {
    const expense = await db.expense.findUnique({
      where: { id: event.sourceId },
      select: { id: true, description: true, totalAmount: true, date: true },
    })

    if (!expense) {
      throw new Error("Expense not found for operational event.")
    }

    const amount = new Prisma.Decimal(expense.totalAmount)

    return {
      companyId: event.companyId,
      entryDate: expense.date,
      description: expense.description,
      reference: expense.id,
      lines: buildBalancedLines(amount, rule),
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

    const amount = new Prisma.Decimal(transaction.amount)

    return {
      companyId: event.companyId,
      entryDate: transaction.date,
      description: transaction.description ?? `Bank transaction ${transaction.id}`,
      reference: transaction.reference ?? transaction.id,
      lines: buildBalancedLines(amount, rule),
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
