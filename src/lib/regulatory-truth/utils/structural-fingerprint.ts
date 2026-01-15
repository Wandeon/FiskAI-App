// src/lib/regulatory-truth/utils/structural-fingerprint.ts
//
// Structural Fingerprinting for Scraper Health Monitoring
//
// Problem: Format changes fail silently (0 items extracted, no error).
// Solution: Generate structural fingerprint on each scrape and alert when drift > 30%.
//
// Critical Safeguards (Appendix A.7):
// - Baseline Governance: Alert -> Human validation -> Approve new baseline
// - Audit Fields: baselineUpdatedAt, baselineUpdatedBy, approved diff
// - No Auto-Update: Baselines never updated automatically

import { JSDOM } from "jsdom"
import type { AlertPayload } from "../watchdog/types"

/**
 * Drift threshold percentage that triggers an alert.
 * When structure drift exceeds this value, a CRITICAL alert is raised.
 */
export const DRIFT_THRESHOLD_PERCENT = 30

/**
 * Structural fingerprint of an HTML page.
 * Used to detect format changes that could cause silent scraper failures.
 */
export interface StructuralFingerprint {
  /** Count of each HTML tag type (e.g., {div: 50, p: 30, table: 5}) */
  tagCounts: Record<string, number>
  /** Count of elements matching specific selectors (e.g., {'.content': 10, '#main': 1}) */
  selectorYields: Record<string, number>
  /** Ratio of text content to total content (0-1) */
  contentRatio: number
  /** Total number of elements in the document */
  totalElements: number
  /** When this fingerprint was generated */
  generatedAt: Date
}

/**
 * Baseline metadata with audit fields for governance.
 * Baselines are never auto-updated - they require human approval.
 */
export interface BaselineMetadata {
  /** Current baseline fingerprint */
  fingerprint: StructuralFingerprint
  /** When the baseline was last updated */
  baselineUpdatedAt: Date
  /** Who updated the baseline ("initial" | user email) */
  baselineUpdatedBy: string
  /** Approval status - baselines require human approval */
  approvalStatus: "pending" | "approved"
  /** Previous fingerprint for comparison (optional) */
  previousFingerprint?: StructuralFingerprint
}

/**
 * Options for fingerprint generation.
 */
export interface FingerprintOptions {
  /** CSS selectors to track yield counts for */
  selectors?: string[]
}

/**
 * Result of structural drift check.
 */
export interface DriftCheckResult {
  /** Drift percentage (0-100) */
  driftPercent: number
  /** Whether drift exceeds threshold and alert should be raised */
  shouldAlert: boolean
  /** Current fingerprint that was compared */
  currentFingerprint: StructuralFingerprint
}

/**
 * Generate a structural fingerprint from HTML content.
 *
 * @param html - HTML content to analyze
 * @param options - Optional configuration (selectors to track)
 * @returns Structural fingerprint of the HTML
 */
export function generateFingerprint(
  html: string,
  options: FingerprintOptions = {}
): StructuralFingerprint {
  const now = new Date()

  // Handle empty HTML
  if (!html || html.trim().length === 0) {
    return {
      tagCounts: {},
      selectorYields: {},
      contentRatio: 0,
      totalElements: 0,
      generatedAt: now,
    }
  }

  // Parse HTML with jsdom (forgiving with malformed HTML)
  const dom = new JSDOM(html)
  const document = dom.window.document

  // Count tags
  const tagCounts: Record<string, number> = {}
  let totalElements = 0

  function countTags(node: Node) {
    if (node.nodeType === 1) {
      // Element node
      const element = node as Element
      const tag = element.tagName.toLowerCase()
      tagCounts[tag] = (tagCounts[tag] || 0) + 1
      totalElements++
    }

    for (const child of Array.from(node.childNodes)) {
      countTags(child)
    }
  }

  countTags(document.documentElement || document.body || document)

  // Calculate selector yields
  const selectorYields: Record<string, number> = {}
  if (options.selectors) {
    for (const selector of options.selectors) {
      try {
        const matches = document.querySelectorAll(selector)
        selectorYields[selector] = matches.length
      } catch {
        // Invalid selector - set to 0
        selectorYields[selector] = 0
      }
    }
  }

  // Calculate content ratio
  // Text content vs total HTML length (excluding script/style)
  const body = document.body
  const textContent = body ? body.textContent || "" : ""
  const cleanText = textContent.replace(/\s+/g, " ").trim()
  const contentRatio = html.length > 0 ? cleanText.length / html.length : 0

  return {
    tagCounts,
    selectorYields,
    contentRatio: Math.min(contentRatio, 1), // Cap at 1
    totalElements,
    generatedAt: now,
  }
}

