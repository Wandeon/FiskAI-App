/**
 * InvoiceDisplayAdapter
 *
 * Adapts raw invoice line data into display-ready values.
 * Uses domain layer Money and VatRate for all calculations,
 * then formats for UI display.
 *
 * Architecture: interfaces layer - thin adapter that calls domain
 */
import { Money, VatRate } from "@/domain/shared"
import { VatCalculator } from "@/domain/tax/VatCalculator"

export interface RawInvoiceLine {
  description: string
  quantity: number
  unit?: string
  unitPrice: number
  vatRate?: number
}

export interface DisplayInvoiceLine {
  description: string
  quantity: number
  unit?: string
  unitPrice: number
  vatRate: number
  netAmount: number
  vatAmount: number
  totalAmount: number
}

export interface DisplayInvoiceTotals {
  netAmount: number
  vatAmount: number
  totalAmount: number
}

/**
 * Calculate display values for a single invoice line.
 * All calculations use domain Money and VatRate to ensure correctness.
 */
export function calculateLineDisplay(line: RawInvoiceLine): DisplayInvoiceLine {
  const quantity = line.quantity || 0
  const unitPrice = line.unitPrice || 0
  const vatRatePercent = line.vatRate || 0

  // Use domain Money for all calculations
  const unitPriceMoney = Money.fromString(unitPrice.toString())
  const netAmount = unitPriceMoney.multiply(quantity.toString())

  // Use domain VatRate for VAT calculation
  const vatRate = VatRate.fromPercentage(vatRatePercent)
  const result = VatCalculator.calculate(netAmount, vatRate)

  return {
    description: line.description,
    quantity,
    unit: line.unit,
    unitPrice,
    vatRate: vatRatePercent,
    netAmount: netAmount.toDisplayNumber(),
    vatAmount: result.vatAmount.toDisplayNumber(),
    totalAmount: result.grossAmount.toDisplayNumber(),
  }
}

/**
 * Calculate VAT from a net amount and VAT rate percentage.
 * Use this for simple expense or single-amount calculations.
 */
export function calculateVatFromNet(
  netAmount: number,
  vatRatePercent: number
): DisplayInvoiceTotals {
  const netMoney = Money.fromString(netAmount.toString())
  const vatRate = VatRate.fromPercentage(vatRatePercent)
  const result = VatCalculator.calculate(netMoney, vatRate)

  return {
    netAmount: netMoney.toDisplayNumber(),
    vatAmount: result.vatAmount.toDisplayNumber(),
    totalAmount: result.grossAmount.toDisplayNumber(),
  }
}

/**
 * Calculate display totals for multiple invoice lines.
 * All calculations use domain Money to ensure correctness.
 */
export function calculateInvoiceTotals(lines: RawInvoiceLine[]): DisplayInvoiceTotals {
  let totalNet = Money.zero()
  let totalVat = Money.zero()
  let totalGross = Money.zero()

  for (const line of lines) {
    const quantity = line.quantity || 0
    const unitPrice = line.unitPrice || 0
    const vatRatePercent = line.vatRate || 0

    const unitPriceMoney = Money.fromString(unitPrice.toString())
    const netAmount = unitPriceMoney.multiply(quantity.toString())
    const vatRate = VatRate.fromPercentage(vatRatePercent)
    const result = VatCalculator.calculate(netAmount, vatRate)

    totalNet = totalNet.add(netAmount)
    totalVat = totalVat.add(result.vatAmount)
    totalGross = totalGross.add(result.grossAmount)
  }

  return {
    netAmount: totalNet.toDisplayNumber(),
    vatAmount: totalVat.toDisplayNumber(),
    totalAmount: totalGross.toDisplayNumber(),
  }
}
