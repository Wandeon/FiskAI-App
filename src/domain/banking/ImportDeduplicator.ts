// src/domain/banking/ImportDeduplicator.ts
import { BankTransaction } from "./BankTransaction"

export interface DuplicateCheckResult {
  isDuplicate: boolean
  existingTransactionId?: string
  reason?: string
}

/**
 * Checks if a transaction already exists (deduplication).
 * Used during bank statement imports to prevent duplicate entries.
 *
 * Deduplication rules (in order of priority):
 * 1. External ID match (strongest - bank's unique transaction identifier)
 * 2. Exact match on amount + date + reference (content-based deduplication)
 */
export class ImportDeduplicator {
  constructor(private readonly existingTransactions: BankTransaction[]) {}

  /**
   * Check if a candidate transaction is a duplicate of an existing transaction.
   *
   * @param candidate - The transaction to check for duplicates
   * @returns DuplicateCheckResult indicating if duplicate and why
   */
  check(candidate: BankTransaction): DuplicateCheckResult {
    // Rule 1: Check by external ID first (strongest match)
    const byExternalId = this.existingTransactions.find(
      (t) => t.externalId === candidate.externalId
    )
    if (byExternalId) {
      return {
        isDuplicate: true,
        existingTransactionId: byExternalId.id,
        reason: "Matching external ID",
      }
    }

    // Rule 2: Check by exact amount + date + reference
    const byContent = this.existingTransactions.find(
      (t) =>
        t.amount.equals(candidate.amount) &&
        this.isSameDate(t.date, candidate.date) &&
        t.reference === candidate.reference
    )
    if (byContent) {
      return {
        isDuplicate: true,
        existingTransactionId: byContent.id,
        reason: "Matching amount, date, and reference",
      }
    }

    return { isDuplicate: false }
  }

  /**
   * Compare dates by their date portion only (ignoring time).
   */
  private isSameDate(a: Date, b: Date): boolean {
    return a.toDateString() === b.toDateString()
  }
}
