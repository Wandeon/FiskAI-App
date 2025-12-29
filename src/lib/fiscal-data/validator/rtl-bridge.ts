// src/lib/fiscal-data/validator/rtl-bridge.ts

/**
 * Regulatory Truth Layer Bridge
 *
 * Integrates fiscal-data validation with the Regulatory Truth Layer (RTL)
 * for automated verification against official Croatian regulatory sources.
 *
 * Key Features:
 * - Connects fiscal data points to RTL source pointers
 * - Creates audit trail for all value changes
 * - Emits content sync events for detected changes
 * - Provides notification system for regulatory updates
 */

import type { ValidationResult, ValidationSource } from "../types"
import type { ContentSyncEventV1, EventSeverity, ChangeType, ValueType } from "@/lib/regulatory-truth/content-sync/types"
import { mapRtlDomainToContentDomain } from "@/lib/regulatory-truth/content-sync/types"
import { generateEventId, determineSeverity, buildEventSignature, hashSourcePointerIds } from "@/lib/regulatory-truth/content-sync/event-id"
import { REGULATORY_SOURCES, type SourceDefinition } from "@/lib/regulatory-truth/data/sources"
import { DATA_POINT_DESCRIPTIONS } from "./data-point-descriptions"

// =============================================================================
// TYPES
// =============================================================================

/**
 * Maps fiscal data points to RTL domains and concepts
 */
export interface FiscalDataPointMapping {
  /** Fiscal data point path (e.g., "CONTRIBUTIONS.rates.MIO_I.rate") */
  dataPoint: string
  /** RTL domain (e.g., "doprinosi", "pausalni", "pdv") */
  rtlDomain: string
  /** RTL concept ID (e.g., "mirovinsko-i-stup") */
  conceptId: string
  /** Value type for formatting */
  valueType: ValueType
  /** Priority for notification (breaking changes get immediate alerts) */
  priority: "critical" | "high" | "medium" | "low"
}

/**
 * Audit trail entry for fiscal data changes
 */
export interface FiscalDataAuditEntry {
  /** Unique ID for this audit entry */
  id: string
  /** Timestamp of the change detection */
  timestamp: string
  /** Data point that changed */
  dataPoint: string
  /** Previous value */
  previousValue: string | number | null
  /** New value detected */
  newValue: string | number | null
  /** Confidence level (0-1) */
  confidence: number
  /** Source URL where change was detected */
  sourceUrl: string
  /** RTL source pointer IDs backing this change */
  sourcePointerIds: string[]
  /** RTL evidence IDs */
  evidenceIds: string[]
  /** Who/what initiated the change */
  changedBy: "rtl-automated" | "manual-review" | "api-update"
  /** Status of the change */
  status: "pending" | "approved" | "rejected" | "applied"
  /** Notes or rejection reason */
  notes?: string
}

/**
 * RTL verification result with traceability
 */
export interface RTLVerificationResult extends ValidationResult {
  /** RTL source pointer IDs that back this verification */
  sourcePointerIds: string[]
  /** RTL evidence IDs */
  evidenceIds: string[]
  /** RTL rule ID if a matching rule exists */
  ruleId?: string
  /** Whether the RTL has data for this data point */
  hasRTLData: boolean
  /** Date of last RTL extraction for this data point */
  lastRTLExtraction?: string
}

/**
 * Notification payload for fiscal data changes
 */
export interface FiscalChangeNotification {
  /** Notification type */
  type: "change_detected" | "validation_error" | "source_unavailable"
  /** Severity level */
  severity: EventSeverity
  /** Title for the notification */
  title: string
  /** Detailed message */
  message: string
  /** Data points affected */
  dataPoints: string[]
  /** Link to review the changes */
  reviewUrl?: string
  /** Timestamp */
  timestamp: string
}

// =============================================================================
// FISCAL DATA POINT MAPPINGS
// =============================================================================

/**
 * Maps fiscal data points to RTL domains and concepts for automated verification
 */
