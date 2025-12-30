import type { AccountingPeriod, PeriodType } from "@prisma/client"
import { db } from "@/lib/db"
import { logServiceBoundarySnapshot } from "@/lib/audit-hooks"
import { runWithAuditContext } from "@/lib/audit-context"

export interface AccountingPeriodInput {
  startDate: Date
  endDate: Date
  periodType?: PeriodType
  fiscalYear?: number
  periodNumber?: number
}

function resolvePeriodNumber(date: Date, periodType: PeriodType) {
  if (periodType === "ANNUAL") return 1
  if (periodType === "QUARTERLY") return Math.floor(date.getMonth() / 3) + 1
  return date.getMonth() + 1
}

function resolvePeriodDetails(input: AccountingPeriodInput) {
  const periodType = input.periodType ?? "MONTHLY"
  const fiscalYear = input.fiscalYear ?? input.startDate.getFullYear()
  const periodNumber = input.periodNumber ?? resolvePeriodNumber(input.startDate, periodType)
  return { periodType, fiscalYear, periodNumber }
}

function normalizeMonthStart(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1)
}

function normalizeMonthEnd(value: Date) {
  return new Date(value.getFullYear(), value.getMonth() + 1, 0, 23, 59, 59, 999)
}

export async function listAccountingPeriods(companyId: string): Promise<AccountingPeriod[]> {
  return db.accountingPeriod.findMany({
    where: { companyId },
    orderBy: { startDate: "asc" },
  })
}

export async function createAccountingPeriod(
  companyId: string,
  input: AccountingPeriodInput,
  actorId: string,
  reason: string
): Promise<AccountingPeriod> {
  const { periodType, fiscalYear, periodNumber } = resolvePeriodDetails(input)
  const period = await runWithAuditContext({ actorId, reason }, async () =>
    db.accountingPeriod.create({
      data: {
        companyId,
        fiscalYear,
        periodNumber,
        periodType,
        startDate: input.startDate,
        endDate: input.endDate,
      },
    })
  )

  await logServiceBoundarySnapshot({
    companyId,
    userId: actorId,
    actor: actorId,
    reason,
    action: "CREATE",
    entity: "AccountingPeriod",
    entityId: period.id,
    after: {
      startDate: period.startDate,
      endDate: period.endDate,
      status: period.status,
    },
  })

  return period
}

export async function lockAccountingPeriod(
  companyId: string,
  periodId: string,
  actorId: string,
  reason: string
): Promise<AccountingPeriod> {
  const before = await db.accountingPeriod.findUnique({ where: { id: periodId } })
  if (!before || before.companyId !== companyId) {
    throw new Error("Accounting period not found")
  }

  if (before.status === "LOCKED") {
    return before
  }

  const updated = await runWithAuditContext({ actorId, reason }, async () =>
    db.accountingPeriod.update({
      where: { id: periodId },
      data: {
        status: "LOCKED",
        lockedAt: new Date(),
        lockedById: actorId,
        lockReason: reason,
      },
    })
  )

  await logServiceBoundarySnapshot({
    companyId,
    userId: actorId,
    actor: actorId,
    reason,
    action: "UPDATE",
    entity: "AccountingPeriod",
    entityId: updated.id,
    before: {
      status: before.status,
      lockedAt: before.lockedAt,
      lockReason: before.lockReason,
    },
    after: {
      status: updated.status,
      lockedAt: updated.lockedAt,
      lockReason: updated.lockReason,
    },
  })

  return updated
}

export async function unlockAccountingPeriod(
  companyId: string,
  periodId: string,
  actorId: string,
  reason: string
): Promise<AccountingPeriod> {
  const before = await db.accountingPeriod.findUnique({ where: { id: periodId } })
  if (!before || before.companyId !== companyId) {
    throw new Error("Accounting period not found")
  }

  const updated = await runWithAuditContext({ actorId, reason }, async () =>
    db.accountingPeriod.update({
      where: { id: periodId },
      data: {
        status: "OPEN",
        lockedAt: null,
        lockedById: null,
        lockReason: null,
      },
    })
  )

  await logServiceBoundarySnapshot({
    companyId,
    userId: actorId,
    actor: actorId,
    reason,
    action: "UPDATE",
    entity: "AccountingPeriod",
    entityId: updated.id,
    before: {
      status: before.status,
      lockedAt: before.lockedAt,
      lockReason: before.lockReason,
    },
    after: {
      status: updated.status,
      lockedAt: updated.lockedAt,
      lockReason: updated.lockReason,
    },
  })

  return updated
}

export async function lockAccountingPeriodsForRange(
  companyId: string,
  from: Date,
  to: Date,
  actorId: string,
  reason: string
): Promise<AccountingPeriod[]> {
  if (from > to) {
    throw new Error("Invalid period range: 'from' must be before 'to'")
  }

  const start = normalizeMonthStart(from)
  const end = normalizeMonthStart(to)
  const lockedPeriods: AccountingPeriod[] = []

  for (let cursor = new Date(start); cursor <= end; cursor.setMonth(cursor.getMonth() + 1)) {
    const periodStart = normalizeMonthStart(cursor)
    const periodEnd = normalizeMonthEnd(cursor)
    const periodType: PeriodType = "MONTHLY"
    const fiscalYear = periodStart.getFullYear()
    const periodNumber = periodStart.getMonth() + 1

    const existing = await db.accountingPeriod.findUnique({
      where: {
        companyId_fiscalYear_periodNumber: {
          companyId,
          fiscalYear,
          periodNumber,
        },
      },
    })

    const period =
      existing ??
      (await createAccountingPeriod(
        companyId,
        { startDate: periodStart, endDate: periodEnd, periodType },
        actorId,
        reason
      ))

    const locked = await lockAccountingPeriod(companyId, period.id, actorId, reason)
    lockedPeriods.push(locked)
  }

  return lockedPeriods
}
