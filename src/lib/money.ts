import { Prisma } from "@prisma/client"

const Decimal = Prisma.Decimal

export type MoneyInput = Prisma.Decimal | string

export function asDecimal(value: MoneyInput): Prisma.Decimal {
  return value instanceof Decimal ? value : new Decimal(value)
}

export function roundMoney(value: Prisma.Decimal, decimals: number = 2): Prisma.Decimal {
  return value.toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP)
}

export function moneyToFixed(value: Prisma.Decimal, decimals: number = 2): string {
  return roundMoney(value, decimals).toFixed(decimals)
}

export function moneyToMinorUnits(value: Prisma.Decimal, decimals: number = 2): number {
  const scale = new Decimal(10).pow(decimals)
  const scaled = value.mul(scale).toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
  const asString = scaled.toFixed(0)
  const asNumber = Number(asString)
  if (!Number.isSafeInteger(asNumber)) {
    throw new Error(`Minor units overflow: ${asString}`)
  }
  return asNumber
}

export function minorUnitsToMoney(value: number, decimals: number = 2): Prisma.Decimal {
  const scale = new Decimal(10).pow(decimals)
  return new Decimal(value).div(scale).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP)
}
