import { drizzleDb } from "@/lib/db/drizzle"
import { paymentObligation, OBLIGATION_STATUS } from "@/lib/db/schema/pausalni"
import { DOPRINOSI_2025, PDV_CONFIG } from "./constants"
import { eq, and, gte, lte } from "drizzle-orm"

/**
 * Bank transaction interface - matches the structure from bank sync
 */
interface BankTransaction {
  id: string
  date: Date
  amount: number
  description: string
  reference?: string
  counterpartyName?: string
  counterpartyIban?: string
}

/**
 * Match result with details about the matching process
 */
interface MatchResult {
  obligationId: string
  transactionId: string
  matchType: "AUTO"
  confidence: "HIGH" | "MEDIUM" | "LOW"
  matchedOn: string[] // Array of criteria used: ["IBAN", "REFERENCE", "AMOUNT", "DATE"]
}

/**
 * Payment matching configuration per obligation type
 */
const MATCHING_CONFIG = {
  DOPRINOSI_MIO_I: {
    iban: DOPRINOSI_2025.MIO_I.iban,
    referencePrefix: DOPRINOSI_2025.MIO_I.referencePrefix,
    exactAmount: DOPRINOSI_2025.MIO_I.amount,
  },
  DOPRINOSI_MIO_II: {
    iban: DOPRINOSI_2025.MIO_II.iban,
    referencePrefix: DOPRINOSI_2025.MIO_II.referencePrefix,
    exactAmount: DOPRINOSI_2025.MIO_II.amount,
  },
  DOPRINOSI_ZDRAVSTVENO: {
    iban: DOPRINOSI_2025.ZDRAVSTVENO.iban,
    referencePrefix: DOPRINOSI_2025.ZDRAVSTVENO.referencePrefix,
    exactAmount: DOPRINOSI_2025.ZDRAVSTVENO.amount,
  },
  PDV: {
    iban: PDV_CONFIG.iban,
    referencePrefix: PDV_CONFIG.referencePrefix,
    exactAmount: null, // PDV amount varies
  },
} as const

/**
 * Amount tolerance for matching (in EUR)
 */
const AMOUNT_TOLERANCE = 0.1

/**
 * Date proximity for matching (in days)
 * Payments can be made up to 7 days before or after due date
 */
const DATE_PROXIMITY_DAYS = 7

/**
 * Automatically match bank transactions to payment obligations
 *
 * @param companyId - Company ID to match obligations for
 * @param transactions - Array of bank transactions from sync
 * @returns Array of match results
 */
export async function matchPayments(
  companyId: string,
  transactions: BankTransaction[]
): Promise<MatchResult[]> {
  const results: MatchResult[] = []

  // Get all pending obligations for this company
  const pendingObligations = await drizzleDb
    .select()
    .from(paymentObligation)
    .where(
      and(
        eq(paymentObligation.companyId, companyId),
        eq(paymentObligation.status, OBLIGATION_STATUS.PENDING)
      )
    )

  for (const obligation of pendingObligations) {
    // Try to find a matching transaction
    const match = findMatchingTransaction(obligation, transactions)

    if (match) {
      // Update obligation as PAID
      await drizzleDb
        .update(paymentObligation)
        .set({
          status: OBLIGATION_STATUS.PAID,
          paidDate: match.transaction.date.toISOString().split("T")[0],
          paidAmount: match.transaction.amount.toString(),
          matchedTransactionId: match.transaction.id,
          matchType: "AUTO",
          updatedAt: new Date(),
        })
        .where(eq(paymentObligation.id, obligation.id))

      results.push({
        obligationId: obligation.id,
        transactionId: match.transaction.id,
        matchType: "AUTO",
        confidence: match.confidence,
        matchedOn: match.matchedOn,
      })
    }
  }

  return results
}

/**
 * Find a matching transaction for a given obligation
 */
