// src/lib/regulatory-truth/utils/health-gates.ts
import { db, dbReg } from "@/lib/db"

export interface HealthGate {
  name: string
  status: "healthy" | "degraded" | "critical"
  value: number
  threshold: number
  message: string
  recommendation?: string
}

export interface HealthGateResult {
  overallHealth: "healthy" | "degraded" | "critical"
  gates: HealthGate[]
  timestamp: string
}

// Parse failure types - indicate pipeline/prompt issues (strict threshold)
const PARSE_FAILURE_TYPES = [
  "NO_QUOTE_MATCH",
  "QUOTE_NOT_IN_EVIDENCE",
  "PARSE_ERROR",
  "SCHEMA_INVALID",
]

// Validator rejection types - indicate healthy strictness (lenient threshold)
const VALIDATOR_REJECTION_TYPES = [
  "OUT_OF_RANGE",
  "INVALID_CURRENCY",
  "INVALID_DATE",
  "VALIDATION_FAILED",
  "CONFIDENCE_TOO_LOW",
]

/**
 * Gate 1a: Extractor parse failure rate
 * Thresholds: >10% CRITICAL, >5% DEGRADED
 * Parse failures indicate the extractor pipeline is broken - prompts need refinement
 */
async function checkExtractorParseFailureRate(): Promise<HealthGate> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours

  const parseFailures = await dbReg.extractionRejected.count({
    where: {
      createdAt: { gte: cutoff },
      rejectionType: { in: PARSE_FAILURE_TYPES },
    },
  })

  const successfulExtractions = await db.sourcePointer.count({
    where: { createdAt: { gte: cutoff } },
  })

  const totalRejections = await dbReg.extractionRejected.count({
    where: { createdAt: { gte: cutoff } },
  })

  const total = successfulExtractions + totalRejections
  const parseFailureRate = total > 0 ? (parseFailures / total) * 100 : 0

  let status: "healthy" | "degraded" | "critical" = "healthy"
  let recommendation: string | undefined

  if (parseFailureRate > 10) {
    status = "critical"
    recommendation =
      "High parse failure rate indicates extractor prompts need refinement or evidence preprocessing issues. Review ExtractionRejected records with types: NO_QUOTE_MATCH, QUOTE_NOT_IN_EVIDENCE, PARSE_ERROR, SCHEMA_INVALID."
  } else if (parseFailureRate > 5) {
    status = "degraded"
    recommendation =
      "Parse failure rate trending up. Monitor extractor output quality and evidence preprocessing."
  }

  return {
    name: "extractor_parse_failure_rate",
    status,
    value: Math.round(parseFailureRate * 10) / 10,
    threshold: 10,
    message: `${parseFailures} parse failures / ${total} total extractions (${parseFailureRate.toFixed(1)}%)`,
    recommendation,
  }
}

/**
 * Gate 1b: Validator rejection rate
 * Thresholds: >35% CRITICAL, >20% DEGRADED
 * Validator rejections are healthy - they catch bad data before it enters the system
 * Higher threshold because some rejection is expected and desirable
 */
async function checkValidatorRejectionRate(): Promise<HealthGate> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours

  const validatorRejections = await dbReg.extractionRejected.count({
    where: {
      createdAt: { gte: cutoff },
      rejectionType: { in: VALIDATOR_REJECTION_TYPES },
    },
  })

  const successfulExtractions = await db.sourcePointer.count({
    where: { createdAt: { gte: cutoff } },
  })

  const totalRejections = await dbReg.extractionRejected.count({
    where: { createdAt: { gte: cutoff } },
  })

  const total = successfulExtractions + totalRejections
  const validatorRejectionRate = total > 0 ? (validatorRejections / total) * 100 : 0

  let status: "healthy" | "degraded" | "critical" = "healthy"
  let recommendation: string | undefined

  if (validatorRejectionRate > 35) {
    status = "critical"
    recommendation =
      "Very high validator rejection rate. Check if source data quality has degraded or validators are misconfigured. Review rejection patterns by type: OUT_OF_RANGE, INVALID_CURRENCY, INVALID_DATE."
  } else if (validatorRejectionRate > 20) {
    status = "degraded"
    recommendation =
      "Elevated validator rejection rate. Monitor for patterns - some rejection is healthy, but sustained high rates may indicate source quality issues."
  }

  return {
    name: "validator_rejection_rate",
    status,
    value: Math.round(validatorRejectionRate * 10) / 10,
    threshold: 35,
    message: `${validatorRejections} validator rejections / ${total} total extractions (${validatorRejectionRate.toFixed(1)}%)`,
    recommendation,
  }
}

