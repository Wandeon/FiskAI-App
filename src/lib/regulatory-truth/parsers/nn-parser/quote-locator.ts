// src/lib/regulatory-truth/parsers/nn-parser/quote-locator.ts
/**
 * Quote Locator for NN Provision Trees
 *
 * Finds quotes within the provision tree and returns their precise location.
 * Supports exact matching, normalized matching, and fuzzy matching for
 * handling OCR errors and Unicode variations.
 *
 * This is critical for evidence anchoring - linking extracted assertions
 * back to specific locations in the source legal text.
 */

import type { ProvisionNode, QuoteLocation } from "./types"
import { normalizeForAnchoring } from "./text-normalizer"
import { calculateSimilarity, fuzzyMatchCroatian } from "../../utils/croatian-text"

/**
 * Options for quote location.
 */
export interface QuoteLocatorOptions {
  /** Minimum similarity for fuzzy matching (default: 0.85) */
  minSimilarity: number

  /** Whether to search normalized text first (default: true) */
  preferNormalized: boolean

  /** Maximum number of results to return (default: 5) */
  maxResults: number
}

const DEFAULT_OPTIONS: QuoteLocatorOptions = {
  minSimilarity: 0.85,
  preferNormalized: true,
  maxResults: 5,
}

/**
 * Locate a quote within the provision tree.
 *
 * Search order:
 * 1. Exact match in rawText
 * 2. Normalized match in textNorm
 * 3. Fuzzy match with Croatian text tolerance
 *
 * @param root Root provision node
 * @param quote Quote text to locate
 * @param options Locator options
 * @returns Array of matching locations, sorted by confidence
 */
export function locateQuote(
  root: ProvisionNode,
  quote: string,
  options: Partial<QuoteLocatorOptions> = {}
): QuoteLocation[] {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const results: QuoteLocation[] = []
  const normalizedQuote = normalizeForAnchoring(quote)

  // Collect all leaf nodes and nodes with text
  const nodesWithText = collectNodesWithText(root)

  for (const node of nodesWithText) {
    // 1. Try exact match
    const exactOffset = node.rawText.indexOf(quote)
    if (exactOffset !== -1) {
      results.push({
        node,
        offsetInNode: exactOffset,
        matchType: "exact",
        confidence: 1.0,
      })
      continue
    }

    // 2. Try normalized match
    const normalizedOffset = node.textNorm.indexOf(normalizedQuote)
    if (normalizedOffset !== -1) {
      results.push({
        node,
        offsetInNode: approximateRawOffset(node.rawText, normalizedOffset, normalizedQuote.length),
        matchType: "normalized",
        confidence: 0.95,
      })
      continue
    }

    // 3. Try fuzzy match
    const fuzzyResult = fuzzyMatchCroatian(node.textNorm, normalizedQuote, opts.minSimilarity)
    if (fuzzyResult.matches) {
      results.push({
        node,
        offsetInNode: 0, // Fuzzy match doesn't give precise offset
        matchType: "fuzzy",
        confidence: fuzzyResult.similarity,
      })
    }
  }

  // Sort by confidence descending
  results.sort((a, b) => b.confidence - a.confidence)

  // Limit results
  return results.slice(0, opts.maxResults)
}

/**
 * Find the best single location for a quote.
 *
 * @param root Root provision node
 * @param quote Quote text to locate
 * @param minConfidence Minimum confidence threshold (default: 0.85)
 * @returns Best matching location or null if not found
 */
export function locateQuoteBest(
  root: ProvisionNode,
  quote: string,
  minConfidence: number = 0.85
): QuoteLocation | null {
  const results = locateQuote(root, quote, { minSimilarity: minConfidence, maxResults: 1 })
  return results.length > 0 ? results[0] : null
}

/**
 * Verify that a quote exists at a specific nodeKey/nodeLabel.
 *
 * @param root Root provision node
 * @param nodeKeyOrLabel Expected node path (ASCII key or Croatian label)
 * @param quote Quote text to verify
 * @returns Verification result with match details
 */
export function verifyQuoteAtPath(
  root: ProvisionNode,
  nodeKeyOrLabel: string,
  quote: string
): {
  verified: boolean
  matchType: "exact" | "normalized" | "fuzzy" | "not_found"
  confidence: number
  actualNodeKey: string | null
} {
  // Find the node at the specified path
  const node = findNodeByPath(root, nodeKeyOrLabel)

  if (!node) {
    // Node not found - try to locate the quote elsewhere
    const location = locateQuoteBest(root, quote)
    if (location) {
      return {
        verified: false,
        matchType: location.matchType,
        confidence: location.confidence,
        actualNodeKey: location.node.nodeKey,
      }
    }
    return {
      verified: false,
      matchType: "not_found",
      confidence: 0,
      actualNodeKey: null,
    }
  }

  // Check for match at the expected path
  const normalizedQuote = normalizeForAnchoring(quote)

  // Exact match
  if (node.rawText.includes(quote)) {
    return {
      verified: true,
      matchType: "exact",
      confidence: 1.0,
      actualNodeKey: node.nodeKey,
    }
  }

  // Normalized match
  if (node.textNorm.includes(normalizedQuote)) {
    return {
      verified: true,
      matchType: "normalized",
      confidence: 0.95,
      actualNodeKey: node.nodeKey,
    }
  }

  // Fuzzy match
  const fuzzyResult = fuzzyMatchCroatian(node.textNorm, normalizedQuote, 0.85)
  if (fuzzyResult.matches) {
    return {
      verified: true,
      matchType: "fuzzy",
      confidence: fuzzyResult.similarity,
      actualNodeKey: node.nodeKey,
    }
  }

  // Not found at expected path - check if it exists elsewhere
  const location = locateQuoteBest(root, quote)
  if (location) {
    return {
      verified: false,
      matchType: location.matchType,
      confidence: location.confidence,
      actualNodeKey: location.node.nodeKey,
    }
  }

  return {
    verified: false,
    matchType: "not_found",
    confidence: 0,
    actualNodeKey: null,
  }
}

