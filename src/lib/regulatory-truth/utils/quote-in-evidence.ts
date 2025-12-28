// src/lib/regulatory-truth/utils/quote-in-evidence.ts
// PROVENANCE VALIDATION: Verify that SourcePointer.exactQuote exists in Evidence.rawContent
//
// This is a HARD GATE for rule approval and publication.
// Without this, the system can publish rules with fabricated or mis-anchored quotes.

export type MatchType = "exact" | "normalized" | "not_found"

export interface QuoteMatchResult {
  found: boolean
  matchType: MatchType
  /** Start offset in the ORIGINAL (non-normalized) rawContent, if found */
  start?: number
  /** End offset in the ORIGINAL (non-normalized) rawContent, if found */
  end?: number
  /** Debug info for reviewer UI */
  debug?: {
    quotePreview: string // First 80 chars of quote
    evidenceHash: string // For audit
    normalizedQuoteLength: number
    normalizedEvidenceLength: number
  }
}

export interface ProvenanceValidationResult {
  valid: boolean
  pointerId: string
  evidenceId: string
  matchResult: QuoteMatchResult
  /** Actionable error message for UI */
  error?: string
}

export interface RuleProvenanceResult {
  ruleId: string
  valid: boolean
  pointerResults: ProvenanceValidationResult[]
  /** All failing pointers */
  failures: ProvenanceValidationResult[]
}

/**
 * Normalize text for matching.
 *
 * DETERMINISTIC RULES (in order):
 * 1. Unicode NFKC normalization (compatibility decomposition + canonical composition)
 * 2. Replace NBSP (\u00A0) with regular space
 * 3. Remove soft hyphens (\u00AD)
 * 4. Normalize all quote variants to ASCII double quote (")
 * 5. Normalize all apostrophe variants to ASCII single quote (')
 * 6. Collapse whitespace runs (spaces, tabs, newlines) to single space
 * 7. Trim leading/trailing whitespace
 *
 * NO FUZZY MATCHING. NO EMBEDDINGS. NO "SIMILARITY".
 */
export function normalizeForMatch(text: string): string {
  if (!text) return ""

  let normalized = text

  // 1. Unicode NFKC normalization
  normalized = normalized.normalize("NFKC")

  // 2. Replace NBSP with regular space
  normalized = normalized.replace(/\u00A0/g, " ")

  // 3. Remove soft hyphens
  normalized = normalized.replace(/\u00AD/g, "")

  // 4. Normalize quote variants to ASCII double quote
  // Covers: " " „ ‟ « » ‹ › ❝ ❞ ❮ ❯ ＂
  normalized = normalized.replace(
    /[\u201C\u201D\u201E\u201F\u00AB\u00BB\u2039\u203A\u275D\u275E\u276E\u276F\uFF02]/g,
    '"'
  )

  // 5. Normalize apostrophe variants to ASCII single quote
  // Covers: ' ' ‚ ‛ ′ ＇
  normalized = normalized.replace(/[\u2018\u2019\u201A\u201B\u2032\uFF07]/g, "'")

  // 6. Collapse whitespace runs to single space
  normalized = normalized.replace(/\s+/g, " ")

  // 7. Trim
  normalized = normalized.trim()

  return normalized
}

/**
 * Find a quote in evidence content.
 *
 * Strategy:
 * 1. Try exact match first (most reliable)
 * 2. If not found, try normalized match (both sides normalized)
 * 3. If normalized match found, attempt to map back to original offsets
 *
 * Returns match type and offsets in ORIGINAL content when possible.
 */
export function findQuoteInEvidence(
  rawContent: string,
  exactQuote: string,
  evidenceHash?: string
): QuoteMatchResult {
  if (!rawContent || !exactQuote) {
    return {
      found: false,
      matchType: "not_found",
      debug: {
        quotePreview: exactQuote?.slice(0, 80) || "",
        evidenceHash: evidenceHash || "unknown",
        normalizedQuoteLength: 0,
        normalizedEvidenceLength: 0,
      },
    }
  }

  // Try exact match first
  const exactIndex = rawContent.indexOf(exactQuote)
  if (exactIndex !== -1) {
    return {
      found: true,
      matchType: "exact",
      start: exactIndex,
      end: exactIndex + exactQuote.length,
      debug: {
        quotePreview: exactQuote.slice(0, 80),
        evidenceHash: evidenceHash || "unknown",
        normalizedQuoteLength: exactQuote.length,
        normalizedEvidenceLength: rawContent.length,
      },
    }
  }

  // Try normalized match
  const normalizedQuote = normalizeForMatch(exactQuote)
  const normalizedContent = normalizeForMatch(rawContent)

  const normalizedIndex = normalizedContent.indexOf(normalizedQuote)
  if (normalizedIndex !== -1) {
    // Found in normalized form - try to find approximate original offsets
    // This is approximate because normalization changes lengths
    const offsets = mapNormalizedOffsetsToOriginal(
      rawContent,
      normalizedContent,
      normalizedIndex,
      normalizedQuote.length
    )

    return {
      found: true,
      matchType: "normalized",
      start: offsets?.start,
      end: offsets?.end,
      debug: {
        quotePreview: exactQuote.slice(0, 80),
        evidenceHash: evidenceHash || "unknown",
        normalizedQuoteLength: normalizedQuote.length,
        normalizedEvidenceLength: normalizedContent.length,
      },
    }
  }

  // Not found
  return {
    found: false,
    matchType: "not_found",
    debug: {
      quotePreview: exactQuote.slice(0, 80),
      evidenceHash: evidenceHash || "unknown",
      normalizedQuoteLength: normalizedQuote.length,
      normalizedEvidenceLength: normalizedContent.length,
    },
  }
}