/**
 * Gate 2: Quote validation rate
 * Thresholds: >10% CRITICAL, >5% DEGRADED
 * Quote failures indicate LLM hallucination - serious audit risk
 */
async function checkQuoteValidationRate(): Promise<HealthGate> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)

  // Check for rejections specifically due to quote not being in evidence
  const quoteFailures = await dbReg.extractionRejected.count({
    where: {
      createdAt: { gte: cutoff },
      rejectionType: { in: ["NO_QUOTE_MATCH", "QUOTE_NOT_IN_EVIDENCE"] },
    },
  })

  const totalExtractions = await db.sourcePointer.count({
    where: { createdAt: { gte: cutoff } },
  })

  const totalRejections = await dbReg.extractionRejected.count({
    where: { createdAt: { gte: cutoff } },
  })

  const total = totalExtractions + totalRejections
  const quoteFailureRate = total > 0 ? (quoteFailures / total) * 100 : 0

  let status: "healthy" | "degraded" | "critical" = "healthy"
  let recommendation: string | undefined

  if (quoteFailureRate > 5) {
    status = "critical"
    recommendation =
      "Quotes not found in evidence suggest LLM hallucination or quote extraction issues. Review extractor prompts and evidence preprocessing. This is an audit risk."
  } else if (quoteFailureRate > 2) {
    status = "degraded"
    recommendation =
      "Quote failure rate trending up. Review recent ExtractionRejected records for hallucination patterns."
  }

  return {
    name: "quote_validation_rate",
    status,
    value: Math.round(quoteFailureRate * 10) / 10,
    threshold: 5,
    message: `${quoteFailures} quote failures / ${total} total extractions (${quoteFailureRate.toFixed(1)}%)`,
    recommendation,
  }
}

/**
 * Gate 3: T0/T1 approval compliance
 * Alert if any T0/T1 rules reach PUBLISHED without approvedBy
 */
async function checkT0T1ApprovalCompliance(): Promise<HealthGate> {
  const unapprovedCritical = await db.regulatoryRule.count({
    where: {
      riskTier: { in: ["T0", "T1"] },
      status: "PUBLISHED",
      approvedBy: null,
    },
  })

  const totalCriticalPublished = await db.regulatoryRule.count({
    where: {
      riskTier: { in: ["T0", "T1"] },
      status: "PUBLISHED",
    },
  })

  let status: "healthy" | "degraded" | "critical" = "healthy"
  let recommendation: string | undefined

  if (unapprovedCritical > 0) {
    status = "critical"
    recommendation =
      "T0/T1 rules MUST have human approval before publishing. This indicates a gate failure in the releaser. Investigate and fix immediately."
  }

  return {
    name: "t0_t1_approval_compliance",
    status,
    value: unapprovedCritical,
    threshold: 0,
    message: `${unapprovedCritical} unapproved T0/T1 rules / ${totalCriticalPublished} total critical published`,
    recommendation,
  }
}

/**
 * Gate 4a: Source pointer coverage - PUBLISHED rules
 * Zero tolerance: ANY published rule without source pointer is critical
 */
