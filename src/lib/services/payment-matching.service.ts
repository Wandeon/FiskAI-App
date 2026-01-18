// src/lib/services/payment-matching.service.ts

/**
 * PaymentMatchingService
 *
 * Matches bank payments to invoices with confidence scoring and full audit trail.
 * This service implements the Data Intelligence Hierarchy from the paušalni obrt UX design:
 *
 * 1. AUTOMATIC - System matches with high confidence → shows source + confidence
 * 2. SUGGESTED - System proposes match → user confirms with one click
 * 3. ASSISTED - Multiple possible matches → user picks from options
 * 4. MANUAL (last resort) - No system match → user types manually
 *
 * Match Methods:
 * - auto_reference: Invoice reference found in payment description (highest confidence)
 * - auto_amount: Exact amount match with date proximity
 * - auto_client: Client name/OIB found in payment
 * - manual: User manually linked payment to invoice
 *
 * Confidence Levels:
 * - HIGH: ≥0.9 (auto-accept)
 * - MEDIUM: 0.7-0.9 (suggest, user confirms)
 * - LOW: <0.7 (show options, user chooses)
 *
 * @example
 * import { paymentMatchingService } from '@/lib/services/payment-matching.service'
 *
 * // Find matches for an invoice
 * const matches = await paymentMatchingService.findMatchesForInvoice('invoice-123')
 *
 * // Create auto match
 * await paymentMatchingService.createAutoMatch(
 *   'invoice-123',
 *   'payment-456',
 *   'auto_reference',
 *   0.98,
 *   'Broj računa "002-2025" pronađen u opisu uplate'
 * )
 *
 * // Get match display for UI
 * const display = await paymentMatchingService.getMatchDisplay('match-789')
 */

import { db } from "@/lib/db"
import type { BankTransaction, EInvoice, MatchRecord, Contact, Organization } from "@prisma/client"

// =============================================================================
// TYPES
// =============================================================================

/**
 * Invoice with buyer relations for matching
 */
type InvoiceWithBuyer = EInvoice & {
  buyer?: Contact | null
  buyerOrganization?: Organization | null
}

/**
 * Match methods for automatic matching
 */
export type AutoMatchMethod = "auto_reference" | "auto_amount" | "auto_client"

/**
 * All match methods including manual
 */
export type MatchMethod = AutoMatchMethod | "manual"

/**
 * Confidence level categories
 */
export enum MatchConfidenceLevel {
  HIGH = "HIGH", // >= 0.9
  MEDIUM = "MEDIUM", // >= 0.7
  LOW = "LOW", // < 0.7
}

/**
 * Match indicator showing why a match was suggested
 */
export interface MatchIndicator {
  /** Type of indicator */
  type: "reference" | "amount" | "client" | "date"
  /** What was found */
  found: string
  /** What was expected */
  expected: string
  /** Score contribution (0.0 - 1.0) */
  score: number
}

/**
 * Potential match result
 */
export interface PotentialMatch {
  invoiceId: string
  paymentId: string
  method: MatchMethod
  confidence: number
  /** Human-readable reason (Croatian) */
  reason: string
  /** Why this match was suggested */
  matchIndicators: MatchIndicator[]
}

/**
 * Match history entry
 */
export interface MatchHistory {
  matchId: string
  action: "created" | "overridden" | "unlinked"
  method: MatchMethod
  confidence: number
  reason: string
  /** 'system' or userId */
  performedBy: string
  performedAt: Date
  /** Previous match ID if overridden */
  previousMatchId?: string
}

/**
 * Audit entry for display
 */
export interface AuditEntry {
  /** Formatted date (e.g., "22.01. 14:32") */
  date: string
  /** Action description (e.g., "Auto-linked", "Manual mark as paid") */
  action: string
  /** Actor name (e.g., "system" or user name) */
  actor: string
}

/**
 * Match display information for UI
 */
export interface MatchDisplay {
  /** Status label (e.g., "PLAĆENO", "PLAĆENO (ručno označeno)") */
  statusLabel: string
  /** Match information */
  matchInfo: {
    /** Method description (e.g., "Automatski (referenca u opisu)", "Ručno") */
    method: string
    /** Confidence string (e.g., "VISOKA (98%)"), null for manual */
    confidence: string | null
    /** Human-readable reason */
    reason: string
    /** When the match was created */
    matchedAt: Date
    /** Who created the match */
    matchedBy: string
  }
  /** Whether this match can be unlinked */
  canUnlink: boolean
  /** Audit trail entries */
  auditTrail: AuditEntry[]
}

/**
 * Result of batch processing
 */
