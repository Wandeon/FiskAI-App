/**
 * VAT Line Totals Calculator
 *
 * Provides pure math functions for computing VAT amounts on invoice lines.
 * This is core accounting logic, not regulatory intelligence.
 *
 * Note: Dynamic VAT rate lookups from regulatory rules were removed in the
 * architectural split. FiskAI now uses static rates. For dynamic rates based
 * on regulatory rules, integrate with the Intelligence API via /v1/rules/resolve.
 */

import { Prisma } from "@prisma/client"
import { getVatRateFromCategory } from "@/lib/validations/product"

const Decimal = Prisma.Decimal

/**
 * Compute VAT totals for a line item.
 * Pure math function - no external dependencies.
 */
export function computeVatLineTotals(input: {
  quantity: Prisma.Decimal | number | string
  unitPrice: Prisma.Decimal | number | string
  vatRatePercent: Prisma.Decimal | number | string
}): {
  quantity: Prisma.Decimal
  unitPrice: Prisma.Decimal
  vatRate: Prisma.Decimal
  netAmount: Prisma.Decimal
  vatAmount: Prisma.Decimal
  totalAmount: Prisma.Decimal
} {
  const quantity = input.quantity instanceof Decimal ? input.quantity : new Decimal(input.quantity)
  const unitPrice =
    input.unitPrice instanceof Decimal ? input.unitPrice : new Decimal(input.unitPrice)
  const vatRate =
    input.vatRatePercent instanceof Decimal
      ? input.vatRatePercent
      : new Decimal(input.vatRatePercent)

  const netAmount = quantity.mul(unitPrice).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
  const vatAmount = netAmount.mul(vatRate).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
  const totalAmount = netAmount.add(vatAmount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)

  return {
    quantity,
    unitPrice,
    vatRate,
    netAmount,
    vatAmount,
    totalAmount,
  }
}

/**
 * Build VAT line totals for an invoice line.
 *
 * Uses the provided vatRate or falls back to category-based defaults.
 * Does NOT perform regulatory rule lookups - use Intelligence API for that.
 *
 * @param line - Invoice line with quantity, unit price, and optional VAT rate/category
 * @param _issueDate - Issue date (reserved for future Intelligence API integration)
 */
export async function buildVatLineTotals(
  line: {
    description: string
    quantity: number
    unit: string
    unitPrice: number
    vatRate?: number
    vatCategory?: string
  },
  _issueDate: Date
): Promise<{
  lineNumber?: number
  description: string
  quantity: Prisma.Decimal
  unit: string
  unitPrice: Prisma.Decimal
  netAmount: Prisma.Decimal
  vatRate: Prisma.Decimal
  vatCategory: string
  vatAmount: Prisma.Decimal
  vatRuleId?: string | null
}> {
  const vatCategory = line.vatCategory || "S"

  // Use provided rate or fall back to category default
  // TODO: Integrate with Intelligence API for dynamic regulatory rates
  const resolvedRate = line.vatRate ?? getVatRateFromCategory(vatCategory)

  const totals = computeVatLineTotals({
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    vatRatePercent: resolvedRate,
  })

  return {
    description: line.description,
    quantity: totals.quantity,
    unit: line.unit,
    unitPrice: totals.unitPrice,
    netAmount: totals.netAmount,
    vatRate: totals.vatRate,
    vatCategory,
    vatAmount: totals.vatAmount,
    vatRuleId: null, // No regulatory rule lookup in simplified version
  }
}