async function checkSourcePointerCoveragePublished(): Promise<HealthGate> {
  // Count PUBLISHED rules without source pointers - this should NEVER happen
  const publishedWithoutPointers = await db.regulatoryRule.count({
    where: {
      status: "PUBLISHED",
      sourcePointers: {
        none: {},
      },
    },
  })

  const totalPublished = await db.regulatoryRule.count({
    where: { status: "PUBLISHED" },
  })

  let status: "healthy" | "degraded" | "critical" = "healthy"
  let recommendation: string | undefined

  if (publishedWithoutPointers > 0) {
    status = "critical"
    recommendation =
      "CRITICAL: Published rules without source pointers cannot be audited. This breaks the chain of evidence. Fix immediately."
  }

  return {
    name: "source_pointer_coverage_published",
    status,
    value: publishedWithoutPointers,
    threshold: 0,
    message: `${publishedWithoutPointers} published rules without pointers / ${totalPublished} total published`,
    recommendation,
  }
}

/**
 * Gate 4b: Source pointer coverage - DRAFT/PENDING rules
 * More lenient: drafts may not have pointers yet, but watch the rate
 */
async function checkSourcePointerCoverageDraft(): Promise<HealthGate> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days

  // Count non-published rules without source pointers
  const draftsWithoutPointers = await db.regulatoryRule.count({
    where: {
      createdAt: { gte: cutoff },
      status: { notIn: ["PUBLISHED", "REJECTED"] },
      sourcePointers: {
        none: {},
      },
    },
  })

  const totalDrafts = await db.regulatoryRule.count({
    where: {
      createdAt: { gte: cutoff },
      status: { notIn: ["PUBLISHED", "REJECTED"] },
    },
  })

  const missingPointerRate = totalDrafts > 0 ? (draftsWithoutPointers / totalDrafts) * 100 : 0

  let status: "healthy" | "degraded" | "critical" = "healthy"
  let recommendation: string | undefined

  if (missingPointerRate > 5) {
    status = "critical"
    recommendation =
      "High rate of draft rules without source pointers. Check extractor and composer validation."
  }

  return {
    name: "source_pointer_coverage_draft",
    status,
    value: Math.round(missingPointerRate * 10) / 10,
    threshold: 5,
    message: `${draftsWithoutPointers} draft rules without pointers / ${totalDrafts} total drafts (${missingPointerRate.toFixed(1)}%)`,
    recommendation,
  }
}

/**
 * Gate 5: Conflict resolution rate
 * Alert if > 50% of conflicts are unresolved after 7 days
 */
async function checkConflictResolutionRate(): Promise<HealthGate> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const unresolvedOldConflicts = await db.regulatoryConflict.count({
    where: {
      status: "OPEN",
      createdAt: { lte: cutoff },
    },
  })

  const totalOldConflicts = await db.regulatoryConflict.count({
    where: {
      createdAt: { lte: cutoff },
    },
  })

  const unresolvedRate =
    totalOldConflicts > 0 ? (unresolvedOldConflicts / totalOldConflicts) * 100 : 0

  let status: "healthy" | "degraded" | "critical" = "healthy"
  let recommendation: string | undefined

  if (unresolvedRate > 50) {
    status = "critical"
    recommendation =
      "High unresolved conflict rate indicates conflict resolution agent is not running or failing. Check arbiter agent logs and queue health."
  } else if (unresolvedRate > 30) {
    status = "degraded"
    recommendation =
      "Conflicts are accumulating. Consider reviewing arbiter confidence thresholds or increasing human review capacity."
  }

  return {
    name: "conflict_resolution_rate",
    status,
    value: Math.round(unresolvedRate * 10) / 10,
    threshold: 50,
    message: `${unresolvedOldConflicts} unresolved / ${totalOldConflicts} total conflicts >7 days (${unresolvedRate.toFixed(1)}%)`,
    recommendation,
  }
}

/**
 * Gate 6: Release blocked attempts
 * Track when releases are blocked due to T0/T1 without approval
 * This is a leading indicator - blocks mean the gate is working
 */
