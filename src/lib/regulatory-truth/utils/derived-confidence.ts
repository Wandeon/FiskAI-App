// src/lib/regulatory-truth/utils/derived-confidence.ts

/**
 * Compute derived confidence from source pointers.
 *
 * Issue #770: Rule confidence should be derived from underlying evidence quality,
 * not just LLM self-assessment. This prevents high-confidence rules backed by
 * low-quality extractions from being auto-approved.
 *
 * @param pointers - Source pointers with confidence scores
 * @param llmConfidence - LLM's self-assessed confidence
 * @returns Derived confidence score (0-1)
 */
export function computeDerivedConfidence(
  pointers: Array<{ confidence: number }>,
  llmConfidence: number
): number {
  if (pointers.length === 0) return 0

  // Calculate average pointer confidence
  const avgPointerConfidence =
    pointers.reduce((sum, p) => sum + p.confidence, 0) / pointers.length

  // Find minimum pointer confidence (weakest evidence)
  const minPointerConfidence = Math.min(...pointers.map((p) => p.confidence))

  // Rule confidence cannot exceed its weakest evidence
  // Weighted formula: 90% average + 10% minimum (ensures weak links pull down confidence)
  const evidenceBasedConfidence = avgPointerConfidence * 0.9 + minPointerConfidence * 0.1

  // Final confidence is the minimum of LLM confidence and evidence-based confidence
  // This ensures a rule can't have high confidence if either:
  // 1. The LLM is uncertain about its composition
  // 2. The underlying evidence is low quality
  return Math.min(evidenceBasedConfidence, llmConfidence)
}
