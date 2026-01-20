// src/lib/regulatory-truth/parsers/nn-parser/index.ts
/**
 * Narodne Novine (NN) Parser
 *
 * Parses Croatian Official Gazette documents into a structured provision tree
 * with stable nodeKey/nodeLabel identifiers for evidence anchoring.
 *
 * Key features:
 * - ELI metadata extraction from HTML meta tags
 * - Hierarchical provision tree (Document → Article → Paragraph → Point)
 * - Dual-path identifiers: nodeKey (ASCII) for storage, nodeLabel (Croatian) for display
 * - Text normalization for Croatian legal text matching
 * - Content hashing (normSha256) for change detection
 *
 * Usage:
 * ```typescript
 * import { parseNNDocument, persistParseSnapshot } from '@/lib/regulatory-truth/parsers/nn-parser'
 *
 * const html = await fetch('https://narodne-novine.nn.hr/clanci/sluzbeni/...').then(r => r.text())
 * const doc = parseNNDocument(html, 'https://narodne-novine.nn.hr/...')
 *
 * // Access metadata
 * console.log(doc.eli.title, doc.eli.datePublication)
 *
 * // Navigate the tree
 * for (const article of getArticles(doc.root)) {
 *   console.log(article.nodeKey, article.nodeLabel, article.rawText)
 * }
 *
 * // Locate a quote
 * const location = locateQuoteBest(doc.root, "iznos od 600,00 eura")
 * if (location) {
 *   console.log(`Found at ${location.node.nodeKey} with ${location.confidence} confidence`)
 * }
 *
 * // Persist to database
 * const result = await persistParseSnapshot(db, doc, evidenceId)
 * console.log(`Persisted ${result.nodeCount} nodes with tree hash ${result.treeSha256}`)
 * ```
 */

// Types
export type {
  EliMetadata,
  EliRelation,
  ProvisionNodeType,
  ProvisionNode,
  TableData,
  ParsedNNDocument,
  ParseWarning,
  QuoteLocation,
  NNParserConfig,
} from "./types"

export { DEFAULT_PARSER_CONFIG } from "./types"

// ELI extraction
export {
  extractEliMetadata,
  getDocumentTypeName,
  parseEliUri,
  eliToNNUrl,
  validateEliMetadata,
} from "./eli-extractor"

// Text normalization
export {
  normalizeForAnchoring,
  normalizeForDisplay,
  decodeHtmlEntities,
  stripHtmlTags,
  normalizeCharacters,
  normalizeAmendmentMarkers,
  extractStavakNumber,
  extractTockaIdentifier,
  hashNormalizedText,
} from "./text-normalizer"

// HTML tree parsing
export {
  parseHtmlToTree,
  countNodes,
  findNodeByPath,
  findNodesByType,
  getArticles,
  flattenTree,
} from "./html-tree-parser"

// Quote location
export {
  locateQuote,
  locateQuoteBest,
  verifyQuoteAtPath,
  extractQuoteContext,
  buildCitation,
} from "./quote-locator"

// Storage utilities
export {
  persistParseSnapshot,
  persistQuoteAnchor,
  getLatestParseSnapshot,
  getProvisionNodes,
  getProvisionNodeByKey,
  compareSnapshots,
} from "./storage"
export type { PersistResult } from "./storage"

import type { ParsedNNDocument, NNParserConfig } from "./types"
import { DEFAULT_PARSER_CONFIG } from "./types"
import { extractEliMetadata, validateEliMetadata } from "./eli-extractor"
import { parseHtmlToTree, countNodes } from "./html-tree-parser"

/**
 * Parse a complete NN HTML document.
 *
 * This is the main entry point for parsing NN documents. It:
 * 1. Extracts ELI metadata from HTML meta tags
 * 2. Parses the document content into a provision tree
 * 3. Generates stable nodeKey/nodeLabel paths for all provisions
 * 4. Computes normSha256 hashes for change detection
 * 5. Validates the result and collects warnings
 *
 * @param html Raw HTML content from NN
 * @param sourceUrl URL the document was fetched from
 * @param config Optional parser configuration
 * @returns Parsed document with metadata and provision tree
 */