export const FISCAL_DATA_POINT_MAPPINGS: FiscalDataPointMapping[] = [
  // === Contribution Rates ===
  {
    dataPoint: "CONTRIBUTIONS.rates.MIO_I.rate",
    rtlDomain: "doprinosi",
    conceptId: "mirovinsko-i-stup",
    valueType: "percentage",
    priority: "critical",
  },
  {
    dataPoint: "CONTRIBUTIONS.rates.MIO_II.rate",
    rtlDomain: "doprinosi",
    conceptId: "mirovinsko-ii-stup",
    valueType: "percentage",
    priority: "critical",
  },
  {
    dataPoint: "CONTRIBUTIONS.rates.HZZO.rate",
    rtlDomain: "doprinosi",
    conceptId: "zdravstveno-rate",
    valueType: "percentage",
    priority: "critical",
  },
  {
    dataPoint: "CONTRIBUTIONS.base.minimum",
    rtlDomain: "doprinosi",
    conceptId: "pausalni-contribution-base",
    valueType: "currency",
    priority: "critical",
  },
  {
    dataPoint: "CONTRIBUTIONS.base.maximum",
    rtlDomain: "doprinosi",
    conceptId: "pausalni-contribution-base",
    valueType: "currency",
    priority: "high",
  },

  // === Tax Rates ===
  {
    dataPoint: "TAX_RATES.income.brackets.0.rate",
    rtlDomain: "porez_dohodak",
    conceptId: "porez-na-dohodak-rates",
    valueType: "percentage",
    priority: "high",
  },
  {
    dataPoint: "TAX_RATES.income.brackets.1.rate",
    rtlDomain: "porez_dohodak",
    conceptId: "porez-na-dohodak-rates",
    valueType: "percentage",
    priority: "high",
  },
  {
    dataPoint: "TAX_RATES.income.personalAllowance",
    rtlDomain: "porez_dohodak",
    conceptId: "osobni-odbitak",
    valueType: "currency",
    priority: "high",
  },
  {
    dataPoint: "TAX_RATES.corporate.small.rate",
    rtlDomain: "porez_dohodak",
    conceptId: "porez-na-dobit-reduced",
    valueType: "percentage",
    priority: "medium",
  },
  {
    dataPoint: "TAX_RATES.corporate.large.rate",
    rtlDomain: "porez_dohodak",
    conceptId: "porez-na-dobit-rate",
    valueType: "percentage",
    priority: "medium",
  },
  {
    dataPoint: "TAX_RATES.pausal.rate",
    rtlDomain: "pausalni",
    conceptId: "pausalni-tax-rate",
    valueType: "percentage",
    priority: "critical",
  },
  {
    dataPoint: "TAX_RATES.pausal.maxRevenue",
    rtlDomain: "pausalni",
    conceptId: "pausalni-revenue-limit",
    valueType: "currency",
    priority: "critical",
  },

  // === VAT Rates ===
  {
    dataPoint: "TAX_RATES.vat.standard.rate",
    rtlDomain: "pdv",
    conceptId: "pdv-standard-rate",
    valueType: "percentage",
    priority: "high",
  },
  {
    dataPoint: "TAX_RATES.vat.reduced.0.rate",
    rtlDomain: "pdv",
    conceptId: "pdv-reduced-rate",
    valueType: "percentage",
    priority: "medium",
  },
  {
    dataPoint: "TAX_RATES.vat.reduced.1.rate",
    rtlDomain: "pdv",
    conceptId: "pdv-lower-rate",
    valueType: "percentage",
    priority: "medium",
  },

  // === Thresholds ===
  {
    dataPoint: "THRESHOLDS.pdv.value",
    rtlDomain: "pdv",
    conceptId: "pdv-threshold",
    valueType: "threshold",
    priority: "critical",
  },
  {
    dataPoint: "THRESHOLDS.pausalni.value",
    rtlDomain: "pausalni",
    conceptId: "pausalni-revenue-limit",
    valueType: "threshold",
    priority: "critical",
  },
  {
    dataPoint: "THRESHOLDS.cashB2B.value",
    rtlDomain: "fiskalizacija",
    conceptId: "fiskalizacija-required",
    valueType: "threshold",
    priority: "high",
  },
]

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get RTL domain for a fiscal data point
 */
export function getRTLDomainForDataPoint(dataPoint: string): string | undefined {
  const mapping = FISCAL_DATA_POINT_MAPPINGS.find((m) => m.dataPoint === dataPoint)
  return mapping?.rtlDomain
}

/**
 * Get concept ID for a fiscal data point
 */
export function getConceptIdForDataPoint(dataPoint: string): string | undefined {
  const mapping = FISCAL_DATA_POINT_MAPPINGS.find((m) => m.dataPoint === dataPoint)
  return mapping?.conceptId
}

/**
 * Get all fiscal data points for an RTL domain
 */
export function getDataPointsForDomain(domain: string): string[] {
  return FISCAL_DATA_POINT_MAPPINGS.filter((m) => m.rtlDomain === domain).map((m) => m.dataPoint)
}

