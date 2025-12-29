// src/lib/regulatory-truth/utils/source-consistency.ts
// Issue #906: Source attribution integrity validation

import { logAuditEvent } from "./audit-log"

export interface SourceConsistencyResult {
  valid: boolean
  warnings: string[]
  crossSourceReferences: Array<{
    pointerId: string
    evidenceId: string
    sourceId: string
    sourceName: string
  }>
  primarySourceId: string | null
}

export interface SourcePointerWithEvidence {
  id: string
  evidence: {
    id: string
    sourceId: string
    source: { id: string; slug: string; name: string }
  }
}

/**
 * Validate source consistency across pointers.
 * Issue #906: Ensures pointer.evidenceId matches expected rule.sourceId
 *
 * Cross-source references are allowed but flagged for audit.
 * This prevents silent source attribution confusion where a rule
 * could theoretically reference evidence from a completely different source.
 *
 * @param pointers - Source pointers with their evidence and source relations
 * @returns Validation result with cross-source reference details
 */
export async function validateSourceConsistency(
  pointers: SourcePointerWithEvidence[]
): Promise<SourceConsistencyResult> {
  const warnings: string[] = []
  const crossSourceReferences: SourceConsistencyResult["crossSourceReferences"] = []

  if (pointers.length === 0) {
    return {
      valid: true,
      warnings: [],
      crossSourceReferences: [],
      primarySourceId: null,
    }
  }

  // Determine primary source (most common source among pointers)
  const sourceCounts = new Map<string, number>()
  for (const pointer of pointers) {
    const sourceId = pointer.evidence.sourceId
    sourceCounts.set(sourceId, (sourceCounts.get(sourceId) || 0) + 1)
  }

  // Find the primary source (most frequently referenced)
  let primarySourceId = pointers[0].evidence.sourceId
  let maxCount = 0
  for (const [sourceId, count] of sourceCounts) {
    if (count > maxCount) {
      maxCount = count
      primarySourceId = sourceId
    }
  }

  // Check each pointer for cross-source references
  for (const pointer of pointers) {
    const evidenceSourceId = pointer.evidence.sourceId

    if (evidenceSourceId !== primarySourceId) {
      crossSourceReferences.push({
        pointerId: pointer.id,
        evidenceId: pointer.evidence.id,
        sourceId: evidenceSourceId,
        sourceName: pointer.evidence.source.name,
      })

      warnings.push(
        `Cross-source reference: Pointer ${pointer.id} cites evidence from "${pointer.evidence.source.name}" (${pointer.evidence.source.slug}) while primary source is different`
      )
    }
  }

  return {
    valid: true, // Cross-references are allowed but flagged
    warnings,
    crossSourceReferences,
    primarySourceId,
  }
}

/**
 * Log cross-source references to the audit log for compliance tracking.
 * Issue #906: Provides audit trail for cross-source citations.
 *
 * @param referenceId - ID to associate with the audit event (e.g., first pointer ID)
 * @param sourceConsistency - Result from validateSourceConsistency
 */
export async function logCrossSourceReferences(
  referenceId: string,
  sourceConsistency: SourceConsistencyResult
): Promise<void> {
  if (sourceConsistency.crossSourceReferences.length === 0) {
    return
  }

  await logAuditEvent({
    action: "CROSS_SOURCE_REFERENCE",
    entityType: "RULE",
    entityId: referenceId,
    metadata: {
      primarySourceId: sourceConsistency.primarySourceId,
      crossSourceCount: sourceConsistency.crossSourceReferences.length,
      crossSourceReferences: sourceConsistency.crossSourceReferences,
      warnings: sourceConsistency.warnings,
    },
  })
}