export function parseNNDocument(
  html: string,
  sourceUrl: string,
  config: Partial<NNParserConfig> = {}
): ParsedNNDocument {
  const fullConfig: NNParserConfig = { ...DEFAULT_PARSER_CONFIG, ...config }

  // Extract ELI metadata
  const eli = extractEliMetadata(html)

  // Parse HTML to provision tree
  const { root, warnings } = parseHtmlToTree(html, fullConfig)

  // Validate ELI metadata
  const eliValidation = validateEliMetadata(eli)
  if (!eliValidation.valid) {
    for (const missing of eliValidation.missing) {
      warnings.push({
        code: "ELI_MISSING_REQUIRED",
        message: `Required ELI field missing: ${missing}`,
      })
    }
  }
  for (const warning of eliValidation.warnings) {
    warnings.push({
      code: "ELI_INCOMPLETE",
      message: warning,
    })
  }

  // Set root title from ELI if not already set
  if (!root.title && eli.title) {
    root.title = eli.title
  }

  const doc: ParsedNNDocument = {
    eli,
    sourceUrl,
    root,
    nodeCount: countNodes(root),
    parsedAt: new Date().toISOString(),
    parserVersion: fullConfig.version,
    warnings,
  }

  if (fullConfig.preserveRawHtml) {
    doc.rawHtml = html
  }

  return doc
}

/**
 * Parse multiple NN documents in batch.
 *
 * @param documents Array of { html, sourceUrl } objects
 * @param config Optional parser configuration
 * @returns Array of parsed documents
 */
export function parseNNDocuments(
  documents: Array<{ html: string; sourceUrl: string }>,
  config: Partial<NNParserConfig> = {}
): ParsedNNDocument[] {
  return documents.map(({ html, sourceUrl }) => parseNNDocument(html, sourceUrl, config))
}

/**
 * Validate an NN HTML document without full parsing.
 * Useful for quick checks before committing to full parsing.
 *
 * @param html Raw HTML content
 * @returns Validation result with issues
 */
export function validateNNHtml(html: string): {
  valid: boolean
  hasEliMetadata: boolean
  hasMainContent: boolean
  hasArticles: boolean
  issues: string[]
} {
  const issues: string[] = []

  // Check for ELI metadata
  const hasEliMetadata = html.includes('property="http://data.europa.eu/eli/ontology#')
  if (!hasEliMetadata) {
    issues.push("No ELI metadata found in document")
  }

  // Check for main content container
  const hasMainContent = html.includes('class="sl-content"') || html.includes("article-column")
  if (!hasMainContent) {
    issues.push("No main content container found")
  }

  // Check for articles
  const hasArticles = /class="[^"]*Clanak[^"]*"/i.test(html) || /Članak\s+\d+/i.test(html)
  if (!hasArticles) {
    issues.push("No article markers found in document")
  }

  return {
    valid: issues.length === 0,
    hasEliMetadata,
    hasMainContent,
    hasArticles,
    issues,
  }
}

/**
 * Extract just the ELI identifier from HTML without full parsing.
 * Useful for quick document identification.
 *
 * @param html Raw HTML content
 * @returns ELI URI or null if not found
 */
export function extractEliQuick(html: string): string | null {
  const match = html.match(/<meta[^>]+about="([^"]+\/eli\/sluzbeni\/[^"]+)"/)
  if (match) return match[1]

  // Fallback: extract from URLs in the document
  const urlMatch = html.match(/narodne-novine\.nn\.hr\/eli\/sluzbeni\/(\d{4})\/(\d+)\/(\d+)/)
  if (urlMatch) {
    return `https://narodne-novine.nn.hr/eli/sluzbeni/${urlMatch[1]}/${urlMatch[2]}/${urlMatch[3]}`
  }

  return null
}
