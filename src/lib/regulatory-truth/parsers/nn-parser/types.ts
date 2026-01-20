// src/lib/regulatory-truth/parsers/nn-parser/types.ts
/**
 * Narodne Novine Parser Types
 *
 * Canonical types for parsing Croatian Official Gazette (NN) documents.
 * These types represent the hierarchical structure of Croatian legal texts
 * and enable stable referencing for evidence anchoring.
 *
 * Croatian legal document structure:
 * - Zakon (Law) / Pravilnik (Regulation) / Uredba (Decree)
 *   └── Dio / Glava / Odjeljak (Part / Chapter / Section)
 *       └── Članak (Article)
 *           └── Stavak (Paragraph) - marked as (1), (2), etc.
 *               └── Točka (Point) - marked as 1., 2., etc. or a), b), etc.
 *                   └── Podtočka (Subpoint) - marked as a), b), etc. or -, etc.
 */

/**
 * ELI (European Legislation Identifier) metadata extracted from NN HTML.
 * This provides structured identification for Croatian legal documents.
 *
 * @see https://eur-lex.europa.eu/eli-register/about.html
 */
export interface EliMetadata {
  /** Full ELI URI: https://narodne-novine.nn.hr/eli/sluzbeni/{year}/{issue}/{article} */
  eli: string

  /** Document type resource URI (ZAKON, PRAVILNIK, UREDBA, ODLUKA, etc.) */
  typeDocument: string | null

  /** Document number within the NN issue */
  number: string | null

  /** Date the document was signed/adopted (ISO date: YYYY-MM-DD) */
  dateDocument: string | null

  /** Date of publication in NN (ISO date: YYYY-MM-DD) */
  datePublication: string | null

  /** Institution that passed the document */
  passedBy: string | null

  /** Document title in Croatian */
  title: string | null

  /** Language code (typically HRV) */
  language: string | null

  /** Relations to other documents */
  relations: EliRelation[]

  /** Eurovoc subject tags */
  eurovocTags: string[]

  /** NN-specific legal area tags */
  legalAreaTags: string[]

  /** NN-specific index terms */
  indexTerms: string[]
}

/**
 * Relation between legal documents (amends, consolidates, etc.)
 */
export interface EliRelation {
  /** Relation type: amends, changes, repeals, consolidates, etc. */
  type: "amends" | "changes" | "repeals" | "consolidates" | "implements" | "transposes" | "other"

  /** Target document ELI URI */
  targetEli: string

  /** Raw property name from HTML */
  rawProperty: string
}

/**
 * Node types in the Croatian legal document tree.
 * Ordered from highest (document-level) to lowest (text-level) granularity.
 */
export type ProvisionNodeType =
  | "document" // Root: Zakon, Pravilnik, Uredba, Odluka
  | "dio" // Dio (Part)
  | "glava" // Glava (Chapter)
  | "odjeljak" // Odjeljak (Section)
  | "pododjeljak" // Pododjeljak (Subsection)
  | "clanak" // Članak (Article)
  | "stavak" // Stavak (Paragraph)
  | "tocka" // Točka (Point)
  | "podtocka" // Podtočka (Subpoint)
  | "alineja" // Alineja (Bullet/dash item)
  | "tablica" // Tablica (Table)
  | "redak" // Redak (Table row)
  | "prilog" // Prilog (Annex/Appendix)

/**
 * A node in the provision tree representing a structural unit of a legal document.
 *
 * Key design decisions:
 * - nodeKey is ASCII for stable storage/joins: /clanak:28/stavak:1/tocka:a
 * - nodeLabel is Croatian for display: /članak:28/stavak:1/točka:a
 * - normSha256 enables content-based change detection
 * - No DOM offsets (brittle) - use nodeKey + normSha256 for anchoring
 */
export interface ProvisionNode {
  /**
   * Canonical ASCII path for storage/joins.
   * Format: /clanak:28/stavak:1/tocka:a
   * Use this for database keys, hashes, joins.
   */
  nodeKey: string

  /**
   * Croatian display path for UI.
   * Format: /članak:28/stavak:1/točka:a
   * Use this for human-readable output only.
   */
  nodeLabel: string

  /** Type of this provision unit */
  nodeType: ProvisionNodeType

  /** Identifier within parent (e.g., "28" for Članak 28, "1" for stavak 1, "a" for točka a) */
  ordinal: string

  /** Sibling order index (0-based) for stable ordering */
  orderIndex: number

  /** Raw text content of this node (not including children) */
  rawText: string

  /** Normalized text for stable matching (lowercase, no diacritics, collapsed whitespace) */
  textNorm: string

  /** SHA256 hash of textNorm for content-based change detection */
  normSha256: string

