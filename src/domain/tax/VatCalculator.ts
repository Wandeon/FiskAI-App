// src/domain/tax/VatCalculator.ts
import { Money, VatRate } from "@/domain/shared"

export interface VatCalculationResult {
  netAmount: Money
  vatRate: VatRate
  vatAmount: Money
  grossAmount: Money
}

/**
 * Domain service for VAT calculations.
 *
 * All financial calculations use the Money value object to ensure
 * precision and prevent float rounding errors.
 */
export class VatCalculator {
  /**
   * Calculate VAT and gross amount from a net amount.
   */
  static calculate(netAmount: Money, rate: VatRate): VatCalculationResult {
    const vatAmount = rate.calculateVat(netAmount)
    const grossAmount = netAmount.add(vatAmount)

    return {
      netAmount,
      vatRate: rate,
      vatAmount,
      grossAmount,
    }
  }

  /**
   * Extract net and VAT amounts from a gross amount.
   */
  static calculateFromGross(grossAmount: Money, rate: VatRate): VatCalculationResult {
    const netAmount = rate.extractNet(grossAmount)
    const vatAmount = rate.extractVat(grossAmount)

    return {
      netAmount,
      vatRate: rate,
      vatAmount,
      grossAmount,
    }
  }

  /**
   * Calculate total VAT for multiple line items.
   */
  static calculateTotal(items: Array<{ netAmount: Money; rate: VatRate }>): Money {
    return items.reduce((total, item) => {
      const vat = item.rate.calculateVat(item.netAmount)
      return total.add(vat)
    }, Money.zero())
  }

  /**
   * Split a gross amount into net and VAT components.
   * Returns the breakdown for each VAT rate.
   */
  static splitByRates(
    items: Array<{ grossAmount: Money; rate: VatRate }>
  ): Map<VatRate, VatCalculationResult> {
    const results = new Map<VatRate, VatCalculationResult>()

    for (const item of items) {
      const result = this.calculateFromGross(item.grossAmount, item.rate)

      const existing = results.get(item.rate)
      if (existing) {
        results.set(item.rate, {
          netAmount: existing.netAmount.add(result.netAmount),
          vatRate: item.rate,
          vatAmount: existing.vatAmount.add(result.vatAmount),
          grossAmount: existing.grossAmount.add(result.grossAmount),
        })
      } else {
        results.set(item.rate, result)
      }
    }

    return results
  }
}
