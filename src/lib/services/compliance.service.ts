// src/lib/services/compliance.service.ts

/**
 * ComplianceService
 *
 * Evaluates compliance state for companies and runs on triggers.
 * This service determines if a pausal obrt company is compliant with
 * Croatian tax and regulatory obligations.
 *
 * States:
 * - OK: All obligations met, no upcoming risks
 * - ATTENTION: Action needed within 14 days
 * - RISK: Overdue or critical issue
 *
 * @example
 * import { complianceService } from '@/lib/services/compliance.service'
 *
 * const status = await complianceService.evaluateCompliance('company-123')
 * // { state: 'OK', evaluatedAt: Date, reasons: [], nextEvaluation: Date }
 */

import { db } from "@/lib/db"
import { regulatoryCalendarService } from "./regulatory-calendar.service"
import type { Company, ComplianceEvaluation as PrismaComplianceEvaluation } from "@prisma/client"

// =============================================================================
// TYPES
// =============================================================================

/**
 * Compliance states
 */
export enum ComplianceState {
  OK = "OK", // All obligations met, no upcoming risks
  ATTENTION = "ATTENTION", // Action needed within 14 days
  RISK = "RISK", // Overdue or critical issue
}

/**
 * Reason severity levels
 */
export type ComplianceReasonSeverity = "info" | "warning" | "critical"

/**
 * Compliance reason with actionable information
 */
export interface ComplianceReason {
  /** Unique code identifying the reason (e.g., 'DEADLINE_APPROACHING', 'MISSING_SETUP') */
  code: string
  /** Severity level */
  severity: ComplianceReasonSeverity
  /** Human-readable message */
  message: string
  /** What to do about it */
  action: string
  /** Where to do it */
  actionUrl: string
  /** If deadline-related, when it's due */
  dueDate?: Date
}

/**
 * Complete compliance status
 */
export interface ComplianceStatus {
  state: ComplianceState
  evaluatedAt: Date
  reasons: ComplianceReason[]
  nextEvaluation: Date
}

/**
 * Company data needed for compliance evaluation
 */
interface CompanyData {
  id: string
  name: string
  legalForm: string | null
  isVatPayer: boolean
  fiscalEnabled: boolean
  featureFlags: Record<string, unknown> | null
  entitlements: string[] | null
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Number of days before a deadline when we start showing ATTENTION state
 */
const ATTENTION_THRESHOLD_DAYS = 14

/**
 * Minimum hours between re-evaluations (used for login trigger)
 */
const MIN_HOURS_BETWEEN_EVALUATIONS = 1

/**
 * Income tracking thresholds (percentage of limit)
 */
const INCOME_ATTENTION_THRESHOLD = 0.85 // 85%
const INCOME_RISK_THRESHOLD = 0.95 // 95%

// =============================================================================
// REASON CODES
// =============================================================================

/**
 * Predefined reason codes for compliance issues
 */
export const ComplianceReasonCodes = {
  // Deadlines
  DEADLINE_APPROACHING: "DEADLINE_APPROACHING",
  DEADLINE_OVERDUE: "DEADLINE_OVERDUE",

  // Setup
  FISCALIZATION_REQUIRED: "FISCALIZATION_REQUIRED",
  VAT_SETUP_REQUIRED: "VAT_SETUP_REQUIRED",

  // Income
  INCOME_APPROACHING_LIMIT: "INCOME_APPROACHING_LIMIT",
  INCOME_CRITICAL: "INCOME_CRITICAL",

  // General
  MISSING_SETUP: "MISSING_SETUP",
} as const

// =============================================================================
// SERVICE CLASS
// =============================================================================

/**
 * ComplianceService
 *
 * Evaluates company compliance state and persists results.
 */
export class ComplianceService {
  // ===========================================================================
  // PUBLIC API
  // ===========================================================================