async function checkReleaseBlockedAttempts(): Promise<HealthGate> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days

  // Count releaser runs that failed due to unapproved T0/T1 rules
  const blockedReleases = await db.agentRun.count({
    where: {
      agentType: "RELEASER",
      status: "FAILED",
      startedAt: { gte: cutoff },
      OR: [
        { error: { contains: "T0/T1 rules without approvedBy" } },
        { error: { contains: "Cannot release" } },
      ],
    },
  })

  const totalReleaseAttempts = await db.agentRun.count({
    where: {
      agentType: "RELEASER",
      startedAt: { gte: cutoff },
    },
  })

  // Blocked attempts are informational - they show the gate is working
  // But high block rate suggests process issues (rules being created without approval path)
  const blockRate = totalReleaseAttempts > 0 ? (blockedReleases / totalReleaseAttempts) * 100 : 0

  let status: "healthy" | "degraded" | "critical" = "healthy"
  let recommendation: string | undefined

  if (blockedReleases > 0 && blockRate > 50) {
    status = "degraded"
    recommendation =
      "High rate of blocked releases. Review rule creation workflow to ensure T0/T1 rules have approval path before release attempts."
  }

  return {
    name: "release_blocked_attempts",
    status,
    value: blockedReleases,
    threshold: 0, // Informational - any blocks show gate is working
    message: `${blockedReleases} blocked / ${totalReleaseAttempts} total release attempts (${blockRate.toFixed(1)}%)`,
    recommendation,
  }
}

/**
 * Run all health gate checks
 */
export async function checkHealthGates(): Promise<HealthGateResult> {
  const gates: HealthGate[] = []

  try {
    gates.push(await checkExtractorParseFailureRate())
  } catch (error) {
    gates.push({
      name: "extractor_parse_failure_rate",
      status: "critical",
      value: -1,
      threshold: 10,
      message: `Error checking: ${error instanceof Error ? error.message : String(error)}`,
    })
  }

  try {
    gates.push(await checkValidatorRejectionRate())
  } catch (error) {
    gates.push({
      name: "validator_rejection_rate",
      status: "critical",
      value: -1,
      threshold: 35,
      message: `Error checking: ${error instanceof Error ? error.message : String(error)}`,
    })
  }

  try {
    gates.push(await checkQuoteValidationRate())
  } catch (error) {
    gates.push({
      name: "quote_validation_rate",
      status: "critical",
      value: -1,
      threshold: 10,
      message: `Error checking: ${error instanceof Error ? error.message : String(error)}`,
    })
  }

  try {
    gates.push(await checkT0T1ApprovalCompliance())
  } catch (error) {
    gates.push({
      name: "t0_t1_approval_compliance",
      status: "critical",
      value: -1,
      threshold: 0,
      message: `Error checking: ${error instanceof Error ? error.message : String(error)}`,
    })
  }

  try {
    gates.push(await checkSourcePointerCoveragePublished())
  } catch (error) {
    gates.push({
      name: "source_pointer_coverage_published",
      status: "critical",
      value: -1,
      threshold: 0,
      message: `Error checking: ${error instanceof Error ? error.message : String(error)}`,
    })
  }

  try {
    gates.push(await checkSourcePointerCoverageDraft())
  } catch (error) {
    gates.push({
      name: "source_pointer_coverage_draft",
      status: "critical",
      value: -1,
      threshold: 5,
      message: `Error checking: ${error instanceof Error ? error.message : String(error)}`,
    })
  }

  try {
    gates.push(await checkConflictResolutionRate())
  } catch (error) {
    gates.push({
      name: "conflict_resolution_rate",
      status: "critical",
      value: -1,
      threshold: 50,
      message: `Error checking: ${error instanceof Error ? error.message : String(error)}`,
    })
  }

  try {
    gates.push(await checkReleaseBlockedAttempts())
  } catch (error) {
    gates.push({
      name: "release_blocked_attempts",
      status: "critical",
      value: -1,
      threshold: 0,
      message: `Error checking: ${error instanceof Error ? error.message : String(error)}`,
    })
  }

  // Determine overall health
  const overallHealth = getOverallHealth(gates)

  return {
    overallHealth,
    gates,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Determine overall health status from gates
 */
export function getOverallHealth(gates: HealthGate[]): "healthy" | "degraded" | "critical" {
  if (gates.some((g) => g.status === "critical")) return "critical"
  if (gates.some((g) => g.status === "degraded")) return "degraded"
  return "healthy"
}
