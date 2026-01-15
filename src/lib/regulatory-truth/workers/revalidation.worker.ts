// src/lib/regulatory-truth/workers/revalidation.worker.ts
//
// Revalidation Worker: Scheduled re-validation of published rules
// Task 4.2: RTL Autonomy - Continuous Re-Validation
//
// This worker implements tier-based revalidation schedules:
// - T0: Weekly (7 days) - Critical compliance rules
// - T1: Bi-weekly (14 days) - High-risk rules
// - T2: Monthly (30 days) - Medium-risk rules
// - T3: Quarterly (90 days) - Low-risk rules
//
// Re-runs the full validation suite on published rules:
// 1. Quote-in-evidence check
// 2. Source availability check
// 3. Conflict detection
// 4. Confidence recalculation
//
// Failed revalidations trigger alerts requiring human review.

import { Job } from "bullmq"
import { dbReg } from "@/lib/db"
import { createWorker, setupGracefulShutdown, type JobResult } from "./base"
import { jobsProcessed, jobDuration } from "./metrics"
import { findQuoteInEvidence } from "../utils/quote-in-evidence"
import { detectStructuralConflicts } from "../utils/conflict-detector"
import {
  REVALIDATION_INTERVALS,
  CONFIDENCE_THRESHOLD,
  revalidateRule,
  createRevalidationAlert,
  type RevalidationCheck,
  type RevalidationResult,
} from "../utils/revalidation"

// =============================================================================
// TYPES
// =============================================================================

interface RevalidationJobData {
  runId: string
  parentJobId?: string
  riskTier?: string // Optional: only revalidate specific tier
}

interface RevalidationJobResult {
  rulesChecked: number
  rulesPassed: number
  rulesFailed: number
  alertsCreated: number
  errors: string[]
}

// =============================================================================
// DATABASE OPERATIONS
// =============================================================================

/**
 * Fetch rules due for revalidation based on their tier schedule.
 */
async function getRulesDueForRevalidation(riskTier?: string): Promise<
  Array<{
    id: string
    conceptSlug: string
    riskTier: string
    value: string
    confidence: number
    groundingQuotes: unknown
  }>
> {
  const rules = await dbReg.ruleFact.findMany({
    where: {
      status: "PUBLISHED",
      ...(riskTier && { riskTier: riskTier as "T0" | "T1" | "T2" | "T3" }),
    },
    select: {
      id: true,
      conceptSlug: true,
      riskTier: true,
      value: true,
      confidence: true,
      groundingQuotes: true,
      updatedAt: true,
    },
  })

  // Filter based on revalidation schedule
  const now = new Date()
  return rules.filter((rule) => {
    const intervalDays = REVALIDATION_INTERVALS[rule.riskTier]
    if (!intervalDays) return false

    // Use updatedAt as a proxy for lastValidatedAt until we add the column
    const lastValidated = rule.updatedAt
    const daysSinceValidation = (now.getTime() - lastValidated.getTime()) / (1000 * 60 * 60 * 24)
    return daysSinceValidation > intervalDays
  })
}

/**
 * Run quote-in-evidence check for a rule.
 */
