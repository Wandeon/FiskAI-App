import { prisma } from "@/lib/prisma"
import { runWithAuditContext } from "@/lib/audit-context"
import { createAccountingPeriod, lockAccountingPeriod } from "@/lib/period-locking/service"
import { postDepreciationEntriesForPeriod } from "@/lib/assets/depreciation"

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function monthEnd(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
}

export async function runMonthClose(params: {
  companyId: string
  forMonth: Date
  actorId: string
  reason: string
  depreciationDebitAccountId: string
  depreciationCreditAccountId: string
}) {
  const startDate = monthStart(params.forMonth)
  const endDate = monthEnd(params.forMonth)
  const fiscalYear = startDate.getFullYear()
  const periodNumber = startDate.getMonth() + 1

  const period =
    (await prisma.accountingPeriod.findUnique({
      where: {
        companyId_fiscalYear_periodNumber: {
          companyId: params.companyId,
          fiscalYear,
          periodNumber,
        },
      },
    })) ??
    (await createAccountingPeriod(
      params.companyId,
      { startDate, endDate, periodType: "MONTHLY", fiscalYear, periodNumber },
      params.actorId,
      params.reason
    ))

  const depreciationResults = await runWithAuditContext(
    { actorId: params.actorId, reason: params.reason },
    async () =>
      postDepreciationEntriesForPeriod({
        companyId: params.companyId,
        periodStart: startDate,
        periodEnd: endDate,
        debitAccountId: params.depreciationDebitAccountId,
        creditAccountId: params.depreciationCreditAccountId,
        createdById: params.actorId,
        status: "POSTED",
      })
  )

  const lockedPeriod = await lockAccountingPeriod(
    params.companyId,
    period.id,
    params.actorId,
    params.reason
  )

  return {
    period: lockedPeriod,
    depreciationResults,
  }
}