function findMatchingTransaction(
  obligation: typeof paymentObligation.$inferSelect,
  transactions: BankTransaction[]
): {
  transaction: BankTransaction
  confidence: "HIGH" | "MEDIUM" | "LOW"
  matchedOn: string[]
} | null {
  const config = MATCHING_CONFIG[obligation.obligationType as keyof typeof MATCHING_CONFIG]

  if (!config) {
    // Unknown obligation type, can't match
    return null
  }

  const dueDate = new Date(obligation.dueDate)
  const obligationAmount = parseFloat(obligation.amount)

  for (const transaction of transactions) {
    const matchedOn: string[] = []
    let score = 0

    // 1. Check IBAN match (required for doprinosi, optional for PDV)
    if (transaction.counterpartyIban) {
      if (normalizeIban(transaction.counterpartyIban) === normalizeIban(config.iban)) {
        matchedOn.push("IBAN")
        score += 3 // IBAN match is strong indicator
      }
    }

    // 2. Check reference number pattern (poziv na broj)
    if (transaction.reference) {
      if (matchesReferencePattern(transaction.reference, config.referencePrefix)) {
        matchedOn.push("REFERENCE")
        score += 3 // Reference match is strong indicator
      }
    }

    // 3. Check amount match (exact or within tolerance)
    const expectedAmount = config.exactAmount ?? obligationAmount
    if (Math.abs(transaction.amount - expectedAmount) <= AMOUNT_TOLERANCE) {
      matchedOn.push("AMOUNT")
      score += 2 // Amount match is good indicator
    }

    // 4. Check date proximity
    if (isWithinDateRange(transaction.date, dueDate, DATE_PROXIMITY_DAYS)) {
      matchedOn.push("DATE")
      score += 1 // Date proximity is weak indicator
    }

    // Determine confidence based on score and criteria
    // High confidence: IBAN + Reference + Amount (score >= 8)
    // Medium confidence: IBAN + Amount OR Reference + Amount (score >= 5)
    // Low confidence: Any combination with Amount (score >= 2)

    if (
      score >= 8 &&
      matchedOn.includes("IBAN") &&
      matchedOn.includes("REFERENCE") &&
      matchedOn.includes("AMOUNT")
    ) {
      return { transaction, confidence: "HIGH", matchedOn }
    }

    if (score >= 5 && matchedOn.includes("AMOUNT")) {
      if (matchedOn.includes("IBAN") || matchedOn.includes("REFERENCE")) {
        return { transaction, confidence: "MEDIUM", matchedOn }
      }
    }

    if (score >= 2 && matchedOn.includes("AMOUNT")) {
      return { transaction, confidence: "LOW", matchedOn }
    }
  }

  return null
}

/**
 * Normalize IBAN for comparison (remove spaces and convert to uppercase)
 */
function normalizeIban(iban: string): string {
  return iban.replace(/\s/g, "").toUpperCase()
}

/**
 * Check if reference matches the expected pattern
 * Croatian reference format: {prefix}-{OIB} or just contains the prefix
 */
function matchesReferencePattern(reference: string, expectedPrefix: string): boolean {
  const normalized = reference.replace(/\s/g, "").toUpperCase()
  const prefix = expectedPrefix.toUpperCase()

  // Check if reference starts with the prefix
  if (normalized.startsWith(prefix)) {
    return true
  }

  // Check if reference contains the prefix followed by a dash or digit
  if (normalized.includes(prefix + "-") || normalized.includes(prefix)) {
    return true
  }

  return false
}

/**
 * Check if transaction date is within acceptable range of due date
 */
function isWithinDateRange(transactionDate: Date, dueDate: Date, proximityDays: number): boolean {
  const diffMs = Math.abs(transactionDate.getTime() - dueDate.getTime())
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  return diffDays <= proximityDays
}

/**
 * Match a single transaction to pending obligations (for real-time matching during import)
 *
 * @param companyId - Company ID
 * @param transaction - Single bank transaction
 * @returns Match result or null
 */
export async function matchSingleTransaction(
  companyId: string,
  transaction: BankTransaction
): Promise<MatchResult | null> {
  const results = await matchPayments(companyId, [transaction])
  return results.length > 0 ? results[0] : null
}

/**
 * Get matching statistics for a company
 *
 * @param companyId - Company ID
 * @returns Statistics about matched payments
 */
export async function getMatchingStats(companyId: string): Promise<{
  totalPaid: number
  autoMatched: number
  manuallyMarked: number
  pending: number
}> {
  const allObligations = await drizzleDb
    .select()
    .from(paymentObligation)
    .where(eq(paymentObligation.companyId, companyId))

  const stats = {
    totalPaid: 0,
    autoMatched: 0,
    manuallyMarked: 0,
    pending: 0,
  }

  for (const ob of allObligations) {
    if (ob.status === OBLIGATION_STATUS.PAID) {
      stats.totalPaid++
      if (ob.matchType === "AUTO") {
        stats.autoMatched++
      } else {
        stats.manuallyMarked++
      }
    } else if (
      ob.status === OBLIGATION_STATUS.PENDING ||
      ob.status === OBLIGATION_STATUS.DUE_SOON ||
      ob.status === OBLIGATION_STATUS.OVERDUE
    ) {
      stats.pending++
    }
  }

  return stats
}