/**
 * Get RTL sources that cover a fiscal data point
 */
export function getRTLSourcesForDataPoint(dataPoint: string): SourceDefinition[] {
  const domain = getRTLDomainForDataPoint(dataPoint)
  if (!domain) return []
  return REGULATORY_SOURCES.filter((s) => s.domains.includes(domain))
}

/**
 * Get priority RTL sources (critical and high priority)
 */
export function getPriorityRTLSources(): SourceDefinition[] {
  return REGULATORY_SOURCES.filter((s) => s.priority === "critical" || s.priority === "high")
}

// =============================================================================
// RTL VERIFICATION
// =============================================================================

/**
 * Verify a validation result against RTL source pointers
 * This queries the RTL database to find supporting evidence
 */
export async function verifyAgainstRTL(
  result: ValidationResult,
  pool: { query: (sql: string, params: unknown[]) => Promise<{ rows: unknown[] }> }
): Promise<RTLVerificationResult> {
  const domain = getRTLDomainForDataPoint(result.dataPoint)

  const rtlResult: RTLVerificationResult = {
    ...result,
    sourcePointerIds: [],
    evidenceIds: [],
    hasRTLData: false,
  }

  if (!domain) {
    return rtlResult
  }

  try {
    // Query RTL for source pointers matching this domain and value
    const pointerQuery = await pool.query(
      `SELECT sp.id, sp."extractedValue", sp."displayValue", sp.confidence, sp."evidenceId",
              e.id as "evidenceId", e."sourceUrl", e."fetchedAt"
       FROM "SourcePointer" sp
       JOIN "Evidence" e ON sp."evidenceId" = e.id
       WHERE sp.domain = $1
         AND sp.confidence >= 0.8
       ORDER BY sp.confidence DESC, sp."createdAt" DESC
       LIMIT 20`,
      [domain]
    )

    if (pointerQuery.rows.length > 0) {
      rtlResult.hasRTLData = true
      rtlResult.sourcePointerIds = pointerQuery.rows.map((r: any) => r.id)
      rtlResult.evidenceIds = [...new Set(pointerQuery.rows.map((r: any) => r.evidenceId))]
      rtlResult.lastRTLExtraction = (pointerQuery.rows[0] as any).fetchedAt

      // Look for matching values
      for (const pointer of pointerQuery.rows) {
        const p = pointer as any
        const extractedNum = parseFloat(p.extractedValue)
        const foundNum =
          typeof result.foundValue === "number" ? result.foundValue : parseFloat(String(result.foundValue))

        if (!isNaN(extractedNum) && !isNaN(foundNum) && Math.abs(extractedNum - foundNum) < 0.001) {
          // Found matching RTL data
          rtlResult.confidence = Math.max(rtlResult.confidence, p.confidence)
          break
        }
      }
    }

    // Check for existing rule
    const ruleQuery = await pool.query(
      `SELECT r.id FROM "RegulatoryRule" r
       JOIN "SourcePointer" sp ON r."sourcePointerId" = sp.id
       WHERE sp.domain = $1 AND r.status = 'ACTIVE'
       LIMIT 1`,
      [domain]
    )

    if (ruleQuery.rows.length > 0) {
      rtlResult.ruleId = (ruleQuery.rows[0] as any).id
    }
  } catch (error) {
    console.error(`[rtl-bridge] Error verifying against RTL:`, error)
  }

  return rtlResult
}

// =============================================================================
// CONTENT SYNC EVENT GENERATION
// =============================================================================

/**
 * Create a content sync event for a fiscal data change
 */
export function createContentSyncEvent(
  result: RTLVerificationResult,
  previousValue: string | number | null
): ContentSyncEventV1 | null {
  const mapping = FISCAL_DATA_POINT_MAPPINGS.find((m) => m.dataPoint === result.dataPoint)
  if (!mapping || result.foundValue === null) {
    return null
  }

  const now = new Date().toISOString()
  const effectiveFrom = now.split("T")[0] // Today's date

  // Determine change type
  const changeType: ChangeType = previousValue === null ? "create" : "update"

  // Build signature
  const signature = buildEventSignature({
    ruleId: result.ruleId || `fiscal-${result.dataPoint}`,
    conceptId: mapping.conceptId,
    type: "VALUE_CHANGE",
    effectiveFrom,
    newValue: String(result.foundValue),
    sourcePointerIds: result.sourcePointerIds,
  })

  // Generate deterministic event ID
  const eventId = generateEventId(signature)

  // Determine severity based on priority and change magnitude
  const severity = determineSeverityForFiscalChange(mapping.priority, previousValue, result.foundValue)

  const event: ContentSyncEventV1 = {
    version: 1,
    id: eventId,
    timestamp: now,
    type: "VALUE_CHANGE",
    ruleId: result.ruleId || `fiscal-${result.dataPoint}`,
    conceptId: mapping.conceptId,
    domain: mapRtlDomainToContentDomain(mapping.rtlDomain),
    changeType,
    effectiveFrom,
    previousValue: previousValue !== null ? String(previousValue) : undefined,
    newValue: String(result.foundValue),
    valueType: mapping.valueType,
    sourcePointerIds: result.sourcePointerIds,
    evidenceIds: result.evidenceIds,
    primarySourceUrl: result.sourceUrl,
    confidenceLevel: Math.round(result.confidence * 100),
    severity,
    signature,
  }

  return event
}