export interface MatchingResult {
  /** Number of payments processed */
  processed: number
  /** Number of auto-matched payments */
  autoMatched: number
  /** Number of suggested matches */
  suggested: number
  /** Number of unmatched payments */
  unmatched: number
  /** Details of matches created */
  matches: Array<{
    paymentId: string
    invoiceId: string
    method: MatchMethod
    confidence: number
  }>
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Confidence thresholds
 */
const HIGH_CONFIDENCE_THRESHOLD = 0.9
const MEDIUM_CONFIDENCE_THRESHOLD = 0.7

/**
 * Date proximity threshold in days for amount matching
 */
const DATE_PROXIMITY_DAYS = 30

/**
 * Croatian localization strings
 */
const CROATIAN_LABELS = {
  // Status labels
  statusPaid: "PLAĆENO",
  statusPaidManual: "PLAĆENO (ručno označeno)",

  // Method labels
  methodAutoReference: "Automatski (referenca u opisu)",
  methodAutoAmount: "Automatski (iznos)",
  methodAutoClient: "Automatski (klijent)",
  methodManual: "Ručno",

  // Confidence labels
  confidenceHigh: "VISOKA",
  confidenceMedium: "SREDNJA",
  confidenceLow: "NISKA",

  // Reason templates
  reasonReferenceFound: 'Broj računa "{reference}" pronađen u opisu uplate',
  reasonAmountMatch: "Točan iznos ({amount}) s datumom blizu roka plaćanja",
  reasonAmountClientMatch: "Točan iznos ({amount}) i klijent ({client}) pronađen u podacima uplate",
  reasonClientMatch: "Klijent ({client}) pronađen u podacima uplate",
  reasonManualMatch: "Ručno označeno kao plaćeno",

  // Audit actions
  auditAutoLinked: "Automatski povezano",
  auditManualLinked: "Ručno označeno kao plaćeno",
  auditOverridden: "Promijenjeno povezivanje",
  auditUnlinked: "Poništeno povezivanje",
  auditInvoiceCreated: "Račun kreiran",

  // Actors
  actorSystem: "sustav",
} as const

// =============================================================================
// SERVICE CLASS
// =============================================================================

/**
 * PaymentMatchingService
 *
 * Handles invoice-payment matching with confidence scoring and audit trails.
 */
export class PaymentMatchingService {
  // ===========================================================================
  // PUBLIC API - FIND MATCHES
  // ===========================================================================

