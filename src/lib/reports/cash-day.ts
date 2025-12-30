import { db } from "@/lib/db"
import { Prisma } from "@prisma/client"

type Decimal = Prisma.Decimal

export type CashDayReport = {
  businessDate: Date
  openingBalance: number
  totalIn: number
  totalOut: number
  closingBalance: number
  isClosed: boolean
  closedAt: Date | null
  closeSnapshot: {
    openingBalance: number
    totalIn: number
    totalOut: number
    closingBalance: number
  } | null
}

export async function fetchCashDayReport(
  companyId: string,
  businessDate: Date
): Promise<CashDayReport> {
  const [cashInBefore, cashOutBefore, cashInDay, cashOutDay, close] = await Promise.all([
    db.cashIn.aggregate({
      where: { companyId, businessDate: { lt: businessDate } },
      _sum: { amount: true },
    }),
    db.cashOut.aggregate({
      where: { companyId, businessDate: { lt: businessDate } },
      _sum: { amount: true },
    }),
    db.cashIn.aggregate({
      where: { companyId, businessDate },
      _sum: { amount: true },
    }),
    db.cashOut.aggregate({
      where: { companyId, businessDate },
      _sum: { amount: true },
    }),
    db.cashDayClose.findUnique({
      where: { companyId_businessDate: { companyId, businessDate } },
      select: {
        openingBalance: true,
        totalIn: true,
        totalOut: true,
        closingBalance: true,
        closedAt: true,
      },
    }),
  ])

  const openingBalance = toDecimal(cashInBefore._sum.amount).minus(
    toDecimal(cashOutBefore._sum.amount)
  )
  const totalIn = toDecimal(cashInDay._sum.amount)
  const totalOut = toDecimal(cashOutDay._sum.amount)
  const closingBalance = openingBalance.plus(totalIn).minus(totalOut)

  return {
    businessDate,
    openingBalance: numberFromDecimal(openingBalance),
    totalIn: numberFromDecimal(totalIn),
    totalOut: numberFromDecimal(totalOut),
    closingBalance: numberFromDecimal(close?.closingBalance ?? closingBalance),
    isClosed: Boolean(close),
    closedAt: close?.closedAt ?? null,
    closeSnapshot: close
      ? {
          openingBalance: numberFromDecimal(close.openingBalance),
          totalIn: numberFromDecimal(close.totalIn),
          totalOut: numberFromDecimal(close.totalOut),
          closingBalance: numberFromDecimal(close.closingBalance),
        }
      : null,
  }
}

function toDecimal(value: Decimal | number | null | undefined): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) return value
  return new Prisma.Decimal(value ?? 0)
}

function numberFromDecimal(value: Decimal | number | null | undefined): number {
  if (value instanceof Prisma.Decimal) {
    return value.toNumber()
  }
  if (typeof value === "number") return value
  if (typeof value === "string") return Number(value)
  return 0
}