  /**
   * Evaluate compliance state for a company
   *
   * @param companyId - The company ID to evaluate
   * @returns ComplianceStatus with state, reasons, and next evaluation time
   *
   * @example
   * const status = await complianceService.evaluateCompliance('company-123')
   */
  async evaluateCompliance(companyId: string): Promise<ComplianceStatus> {
    // 1. Get company data
    const company = await this.getCompanyData(companyId)
    if (!company) {
      throw new Error(`Company not found: ${companyId}`)
    }

    // 2. Evaluate compliance
    const reasons: ComplianceReason[] = []
    const now = new Date()

    // Check deadlines
    const deadlineReasons = this.evaluateDeadlines(company, now)
    reasons.push(...deadlineReasons)

    // Check required setup
    const setupReasons = this.evaluateRequiredSetup(company)
    reasons.push(...setupReasons)

    // Check income tracking (if pausal)
    if (company.legalForm === "OBRT_PAUSAL") {
      const incomeReasons = await this.evaluateIncomeTracking(companyId, now)
      reasons.push(...incomeReasons)
    }

    // 3. Determine state from reasons
    const state = this.determineState(reasons)

    // 4. Calculate next evaluation time
    const nextEvaluation = this.calculateNextEvaluation(reasons, now)

    // 5. Save to database
    await this.saveEvaluation(companyId, state, reasons)

    return {
      state,
      evaluatedAt: now,
      reasons,
      nextEvaluation,
    }
  }

  /**
   * Get the latest compliance status from database
   *
   * @param companyId - The company ID to get status for
   * @returns ComplianceStatus or null if never evaluated
   *
   * @example
   * const status = await complianceService.getComplianceStatus('company-123')
   */
  async getComplianceStatus(companyId: string): Promise<ComplianceStatus | null> {
    const evaluation = await db.complianceEvaluation.findFirst({
      where: { companyId },
      orderBy: { evaluatedAt: "desc" },
    })

    if (!evaluation) {
      return null
    }

    return this.mapEvaluationToStatus(evaluation)
  }

  /**
   * Check if re-evaluation is needed (>1 hour since last evaluation)
   *
   * @param companyId - The company ID to check
   * @returns true if re-evaluation should be triggered
   *
   * @example
   * if (await complianceService.shouldReEvaluate('company-123')) {
   *   await complianceService.evaluateCompliance('company-123')
   * }
   */
  async shouldReEvaluate(companyId: string): Promise<boolean> {
    const evaluation = await db.complianceEvaluation.findFirst({
      where: { companyId },
      orderBy: { evaluatedAt: "desc" },
      select: { evaluatedAt: true },
    })

    if (!evaluation) {
      return true // Never evaluated
    }

    const hoursSinceLastEvaluation =
      (Date.now() - evaluation.evaluatedAt.getTime()) / (1000 * 60 * 60)

    return hoursSinceLastEvaluation > MIN_HOURS_BETWEEN_EVALUATIONS
  }

  /**
   * Get the next deadline for a company
   *
   * @param companyId - The company ID
   * @returns Next deadline date or null if no upcoming deadlines
   *
   * @example
   * const nextDeadline = await complianceService.getNextDeadline('company-123')
   */
  async getNextDeadline(companyId: string): Promise<Date | null> {
    const company = await this.getCompanyData(companyId)
    if (!company) {
      return null
    }

    const now = new Date()
    const deadlines: Date[] = []

    // Get all applicable deadlines
    if (company.legalForm === "OBRT_PAUSAL") {
      deadlines.push(regulatoryCalendarService.getNextDeadline("pausalTax", now))
      deadlines.push(regulatoryCalendarService.getNextDeadline("dohodak", now))

      // Contributions only if not employed elsewhere
      const featureFlags = company.featureFlags || {}
      if (!featureFlags.employedElsewhere) {
        deadlines.push(regulatoryCalendarService.getNextDeadline("contributions", now))
      }

      // HOK membership
      deadlines.push(regulatoryCalendarService.getNextDeadline("hok", now))
    }

    if (company.isVatPayer) {
      // VAT deadlines would be added here when implemented
    }

    if (deadlines.length === 0) {
      return null
    }

    // Return the earliest deadline
    return deadlines.reduce((earliest, current) => (current < earliest ? current : earliest))
  }

  // ===========================================================================
  // PRIVATE METHODS - EVALUATION
  // ===========================================================================