/**
 * Calculate drift percentage between baseline and current fingerprints.
 *
 * Uses a weighted combination of:
 * - Tag distribution similarity (Jaccard-like coefficient)
 * - Selector yield changes
 * - Content ratio change
 * - Total element count change
 *
 * @param baseline - Baseline fingerprint to compare against
 * @param current - Current fingerprint
 * @returns Drift percentage (0-100)
 */
export function calculateDrift(
  baseline: StructuralFingerprint,
  current: StructuralFingerprint
): number {
  // Weights for different components (should sum to 1)
  // Selector yields and content ratio are weighted higher because they are
  // stronger signals for format changes that cause silent failures
  const WEIGHT_TAG_DISTRIBUTION = 0.25
  const WEIGHT_SELECTOR_YIELDS = 0.4 // Increased - key signal for format changes
  const WEIGHT_CONTENT_RATIO = 0.25 // Increased - detects page becoming mostly scripts
  const WEIGHT_ELEMENT_COUNT = 0.1

  let totalDrift = 0

  // 1. Tag distribution drift (Jaccard-like similarity)
  const tagDrift = calculateTagDistributionDrift(baseline.tagCounts, current.tagCounts)
  totalDrift += tagDrift * WEIGHT_TAG_DISTRIBUTION

  // 2. Selector yields drift
  const selectorDrift = calculateSelectorYieldsDrift(
    baseline.selectorYields,
    current.selectorYields
  )
  totalDrift += selectorDrift * WEIGHT_SELECTOR_YIELDS

  // 3. Content ratio drift (scaled to 0-100 range)
  // A change from 0.7 to 0.1 (60% absolute change) should be significant
  const contentRatioDrift = Math.abs(baseline.contentRatio - current.contentRatio) * 100
  totalDrift += contentRatioDrift * WEIGHT_CONTENT_RATIO

  // 4. Element count drift
  const elementCountDrift = calculateElementCountDrift(
    baseline.totalElements,
    current.totalElements
  )
  totalDrift += elementCountDrift * WEIGHT_ELEMENT_COUNT

  return Math.round(totalDrift * 100) / 100 // Round to 2 decimal places
}

/**
 * Calculate drift in tag distribution using a modified Jaccard similarity.
 */
function calculateTagDistributionDrift(
  baseline: Record<string, number>,
  current: Record<string, number>
): number {
  const allTags = Array.from(new Set([...Object.keys(baseline), ...Object.keys(current)]))

  if (allTags.length === 0) return 0

  let totalDifference = 0
  let totalSum = 0

  for (const tag of allTags) {
    const baselineCount = baseline[tag] || 0
    const currentCount = current[tag] || 0
    const max = Math.max(baselineCount, currentCount)
    const diff = Math.abs(baselineCount - currentCount)

    totalDifference += diff
    totalSum += max
  }

  if (totalSum === 0) return 0

  // Normalize to percentage
  return (totalDifference / totalSum) * 100
}

/**
 * Calculate drift in selector yields.
 * Heavily penalizes selectors that go from yielding results to 0.
 */
function calculateSelectorYieldsDrift(
  baseline: Record<string, number>,
  current: Record<string, number>
): number {
  const allSelectors = Array.from(new Set([...Object.keys(baseline), ...Object.keys(current)]))

  if (allSelectors.length === 0) return 0

  let totalDrift = 0
  let selectorCount = 0

  for (const selector of allSelectors) {
    const baselineYield = baseline[selector] || 0
    const currentYield = current[selector] || 0

    // Heavy penalty when a selector that used to yield results now yields 0
    if (baselineYield > 0 && currentYield === 0) {
      totalDrift += 100 // Full drift for this selector
    } else if (baselineYield === 0 && currentYield === 0) {
      // Both 0, no drift
      totalDrift += 0
    } else {
      // Calculate percentage change
      const max = Math.max(baselineYield, currentYield)
      const diff = Math.abs(baselineYield - currentYield)
      totalDrift += (diff / max) * 100
    }

    selectorCount++
  }

  return selectorCount > 0 ? totalDrift / selectorCount : 0
}

