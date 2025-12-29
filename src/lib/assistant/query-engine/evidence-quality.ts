// src/lib/assistant/query-engine/evidence-quality.ts
/**
 * EVIDENCE QUALITY SCORING
 *
 * Calculates evidence quality based on:
 * 1. Freshness (days since fetchedAt)
 * 2. Number of corroborating sources
 * 3. Authority level weight
 * 4. Quote match quality (exact vs normalized)
 * 5. Temporal validity margin (distance to effectiveUntil)
 *
 * This quality score is combined with query confidence to produce
 * the final confidence score shown to users.
 */

import type { RuleCandidate } from "./rule-selector"

// Authority weights (higher is better)
const AUTHORITY_WEIGHTS: Record<string, number> = {
  LAW: 1.0,
  REGULATION: 0.9,
  GUIDANCE: 0.75,
  PRACTICE: 0.6,
}

// Freshness decay schedule (in days)
const FRESHNESS_DECAY = [
  { maxDays: 30, score: 1.0 }, // < 30 days: 100%
  { maxDays: 90, score: 0.95 }, // < 90 days: 95%
  { maxDays: 180, score: 0.9 }, // < 180 days: 90%
  { maxDays: 365, score: 0.8 }, // < 1 year: 80%
  { maxDays: 730, score: 0.7 }, // < 2 years: 70%
  { maxDays: Infinity, score: 0.5 }, // 2+ years: 50%
]

// Temporal validity margin (days until effectiveUntil)
const TEMPORAL_MARGIN_DECAY = [
  { daysRemaining: 365, score: 1.0 }, // > 1 year: 100%
  { daysRemaining: 180, score: 0.95 }, // > 6 months: 95%
  { daysRemaining: 90, score: 0.9 }, // > 3 months: 90%
  { daysRemaining: 30, score: 0.8 }, // > 1 month: 80%
  { daysRemaining: 7, score: 0.7 }, // > 1 week: 70%
  { daysRemaining: 0, score: 0.5 }, // < 1 week: 50%
]

export interface EvidenceQualityFactors {
  freshness: number // 0-1
  sourceCount: number // 0-1
  authorityWeight: number // 0-1
  quoteQuality: number // 0-1
  temporalMargin: number // 0-1
}

export interface EvidenceQualityScore {
  overall: number // 0-1
  factors: EvidenceQualityFactors
  breakdown: {
    freshness: { score: number; ageInDays: number }
    sourceCount: { score: number; count: number }
    authorityWeight: { score: number; level: string }
    quoteQuality: { score: number; hasExactQuote: boolean }
    temporalMargin: { score: number; daysRemaining: number | null }
  }
}

/**
 * Calculate freshness score based on days since evidence was fetched.
 */
function calculateFreshnessScore(fetchedAt: Date | null): {
  score: number
  ageInDays: number
} {
  if (!fetchedAt) {
    // No fetchedAt = assume very old
    return { score: 0.3, ageInDays: -1 }
  }

  const now = new Date()
  const ageMs = now.getTime() - fetchedAt.getTime()
  const ageInDays = Math.floor(ageMs / (24 * 60 * 60 * 1000))

  // Find matching decay tier
  for (const tier of FRESHNESS_DECAY) {
    if (ageInDays <= tier.maxDays) {
      return { score: tier.score, ageInDays }
    }
  }

  return { score: 0.5, ageInDays }
}

/**
 * Calculate source count score based on number of corroborating sources.
 * Multiple sources increase confidence.
 */
function calculateSourceCountScore(sourceCount: number): { score: number; count: number } {
  if (sourceCount === 0) {
    return { score: 0, count: 0 }
  }

  // Logarithmic scaling with diminishing returns
  // 1 source: 0.6, 2 sources: 0.8, 3+ sources: 0.95-1.0
  let score = 0.6
  if (sourceCount >= 2) {
    score = 0.8
  }
  if (sourceCount >= 3) {
    score = 0.95
  }
  if (sourceCount >= 4) {
    score = 1.0
  }

  return { score, count: sourceCount }
}

