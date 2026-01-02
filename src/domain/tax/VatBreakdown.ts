// src/domain/tax/VatBreakdown.ts
import { Money, VatRate } from "@/domain/shared"

export interface VatBreakdownLine {
  readonly vatRate: VatRate
  readonly baseAmount: Money
  readonly vatAmount: Money
}

/**
 * VatBreakdown is an immutable value object that represents a collection
 * of VAT breakdown lines. Use the static factory methods to create instances.
 */
export class VatBreakdown {
  private readonly lines: readonly VatBreakdownLine[]

  private constructor(lines: readonly VatBreakdownLine[]) {
    this.lines = lines
  }

  /**
   * Create an empty VatBreakdown
   */
  static empty(): VatBreakdown {
    return new VatBreakdown([])
  }

  /**
   * Create a VatBreakdown from an array of lines
   */
  static fromLines(lines: readonly VatBreakdownLine[]): VatBreakdown {
    return new VatBreakdown([...lines])
  }

  /**
   * Add a line and return a new VatBreakdown (immutable)
   */
  addLine(baseAmount: Money, vatRate: VatRate): VatBreakdown {
    const vatAmount = vatRate.calculateVat(baseAmount)
    const newLine: VatBreakdownLine = { vatRate, baseAmount, vatAmount }
    return new VatBreakdown([...this.lines, newLine])
  }

  getLines(): readonly VatBreakdownLine[] {
    return [...this.lines]
  }

  totalBase(): Money {
    return this.lines.reduce((sum, line) => sum.add(line.baseAmount), Money.zero())
  }

  totalVat(): Money {
    return this.lines.reduce((sum, line) => sum.add(line.vatAmount), Money.zero())
  }

  totalGross(): Money {
    return this.totalBase().add(this.totalVat())
  }

  /**
   * Group by VAT rate for reporting (Croatian fiscal requirement)
   */
  byRate(): Map<number, { base: Money; vat: Money }> {
    const grouped = new Map<number, { base: Money; vat: Money }>()

    for (const line of this.lines) {
      const rateKey = line.vatRate.rateAsPercentage()
      const existing = grouped.get(rateKey) || {
        base: Money.zero(),
        vat: Money.zero(),
      }
      grouped.set(rateKey, {
        base: existing.base.add(line.baseAmount),
        vat: existing.vat.add(line.vatAmount),
      })
    }

    return grouped
  }

  lineCount(): number {
    return this.lines.length
  }
}
