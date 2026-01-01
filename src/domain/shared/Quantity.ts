// src/domain/shared/Quantity.ts
import Decimal from "decimal.js"

export class Quantity {
  private constructor(private readonly value: Decimal) {}

  static of(value: number | string | Decimal): Quantity {
    const decimal = value instanceof Decimal ? value : new Decimal(value)

    if (!decimal.isFinite()) {
      throw new QuantityError("Quantity must be finite")
    }

    if (decimal.isNegative()) {
      throw new QuantityError("Quantity cannot be negative")
    }

    return new Quantity(decimal)
  }

  static one(): Quantity {
    return new Quantity(new Decimal(1))
  }

  static zero(): Quantity {
    return new Quantity(new Decimal(0))
  }

  add(other: Quantity): Quantity {
    return new Quantity(this.value.plus(other.value))
  }

  subtract(other: Quantity): Quantity {
    const result = this.value.minus(other.value)
    if (result.isNegative()) {
      throw new QuantityError("Quantity cannot become negative")
    }
    return new Quantity(result)
  }

  multiply(factor: number | Decimal): Quantity {
    const factorDecimal = factor instanceof Decimal ? factor : new Decimal(factor)
    return new Quantity(this.value.mul(factorDecimal))
  }

  isZero(): boolean {
    return this.value.isZero()
  }

  equals(other: Quantity): boolean {
    return this.value.equals(other.value)
  }

  toNumber(): number {
    return this.value.toNumber()
  }

  toDecimal(): Decimal {
    return this.value
  }
}

export class QuantityError extends Error {
  readonly code = "QUANTITY_ERROR"

  constructor(message: string) {
    super(message)
    this.name = "QuantityError"
  }
}
