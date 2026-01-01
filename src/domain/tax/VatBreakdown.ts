// src/domain/tax/VatBreakdown.ts
import { Money, VatRate } from "@/domain/shared"

export interface VatBreakdownLine {
  vatRate: VatRate
  baseAmount: Money
  vatAmount: Money
}

export class VatBreakdown {
  private lines: VatBreakdownLine[] = []

  addLine(baseAmount: Money, vatRate: VatRate): void {
    const vatAmount = vatRate.calculateVat(baseAmount)
    this.lines.push({ vatRate, baseAmount, vatAmount })
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