/**
 * Collect all nodes that have text content.
 */
function collectNodesWithText(node: ProvisionNode): ProvisionNode[] {
  const results: ProvisionNode[] = []

  if (node.rawText && node.rawText.trim()) {
    results.push(node)
  }

  for (const child of node.children) {
    results.push(...collectNodesWithText(child))
  }

  return results
}

/**
 * Find a node by its nodeKey or nodeLabel in the tree.
 */
function findNodeByPath(node: ProvisionNode, path: string): ProvisionNode | null {
  if (node.nodeKey === path || node.nodeLabel === path) return node

  for (const child of node.children) {
    const found = findNodeByPath(child, path)
    if (found) return found
  }

  return null
}

/**
 * Approximate the raw text offset from a normalized text offset.
 * This is needed because normalization changes character positions.
 */
function approximateRawOffset(
  rawText: string,
  normalizedOffset: number,
  matchLength: number
): number {
  // Simple heuristic: find the substring that normalizes to match
  const normalized = normalizeForAnchoring(rawText)

  // If offsets are similar, return as-is
  if (Math.abs(rawText.length - normalized.length) < 5) {
    return normalizedOffset
  }

  // Search for the best matching position in raw text
  const targetNormalized = normalized.substring(normalizedOffset, normalizedOffset + matchLength)

  let bestOffset = 0
  let bestScore = 0

  for (let i = 0; i <= rawText.length - matchLength; i++) {
    const candidate = rawText.substring(i, i + matchLength + 10) // Allow some slack
    const candidateNorm = normalizeForAnchoring(candidate)

    if (candidateNorm.startsWith(targetNormalized)) {
      const score = calculateSimilarity(candidateNorm, targetNormalized)
      if (score > bestScore) {
        bestScore = score
        bestOffset = i
      }
    }
  }

  return bestOffset
}

/**
 * Extract a context window around a quote in a node.
 *
 * @param node Provision node containing the quote
 * @param offsetInNode Character offset within the node
 * @param quoteLength Length of the quote
 * @param contextChars Number of context characters before/after (default: 50)
 * @returns Context string with quote highlighted
 */
export function extractQuoteContext(
  node: ProvisionNode,
  offsetInNode: number,
  quoteLength: number,
  contextChars: number = 50
): {
  before: string
  quote: string
  after: string
  full: string
} {
  const text = node.rawText

  const startContext = Math.max(0, offsetInNode - contextChars)
  const endQuote = offsetInNode + quoteLength
  const endContext = Math.min(text.length, endQuote + contextChars)

  const before = text.substring(startContext, offsetInNode)
  const quote = text.substring(offsetInNode, endQuote)
  const after = text.substring(endQuote, endContext)

  return {
    before: (startContext > 0 ? "..." : "") + before,
    quote,
    after: after + (endContext < text.length ? "..." : ""),
    full: `${startContext > 0 ? "..." : ""}${before}[${quote}]${after}${endContext < text.length ? "..." : ""}`,
  }
}

/**
 * Build a citation string for a quote location.
 *
 * @param eli Document ELI URI
 * @param location Quote location
 * @returns Formatted citation string
 */
export function buildCitation(eli: string, location: QuoteLocation): string {
  const node = location.node
  const parts: string[] = []

  // Parse the nodeLabel (Croatian display path) to extract citation components
  const pathParts = node.nodeLabel.split("/").filter(Boolean)

  for (const part of pathParts) {
    const [type, ordinal] = part.split(":")
    if (type && ordinal) {
      switch (type) {
        case "članak":
          parts.push(`čl. ${ordinal}`)
          break
        case "stavak":
          parts.push(`st. ${ordinal}`)
          break
        case "točka":
          parts.push(`t. ${ordinal}`)
          break
        case "podtočka":
          parts.push(`podt. ${ordinal}`)
          break
        case "tablica":
          parts.push(`tabl. ${ordinal}`)
          break
        default:
          parts.push(`${type} ${ordinal}`)
      }
    }
  }

  // Build full citation
  const citation = parts.join(", ")

  // Add ELI reference if available
  if (eli) {
    const eliParts = eli.match(/eli\/sluzbeni\/(\d{4})\/(\d+)/)
    if (eliParts) {
      return `${citation} (NN ${eliParts[2]}/${eliParts[1]})`
    }
  }

  return citation
}
