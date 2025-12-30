import crypto from "node:crypto"
import { Prisma, type JournalEntry, type JournalLine } from "@prisma/client"
import { db } from "@/lib/db"

export type PostingLineInput = {
  accountId: string
  debit: Prisma.Decimal | number | string
  credit: Prisma.Decimal | number | string
  description?: string
  lineNumber?: number
  dimensions?: Prisma.InputJsonValue
}

export type PostingRequest = {
  companyId: string
  entryDate: Date
  description: string
  reference?: string
  createdById?: string
  lines: PostingLineInput[]
  status?: "DRAFT" | "POSTED"
  periodId?: string
}

export type PostingResult = {
  journalEntry: JournalEntry
  journalLines: JournalLine[]
}

const OPEN_PERIOD_STATUSES = ["OPEN", "SOFT_CLOSE"] as const

function toDecimal(value: Prisma.Decimal | number | string): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) {
    return value
  }
  return new Prisma.Decimal(value)
}

function assertLineAmounts(line: PostingLineInput): void {
  const debit = toDecimal(line.debit)
  const credit = toDecimal(line.credit)
  const debitPositive = debit.gt(0)
  const creditPositive = credit.gt(0)

  if ((debitPositive && creditPositive) || (!debitPositive && !creditPositive)) {
    throw new Error("Each journal line must have either debit or credit amount.")
  }

  if (debit.lt(0) || credit.lt(0)) {
    throw new Error("Journal line amounts cannot be negative.")
  }
}

function assertBalanced(lines: PostingLineInput[]): void {
  const totals = lines.reduce(
    (acc, line) => {
      return {
        debit: acc.debit.plus(toDecimal(line.debit)),
        credit: acc.credit.plus(toDecimal(line.credit)),
      }
    },
    { debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(0) }
  )

  if (!totals.debit.equals(totals.credit)) {
    throw new Error(
      `Unbalanced journal entry. debit=${totals.debit.toFixed(2)} credit=${totals.credit.toFixed(2)}`
    )
  }
}

async function resolvePeriod(companyId: string, entryDate: Date, periodId?: string) {
  if (periodId) {
    const period = await db.accountingPeriod.findUnique({
      where: { id: periodId },
    })
    if (period && !OPEN_PERIOD_STATUSES.includes(period.status)) {
      throw new Error(`Accounting period ${periodId} is locked.`)
    }
    return period
  }

  const period = await db.accountingPeriod.findFirst({
    where: {
      companyId,
      status: { in: [...OPEN_PERIOD_STATUSES] },
      startDate: { lte: entryDate },
      endDate: { gte: entryDate },
    },
    orderBy: { startDate: "desc" },
  })

  if (!period) {
    throw new Error("No open accounting period for entry date.")
  }

  return period
}

async function getNextEntryNumber(companyId: string, fiscalYear: number): Promise<number> {
  const result = await db.journalEntry.aggregate({
    where: { companyId, fiscalYear },
    _max: { entryNumber: true },
  })

  return (result._max.entryNumber ?? 0) + 1
}

function computeContentHash(input: PostingRequest, entryNumber: number, periodId: string): string {
  const normalizedLines = input.lines.map((line, index) => ({
    accountId: line.accountId,
    debit: toDecimal(line.debit).toFixed(2),
    credit: toDecimal(line.credit).toFixed(2),
    lineNumber: line.lineNumber ?? index + 1,
  }))

  const canonical = {
    companyId: input.companyId,
    entryNumber,
    entryDate: input.entryDate.toISOString(),
    periodId,
    description: input.description,
    reference: input.reference ?? null,
    lines: normalizedLines.sort((a, b) => a.lineNumber - b.lineNumber),
  }

  return crypto.createHash("sha256").update(JSON.stringify(canonical)).digest("hex")
}

export async function postJournalEntry(input: PostingRequest): Promise<PostingResult> {
  if (!input.lines.length) {
    throw new Error("Journal entry must include at least one line.")
  }

  input.lines.forEach(assertLineAmounts)
  assertBalanced(input.lines)

  const period = await resolvePeriod(input.companyId, input.entryDate, input.periodId)
  if (!period) {
    throw new Error("Accounting period not found.")
  }

  const entryNumber = await getNextEntryNumber(input.companyId, period.fiscalYear)
  const contentHash = computeContentHash(input, entryNumber, period.id)
  const status = input.status ?? "POSTED"
  const now = new Date()

  const result = await db.$transaction(async (tx) => {
    const journalEntry = await tx.journalEntry.create({
      data: {
        companyId: input.companyId,
        entryNumber,
        fiscalYear: period.fiscalYear,
        entryDate: input.entryDate,
        periodId: period.id,
        status,
        description: input.description,
        reference: input.reference,
        contentHash,
        createdById: input.createdById,
        postedAt: status === "POSTED" ? now : null,
        lines: {
          create: input.lines.map((line, index) => ({
            accountId: line.accountId,
            debit: toDecimal(line.debit),
            credit: toDecimal(line.credit),
            lineNumber: line.lineNumber ?? index + 1,
            description: line.description,
            dimensions: line.dimensions ?? Prisma.DbNull,
          })),
        },
      },
      include: { lines: true },
    })

    return journalEntry
  })

  return { journalEntry: result, journalLines: result.lines }
}
