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

// Type for source pointer with evidenceId (soft reference)
export interface SourcePointerWithEvidenceId {
  id: string
  evidenceId: string
}

// Type for evidence with source (fetched separately via dbReg)
export interface EvidenceWithSource {
  id: string
  sourceId: string
  source: { id: string; slug: string; name: string } | null
}

/**
 * Validate source consistency across pointers.
 * Issue #906: Ensures pointer.evidenceId matches expected rule.sourceId
 *
 * Cross-source references are allowed but flagged for audit.
 * This prevents silent source attribution confusion where a rule
 * could theoretically reference evidence from a completely different source.
 *
 * @param pointers - Source pointers with evidenceId (soft reference)
 * @param evidenceMap - Map of evidenceId -> evidence record (fetched separately via dbReg)
 * @returns Validation result with cross-source reference details
 */
export async function validateSourceConsistency(
  pointers: SourcePointerWithEvidenceId[],
  evidenceMap: Map<string, EvidenceWithSource>
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
    const evidence = evidenceMap.get(pointer.evidenceId)
    if (evidence?.sourceId) {
      sourceCounts.set(evidence.sourceId, (sourceCounts.get(evidence.sourceId) || 0) + 1)
    }
  }

  // Find the primary source (most frequently referenced)
  const firstEvidence = evidenceMap.get(pointers[0].evidenceId)
  let primarySourceId = firstEvidence?.sourceId || null
  let maxCount = 0
  for (const [sourceId, count] of sourceCounts) {
    if (count > maxCount) {
      maxCount = count
      primarySourceId = sourceId
    }
  }

  // Check each pointer for cross-source references
  for (const pointer of pointers) {
    const evidence = evidenceMap.get(pointer.evidenceId)
    if (!evidence?.sourceId || !evidence.source) continue

    const evidenceSourceId = evidence.sourceId

    if (primarySourceId && evidenceSourceId !== primarySourceId) {
      crossSourceReferences.push({
        pointerId: pointer.id,
        evidenceId: evidence.id,
        sourceId: evidenceSourceId,
        sourceName: evidence.source.name,
      })

      warnings.push(
        `Cross-source reference: Pointer ${pointer.id} cites evidence from "${evidence.source.name}" (${evidence.source.slug}) while primary source is different`
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