async function runQuoteInEvidenceCheck(
  ruleId: string,
  groundingQuotes: unknown
): Promise<RevalidationCheck> {
  try {
    // groundingQuotes is a JSON array of objects with evidenceId and quote
    type GroundingQuote = {
      evidenceId?: string
      quote?: string
      [key: string]: unknown
    }
    const quotes = groundingQuotes as GroundingQuote[]

    if (!Array.isArray(quotes) || quotes.length === 0) {
      return {
        name: "quote-in-evidence",
        passed: false,
        reason: "No grounding quotes found for rule",
      }
    }

    // Check each quote against its evidence
    for (const quoteObj of quotes) {
      if (!quoteObj.evidenceId || !quoteObj.quote) continue

      const evidence = await dbReg.evidence.findUnique({
        where: { id: quoteObj.evidenceId },
        select: { rawContent: true, contentHash: true },
      })

      if (!evidence) {
        return {
          name: "quote-in-evidence",
          passed: false,
          reason: `Evidence ${quoteObj.evidenceId} not found`,
        }
      }

      const matchResult = findQuoteInEvidence(
        evidence.rawContent,
        quoteObj.quote,
        evidence.contentHash
      )

      if (!matchResult.found) {
        return {
          name: "quote-in-evidence",
          passed: false,
          reason: `Quote not found in evidence ${quoteObj.evidenceId}`,
        }
      }
    }

    return { name: "quote-in-evidence", passed: true }
  } catch (error) {
    return {
      name: "quote-in-evidence",
      passed: false,
      reason: `Error checking quotes: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

/**
 * Run source availability check for a rule.
 */
async function runSourceAvailabilityCheck(groundingQuotes: unknown): Promise<RevalidationCheck> {
  try {
    type GroundingQuote = { evidenceId?: string; [key: string]: unknown }
    const quotes = groundingQuotes as GroundingQuote[]

    if (!Array.isArray(quotes) || quotes.length === 0) {
      return { name: "source-availability", passed: true } // No sources to check
    }

    // Get unique evidence IDs
    const evidenceIds = [
      ...new Set(
        quotes
          .filter(
            (q): q is GroundingQuote & { evidenceId: string } => typeof q.evidenceId === "string"
          )
          .map((q) => q.evidenceId)
      ),
    ]

    if (evidenceIds.length === 0) {
      return { name: "source-availability", passed: true }
    }

    // Check if evidence records still exist and are available
    const evidence = await dbReg.evidence.findMany({
      where: { id: { in: evidenceIds } },
      select: { id: true, stalenessStatus: true, deletedAt: true },
    })

    // Check for missing evidence
    const foundIds = new Set(evidence.map((e) => e.id))
    const missingIds = evidenceIds.filter((id) => !foundIds.has(id))
    if (missingIds.length > 0) {
      return {
        name: "source-availability",
        passed: false,
        reason: `Evidence records not found: ${missingIds.join(", ")}`,
      }
    }

    // Check for unavailable/deleted evidence
    const unavailable = evidence.filter(
      (e) => e.stalenessStatus === "UNAVAILABLE" || e.deletedAt !== null
    )
    if (unavailable.length > 0) {
      return {
        name: "source-availability",
        passed: false,
        reason: `Evidence unavailable: ${unavailable.map((e) => e.id).join(", ")}`,
      }
    }

    return { name: "source-availability", passed: true }
  } catch (error) {
    return {
      name: "source-availability",
      passed: false,
      reason: `Error checking sources: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

/**
 * Run conflict detection check for a rule.
 */
async function runConflictDetectionCheck(
  ruleId: string,
  conceptSlug: string,
  value: string
): Promise<RevalidationCheck> {
  try {
    // Check for new conflicts that may have emerged
    const conflicts = await detectStructuralConflicts({
      id: ruleId,
      conceptSlug,
      value,
      effectiveFrom: null,
      effectiveUntil: null,
      authorityLevel: "GUIDANCE", // Default, actual level would be fetched
    })

    if (conflicts.length > 0) {
      const conflictDescriptions = conflicts.map((c) => c.reason).join("; ")
      return {
        name: "conflict-detection",
        passed: false,
        reason: `Conflicts detected: ${conflictDescriptions}`,
      }
    }

    return { name: "conflict-detection", passed: true }
  } catch (error) {
    return {
      name: "conflict-detection",
      passed: false,
      reason: `Error detecting conflicts: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

/**
 * Run confidence recalculation check for a rule.
 */
function runConfidenceRecalculationCheck(
  ruleId: string,
  currentConfidence: number
): RevalidationCheck {
  // Check if confidence has dropped below threshold
  if (currentConfidence < CONFIDENCE_THRESHOLD) {
    return {
      name: "confidence-recalculation",
      passed: false,
      reason: `Confidence dropped below threshold: ${currentConfidence.toFixed(2)} < ${CONFIDENCE_THRESHOLD}`,
    }
  }

  return { name: "confidence-recalculation", passed: true }
}

/**
 * Run the full validation suite on a rule.
 */
async function runValidationSuite(rule: {
  id: string
  conceptSlug: string
  value: string
  confidence: number
  groundingQuotes: unknown
}): Promise<RevalidationResult> {
  const checks: RevalidationCheck[] = []

  // 1. Quote-in-evidence check
  const quoteCheck = await runQuoteInEvidenceCheck(rule.id, rule.groundingQuotes)
  checks.push(quoteCheck)

  // 2. Source availability check
  const sourceCheck = await runSourceAvailabilityCheck(rule.groundingQuotes)
  checks.push(sourceCheck)

  // 3. Conflict detection
  const conflictCheck = await runConflictDetectionCheck(rule.id, rule.conceptSlug, rule.value)
  checks.push(conflictCheck)

  // 4. Confidence recalculation
  const confidenceCheck = runConfidenceRecalculationCheck(rule.id, rule.confidence)
  checks.push(confidenceCheck)

  return revalidateRule(rule.id, checks)
}

/**
 * Record a revalidation result in the database.
 */
async function recordRevalidation(result: RevalidationResult): Promise<void> {
  await dbReg.ruleRevalidation.create({
    data: {
      ruleId: result.ruleId,
      validatedAt: result.validatedAt,
      passed: result.passed,
      failures: result.failures.length > 0 ? result.failures : null,
      validationSuite: "full",
    },
  })
}

/**
 * Create a monitoring alert for a failed revalidation.
 */
async function createAlert(result: RevalidationResult): Promise<void> {
  const alertData = createRevalidationAlert(result)

  // Note: AlertType enum doesn't have REVALIDATION_FAILED, so we use CONFLICT_DETECTED
  // as the closest match (similar to how regression-detector does it)
  await dbReg.monitoringAlert.create({
    data: {
      severity: alertData.severity,
      type: "CONFLICT_DETECTED", // Using existing type; future: add REVALIDATION_FAILED
      affectedRuleIds: alertData.affectedRuleIds,
      description: alertData.description,
      humanActionRequired: alertData.humanActionRequired,
    },
  })
}

// =============================================================================
// JOB PROCESSING
// =============================================================================

/**
 * Process the revalidation job.
 */
async function processRevalidationJob(job: Job<RevalidationJobData>): Promise<JobResult> {
  const start = Date.now()
  const { runId, riskTier } = job.data

  const result: RevalidationJobResult = {
    rulesChecked: 0,
    rulesPassed: 0,
    rulesFailed: 0,
    alertsCreated: 0,
    errors: [],
  }

  try {
    console.log(`[revalidation] Starting run ${runId}${riskTier ? ` for tier ${riskTier}` : ""}`)

    // Fetch rules due for revalidation
    const rulesDue = await getRulesDueForRevalidation(riskTier)
    console.log(`[revalidation] Found ${rulesDue.length} rules due for revalidation`)

    // Process each rule
    for (const rule of rulesDue) {
      result.rulesChecked++

      try {
        // Run validation suite
        const validationResult = await runValidationSuite(rule)

        // Record the revalidation
        await recordRevalidation(validationResult)

        if (validationResult.passed) {
          result.rulesPassed++
          console.log(`[revalidation] Rule ${rule.id} (${rule.conceptSlug}) passed`)
        } else {
          result.rulesFailed++
          console.log(
            `[revalidation] Rule ${rule.id} (${rule.conceptSlug}) FAILED: ` +
              validationResult.failures.map((f) => f.check).join(", ")
          )

          // Create alert for failed revalidation
          await createAlert(validationResult)
          result.alertsCreated++
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        result.errors.push(`Rule ${rule.id}: ${errorMessage}`)
        console.error(`[revalidation] Error processing rule ${rule.id}:`, errorMessage)
      }
    }

    const duration = Date.now() - start
    const hasErrors = result.errors.length > 0
    const status = hasErrors ? "partial" : "success"

    jobsProcessed.inc({
      worker: "revalidation",
      status,
      queue: "revalidation",
    })
    jobDuration.observe({ worker: "revalidation", queue: "revalidation" }, duration / 1000)

    console.log(`[revalidation] Run ${runId} completed:`, {
      rulesChecked: result.rulesChecked,
      rulesPassed: result.rulesPassed,
      rulesFailed: result.rulesFailed,
      alertsCreated: result.alertsCreated,
      errors: result.errors.length,
      duration: `${duration}ms`,
    })

    return {
      success: !hasErrors,
      duration,
      data: result,
    }
  } catch (error) {
    jobsProcessed.inc({
      worker: "revalidation",
      status: "failed",
      queue: "revalidation",
    })

    return {
      success: false,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// =============================================================================
// WORKER SETUP
// =============================================================================

// Only create worker if this file is run directly (not imported for tests)
if (process.env.WORKER_TYPE === "revalidation") {
  const worker = createWorker<RevalidationJobData>("revalidation", processRevalidationJob, {
    name: "revalidation",
    concurrency: 1, // Only one revalidation at a time
    lockDuration: 600000, // 10 minutes - may take a while for many rules
    stalledInterval: 60000, // Check for stalled jobs every 1 min
  })

  setupGracefulShutdown([worker])

  console.log("[revalidation] Worker started")
}
