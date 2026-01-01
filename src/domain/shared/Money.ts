// src/domain/shared/Money.ts
import Decimal from "decimal.js"

export class Money {
  private constructor(
    private readonly amount: Decimal,
    public readonly currency: string = "EUR"
  ) {}

  static fromDecimal(value: Decimal, currency = "EUR"): Money {
    return new Money(value, currency)
  }

  static fromString(value: string, currency = "EUR"): Money {
    return new Money(new Decimal(value), currency)
  }

  static fromCents(cents: number, currency = "EUR"): Money {
    if (!Number.isInteger(cents)) {
      throw new MoneyError("Money.fromCents requires integer cents")
    }
    return new Money(new Decimal(cents).dividedBy(100), currency)
  }

  static zero(currency = "EUR"): Money {
    return new Money(new Decimal(0), currency)
  }

  add(other: Money): Money {
    this.assertSameCurrency(other)
    return new Money(this.amount.plus(other.amount), this.currency)
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other)
    return new Money(this.amount.minus(other.amount), this.currency)
  }

  multiply(factor: Decimal | number | string): Money {
    const factorDecimal = factor instanceof Decimal ? factor : new Decimal(factor)
    return new Money(this.amount.mul(factorDecimal), this.currency)
  }

  divide(divisor: Decimal | number | string): Money {
    const divisorDecimal = divisor instanceof Decimal ? divisor : new Decimal(divisor)
    if (divisorDecimal.isZero()) {
      throw new MoneyError("Cannot divide by zero")
    }
    return new Money(this.amount.div(divisorDecimal), this.currency)
  }

  /**
   * Round to 2 decimal places using banker's rounding (round half to even).
   * Use this for final display/storage, not intermediate calculations.
   */
  round(): Money {
    return new Money(this.amount.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN), this.currency)
  }

  isNegative(): boolean {
    return this.amount.isNegative()
  }

  isZero(): boolean {
    return this.amount.isZero()
  }

  isPositive(): boolean {
    return this.amount.isPositive() && !this.amount.isZero()
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.amount.equals(other.amount)
  }

  lessThan(other: Money): boolean {
    this.assertSameCurrency(other)
    return this.amount.lessThan(other.amount)
  }

  greaterThan(other: Money): boolean {
    this.assertSameCurrency(other)
    return this.amount.greaterThan(other.amount)
  }

  toDecimal(): Decimal {
    return this.amount
  }

  /**
   * Convert to cents for database storage.
   * Throws if the amount cannot be represented exactly in cents.
   */
  toCents(): number {
    const cents = this.amount.mul(100)
    if (!cents.isInteger()) {
      throw new MoneyError("Amount cannot be represented exactly in cents")
    }
    return cents.toNumber()
  }

  /**
   * Format for display. Use only in UI layer.
   */
  format(locale = "hr-HR"): string {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: this.currency,
    }).format(this.amount.toNumber())
  }

  /**
   * Convert to a number for display purposes only.
   * Rounds to 2 decimal places before conversion.
   * ONLY use this at the UI boundary for display formatting.
   */
  toDisplayNumber(): number {
    return this.round().toDecimal().toNumber()
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new MoneyError(`Currency mismatch: ${this.currency} vs ${other.currency}`)
    }
  }
}

export class MoneyError extends Error {
  readonly code = "MONEY_ERROR"

  constructor(message: string) {
    super(message)
    this.name = "MoneyError"
  }
}
