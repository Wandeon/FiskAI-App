// src/lib/article-agent/utils/confidence.ts

import { SupportLevel, THRESHOLDS } from "../types"

interface ChunkClassification {
  similarity: number
  relationship: SupportLevel
  confidence: number
}

const SUPPORT_WEIGHTS: Record<SupportLevel, number> = {
  SUPPORTED: 1.0,
  PARTIALLY_SUPPORTED: 0.6,
  NOT_SUPPORTED: 0.0,
  CONTRADICTED: -0.5,
}

export function aggregateConfidence(classifications: ChunkClassification[]): {
  confidence: number
  status: SupportLevel
  hasCriticalIssue: boolean
} {
  if (classifications.length === 0) {
    return { confidence: 0, status: "NOT_SUPPORTED", hasCriticalIssue: true }
  }

  let totalWeight = 0
  let weightedSum = 0
  let hasContradiction = false
  let hasSupport = false

  for (const c of classifications) {
    const weight = c.similarity * c.confidence
    const value = SUPPORT_WEIGHTS[c.relationship]

    weightedSum += weight * value
    totalWeight += weight

    if (c.relationship === "CONTRADICTED") hasContradiction = true
    if (c.relationship === "SUPPORTED") hasSupport = true
  }

  const rawConfidence = totalWeight > 0 ? weightedSum / totalWeight : 0

  // Normalize to 0-1 range (raw can be negative due to contradictions)
  const confidence = Math.max(0, Math.min(1, (rawConfidence + 0.5) / 1.5))

  // Determine status
  let status: SupportLevel
  if (hasContradiction) {
    status = "CONTRADICTED"
  } else if (confidence >= 0.7 && hasSupport) {
    status = "SUPPORTED"
  } else if (confidence >= 0.4) {
    status = "PARTIALLY_SUPPORTED"
  } else {
    status = "NOT_SUPPORTED"
  }

  return {
    confidence,
    status,
    hasCriticalIssue: hasContradiction || confidence < THRESHOLDS.PARAGRAPH_FAIL,
  }
}

export function shouldLock(confidence: number): boolean {
  return confidence >= THRESHOLDS.PARAGRAPH_PASS
}

export function shouldRewrite(confidence: number): boolean {
  return confidence >= THRESHOLDS.PARAGRAPH_FAIL && confidence < THRESHOLDS.PARAGRAPH_PASS
}

export function needsHumanReview(confidence: number): boolean {
  return confidence < THRESHOLDS.PARAGRAPH_FAIL
}

export function calculateOverallConfidence(paragraphConfidences: number[]): number {
  if (paragraphConfidences.length === 0) return 0
  return paragraphConfidences.reduce((sum, c) => sum + c, 0) / paragraphConfidences.length
}
