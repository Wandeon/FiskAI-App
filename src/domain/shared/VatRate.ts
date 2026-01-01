// src/domain/shared/VatRate.ts
import Decimal from "decimal.js"
import { Money } from "./Money"

export type VatRateType = "standard" | "reduced" | "zero" | "exempt"

export class VatRate {
  private constructor(
    private readonly rate: Decimal,
    public readonly label: string,
    public readonly type: VatRateType
  ) {}

  static standard(rate: number | string, label = "Standard"): VatRate {
    return new VatRate(new Decimal(rate), label, "standard")
  }

  static reduced(rate: number | string, label: string): VatRate {
    return new VatRate(new Decimal(rate), label, "reduced")
  }

  static zero(): VatRate {
    return new VatRate(new Decimal(0), "Zero Rate", "zero")
  }

  static exempt(): VatRate {
    return new VatRate(new Decimal(0), "Exempt", "exempt")
  }

  /**
   * Create VatRate from a percentage value.
   * Useful for UI inputs where rates are entered as percentages (e.g., 25 for 25%).
   */
  static fromPercentage(percentage: number): VatRate {
    if (percentage === 0) {
      return VatRate.zero()
    }
    const rate = new Decimal(percentage).dividedBy(100)
    return new VatRate(rate, `${percentage}%`, "standard")
  }

  /**
   * Croatian standard rates
   */
  static HR_STANDARD = VatRate.standard("0.25", "PDV 25%")
  static HR_REDUCED_13 = VatRate.reduced("0.13", "PDV 13%")
  static HR_REDUCED_5 = VatRate.reduced("0.05", "PDV 5%")

  /**
   * Calculate VAT amount from net amount.
   */
  calculateVat(netAmount: Money): Money {
    if (this.rate.isZero()) {
      return Money.zero(netAmount.currency)
    }
    return netAmount.multiply(this.rate).round()
  }

  /**
   * Calculate gross amount from net amount.
   */
  calculateGross(netAmount: Money): Money {
    return netAmount.add(this.calculateVat(netAmount))
  }

  /**
   * Extract net amount from gross amount.
   */
  extractNet(grossAmount: Money): Money {
    const divisor = this.rate.plus(1)
    return grossAmount.divide(divisor).round()
  }

  /**
   * Extract VAT amount from gross amount.
   */
  extractVat(grossAmount: Money): Money {
    const net = this.extractNet(grossAmount)
    return grossAmount.subtract(net)
  }

  rateAsDecimal(): Decimal {
    return this.rate
  }

  rateAsPercentage(): number {
    return this.rate.mul(100).toNumber()
  }

  equals(other: VatRate): boolean {
    return this.rate.equals(other.rate)
  }
}