/**
 * Attempt to map normalized offsets back to original content offsets.
 *
 * This is approximate - normalization changes lengths.
 * Returns undefined if mapping fails.
 */
function mapNormalizedOffsetsToOriginal(
  original: string,
  _normalized: string, // unused but kept for API consistency
  normalizedStart: number,
  normalizedLength: number
): { start: number; end: number } | undefined {
  // Build a position map: normalizedIndex -> originalIndex
  // This is O(n) but only runs when we have a normalized match
  const positionMap: number[] = []
  let normalizedIndex = 0

  const normalizedChars = normalizeForMatch(original)

  // Walk through original, tracking where each normalized char came from
  for (let i = 0; i < original.length && normalizedIndex < normalizedChars.length; i++) {
    const origChar = original[i]
    const normContrib = normalizeForMatch(origChar)

    for (let j = 0; j < normContrib.length && normalizedIndex < normalizedChars.length; j++) {
      if (normContrib[j] === normalizedChars[normalizedIndex]) {
        positionMap[normalizedIndex] = i
        normalizedIndex++
      }
    }
  }

  // Map the normalized range back to original
  const origStart = positionMap[normalizedStart]
  const origEndNormIndex = normalizedStart + normalizedLength - 1
  const origEnd = positionMap[origEndNormIndex]

  if (origStart === undefined || origEnd === undefined) {
    return undefined
  }

  // Find the actual end in original (include the full last character)
  let actualEnd = origEnd + 1
  while (actualEnd < original.length) {
    const slice = original.slice(origStart, actualEnd)
    if (normalizeForMatch(slice).length >= normalizedLength) {
      break
    }
    actualEnd++
  }

  return { start: origStart, end: actualEnd }
}

/**
 * Validate that a quote exists in its evidence.
 * This is the core provenance check.
 */
export function validateQuoteInEvidence(
  pointerId: string,
  evidenceId: string,
  exactQuote: string,
  rawContent: string,
  evidenceHash?: string
): ProvenanceValidationResult {
  const matchResult = findQuoteInEvidence(rawContent, exactQuote, evidenceHash)

  if (!matchResult.found) {
    return {
      valid: false,
      pointerId,
      evidenceId,
      matchResult,
      error:
        `Quote not found in evidence. Pointer: ${pointerId}, Evidence: ${evidenceId}. ` +
        `Quote preview: "${matchResult.debug?.quotePreview}..."`,
    }
  }

  return {
    valid: true,
    pointerId,
    evidenceId,
    matchResult,
  }
}

/**
 * Policy check: Is this match type acceptable for the given risk tier?
 *
 * T0/T1 (critical): REQUIRE exact match only
 * T2/T3 (low risk): Allow normalized match (but log it)
 */
export function isMatchTypeAcceptableForTier(
  matchType: MatchType,
  riskTier: string
): { acceptable: boolean; reason?: string } {
  if (matchType === "not_found") {
    return {
      acceptable: false,
      reason: "Quote not found in evidence",
    }
  }

  if (matchType === "exact") {
    return { acceptable: true }
  }

  // matchType === "normalized"
  if (riskTier === "T0" || riskTier === "T1") {
    return {
      acceptable: false,
      reason: `T0/T1 rules require exact quote match, but only normalized match found`,
    }
  }

  // T2/T3 allow normalized
  return {
    acceptable: true,
    reason: "Normalized match accepted for T2/T3 (logged for audit)",
  }
}

/**
 * Verify that stored offsets satisfy the invariant for EXACT matches.
 *
 * INVARIANTS (from schema):
 * - endOffset = startOffset + exactQuote.length
 * - rawContent.slice(startOffset, endOffset) === exactQuote
 *
 * Use this to validate stored pointers before trusting them.
 *
 * @param rawContent - Evidence.rawContent (UTF-16 string)
 * @param exactQuote - SourcePointer.exactQuote
 * @param startOffset - SourcePointer.startOffset (UTF-16 code unit index)
 * @param endOffset - SourcePointer.endOffset (UTF-16 code unit index)
 * @returns true if invariants hold
 */
export function verifyOffsetInvariant(
  rawContent: string,
  exactQuote: string,
  startOffset: number,
  endOffset: number
): { valid: boolean; error?: string } {
  // Invariant 1: endOffset = startOffset + exactQuote.length
  const expectedEnd = startOffset + exactQuote.length
  if (endOffset !== expectedEnd) {
    return {
      valid: false,
      error: `Offset invariant violation: endOffset (${endOffset}) !== startOffset (${startOffset}) + quote.length (${exactQuote.length}) = ${expectedEnd}`,
    }
  }

  // Invariant 2: rawContent.slice(startOffset, endOffset) === exactQuote
  const sliced = rawContent.slice(startOffset, endOffset)
  if (sliced !== exactQuote) {
    return {
      valid: false,
      error: `Offset invariant violation: rawContent.slice(${startOffset}, ${endOffset}) !== exactQuote. Got: "${sliced.slice(0, 50)}..."`,
    }
  }

  return { valid: true }
}
