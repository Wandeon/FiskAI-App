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
  const fiscalYear = input.fiscalYear ?? input.startDate.getFullYear()
  const periodNumber = input.periodNumber ?? input.startDate.getMonth() + 1
  const periodType = input.periodType ?? "MONTHLY"

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
