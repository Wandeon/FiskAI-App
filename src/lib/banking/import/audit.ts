import Decimal from "decimal.js"

export type Direction = "INCOMING" | "OUTGOING"

export interface ExtractedPageData {
  pageNumber: number
  pageStartBalance: number | null
  pageEndBalance: number | null
  transactions: Array<{
    amount: number
    direction: Direction
  }>
}

export interface AuditResult {
  isVerified: boolean
  calculatedEnd: number | null
  discrepancy: number | null
  reason?: AuditFailureReason
}

export type AuditFailureReason = "MISSING_PAGE_BALANCES" | "MATH_MISMATCH"

const TOLERANCE = new Decimal("0.01")

/**
 * Runs the page-level balance check:
 * start + incoming - outgoing === end (within tolerance).
 */
export function auditPageMath(data: ExtractedPageData): AuditResult {
  if (data.pageStartBalance === null || data.pageEndBalance === null) {
    return {
      isVerified: false,
      calculatedEnd: null,
      discrepancy: null,
      reason: "MISSING_PAGE_BALANCES",
    }
  }

  let calculated = new Decimal(data.pageStartBalance)

  for (const tx of data.transactions) {
    const amount = new Decimal(tx.amount)
    calculated = tx.direction === "INCOMING" ? calculated.plus(amount) : calculated.minus(amount)
  }

  const reportedEnd = new Decimal(data.pageEndBalance)
  const diff = calculated.minus(reportedEnd).abs()
  const isMatch = diff.lessThanOrEqualTo(TOLERANCE)

  return {
    isVerified: isMatch,
    calculatedEnd: calculated.toNumber(),
    discrepancy: diff.toNumber(),
    reason: isMatch ? undefined : "MATH_MISMATCH",
  }
}