/**
 * Determine severity for a fiscal data change
 */
function determineSeverityForFiscalChange(
  priority: "critical" | "high" | "medium" | "low",
  previousValue: string | number | null,
  newValue: string | number | null
): EventSeverity {
  // Critical priority data points with changes are always breaking
  if (priority === "critical" && previousValue !== null) {
    return "breaking"
  }

  // High priority changes are major
  if (priority === "high") {
    return "major"
  }

  // Calculate percentage change for numerical values
  if (typeof previousValue === "number" && typeof newValue === "number" && previousValue !== 0) {
    const percentChange = Math.abs((newValue - previousValue) / previousValue)
    if (percentChange > 0.1) {
      return "major" // More than 10% change
    }
    if (percentChange > 0.01) {
      return "minor" // More than 1% change
    }
  }

  return priority === "medium" ? "minor" : "info"
}

// =============================================================================
// AUDIT TRAIL
// =============================================================================

/**
 * Create an audit trail entry for a fiscal data change
 */
export function createAuditEntry(
  result: RTLVerificationResult,
  previousValue: string | number | null,
  changedBy: "rtl-automated" | "manual-review" | "api-update" = "rtl-automated"
): FiscalDataAuditEntry {
  const id = `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  return {
    id,
    timestamp: new Date().toISOString(),
    dataPoint: result.dataPoint,
    previousValue,
    newValue: result.foundValue,
    confidence: result.confidence,
    sourceUrl: result.sourceUrl,
    sourcePointerIds: result.sourcePointerIds,
    evidenceIds: result.evidenceIds,
    changedBy,
    status: changedBy === "rtl-automated" && result.confidence >= 0.95 ? "approved" : "pending",
    notes: result.extractedText,
  }
}

// =============================================================================
// NOTIFICATION SYSTEM
// =============================================================================

/**
 * Create a notification for fiscal data changes
 */
export function createChangeNotification(
  results: RTLVerificationResult[],
  type: "change_detected" | "validation_error" | "source_unavailable" = "change_detected"
): FiscalChangeNotification | null {
  const changes = results.filter((r) => r.status === "mismatch")
  if (changes.length === 0 && type === "change_detected") {
    return null
  }

  const criticalChanges = changes.filter((r) => {
    const mapping = FISCAL_DATA_POINT_MAPPINGS.find((m) => m.dataPoint === r.dataPoint)
    return mapping?.priority === "critical"
  })

  const severity: EventSeverity = criticalChanges.length > 0 ? "breaking" : changes.length > 0 ? "major" : "info"

  const dataPointDescriptions = changes.map((r) => {
    const desc = DATA_POINT_DESCRIPTIONS[r.dataPoint]
    return desc?.croatianTerm || r.dataPoint
  })

  let title: string
  let message: string

  switch (type) {
    case "change_detected":
      title = `Otkrivene promjene fiskalnih podataka (${changes.length})`
      message = `Pronađene su promjene u: ${dataPointDescriptions.join(", ")}. Potrebna provjera.`
      break
    case "validation_error":
      title = "Greška pri validaciji fiskalnih podataka"
      message = `Nije bilo moguće validirati ${results.length} podataka. Provjerite izvore.`
      break
    case "source_unavailable":
      title = "Nedostupni regulatorni izvori"
      message = `Neki regulatorni izvori nisu dostupni. Validacija odgođena.`
      break
  }

  return {
    type,
    severity,
    title,
    message,
    dataPoints: changes.map((r) => r.dataPoint),
    timestamp: new Date().toISOString(),
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  // Re-export RTL types for convenience
  type ContentSyncEventV1,
  type EventSeverity,
  type ChangeType,
  type ValueType,
}