  /**
   * Evaluate deadline-related compliance
   */
  private evaluateDeadlines(company: CompanyData, now: Date): ComplianceReason[] {
    const reasons: ComplianceReason[] = []
    const featureFlags = company.featureFlags || {}

    // Pausal-specific deadlines
    if (company.legalForm === "OBRT_PAUSAL") {
      // Quarterly tax payment
      const pausalTaxDeadline = regulatoryCalendarService.getNextDeadline("pausalTax", now)
      const pausalTaxReason = this.checkDeadline(
        pausalTaxDeadline,
        now,
        "Porez na dohodak (kvartalno)",
        "/dashboard/deadlines",
        "Kako platiti porez"
      )
      if (pausalTaxReason) {
        reasons.push(pausalTaxReason)
      }

      // Monthly contributions (only if not employed elsewhere)
      if (!featureFlags.employedElsewhere) {
        const contributionsDeadline = regulatoryCalendarService.getNextDeadline(
          "contributions",
          now
        )
        const contributionsReason = this.checkDeadline(
          contributionsDeadline,
          now,
          "Mjesecni doprinosi (MIO, HZZO)",
          "/dashboard/deadlines",
          "Kako platiti doprinose"
        )
        if (contributionsReason) {
          reasons.push(contributionsReason)
        }
      }

      // HOK membership fee
      const hokDeadline = regulatoryCalendarService.getNextDeadline("hok", now)
      const hokReason = this.checkDeadline(
        hokDeadline,
        now,
        "HOK clanarina",
        "/dashboard/deadlines",
        "Kako platiti HOK clanarinu"
      )
      if (hokReason) {
        reasons.push(hokReason)
      }

      // Annual filing
      const dohodakDeadline = regulatoryCalendarService.getNextDeadline("dohodak", now)
      const dohodakReason = this.checkDeadline(
        dohodakDeadline,
        now,
        "Godisnja prijava poreza na dohodak",
        "/dashboard/deadlines",
        "Kako predati godisnju prijavu"
      )
      if (dohodakReason) {
        reasons.push(dohodakReason)
      }
    }

    return reasons
  }

  /**
   * Check a single deadline and return a reason if attention/risk needed
   */
  private checkDeadline(
    deadline: Date,
    now: Date,
    name: string,
    actionUrl: string,
    action: string
  ): ComplianceReason | null {
    const daysUntilDeadline = Math.ceil(
      (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    )

    if (daysUntilDeadline < 0) {
      // Overdue
      return {
        code: ComplianceReasonCodes.DEADLINE_OVERDUE,
        severity: "critical",
        message: `${name} - ISTEKAO`,
        action,
        actionUrl,
        dueDate: deadline,
      }
    } else if (daysUntilDeadline <= ATTENTION_THRESHOLD_DAYS) {
      // Approaching
      return {
        code: ComplianceReasonCodes.DEADLINE_APPROACHING,
        severity: "warning",
        message: `${name} - za ${daysUntilDeadline} dana`,
        action,
        actionUrl,
        dueDate: deadline,
      }
    }

    return null
  }

  /**
   * Evaluate required setup compliance
   */
  private evaluateRequiredSetup(company: CompanyData): ComplianceReason[] {
    const reasons: ComplianceReason[] = []
    const featureFlags = company.featureFlags || {}

    // Check fiscalization requirement
    // If acceptsCash is true and fiscalEnabled is false, this is a RISK
    if (featureFlags.acceptsCash === true && !company.fiscalEnabled) {
      reasons.push({
        code: ComplianceReasonCodes.FISCALIZATION_REQUIRED,
        severity: "critical",
        message: "Fiskalizacija nije postavljena",
        action: "Postavi fiskalizaciju",
        actionUrl: "/settings/fiscalization",
      })
    }

    // Check VAT setup requirement
    // If isVatPayer is true but VAT module not properly set up
    if (company.isVatPayer) {
      // Check if VAT entitlement is present
      const entitlements = company.entitlements || []
      if (!entitlements.includes("vat")) {
        reasons.push({
          code: ComplianceReasonCodes.VAT_SETUP_REQUIRED,
          severity: "critical",
          message: "PDV postavke nisu kompletne",
          action: "Zavrsi postavljanje PDV-a",
          actionUrl: "/settings/vat",
        })
      }
    }

    return reasons
  }

  /**
   * Evaluate income tracking compliance
   */
  private async evaluateIncomeTracking(companyId: string, now: Date): Promise<ComplianceReason[]> {
    const reasons: ComplianceReason[] = []

    // Get current year's income
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    const yearlyIncome = await this.getYearlyIncome(companyId, startOfYear)

    // Get the pausal limit
    const pausalLimit = regulatoryCalendarService.getPausalLimit()

    // Calculate percentage
    const incomePercentage = yearlyIncome / pausalLimit

    if (incomePercentage >= INCOME_RISK_THRESHOLD) {
      reasons.push({
        code: ComplianceReasonCodes.INCOME_CRITICAL,
        severity: "critical",
        message: `Kriticno - ${Math.round(incomePercentage * 100)}% pausalnog limita`,
        action: "Razmislite o prelasku na stvarni dohodak",
        actionUrl: "/dashboard/income",
      })
    } else if (incomePercentage >= INCOME_ATTENTION_THRESHOLD) {
      reasons.push({
        code: ComplianceReasonCodes.INCOME_APPROACHING_LIMIT,
        severity: "warning",
        message: `Priblizavate se limitu - ${Math.round(incomePercentage * 100)}% pausalnog limita`,
        action: "Pratite prihode pazljivo",
        actionUrl: "/dashboard/income",
      })
    }

    return reasons
  }

  /**
   * Get yearly income from invoices
   */
  private async getYearlyIncome(companyId: string, startOfYear: Date): Promise<number> {
    const result = await db.eInvoice.aggregate({
      where: {
        companyId,
        createdAt: { gte: startOfYear },
        status: { not: "DRAFT" },
      },
      _sum: {
        totalAmount: true,
      },
    })

    return result._sum.totalAmount?.toNumber() ?? 0
  }

  // ===========================================================================
  // PRIVATE METHODS - STATE DETERMINATION
  // ===========================================================================

  /**
   * Determine overall compliance state from reasons
   */
  private determineState(reasons: ComplianceReason[]): ComplianceState {
    // If any critical severity, state is RISK
    if (reasons.some((r) => r.severity === "critical")) {
      return ComplianceState.RISK
    }

    // If any warning severity, state is ATTENTION
    if (reasons.some((r) => r.severity === "warning")) {
      return ComplianceState.ATTENTION
    }

    // Otherwise OK
    return ComplianceState.OK
  }

  /**
   * Calculate when next evaluation should occur
   */
  private calculateNextEvaluation(reasons: ComplianceReason[], now: Date): Date {
    // Find the earliest deadline in reasons
    const deadlineReasons = reasons.filter((r) => r.dueDate)

    if (deadlineReasons.length > 0) {
      const earliestDeadline = deadlineReasons.reduce((earliest, current) =>
        current.dueDate! < earliest.dueDate! ? current : earliest
      )

      // Re-evaluate 1 day after the earliest deadline
      const nextEval = new Date(earliestDeadline.dueDate!)
      nextEval.setDate(nextEval.getDate() + 1)
      return nextEval
    }

    // Default: re-evaluate tomorrow at 02:00
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(2, 0, 0, 0)
    return tomorrow
  }

  // ===========================================================================
  // PRIVATE METHODS - DATABASE
  // ===========================================================================

  /**
   * Get company data needed for compliance evaluation
   */
  private async getCompanyData(companyId: string): Promise<CompanyData | null> {
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        legalForm: true,
        isVatPayer: true,
        fiscalEnabled: true,
        featureFlags: true,
        entitlements: true,
      },
    })