  /**
   * Find potential matches for an invoice
   *
   * Searches unmatched bank transactions for potential matches using
   * reference, amount, and client matching algorithms.
   *
   * @param invoiceId - The invoice ID to find matches for
   * @returns Array of potential matches sorted by confidence (highest first)
   *
   * @example
   * const matches = await paymentMatchingService.findMatchesForInvoice('invoice-123')
   * // Returns matches sorted by confidence, highest first
   */
  async findMatchesForInvoice(invoiceId: string): Promise<PotentialMatch[]> {
    // Get invoice details
    const invoice = await db.eInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        buyer: true,
        buyerOrganization: true,
      },
    })

    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`)
    }

    // Get unmatched transactions for the company
    const unmatchedTransactions = await db.bankTransaction.findMany({
      where: {
        companyId: invoice.companyId,
        matchStatus: "UNMATCHED",
        amount: { gt: 0 }, // Only credits (incoming payments)
      },
      orderBy: { date: "desc" },
    })

    const matches: PotentialMatch[] = []

    for (const transaction of unmatchedTransactions) {
      const match = this.evaluateMatch(invoice, transaction)
      if (match) {
        matches.push(match)
      }
    }

    // Sort by confidence descending
    return matches.sort((a, b) => b.confidence - a.confidence)
  }

  /**
   * Find potential matches for a payment
   *
   * Searches unpaid invoices for potential matches using
   * reference, amount, and client matching algorithms.
   *
   * @param paymentId - The bank transaction ID to find matches for
   * @returns Array of potential matches sorted by confidence (highest first)
   *
   * @example
   * const matches = await paymentMatchingService.findMatchesForPayment('transaction-123')
   */
  async findMatchesForPayment(paymentId: string): Promise<PotentialMatch[]> {
    // Get transaction details
    const transaction = await db.bankTransaction.findUnique({
      where: { id: paymentId },
    })

    if (!transaction) {
      throw new Error(`Bank transaction not found: ${paymentId}`)
    }

    // Get unpaid invoices for the company
    const unpaidInvoices = await db.eInvoice.findMany({
      where: {
        companyId: transaction.companyId,
        status: { in: ["FISCALIZED", "SENT", "DELIVERED", "ACCEPTED"] }, // Active invoices
        paymentStatus: "UNPAID", // Not yet paid
        direction: "OUTBOUND", // Issued invoices
      },
      include: {
        buyer: true,
        buyerOrganization: true,
      },
      orderBy: { issueDate: "desc" },
    })

    const matches: PotentialMatch[] = []

    for (const invoice of unpaidInvoices) {
      const match = this.evaluateMatch(invoice, transaction)
      if (match) {
        matches.push(match)
      }
    }

    // Sort by confidence descending
    return matches.sort((a, b) => b.confidence - a.confidence)
  }

  // ===========================================================================
  // PUBLIC API - CREATE MATCHES
  // ===========================================================================

  /**
   * Create an automatic match (system-initiated)
   *
   * @param invoiceId - The invoice ID
   * @param paymentId - The bank transaction ID
   * @param method - The auto-match method used
   * @param confidence - Confidence score (0.0 - 1.0)
   * @param reason - Human-readable reason (Croatian)
   * @returns The created match record
   *
   * @example
   * const match = await paymentMatchingService.createAutoMatch(
   *   'invoice-123',
   *   'payment-456',
   *   'auto_reference',
   *   0.98,
   *   'Broj računa "002-2025" pronađen u opisu uplate'
   * )
   */
  async createAutoMatch(
    invoiceId: string,
    paymentId: string,
    method: AutoMatchMethod,
    confidence: number,
    reason: string
  ): Promise<MatchRecord> {
    // Validate confidence
    if (confidence < 0 || confidence > 1) {
      throw new Error(`Invalid confidence value: ${confidence}. Must be between 0.0 and 1.0`)
    }

    // Get invoice and transaction
    const [invoice, transaction] = await Promise.all([
      db.eInvoice.findUnique({ where: { id: invoiceId } }),
      db.bankTransaction.findUnique({ where: { id: paymentId } }),
    ])

    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`)
    }
    if (!transaction) {
      throw new Error(`Bank transaction not found: ${paymentId}`)
    }
    if (invoice.companyId !== transaction.companyId) {
      throw new Error("Invoice and transaction must belong to the same company")
    }

    // Map method to MatchSource
    const source = "AUTO" as const

    // Wrap multi-table operations in transaction for atomicity
    return db.$transaction(async (tx) => {
      // Create match record
      const matchRecord = await tx.matchRecord.create({
        data: {
          companyId: invoice.companyId,
          bankTransactionId: paymentId,
          matchStatus: "AUTO_MATCHED",
          matchKind: "INVOICE",
          matchedInvoiceId: invoiceId,
          confidenceScore: Math.round(confidence * 100),
          reason,
          source,
          metadata: {
            method,
            matchedAt: new Date().toISOString(),
          },
          createdBy: null, // System-initiated
        },
      })

      // Update bank transaction status
      await tx.bankTransaction.update({
        where: { id: paymentId },
        data: {
          matchStatus: "AUTO_MATCHED",
          matchedInvoiceId: invoiceId,
          matchedBy: "system",
        },
      })

      // Update invoice payment status to PAID if not already
      if (invoice.paymentStatus !== "PAID") {
        await tx.eInvoice.update({
          where: { id: invoiceId },
          data: { paymentStatus: "PAID" },
        })
      }

      return matchRecord
    })
  }

  /**
   * Create a manual match (user-initiated)
   *
   * @param invoiceId - The invoice ID
   * @param paymentId - The bank transaction ID
   * @param userId - The user ID who created the match
   * @param reason - Optional human-readable reason
   * @returns The created match record
   *
   * @example
   * const match = await paymentMatchingService.createManualMatch(
   *   'invoice-123',
   *   'payment-456',
   *   'user-789',
   *   'Klijent platio na sastanku'
   * )
   */
  async createManualMatch(
    invoiceId: string,
    paymentId: string,
    userId: string,
    reason?: string
  ): Promise<MatchRecord> {
    // Get invoice and transaction
    const [invoice, transaction] = await Promise.all([
      db.eInvoice.findUnique({ where: { id: invoiceId } }),
      db.bankTransaction.findUnique({ where: { id: paymentId } }),
    ])

    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`)
    }
    if (!transaction) {
      throw new Error(`Bank transaction not found: ${paymentId}`)
    }
    if (invoice.companyId !== transaction.companyId) {
      throw new Error("Invoice and transaction must belong to the same company")
    }

    const matchReason = reason || CROATIAN_LABELS.reasonManualMatch

    // Wrap multi-table operations in transaction for atomicity
    return db.$transaction(async (tx) => {
      // Create match record
      const matchRecord = await tx.matchRecord.create({
        data: {
          companyId: invoice.companyId,
          bankTransactionId: paymentId,
          matchStatus: "MANUAL_MATCHED",
          matchKind: "INVOICE",
          matchedInvoiceId: invoiceId,
          confidenceScore: 100, // Manual matches have full confidence
          reason: matchReason,
          source: "MANUAL",
          metadata: {
            method: "manual",
            matchedAt: new Date().toISOString(),
          },
          createdBy: userId,
        },
      })

      // Update bank transaction status
      await tx.bankTransaction.update({
        where: { id: paymentId },
        data: {
          matchStatus: "MANUAL_MATCHED",
          matchedInvoiceId: invoiceId,
          matchedBy: userId,
        },
      })

      // Update invoice payment status to PAID if not already
      if (invoice.paymentStatus !== "PAID") {
        await tx.eInvoice.update({
          where: { id: invoiceId },
          data: { paymentStatus: "PAID" },
        })
      }

      return matchRecord
    })
  }

  // ===========================================================================
  // PUBLIC API - MANAGE MATCHES
  // ===========================================================================

  /**
   * Override an existing match with a new invoice
   *
   * Creates a new match record that references the overridden match.
   *
   * @param matchId - The existing match ID to override
   * @param newInvoiceId - The new invoice ID to match to
   * @param userId - The user ID performing the override
   * @param reason - Reason for the override
   * @returns The new match record
   *
   * @example
   * const newMatch = await paymentMatchingService.overrideMatch(
   *   'old-match-123',
   *   'new-invoice-456',
   *   'user-789',
   *   'Pogrešan račun povezan automatski'
   * )
   */
  async overrideMatch(
    matchId: string,
    newInvoiceId: string,
    userId: string,
    reason: string
  ): Promise<MatchRecord> {
    // Get existing match
    const existingMatch = await db.matchRecord.findUnique({
      where: { id: matchId },
      include: { matchedInvoice: true },
    })

    if (!existingMatch) {
      throw new Error(`Match record not found: ${matchId}`)
    }

    // Get the new invoice
    const newInvoice = await db.eInvoice.findUnique({
      where: { id: newInvoiceId },
    })

    if (!newInvoice) {
      throw new Error(`New invoice not found: ${newInvoiceId}`)
    }

    if (newInvoice.companyId !== existingMatch.companyId) {
      throw new Error("New invoice must belong to the same company")
    }

    // Wrap multi-table operations in transaction for atomicity
    return db.$transaction(async (tx) => {
      // Update old invoice payment status back to unpaid if it was this match that marked it paid
      if (existingMatch.matchedInvoiceId && existingMatch.matchedInvoice) {
        await tx.eInvoice.update({
          where: { id: existingMatch.matchedInvoiceId },
          data: { paymentStatus: "UNPAID" },
        })
      }

      // Create new match record with override reference
      const newMatch = await tx.matchRecord.create({
        data: {
          companyId: existingMatch.companyId,
          bankTransactionId: existingMatch.bankTransactionId,
          matchStatus: "MANUAL_MATCHED",
          matchKind: "INVOICE",
          matchedInvoiceId: newInvoiceId,
          confidenceScore: 100,
          reason,
          source: "MANUAL",
          metadata: {
            method: "manual",
            matchedAt: new Date().toISOString(),
            overrideReason: reason,
          },
          createdBy: userId,
          overrideOf: matchId,
        },
      })

      // Update bank transaction
      await tx.bankTransaction.update({
        where: { id: existingMatch.bankTransactionId },
        data: {
          matchStatus: "MANUAL_MATCHED",
          matchedInvoiceId: newInvoiceId,
          matchedBy: userId,
        },
      })

      // Update new invoice payment status
      if (newInvoice.paymentStatus !== "PAID") {
        await tx.eInvoice.update({
          where: { id: newInvoiceId },
          data: { paymentStatus: "PAID" },
        })
      }

      return newMatch
    })
  }

  /**
   * Unlink a match (mark as incorrect)
   *
   * Sets the match status to UNMATCHED but preserves the match record for audit.
   *
   * @param matchId - The match ID to unlink
   * @param userId - The user ID performing the unlink
   *
   * @example
   * await paymentMatchingService.unlinkMatch('match-123', 'user-456')
   */
  async unlinkMatch(matchId: string, userId: string): Promise<void> {
    // Get existing match
    const existingMatch = await db.matchRecord.findUnique({
      where: { id: matchId },
      include: { matchedInvoice: true },
    })

    if (!existingMatch) {
      throw new Error(`Match record not found: ${matchId}`)
    }

    // Wrap multi-table operations in transaction for atomicity
    await db.$transaction(async (tx) => {
      // Create a new "unlink" match record for audit trail
      await tx.matchRecord.create({
        data: {
          companyId: existingMatch.companyId,
          bankTransactionId: existingMatch.bankTransactionId,
          matchStatus: "UNMATCHED",
          matchKind: "UNMATCH",
          matchedInvoiceId: null,
          confidenceScore: null,
          reason: CROATIAN_LABELS.auditUnlinked,
          source: "MANUAL",
          metadata: {
            method: "unlink",
            unlinkedAt: new Date().toISOString(),
            previousMatchId: matchId,
          },
          createdBy: userId,
          overrideOf: matchId,
        },
      })

      // Update bank transaction to unmatched
      await tx.bankTransaction.update({
        where: { id: existingMatch.bankTransactionId },
        data: {
          matchStatus: "UNMATCHED",
          matchedInvoiceId: null,
          matchedBy: null,
        },
      })

      // Update invoice payment status back to unpaid
      if (existingMatch.matchedInvoiceId && existingMatch.matchedInvoice) {
        await tx.eInvoice.update({
          where: { id: existingMatch.matchedInvoiceId },
          data: { paymentStatus: "UNPAID" },
        })
      }
    })
  }

  // ===========================================================================
  // PUBLIC API - QUERY
  // ===========================================================================

  /**
   * Get match history for an invoice
   *
   * @param invoiceId - The invoice ID
   * @returns Array of match history entries
   *
   * @example
   * const history = await paymentMatchingService.getMatchHistory('invoice-123')
   */
  async getMatchHistory(invoiceId: string): Promise<MatchHistory[]> {
    const matches = await db.matchRecord.findMany({
      where: {
        matchedInvoiceId: invoiceId,
      },
      orderBy: { createdAt: "desc" },
    })

    // Also get any matches that were overridden to this invoice
    const overriddenMatches = await db.matchRecord.findMany({
      where: {
        overrideOf: { not: null },
        matchedInvoiceId: invoiceId,
      },
      orderBy: { createdAt: "desc" },
    })

    const allMatches = [...matches, ...overriddenMatches]
    const uniqueMatches = allMatches.filter(
      (match, index, self) => index === self.findIndex((m) => m.id === match.id)
    )

    return uniqueMatches.map((match) => this.mapToMatchHistory(match))
  }

  /**
   * Get display information for a match
   *
   * Returns Croatian-localized display information for the UI.
   *
   * @param matchId - The match ID
   * @returns Match display information
   *
   * @example
   * const display = await paymentMatchingService.getMatchDisplay('match-123')
   * // Returns display info with Croatian labels
   */
  async getMatchDisplay(matchId: string): Promise<MatchDisplay> {
    const match = await db.matchRecord.findUnique({
      where: { id: matchId },
      include: {
        matchedInvoice: true,
        bankTransaction: true,
      },
    })

    if (!match) {
      throw new Error(`Match record not found: ${matchId}`)
    }

    // Get user name if not system
    let matchedByName: string = CROATIAN_LABELS.actorSystem
    if (match.createdBy) {
      const user = await db.user.findUnique({
        where: { id: match.createdBy },
        select: { name: true, email: true },
      })
      matchedByName = user?.name || user?.email || match.createdBy
    }

    // Determine method and status labels
    const metadata = match.metadata as { method?: string } | null
    const method = (metadata?.method || "manual") as MatchMethod
    const isManual = method === "manual"

    const statusLabel = isManual ? CROATIAN_LABELS.statusPaidManual : CROATIAN_LABELS.statusPaid

    const methodLabel = this.getMethodLabel(method)
    const confidenceLabel = this.getConfidenceLabel(match.confidenceScore)

    // Build audit trail
    const auditTrail = await this.buildAuditTrail(match)

    return {
      statusLabel,
      matchInfo: {
        method: methodLabel,
        confidence: isManual ? null : confidenceLabel,
        reason: match.reason || CROATIAN_LABELS.reasonManualMatch,
        matchedAt: match.createdAt,
        matchedBy: matchedByName,
      },
      canUnlink: true,
      auditTrail,
    }
  }

  // ===========================================================================
  // PUBLIC API - BATCH PROCESSING
  // ===========================================================================

  /**
   * Process unmatched payments for a company (batch)
   *
   * Attempts to automatically match all unmatched incoming payments
   * to unpaid invoices.
   *
   * @param companyId - The company ID
   * @returns Matching result summary
   *
   * @example
   * const result = await paymentMatchingService.processUnmatchedPayments('company-123')
   * console.log(`Auto-matched: ${result.autoMatched}, Suggested: ${result.suggested}`)
   */
  async processUnmatchedPayments(companyId: string): Promise<MatchingResult> {
    // Get all unmatched incoming transactions
    const unmatchedTransactions = await db.bankTransaction.findMany({
      where: {
        companyId,
        matchStatus: "UNMATCHED",
        amount: { gt: 0 },
      },
      orderBy: { date: "desc" },
    })

    // Get all unpaid outbound invoices
    const unpaidInvoices = await db.eInvoice.findMany({
      where: {
        companyId,
        status: { in: ["FISCALIZED", "SENT", "DELIVERED", "ACCEPTED"] },
        paymentStatus: "UNPAID",
        direction: "OUTBOUND",
      },
      include: {
        buyer: true,
        buyerOrganization: true,
      },
      orderBy: { issueDate: "desc" },
    })

    const result: MatchingResult = {
      processed: unmatchedTransactions.length,
      autoMatched: 0,
      suggested: 0,
      unmatched: 0,
      matches: [],
    }

    for (const transaction of unmatchedTransactions) {
      let bestMatch: PotentialMatch | null = null
      let bestConfidence = 0

      for (const invoice of unpaidInvoices) {
        const match = this.evaluateMatch(invoice, transaction)
        if (match && match.confidence > bestConfidence) {
          bestMatch = match
          bestConfidence = match.confidence
        }
      }

      if (bestMatch) {
        if (bestConfidence >= HIGH_CONFIDENCE_THRESHOLD) {
          // Auto-match high confidence
          await this.createAutoMatch(
            bestMatch.invoiceId,
            bestMatch.paymentId,
            bestMatch.method as AutoMatchMethod,
            bestMatch.confidence,
            bestMatch.reason
          )
          result.autoMatched++
          result.matches.push({
            paymentId: bestMatch.paymentId,
            invoiceId: bestMatch.invoiceId,
            method: bestMatch.method,
            confidence: bestMatch.confidence,
          })

          // Remove matched invoice from future matches
          const invoiceIndex = unpaidInvoices.findIndex((i) => i.id === bestMatch!.invoiceId)
          if (invoiceIndex > -1) {
            unpaidInvoices.splice(invoiceIndex, 1)
          }
        } else if (bestConfidence >= MEDIUM_CONFIDENCE_THRESHOLD) {
          // Suggested match (don't auto-create, just count)
          result.suggested++
        } else {
          result.unmatched++
        }
      } else {
        result.unmatched++
      }
    }

    return result
  }

  // ===========================================================================
  // PUBLIC API - HELPERS
  // ===========================================================================

  /**
   * Get confidence level from score
   *
   * @param confidence - Confidence score (0.0 - 1.0)
   * @returns Confidence level category
   */
  getConfidenceLevel(confidence: number): MatchConfidenceLevel {
    if (confidence >= HIGH_CONFIDENCE_THRESHOLD) {
      return MatchConfidenceLevel.HIGH
    }
    if (confidence >= MEDIUM_CONFIDENCE_THRESHOLD) {
      return MatchConfidenceLevel.MEDIUM
    }
    return MatchConfidenceLevel.LOW
  }

  // ===========================================================================
  // PRIVATE METHODS - MATCHING ALGORITHM
  // ===========================================================================

  /**
   * Evaluate a potential match between invoice and transaction
   */
  private evaluateMatch(
    invoice: InvoiceWithBuyer,
    transaction: BankTransaction
  ): PotentialMatch | null {
    const indicators: MatchIndicator[] = []
    let totalScore = 0
    let method: MatchMethod = "manual"

    // 1. Reference matching (highest priority)
    const referenceMatch = this.matchReference(invoice, transaction)
    if (referenceMatch) {
      indicators.push(referenceMatch)
      totalScore += referenceMatch.score * 0.5 // 50% weight
      method = "auto_reference"
    }

    // 2. Amount matching
    const amountMatch = this.matchAmount(invoice, transaction)
    if (amountMatch) {
      indicators.push(amountMatch)
      totalScore += amountMatch.score * 0.3 // 30% weight
      if (method !== "auto_reference") {
        method = "auto_amount"
      }
    }

    // 3. Client matching
    const clientMatch = this.matchClient(invoice, transaction)
    if (clientMatch) {
      indicators.push(clientMatch)
      totalScore += clientMatch.score * 0.15 // 15% weight
      if (method !== "auto_reference" && method !== "auto_amount") {
        method = "auto_client"
      }
    }

    // 4. Date proximity
    const dateMatch = this.matchDateProximity(invoice, transaction)
    if (dateMatch) {
      indicators.push(dateMatch)
      totalScore += dateMatch.score * 0.05 // 5% weight
    }

    // No match if no indicators
    if (indicators.length === 0 || totalScore < 0.3) {
      return null
    }

    // Generate reason
    const reason = this.generateMatchReason(method, invoice, transaction, indicators)

    return {
      invoiceId: invoice.id,
      paymentId: transaction.id,
      method,
      confidence: Math.min(totalScore, 1.0),
      reason,
      matchIndicators: indicators,
    }
  }

  /**
   * Match invoice reference in payment description
   */
  private matchReference(invoice: EInvoice, transaction: BankTransaction): MatchIndicator | null {
    if (!transaction.description) {
      return null
    }

    const description = transaction.description.toLowerCase()
    const invoiceNumber = invoice.invoiceNumber.toLowerCase()

    // Pattern variations to check
    const patterns = [
      invoiceNumber, // Exact invoice number
      invoiceNumber.replace(/-/g, ""), // Without dashes
      `račun ${invoiceNumber}`,
      `racun ${invoiceNumber}`,
      `invoice ${invoiceNumber}`,
      `r-${invoiceNumber}`,
      `#${invoiceNumber}`,
    ]

    for (const pattern of patterns) {
      if (description.includes(pattern)) {
        return {
          type: "reference",
          found: pattern,
          expected: invoice.invoiceNumber,
          score: 0.98,
        }
      }
    }

    // Partial match (just the number portion)
    const numberMatch = invoiceNumber.match(/(\d+)/)
    if (numberMatch) {
      const justNumber = numberMatch[1]
      if (justNumber.length >= 3 && description.includes(justNumber)) {
        return {
          type: "reference",
          found: justNumber,
          expected: invoice.invoiceNumber,
          score: 0.75,
        }
      }
    }

    return null
  }

  /**
   * Match invoice amount with transaction amount
   */
  private matchAmount(invoice: EInvoice, transaction: BankTransaction): MatchIndicator | null {
    const invoiceAmount = Number(invoice.totalAmount)
    const transactionAmount = Number(transaction.amount)

    // Exact match
    if (Math.abs(invoiceAmount - transactionAmount) < 0.01) {
      return {
        type: "amount",
        found: transactionAmount.toFixed(2),
        expected: invoiceAmount.toFixed(2),
        score: 1.0,
      }
    }

    // Allow for small difference (bank fees)
    const difference = Math.abs(invoiceAmount - transactionAmount)
    const percentDiff = difference / invoiceAmount

    if (percentDiff <= 0.02) {
      // Within 2%
      return {
        type: "amount",
        found: transactionAmount.toFixed(2),
        expected: invoiceAmount.toFixed(2),
        score: 0.85,
      }
    }

    if (percentDiff <= 0.05) {
      // Within 5%
      return {
        type: "amount",
        found: transactionAmount.toFixed(2),
        expected: invoiceAmount.toFixed(2),
        score: 0.6,
      }
    }

    return null
  }

  /**
   * Match client name or OIB in transaction
   */
  private matchClient(
    invoice: InvoiceWithBuyer,
    transaction: BankTransaction
  ): MatchIndicator | null {
    const counterpartyName = transaction.counterpartyName?.toLowerCase() || ""
    const description = transaction.description?.toLowerCase() || ""
    const searchText = `${counterpartyName} ${description}`

    // Get client info from related entities
    const clientName = invoice.buyerOrganization?.legalName || invoice.buyer?.name || ""
    const clientOib = invoice.buyer?.oib || ""

    // OIB match (exact, high confidence)
    if (clientOib && searchText.includes(clientOib)) {
      return {
        type: "client",
        found: clientOib,
        expected: clientOib,
        score: 0.95,
      }
    }

    // Name match
    if (clientName) {
      const lowerClientName = clientName.toLowerCase()

      // Exact name match
      if (searchText.includes(lowerClientName)) {
        return {
          type: "client",
          found: clientName,
          expected: clientName,
          score: 0.85,
        }
      }

      // Partial name match (at least first word)
      const firstWord = lowerClientName.split(/\s+/)[0]
      if (firstWord.length >= 3 && searchText.includes(firstWord)) {
        return {
          type: "client",
          found: firstWord,
          expected: clientName,
          score: 0.5,
        }
      }
    }

    return null
  }

  /**
   * Match date proximity (payment within 30 days of invoice)
   */
  private matchDateProximity(
    invoice: EInvoice,
    transaction: BankTransaction
  ): MatchIndicator | null {
    const invoiceDate = new Date(invoice.issueDate)
    const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null
    const paymentDate = new Date(transaction.date)

    // Calculate days from invoice/due date
    const referenceDate = dueDate || invoiceDate
    const daysDiff = Math.floor(
      (paymentDate.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    // Payment should be after invoice and within proximity window
    if (daysDiff >= 0 && daysDiff <= DATE_PROXIMITY_DAYS) {
      const score = 1.0 - daysDiff / DATE_PROXIMITY_DAYS // Higher score for closer dates
      return {
        type: "date",
        found: paymentDate.toISOString().split("T")[0],
        expected: referenceDate.toISOString().split("T")[0],
        score: Math.max(score, 0.3),
      }
    }

    // Allow payments slightly before due date (up to 5 days)
    if (daysDiff >= -5 && daysDiff < 0) {
      return {
        type: "date",
        found: paymentDate.toISOString().split("T")[0],
        expected: referenceDate.toISOString().split("T")[0],
        score: 0.8,
      }
    }

    return null
  }

  /**
   * Generate human-readable match reason in Croatian
   */
  private generateMatchReason(
    method: MatchMethod,
    invoice: InvoiceWithBuyer,
    _transaction: BankTransaction,
    indicators: MatchIndicator[]
  ): string {
    const referenceIndicator = indicators.find((i) => i.type === "reference")
    const clientIndicator = indicators.find((i) => i.type === "client")

    switch (method) {
      case "auto_reference":
        return CROATIAN_LABELS.reasonReferenceFound.replace(
          "{reference}",
          referenceIndicator?.found || invoice.invoiceNumber
        )

      case "auto_amount":
        if (clientIndicator) {
          return CROATIAN_LABELS.reasonAmountClientMatch
            .replace("{amount}", `€${Number(invoice.totalAmount).toFixed(2)}`)
            .replace("{client}", clientIndicator.expected)
        }
        return CROATIAN_LABELS.reasonAmountMatch.replace(
          "{amount}",
          `€${Number(invoice.totalAmount).toFixed(2)}`
        )

      case "auto_client":
        return CROATIAN_LABELS.reasonClientMatch.replace(
          "{client}",
          clientIndicator?.expected || ""
        )

      default:
        return CROATIAN_LABELS.reasonManualMatch
    }
  }

  // ===========================================================================
  // PRIVATE METHODS - DISPLAY HELPERS
  // ===========================================================================

  /**
   * Get localized method label
   */
  private getMethodLabel(method: MatchMethod): string {
    switch (method) {
      case "auto_reference":
        return CROATIAN_LABELS.methodAutoReference
      case "auto_amount":
        return CROATIAN_LABELS.methodAutoAmount
      case "auto_client":
        return CROATIAN_LABELS.methodAutoClient
      case "manual":
        return CROATIAN_LABELS.methodManual
      default:
        return method
    }
  }

  /**
   * Get localized confidence label
   */
  private getConfidenceLabel(confidenceScore: number | null): string | null {
    if (confidenceScore === null) {
      return null
    }

    const confidence = confidenceScore / 100
    const level = this.getConfidenceLevel(confidence)

    let levelLabel: string
    switch (level) {
      case MatchConfidenceLevel.HIGH:
        levelLabel = CROATIAN_LABELS.confidenceHigh
        break
      case MatchConfidenceLevel.MEDIUM:
        levelLabel = CROATIAN_LABELS.confidenceMedium
        break
      case MatchConfidenceLevel.LOW:
        levelLabel = CROATIAN_LABELS.confidenceLow
        break
    }

    return `${levelLabel} (${confidenceScore}%)`
  }

  /**
   * Build audit trail for a match
   */
  private async buildAuditTrail(match: MatchRecord): Promise<AuditEntry[]> {
    const trail: AuditEntry[] = []

    // Add the current match entry
    const metadata = match.metadata as { method?: string } | null
    const isManual = (metadata?.method || "manual") === "manual"

    let matchedByName: string = CROATIAN_LABELS.actorSystem
    if (match.createdBy) {
      const user = await db.user.findUnique({
        where: { id: match.createdBy },
        select: { name: true, email: true },
      })
      matchedByName = user?.name || user?.email || match.createdBy
    }

    trail.push({
      date: this.formatDateCroatian(match.createdAt),
      action: isManual ? CROATIAN_LABELS.auditManualLinked : CROATIAN_LABELS.auditAutoLinked,
      actor: matchedByName,
    })

    // Get any previous matches (override chain)
    if (match.overrideOf) {
      const previousMatch = await db.matchRecord.findUnique({
        where: { id: match.overrideOf },
      })
      if (previousMatch) {
        const prevTrail = await this.buildAuditTrail(previousMatch)
        trail.push(...prevTrail)
      }
    }

    return trail
  }

  /**
   * Format date in Croatian style (DD.MM. HH:mm)
   */
  private formatDateCroatian(date: Date): string {
    const day = date.getDate().toString().padStart(2, "0")
    const month = (date.getMonth() + 1).toString().padStart(2, "0")
    const hours = date.getHours().toString().padStart(2, "0")
    const minutes = date.getMinutes().toString().padStart(2, "0")
    return `${day}.${month}. ${hours}:${minutes}`
  }

  /**
   * Map MatchRecord to MatchHistory
   */
  private mapToMatchHistory(match: MatchRecord): MatchHistory {
    const metadata = match.metadata as { method?: string; unlinkedAt?: string } | null
    const method = (metadata?.method || "manual") as MatchMethod

    let action: "created" | "overridden" | "unlinked"
    if (match.matchKind === "UNMATCH") {
      action = "unlinked"
    } else if (match.overrideOf) {
      action = "overridden"
    } else {
      action = "created"
    }

    return {
      matchId: match.id,
      action,
      method,
      confidence: (match.confidenceScore || 100) / 100,
      reason: match.reason || "",
      performedBy: match.createdBy || "system",
      performedAt: match.createdAt,
      previousMatchId: match.overrideOf || undefined,
    }
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

/**
 * Singleton instance of PaymentMatchingService
 *
 * @example
 * import { paymentMatchingService } from '@/lib/services/payment-matching.service'
 *
 * const matches = await paymentMatchingService.findMatchesForInvoice('invoice-123')
 */
export const paymentMatchingService = new PaymentMatchingService()

// Also export the class for testing
export default PaymentMatchingService