/**
 * Calculate drift in total element count.
 */
function calculateElementCountDrift(baseline: number, current: number): number {
  if (baseline === 0 && current === 0) return 0
  if (baseline === 0) return 100 // From 0 to something is 100% change

  const diff = Math.abs(baseline - current)
  return Math.min((diff / baseline) * 100, 100) // Cap at 100%
}

/**
 * Check structural drift against baseline and raise alert if needed.
 *
 * @param endpointId - ID of the endpoint being checked
 * @param currentHtml - Current HTML content
 * @param baseline - Baseline metadata to compare against
 * @param raiseAlert - Function to raise alerts
 * @returns Drift check result
 */
export async function checkStructuralDrift(
  endpointId: string,
  currentHtml: string,
  baseline: BaselineMetadata,
  raiseAlert: (payload: AlertPayload) => Promise<string>
): Promise<DriftCheckResult> {
  // Generate fingerprint with same selectors as baseline
  const selectors = Object.keys(baseline.fingerprint.selectorYields)
  const currentFingerprint = generateFingerprint(currentHtml, { selectors })

  // Calculate drift
  const driftPercent = calculateDrift(baseline.fingerprint, currentFingerprint)

  const shouldAlert = driftPercent > DRIFT_THRESHOLD_PERCENT

  if (shouldAlert) {
    await raiseAlert({
      severity: "CRITICAL",
      type: "STRUCTURAL_DRIFT",
      entityId: endpointId,
      message: `Structural drift of ${driftPercent.toFixed(1)}% detected (threshold: ${DRIFT_THRESHOLD_PERCENT}%)`,
      details: {
        driftPercent,
        baselineUpdatedAt: baseline.baselineUpdatedAt,
        currentFingerprint,
        baselineFingerprint: baseline.fingerprint,
      },
    })
  }

  return {
    driftPercent,
    shouldAlert,
    currentFingerprint,
  }
}

/**
 * Create initial baseline metadata for an endpoint.
 *
 * @param html - Initial HTML to fingerprint
 * @param selectors - Selectors to track
 * @returns Baseline metadata in pending state (requires human approval)
 */
export function createInitialBaseline(html: string, selectors: string[] = []): BaselineMetadata {
  const fingerprint = generateFingerprint(html, { selectors })

  return {
    fingerprint,
    baselineUpdatedAt: new Date(),
    baselineUpdatedBy: "initial",
    approvalStatus: "pending",
  }
}

/**
 * Propose a baseline update (does not auto-approve).
 *
 * @param currentBaseline - Current baseline
 * @param newHtml - New HTML to fingerprint
 * @param proposedBy - Who is proposing the update
 * @returns New baseline metadata in pending state
 */
export function proposeBaselineUpdate(
  currentBaseline: BaselineMetadata,
  newHtml: string,
  proposedBy: string
): BaselineMetadata {
  const selectors = Object.keys(currentBaseline.fingerprint.selectorYields)
  const newFingerprint = generateFingerprint(newHtml, { selectors })

  return {
    fingerprint: newFingerprint,
    baselineUpdatedAt: new Date(),
    baselineUpdatedBy: proposedBy,
    approvalStatus: "pending", // Never auto-approve
    previousFingerprint: currentBaseline.fingerprint,
  }
}

/**
 * Approve a pending baseline.
 *
 * This function transitions a baseline from "pending" to "approved" status,
 * recording who approved it and when. This is the human-in-the-loop step
 * required by baseline governance rules (Appendix A.7).
 *
 * @param pendingBaseline - Baseline metadata in pending state
 * @param approvedBy - Email of the admin who approved the baseline
 * @returns New baseline metadata with approved status
 */
export function approveBaseline(
  pendingBaseline: BaselineMetadata,
  approvedBy: string
): BaselineMetadata {
  return {
    ...pendingBaseline,
    approvalStatus: "approved",
    baselineUpdatedBy: approvedBy,
    baselineUpdatedAt: new Date(),
  }
}