    if (!company) {
      return null
    }

    return {
      id: company.id,
      name: company.name,
      legalForm: company.legalForm,
      isVatPayer: company.isVatPayer,
      fiscalEnabled: company.fiscalEnabled,
      featureFlags: company.featureFlags as Record<string, unknown> | null,
      entitlements: company.entitlements as string[] | null,
    }
  }

  /**
   * Save evaluation to database
   */
  private async saveEvaluation(
    companyId: string,
    state: ComplianceState,
    reasons: ComplianceReason[]
  ): Promise<void> {
    await db.complianceEvaluation.create({
      data: {
        companyId,
        state,
        reasons: reasons.map((r) => ({
          ...r,
          dueDate: r.dueDate?.toISOString(),
        })),
      },
    })
  }

  /**
   * Map database evaluation to ComplianceStatus
   */
  private mapEvaluationToStatus(evaluation: PrismaComplianceEvaluation): ComplianceStatus {
    const reasons = (evaluation.reasons as Array<Record<string, unknown>>).map((r) => ({
      code: r.code as string,
      severity: r.severity as ComplianceReasonSeverity,
      message: r.message as string,
      action: r.action as string,
      actionUrl: r.actionUrl as string,
      dueDate: r.dueDate ? new Date(r.dueDate as string) : undefined,
    }))

    // Calculate next evaluation (tomorrow at 02:00 by default)
    const nextEvaluation = new Date(evaluation.evaluatedAt)
    nextEvaluation.setDate(nextEvaluation.getDate() + 1)
    nextEvaluation.setHours(2, 0, 0, 0)

    return {
      state: evaluation.state as ComplianceState,
      evaluatedAt: evaluation.evaluatedAt,
      reasons,
      nextEvaluation,
    }
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

/**
 * Singleton instance of ComplianceService
 *
 * @example
 * import { complianceService } from '@/lib/services/compliance.service'
 *
 * const status = await complianceService.evaluateCompliance('company-123')
 */
export const complianceService = new ComplianceService()

// Also export the class for testing
export default ComplianceService