/**
 * Get authority weight for the given authority level.
 */
function getAuthorityWeight(authorityLevel: string): { score: number; level: string } {
  const score = AUTHORITY_WEIGHTS[authorityLevel] ?? 0.5
  return { score, level: authorityLevel }
}

/**
 * Calculate quote quality score.
 * Exact quotes have higher quality than missing quotes.
 */
function calculateQuoteQuality(hasExactQuote: boolean): { score: number; hasExactQuote: boolean } {
  return {
    score: hasExactQuote ? 1.0 : 0.7,
    hasExactQuote,
  }
}

/**
 * Calculate temporal margin score.
 * Rules approaching effectiveUntil get lower scores.
 */
function calculateTemporalMargin(
  effectiveUntil: Date | null
): { score: number; daysRemaining: number | null } {
  if (!effectiveUntil) {
    // No expiration date = assume permanent
    return { score: 1.0, daysRemaining: null }
  }

  const now = new Date()
  const remainingMs = effectiveUntil.getTime() - now.getTime()
  const daysRemaining = Math.floor(remainingMs / (24 * 60 * 60 * 1000))

  // Already expired
  if (daysRemaining < 0) {
    return { score: 0, daysRemaining }
  }

  // Find matching tier
  for (const tier of TEMPORAL_MARGIN_DECAY) {
    if (daysRemaining >= tier.daysRemaining) {
      return { score: tier.score, daysRemaining }
    }
  }

  return { score: 0.5, daysRemaining }
}

/**
 * Calculate overall evidence quality score for a rule.
 *
 * Weighted average:
 * - Freshness: 25%
 * - Source count: 20%
 * - Authority: 30%
 * - Quote quality: 15%
 * - Temporal margin: 10%
 */
export function calculateEvidenceQuality(rule: RuleCandidate): EvidenceQualityScore {
  // Get the most recent evidence fetchedAt across all source pointers
  const fetchedDates = rule.sourcePointers
    .map((sp) => sp.evidence.fetchedAt)
    .filter((d): d is Date => d !== null)

  const mostRecentFetchedAt = fetchedDates.length > 0 ? new Date(Math.max(...fetchedDates.map((d) => d.getTime()))) : null

  const freshness = calculateFreshnessScore(mostRecentFetchedAt)
  const sourceCount = calculateSourceCountScore(rule.sourcePointers.length)
  const authorityWeight = getAuthorityWeight(rule.authorityLevel)
  const quoteQuality = calculateQuoteQuality(
    rule.sourcePointers.some((sp) => sp.exactQuote && sp.exactQuote.length > 0)
  )
  const temporalMargin = calculateTemporalMargin(rule.effectiveUntil)

  // Weighted average
  const overall =
    freshness.score * 0.25 +
    sourceCount.score * 0.2 +
    authorityWeight.score * 0.3 +
    quoteQuality.score * 0.15 +
    temporalMargin.score * 0.1

  return {
    overall,
    factors: {
      freshness: freshness.score,
      sourceCount: sourceCount.score,
      authorityWeight: authorityWeight.score,
      quoteQuality: quoteQuality.score,
      temporalMargin: temporalMargin.score,
    },
    breakdown: {
      freshness,
      sourceCount,
      authorityWeight,
      quoteQuality,
      temporalMargin,
    },
  }
}

/**
 * Calculate final confidence score by combining query confidence and evidence quality.
 *
 * Query confidence (30%): How well we understood the question
 * Evidence quality (70%): How strong the evidence is
 */
export function calculateFinalConfidence(
  queryConfidence: number,
  evidenceQuality: number
): number {
  return queryConfidence * 0.3 + evidenceQuality * 0.7
}

/**
 * Calculate evidence quality for multiple rules and return aggregated score.
 * Uses the highest-quality rule's score.
 */
export function calculateAggregateEvidenceQuality(rules: RuleCandidate[]): number {
  if (rules.length === 0) {
    return 0
  }

  // Use the highest quality evidence score
  const qualityScores = rules.map((rule) => calculateEvidenceQuality(rule).overall)
  return Math.max(...qualityScores)
}
