import { db } from "@/lib/db"
import {
  CashAmountNegativeError,
  CashBalanceNegativeError,
  CashDayClosedError,
  CashLimitExceededError,
} from "@/lib/prisma-extensions"
import { Prisma } from "@prisma/client"

type DecimalInput = Prisma.Decimal | number | string

export type CashEntryInput = {
  companyId: string
  businessDate: Date
  amount: DecimalInput
  note?: string | null
}

export type CashEntryUpdate = {
  businessDate?: Date
  amount?: DecimalInput
  note?: string | null
}

export type CashDayCloseInput = {
  companyId: string
  businessDate: Date
  note?: string | null
}

export type CashLimitSettingInput = {
  companyId: string
  limitAmount: DecimalInput
  currency?: string
  isActive?: boolean
}

function toDecimal(value: DecimalInput): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) return value
  return new Prisma.Decimal(value)
}

function assertAmountNonNegative(amount: Prisma.Decimal) {
  if (amount.lessThan(0)) {
    throw new CashAmountNegativeError()
  }
}

async function assertCashDayOpen(companyId: string, businessDate: Date, action: string) {
  const closed = await db.cashDayClose.findUnique({
    where: { companyId_businessDate: { companyId, businessDate } },
    select: { id: true },
  })

  if (closed) {
    throw new CashDayClosedError(action, businessDate)
  }
}

export async function getCashBalance(companyId: string): Promise<Prisma.Decimal> {
  const [cashInSum, cashOutSum] = await Promise.all([
    db.cashIn.aggregate({
      where: { companyId },
      _sum: { amount: true },
    }),
    db.cashOut.aggregate({
      where: { companyId },
      _sum: { amount: true },
    }),
  ])

  const totalIn = cashInSum._sum.amount ?? new Prisma.Decimal(0)
  const totalOut = cashOutSum._sum.amount ?? new Prisma.Decimal(0)
  return totalIn.minus(totalOut)
}

export async function createCashIn(input: CashEntryInput) {
  const amount = toDecimal(input.amount)
  assertAmountNonNegative(amount)
  await assertCashDayOpen(input.companyId, input.businessDate, "create cash entry")

  const balance = await getCashBalance(input.companyId)
  const nextBalance = balance.plus(amount)
  if (nextBalance.lessThan(0)) {
    throw new CashBalanceNegativeError()
  }

  // Check if adding cash would exceed the configured limit
  const limitSetting = await getCashLimitSetting(input.companyId)
  if (limitSetting?.isActive && nextBalance.greaterThan(limitSetting.limitAmount)) {
    throw new CashLimitExceededError(limitSetting.limitAmount.toString(), nextBalance.toString())
  }

  return db.cashIn.create({
    data: {
      companyId: input.companyId,
      businessDate: input.businessDate,
      amount,
      note: input.note ?? null,
    },
  })
}

export async function createCashOut(input: CashEntryInput) {
  const amount = toDecimal(input.amount)
  assertAmountNonNegative(amount)
  await assertCashDayOpen(input.companyId, input.businessDate, "create cash entry")

  const balance = await getCashBalance(input.companyId)
  const nextBalance = balance.minus(amount)
  if (nextBalance.lessThan(0)) {
    throw new CashBalanceNegativeError()
  }

  return db.cashOut.create({
    data: {
      companyId: input.companyId,
      businessDate: input.businessDate,
      amount,
      note: input.note ?? null,
    },
  })
}

export async function updateCashIn(id: string, companyId: string, update: CashEntryUpdate) {
  const existing = await db.cashIn.findUnique({
    where: { id },
    select: { amount: true, businessDate: true },
  })

  if (!existing) return null

  await assertCashDayOpen(companyId, existing.businessDate, "update cash entry")
  if (update.businessDate) {
    await assertCashDayOpen(companyId, update.businessDate, "update cash entry")
  }

  const nextAmount = update.amount ? toDecimal(update.amount) : existing.amount
  assertAmountNonNegative(nextAmount)

  const balance = await getCashBalance(companyId)
  const nextBalance = balance.minus(existing.amount).plus(nextAmount)
  if (nextBalance.lessThan(0)) {
    throw new CashBalanceNegativeError()
  }

  return db.cashIn.update({
    where: { id },
    data: {
      businessDate: update.businessDate,
      amount: update.amount ? toDecimal(update.amount) : undefined,
      note: update.note ?? undefined,
    },
  })
}