  /** Child nodes (articles contain paragraphs, paragraphs contain points, etc.) */
  children: ProvisionNode[]

  /** Optional title/heading for this node (e.g., article title) */
  title?: string

  /** For tables: structured table data */
  tableData?: TableData

  /** Croatian citation format: "čl. 28, st. 1 (NN 152/2024)" */
  citationHr?: string
}

/**
 * Structured table data extracted from legal documents.
 * Tables in Croatian law often contain rates, thresholds, and coefficients.
 */
export interface TableData {
  /** Column headers */
  headers: string[]

  /** Table rows, each row is an array of cell values */
  rows: string[][]

  /** Whether the first row is a header row */
  hasHeader: boolean
}

/**
 * Complete parsed NN document with metadata and provision tree.
 */
export interface ParsedNNDocument {
  /** ELI metadata from HTML head */
  eli: EliMetadata

  /** URL the document was fetched from */
  sourceUrl: string

  /** Raw HTML content (for debugging/verification) */
  rawHtml?: string

  /** Root provision node (document level) */
  root: ProvisionNode

  /** Total number of provision nodes in the tree */
  nodeCount: number

  /** Parse timestamp (ISO datetime) */
  parsedAt: string

  /** Parser version for migration tracking */
  parserVersion: string

  /** Warnings generated during parsing */
  warnings: ParseWarning[]
}

/**
 * Warning generated during parsing (non-fatal issues).
 */
export interface ParseWarning {
  /** Warning code for programmatic handling */
  code: string

  /** Human-readable warning message */
  message: string

  /** Source location if applicable */
  location?: {
    offset: number
    context: string
  }
}

/**
 * Result of locating a quote within the provision tree.
 */
export interface QuoteLocation {
  /** The provision node containing the quote */
  node: ProvisionNode

  /** Match type: exact, normalized, or fuzzy */
  matchType: "exact" | "normalized" | "fuzzy"

  /** Confidence score (1.0 for exact, 0.85-0.99 for normalized, below for fuzzy) */
  confidence: number

  /** Start position in normalized text (for anchoring) */
  normStart?: number

  /** End position in normalized text (for anchoring) */
  normEnd?: number
}

// =============================================================================
// Storage Types (for persistence layer)
// =============================================================================

/**
 * Evidence snapshot - immutable raw source material.
 * Never modified after creation. New fetch = new snapshot.
 */
export interface EvidenceSnapshot {
  id: string
  sourceUrl: string
  fetchedAt: string // ISO datetime
  httpStatus: number | null
  contentType: string | null
  rawSha256: string // SHA256 of raw bytes
  etag: string | null
  lastModified: string | null
  notes: string | null
}

/**
 * Parse snapshot - immutable parse result for a specific parser version.
 * New parser version = new ParseSnapshot (even for same evidence).
 */
export interface ParseSnapshot {
  id: string
  evidenceSnapshotId: string
  parserName: string // "nn-parser"
  parserVersion: string // git sha or semver
  parsedAt: string // ISO datetime
  parseStatus: "PARSED" | "FAILED"
  error: string | null
  eli: EliMetadata | null
  treeSha256: string // SHA256 of serialized tree
}

/**
 * Flattened provision node row for database storage.
 * Derived from ParseSnapshot tree, enables indexing/querying.
 */
export interface ProvisionNodeRow {
  id: string
  parseSnapshotId: string

  nodeKey: string // ASCII canonical path
  nodeLabel: string // Croatian display path
  nodeType: ProvisionNodeType

  parentNodeKey: string | null
  orderIndex: number

  rawText: string
  normText: string
  normSha256: string

  citationHr: string | null
  effectiveFrom: string | null // ISO date
  effectiveUntil: string | null // ISO date
}

/**
 * Quote anchor - persisted result of quote location.
 * Avoids re-running fuzzy matching on every query.
 */
export interface QuoteAnchor {
  id: string
  parseSnapshotId: string

  quoteText: string
  quoteNorm: string
  matchNodeKey: string
  matchConfidence: number

  normStart: number | null
  normEnd: number | null

  createdAt: string // ISO datetime
}

/**
 * Configuration for the NN parser.
 */
export interface NNParserConfig {
  /** Whether to preserve raw HTML in output */
  preserveRawHtml: boolean

  /** Maximum depth of provision tree (default: 10) */
  maxDepth: number

  /** Minimum text length to consider a node (default: 1) */
  minTextLength: number

  /** Whether to extract table data (default: true) */
  extractTables: boolean

  /** Parser version string */
  version: string
}

/**
 * Default parser configuration.
 */
export const DEFAULT_PARSER_CONFIG: NNParserConfig = {
  preserveRawHtml: false,
  maxDepth: 10,
  minTextLength: 1,
  extractTables: true,
  version: "1.0.0",
}
