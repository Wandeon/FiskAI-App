// src/domain/banking/ReconciliationMatcher.ts
import { Money } from "@/domain/shared"
import { BankTransaction } from "./BankTransaction"

export interface MatchCandidate {
  id: string
  reference: string
  amount: Money
  date: Date
  type: "INVOICE" | "EXPENSE"
}

export interface MatchResult {
  candidateId: string
  candidateType: "INVOICE" | "EXPENSE"
  score: number // 0-100
  reason: string
}

const AUTO_MATCH_THRESHOLD = 85

/**
 * Pure domain logic for matching bank transactions to invoices/expenses.
 * No database access - just matching algorithms.
 *
 * Scoring:
 * - Reference match: +50 points
 * - Amount exact match: +40 points
 * - Amount within 5%: +25 points
 * - Date within 3 days: +10 points
 * - Date within 7 days: +5 points
 * - Auto-match threshold: 85 points
 */
export class ReconciliationMatcher {
  /**
   * Match a bank transaction against a list of candidates (invoices/expenses).
   * Returns results sorted by score descending, filtering out 0-score matches.
   */
  match(transaction: BankTransaction, candidates: MatchCandidate[]): MatchResult[] {
    const results: MatchResult[] = []

    for (const candidate of candidates) {
      const score = this.calculateScore(transaction, candidate)
      if (score > 0) {
        results.push({
          candidateId: candidate.id,
          candidateType: candidate.type,
          score,
          reason: this.explainScore(transaction, candidate, score),
        })
      }
    }

    // Sort by score descending
    return results.sort((a, b) => b.score - a.score)
  }

  /**
   * Determine if a match result qualifies for automatic matching.
   * Returns true if score >= 85 points.
   */
  shouldAutoMatch(result: MatchResult): boolean {
    return result.score >= AUTO_MATCH_THRESHOLD
  }

  private calculateScore(transaction: BankTransaction, candidate: MatchCandidate): number {
    let score = 0

    // Reference match (highest weight: +50)
    if (transaction.reference && candidate.reference) {
      if (this.referencesMatch(transaction.reference, candidate.reference)) {
        score += 50
      }
    }

    // Amount match (+40 for exact, +25 for tolerance)
    const amountMatch = this.amountsMatch(transaction.amount, candidate.amount)
    if (amountMatch === "exact") {
      score += 40
    } else if (amountMatch === "tolerance") {
      score += 25
    }

    // Date proximity (+10 for <=3 days, +5 for <=7 days)
    const daysDiff = this.daysBetween(transaction.date, candidate.date)
    if (daysDiff <= 3) {
      score += 10
    } else if (daysDiff <= 7) {
      score += 5
    }

    return Math.min(score, 100)
  }

  /**
   * Check if two references match after normalization.
   * Normalizes by converting to lowercase and removing non-alphanumeric characters.
   * Returns true if either reference contains the other.
   */
  private referencesMatch(txRef: string, candRef: string): boolean {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "")
    const normalizedTx = normalize(txRef)
    const normalizedCand = normalize(candRef)

    // Both must have content after normalization
    if (!normalizedTx || !normalizedCand) {
      return false
    }

    return normalizedTx.includes(normalizedCand) || normalizedCand.includes(normalizedTx)
  }

  /**
   * Compare two Money amounts.
   * Returns:
   * - "exact" if amounts are equal
   * - "tolerance" if difference is less than 5% of candidate amount
   * - "none" otherwise
   */
  private amountsMatch(txAmount: Money, candAmount: Money): "exact" | "tolerance" | "none" {
    if (txAmount.equals(candAmount)) {
      return "exact"
    }

    // 5% tolerance calculation
    const tolerance = candAmount.multiply(0.05)
    const diff = txAmount.subtract(candAmount)
    const absDiff = diff.toDecimal().abs()
    const absTolerance = tolerance.toDecimal().abs()

    if (absDiff.lessThan(absTolerance)) {
      return "tolerance"
    }

    return "none"
  }

  /**
   * Calculate the number of full days between two dates.
   */
  private daysBetween(a: Date, b: Date): number {
    const msPerDay = 1000 * 60 * 60 * 24
    const diff = Math.abs(a.getTime() - b.getTime())
    return Math.floor(diff / msPerDay)
  }

  /**
   * Generate a human-readable explanation for the match score.
   */
  private explainScore(
    transaction: BankTransaction,
    candidate: MatchCandidate,
    _score: number
  ): string {
    const reasons: string[] = []

    // Check reference match
    if (transaction.reference && candidate.reference) {
      if (this.referencesMatch(transaction.reference, candidate.reference)) {
        reasons.push("Reference match")
      }
    }

    // Check amount match
    const amountMatch = this.amountsMatch(transaction.amount, candidate.amount)
    if (amountMatch === "exact") {
      reasons.push("Exact amount")
    } else if (amountMatch === "tolerance") {
      reasons.push("Amount within 5%")
    }

    return reasons.length > 0 ? reasons.join(", ") : "Partial match"
  }
}