export async function updateCashOut(id: string, companyId: string, update: CashEntryUpdate) {
  const existing = await db.cashOut.findUnique({
    where: { id },
    select: { amount: true, businessDate: true },
  })

  if (!existing) return null

  await assertCashDayOpen(companyId, existing.businessDate, "update cash entry")
  if (update.businessDate) {
    await assertCashDayOpen(companyId, update.businessDate, "update cash entry")
  }

  const nextAmount = update.amount ? toDecimal(update.amount) : existing.amount
  assertAmountNonNegative(nextAmount)

  const balance = await getCashBalance(companyId)
  const nextBalance = balance.plus(existing.amount).minus(nextAmount)
  if (nextBalance.lessThan(0)) {
    throw new CashBalanceNegativeError()
  }

  return db.cashOut.update({
    where: { id },
    data: {
      businessDate: update.businessDate,
      amount: update.amount ? toDecimal(update.amount) : undefined,
      note: update.note ?? undefined,
    },
  })
}

export async function deleteCashIn(id: string, companyId: string) {
  const existing = await db.cashIn.findUnique({
    where: { id },
    select: { amount: true, businessDate: true },
  })

  if (!existing) return null

  await assertCashDayOpen(companyId, existing.businessDate, "delete cash entry")

  const balance = await getCashBalance(companyId)
  const nextBalance = balance.minus(existing.amount)
  if (nextBalance.lessThan(0)) {
    throw new CashBalanceNegativeError()
  }

  return db.cashIn.delete({ where: { id } })
}

export async function deleteCashOut(id: string, companyId: string) {
  const existing = await db.cashOut.findUnique({
    where: { id },
    select: { amount: true, businessDate: true },
  })

  if (!existing) return null

  await assertCashDayOpen(companyId, existing.businessDate, "delete cash entry")

  const balance = await getCashBalance(companyId)
  const nextBalance = balance.plus(existing.amount)
  if (nextBalance.lessThan(0)) {
    throw new CashBalanceNegativeError()
  }

  return db.cashOut.delete({ where: { id } })
}

export async function closeCashDay(input: CashDayCloseInput) {
  await assertCashDayOpen(input.companyId, input.businessDate, "close cash day")

  const [cashInBefore, cashOutBefore, cashInDay, cashOutDay] = await Promise.all([
    db.cashIn.aggregate({
      where: { companyId: input.companyId, businessDate: { lt: input.businessDate } },
      _sum: { amount: true },
    }),
    db.cashOut.aggregate({
      where: { companyId: input.companyId, businessDate: { lt: input.businessDate } },
      _sum: { amount: true },
    }),
    db.cashIn.aggregate({
      where: { companyId: input.companyId, businessDate: input.businessDate },
      _sum: { amount: true },
    }),
    db.cashOut.aggregate({
      where: { companyId: input.companyId, businessDate: input.businessDate },
      _sum: { amount: true },
    }),
  ])

  const openingBalance = (cashInBefore._sum.amount ?? new Prisma.Decimal(0)).minus(
    cashOutBefore._sum.amount ?? new Prisma.Decimal(0)
  )
  const totalIn = cashInDay._sum.amount ?? new Prisma.Decimal(0)
  const totalOut = cashOutDay._sum.amount ?? new Prisma.Decimal(0)
  const closingBalance = openingBalance.plus(totalIn).minus(totalOut)

  if (closingBalance.lessThan(0)) {
    throw new CashBalanceNegativeError()
  }

  return db.cashDayClose.create({
    data: {
      companyId: input.companyId,
      businessDate: input.businessDate,
      openingBalance,
      totalIn,
      totalOut,
      closingBalance,
      note: input.note ?? null,
    },
  })
}

export async function upsertCashLimitSetting(input: CashLimitSettingInput) {
  const limitAmount = toDecimal(input.limitAmount)
  assertAmountNonNegative(limitAmount)

  return db.cashLimitSetting.upsert({
    where: { companyId: input.companyId },
    create: {
      companyId: input.companyId,
      limitAmount,
      currency: input.currency ?? "EUR",
      isActive: input.isActive ?? true,
    },
    update: {
      limitAmount,
      currency: input.currency,
      isActive: input.isActive,
    },
  })
}

export async function getCashLimitSetting(companyId: string) {
  return db.cashLimitSetting.findUnique({ where: { companyId } })
}
