// src/infrastructure/mappers/MoneyMapper.ts
import { Money } from "@/domain/shared"
import { Prisma } from "@prisma/client"

/**
 * Maps between database representation and domain Money.
 */
export class MoneyMapper {
  /**
   * Convert database cents (integer) to domain Money.
   */
  static toDomain(cents: number | bigint, currency = "EUR"): Money {
    return Money.fromCents(Number(cents), currency)
  }

  /**
   * Convert Prisma Decimal to domain Money.
   */
  static fromPrismaDecimal(value: Prisma.Decimal | null, currency = "EUR"): Money {
    if (value === null) {
      return Money.zero(currency)
    }
    return Money.fromString(value.toString(), currency)
  }

  /**
   * Convert domain Money to database cents (integer).
   */
  static toPersistence(money: Money): number {
    return money.toCents()
  }

  /**
   * Convert domain Money to Prisma Decimal for storage.
   */
  static toPrismaDecimal(money: Money): Prisma.Decimal {
    return new Prisma.Decimal(money.toDecimal().toString())
  }

  /**
   * Convert a number (assumed to be in major currency units) to Money.
   * Use this at adapter boundaries when receiving legacy float values.
   */
  static fromLegacyNumber(value: number, currency = "EUR"): Money {
    return Money.fromString(value.toString(), currency)
  }
}
