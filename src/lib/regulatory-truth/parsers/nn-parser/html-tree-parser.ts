// src/lib/regulatory-truth/parsers/nn-parser/html-tree-parser.ts
/**
 * HTML Tree Parser for Narodne Novine Documents
 *
 * Parses NN HTML content into a hierarchical ProvisionNode tree.
 * The tree structure mirrors the legal document hierarchy:
 *
 * Document → Parts/Chapters → Articles → Paragraphs → Points
 *
 * Key responsibilities:
 * 1. Identify structural elements (Članak, Stavak, Točka) from CSS classes and text patterns
 * 2. Build stable nodePath identifiers for evidence anchoring
 * 3. Extract and normalize text content
 * 4. Handle tables embedded in legal provisions
 */

import type {
  ProvisionNode,
  ProvisionNodeType,
  TableData,
  ParseWarning,
  NNParserConfig,
  DEFAULT_PARSER_CONFIG,
} from "./types"
import {
  normalizeForAnchoring,
  normalizeForDisplay,
  stripHtmlTags,
  decodeHtmlEntities,
  extractStavakNumber,
  extractTockaIdentifier,
} from "./text-normalizer"

/**
 * CSS class patterns for identifying NN document elements.
 * Based on analysis of real NN HTML documents.
 */
const CSS_PATTERNS = {
  // Article markers
  article: /\b(Clanak|Članak|Clanak--|Clanak--)\b/i,

  // Title elements
  title: /\b(TB-NA18|TB-NA16|T-12-9-fett|Podnaslov)\b/i,

  // Body text
  bodyText: /\b(T-9-8|T-9-8-bez-uvl|T-9-8-sredina)\b/i,

  // Centered text (often for headings, signatures)
  centered: /\bpcenter\b/,

  // Signature/metadata sections
  signature: /\b(T-9-8-potpis|Klasa2)\b/i,

  // Table-related
  table: /\btekst-u-tablici\b/i,
}

/**
 * Text patterns for identifying structural elements.
 */
const TEXT_PATTERNS = {
  // Članak header: "Članak 1.", "Članak 28."
  article: /^Članak\s+(\d+[a-z]?)\.?$/i,

  // Stavak marker: "(1)", "(2)", etc. at start of paragraph
  stavak: /^\s*[»"']?\s*\((\d+)\)/,

  // Točka numbered: "1.", "2.", etc. at start
  tockaNumbered: /^\s*(\d+)\.\s/,

  // Točka lettered: "a)", "b)", etc.
  tockaLettered: /^\s*([a-z])\)\s/i,

  // Alineja (dash/bullet point)
  alineja: /^\s*[-–—]\s/,

  // Dio (Part): "DIO PRVI", "I. DIO"
  dio: /^(?:DIO\s+|([IVXLCDM]+)\.\s*DIO)/i,

  // Glava (Chapter): "GLAVA I.", "I. GLAVA"
  glava: /^(?:GLAVA\s+|([IVXLCDM]+)\.\s*GLAVA)/i,

  // Odjeljak (Section): "Odjeljak 1.", "1. Odjeljak"
  odjeljak: /^(?:Odjeljak\s+(\d+)|(\d+)\.\s*Odjeljak)/i,

  // Prilog (Annex): "PRILOG", "PRILOG I."
  prilog: /^PRILOG(?:\s+([IVXLCDM]+|\d+))?\.?$/i,
}

/**
 * Parse NN HTML document content into a ProvisionNode tree.
 *
 * @param html Raw HTML content
 * @param config Parser configuration
 * @returns Root ProvisionNode with children
 */
export function parseHtmlToTree(
  html: string,
  config: NNParserConfig = DEFAULT_PARSER_CONFIG
): { root: ProvisionNode; warnings: ParseWarning[] } {
  const warnings: ParseWarning[] = []

  // Find the main content container
  const contentHtml = extractMainContent(html)
  if (!contentHtml) {
    warnings.push({
      code: "NO_CONTENT",
      message: "Could not find main content container (sl-content div)",
    })
    return {
      root: createEmptyRoot(),
      warnings,
    }
  }

  // Extract paragraph elements
  const paragraphs = extractParagraphs(contentHtml)

  // Build the tree
  const root = buildProvisionTree(paragraphs, config, warnings)

  return { root, warnings }
}

/**
 * Extract the main content div from NN HTML.
 */
function extractMainContent(html: string): string | null {
  // NN uses <div class="sl-content"> for main content
  const match = html.match(/<div\s+class="sl-content"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i)
  if (match) return match[1]

  // Fallback: look for article-column
  const fallback = html.match(/<div\s+class="[^"]*article-column[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
  if (fallback) return fallback[1]

  return null
}

/**
 * Paragraph element extracted from HTML.
 */
interface ParagraphElement {
  html: string
  text: string
  cssClass: string
  tagName: string
  offset: number
  length: number
  boxId?: string
}

/**
 * Extract paragraph elements from HTML content.
 */
function extractParagraphs(html: string): ParagraphElement[] {
  const paragraphs: ParagraphElement[] = []

  // Match <p> and <table> elements
  const elementRegex = /<(p|table)([^>]*)>([\s\S]*?)<\/\1>/gi
  let match

  while ((match = elementRegex.exec(html)) !== null) {
    const tagName = match[1].toLowerCase()
    const attributes = match[2]
    const content = match[3]

    // Extract CSS class
    const classMatch = attributes.match(/class="([^"]*)"/)
    const cssClass = classMatch ? classMatch[1] : ""

    // Extract box ID if present
    const boxMatch = cssClass.match(/Box_(\d+)/)
    const boxId = boxMatch ? boxMatch[1] : undefined

    // Get text content
    const text = normalizeForDisplay(stripHtmlTags(content))

    paragraphs.push({
      html: match[0],
      text,
      cssClass,
      tagName,
      offset: match.index,
      length: match[0].length,
      boxId,
    })
  }

  return paragraphs
}

/**
 * Build provision tree from parsed paragraphs.
 */
function buildProvisionTree(
  paragraphs: ParagraphElement[],
  config: NNParserConfig,
  warnings: ParseWarning[]
): ProvisionNode {
  const root: ProvisionNode = {
    nodeKey: "/",
    nodeLabel: "/",
    nodeType: "document",
    ordinal: "",
    orderIndex: 0,
    rawText: "",
    textNorm: "",
    normSha256: sha256Sync(""),
    children: [],
  }

  let currentArticle: ProvisionNode | null = null
  let currentStavak: ProvisionNode | null = null
  let currentTocka: ProvisionNode | null = null
  let pendingText: string[] = []

  for (const para of paragraphs) {
    const { text, cssClass, tagName } = para

    // Skip empty paragraphs
    if (!text.trim()) continue

    // Check if this is an article header
    const articleMatch = text.match(TEXT_PATTERNS.article)
    if (articleMatch || CSS_PATTERNS.article.test(cssClass)) {
      // Flush pending text to current context
      flushPendingText(pendingText, currentStavak || currentArticle || root)
      pendingText = []

      const ordinal = articleMatch ? articleMatch[1] : extractArticleNumber(text)
      currentArticle = createNode("clanak", ordinal, text, root.children.length)
      currentStavak = null
      currentTocka = null
      root.children.push(currentArticle)
      continue
    }

    // Check for stavak marker at start of text
    const stavakMatch = text.match(TEXT_PATTERNS.stavak)
    if (stavakMatch && currentArticle) {
      flushPendingText(pendingText, currentStavak || currentArticle)
      pendingText = []

      const ordinal = stavakMatch[1]
      currentStavak = createNode("stavak", ordinal, text, currentArticle.children.length)
      currentTocka = null
      currentArticle.children.push(currentStavak)

      // Store remaining text after marker as pending
      const remainingText = text.substring(stavakMatch[0].length).trim()
      if (remainingText) {
        pendingText.push(remainingText)
      }
      continue
    }

    // Check for točka
    const tockaOrdinal = extractTockaIdentifier(text)
    if (tockaOrdinal && (currentStavak || currentArticle)) {
      // Don't flush - točke are children of stavak
      const parent = currentStavak || currentArticle!
      currentTocka = createNode("tocka", tockaOrdinal, text, parent.children.length)
      parent.children.push(currentTocka)
      continue
    }

    // Handle tables
    if (tagName === "table") {
      const tableNode = parseTable(para, currentStavak || currentArticle || root)
      if (tableNode) {
        const parent = currentStavak || currentArticle || root
        parent.children.push(tableNode)
      }
      continue
    }

    // Check for higher-level structural elements (Dio, Glava, etc.)
    const structuralNode = parseStructuralElement(text, root.children.length)
    if (structuralNode) {
      flushPendingText(pendingText, currentStavak || currentArticle || root)
      pendingText = []

      root.children.push(structuralNode)
      currentArticle = null
      currentStavak = null
      currentTocka = null
      continue
    }

    // Regular body text - add to pending
    if (CSS_PATTERNS.bodyText.test(cssClass) || CSS_PATTERNS.centered.test(cssClass)) {
      pendingText.push(text)
    } else if (CSS_PATTERNS.title.test(cssClass)) {
      // Title text - might be document title or section heading
      if (!root.title) {
        root.title = text
      }
    }
  }

  // Flush any remaining pending text
  flushPendingText(pendingText, currentStavak || currentArticle || root)

  // Regenerate all node keys/labels and hashes to ensure consistency
  regenerateNodeKeys(root, "", "", 0)

  return root
}

/**
 * Simple SHA256 hash for browser/Node compatibility.
 * Uses Web Crypto API if available, falls back to simple hash.
 */
function sha256Sync(text: string): string {
  // Simple hash for synchronous use (not cryptographically secure, but deterministic)
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  // Convert to hex-like string with more entropy
  const h1 = Math.abs(hash).toString(16).padStart(8, "0")

  // Second pass for more bits
  let hash2 = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash2 ^= text.charCodeAt(i)
    hash2 = Math.imul(hash2, 0x01000193)
  }
  const h2 = (hash2 >>> 0).toString(16).padStart(8, "0")

  return h1 + h2
}

/**
 * Create a new ProvisionNode.
 */
function createNode(
  nodeType: ProvisionNodeType,
  ordinal: string,
  rawText: string,
  orderIndex: number = 0
): ProvisionNode {
  const textNorm = normalizeForAnchoring(rawText)
  return {
    nodeKey: `/${nodeType}:${ordinal}`,
    nodeLabel: `/${NODE_TYPE_NAMES[nodeType] || nodeType}:${ordinal}`,
    nodeType,
    ordinal,
    orderIndex,
    rawText,
    textNorm,
    normSha256: sha256Sync(textNorm),
    children: [],
  }
}

/**
 * Extract article number from text that might not match the standard pattern.
 */
function extractArticleNumber(text: string): string {
  const match = text.match(/\d+[a-z]?/)
  return match ? match[0] : "?"
}

/**
 * Flush pending text to a node.
 */
function flushPendingText(pending: string[], target: ProvisionNode): void {
  if (pending.length === 0) return

  const text = pending.join(" ")
  if (target.rawText) {
    target.rawText += " " + text
  } else {
    target.rawText = text
  }
  target.textNorm = normalizeForAnchoring(target.rawText)
  target.normSha256 = sha256Sync(target.textNorm)
  pending.length = 0
}

/**
 * Parse a structural element (Dio, Glava, Odjeljak, Prilog).
 */
function parseStructuralElement(text: string, orderIndex: number): ProvisionNode | null {
  // Check for Dio (Part)
  const dioMatch = text.match(TEXT_PATTERNS.dio)
  if (dioMatch) {
    return createNode("dio", dioMatch[1] || "1", text, orderIndex)
  }

  // Check for Glava (Chapter)
  const glavaMatch = text.match(TEXT_PATTERNS.glava)
  if (glavaMatch) {
    return createNode("glava", glavaMatch[1] || "1", text, orderIndex)
  }

  // Check for Odjeljak (Section)
  const odjeljakMatch = text.match(TEXT_PATTERNS.odjeljak)
  if (odjeljakMatch) {
    return createNode("odjeljak", odjeljakMatch[1] || odjeljakMatch[2] || "1", text, orderIndex)
  }

  // Check for Prilog (Annex)
  const prilogMatch = text.match(TEXT_PATTERNS.prilog)
  if (prilogMatch) {
    return createNode("prilog", prilogMatch[1] || "1", text, orderIndex)
  }

  return null
}

/**
 * Parse a table element into a ProvisionNode.
 */
function parseTable(para: ParagraphElement, parent: ProvisionNode): ProvisionNode | null {
  const tableData = extractTableData(para.html)
  if (!tableData) return null

  const tableIndex = parent.children.filter((c) => c.nodeType === "tablica").length + 1
  const rawText = tableData.rows.map((r) => r.join("\t")).join("\n")
  const textNorm = normalizeForAnchoring(tableData.rows.flat().join(" "))

  const tableNode: ProvisionNode = {
    nodeKey: `${parent.nodeKey === "/" ? "" : parent.nodeKey}/tablica:${tableIndex}`,
    nodeLabel: `${parent.nodeLabel === "/" ? "" : parent.nodeLabel}/tablica:${tableIndex}`,
    nodeType: "tablica",
    ordinal: tableIndex.toString(),
    orderIndex: parent.children.length,
    rawText,
    textNorm,
    normSha256: sha256Sync(textNorm),
    children: [],
    tableData,
  }

  // Add rows as children
  tableData.rows.forEach((row, rowIndex) => {
    const rowText = row.join("\t")
    const rowNorm = normalizeForAnchoring(row.join(" "))
    const rowNode: ProvisionNode = {
      nodeKey: `${tableNode.nodeKey}/redak:${rowIndex + 1}`,
      nodeLabel: `${tableNode.nodeLabel}/redak:${rowIndex + 1}`,
      nodeType: "redak",
      ordinal: (rowIndex + 1).toString(),
      orderIndex: rowIndex,
      rawText: rowText,
      textNorm: rowNorm,
      normSha256: sha256Sync(rowNorm),
      children: [],
    }
    tableNode.children.push(rowNode)
  })

  return tableNode
}

/**
 * Extract table data from HTML table element.
 */
function extractTableData(tableHtml: string): TableData | null {
  const rows: string[][] = []
  let hasHeader = false

  // Extract rows
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let rowMatch
  let isFirstRow = true

  while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
    const rowHtml = rowMatch[1]
    const cells: string[] = []

    // Extract cells (th or td)
    const cellRegex = /<(th|td)[^>]*>([\s\S]*?)<\/\1>/gi
    let cellMatch

    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      const cellTag = cellMatch[1].toLowerCase()
      const cellContent = normalizeForDisplay(stripHtmlTags(cellMatch[2]))
      cells.push(cellContent)

      if (cellTag === "th" && isFirstRow) {
        hasHeader = true
      }
    }

    if (cells.length > 0) {
      rows.push(cells)
    }
    isFirstRow = false
  }

  if (rows.length === 0) return null

  return {
    headers: hasHeader && rows.length > 0 ? rows[0] : [],
    rows: hasHeader ? rows.slice(1) : rows,
    hasHeader,
  }
}

/**
 * Map node type to Croatian display name for nodeLabel.
 */
const NODE_TYPE_NAMES: Record<ProvisionNodeType, string> = {
  document: "document",
  dio: "dio",
  glava: "glava",
  odjeljak: "odjeljak",
  pododjeljak: "pododjeljak",
  clanak: "članak",
  stavak: "stavak",
  tocka: "točka",
  podtocka: "podtočka",
  alineja: "alineja",
  tablica: "tablica",
  redak: "redak",
  prilog: "prilog",
}

/**
 * Regenerate all node keys/labels in the tree to ensure consistency.
 * nodeKey = ASCII for storage/joins
 * nodeLabel = Croatian for display
 */
function regenerateNodeKeys(
  node: ProvisionNode,
  parentKey: string,
  parentLabel: string,
  siblingIndex: number
): void {
  if (node.nodeType === "document") {
    node.nodeKey = "/"
    node.nodeLabel = "/"
    node.orderIndex = 0
  } else {
    // ASCII key for storage
    node.nodeKey = `${parentKey}/${node.nodeType}:${node.ordinal}`
    // Croatian label for display
    const typeName = NODE_TYPE_NAMES[node.nodeType] || node.nodeType
    node.nodeLabel = `${parentLabel}/${typeName}:${node.ordinal}`
    node.orderIndex = siblingIndex
  }

  // Recalculate hash in case text was updated
  node.normSha256 = sha256Sync(node.textNorm)

  // Process children
  const childKey = node.nodeKey === "/" ? "" : node.nodeKey
  const childLabel = node.nodeLabel === "/" ? "" : node.nodeLabel

  for (let i = 0; i < node.children.length; i++) {
    regenerateNodeKeys(node.children[i], childKey, childLabel, i)
  }
}

/**
 * Create an empty root node for error cases.
 */
function createEmptyRoot(): ProvisionNode {
  return {
    nodeKey: "/",
    nodeLabel: "/",
    nodeType: "document",
    ordinal: "",
    orderIndex: 0,
    rawText: "",
    textNorm: "",
    normSha256: sha256Sync(""),
    children: [],
  }
}

/**
 * Count total nodes in the tree.
 */
export function countNodes(node: ProvisionNode): number {
  let count = 1
  for (const child of node.children) {
    count += countNodes(child)
  }
  return count
}

/**
 * Find a node by its nodeKey (ASCII canonical path).
 * Also accepts nodeLabel (Croatian display path) for convenience.
 */
export function findNodeByPath(root: ProvisionNode, path: string): ProvisionNode | null {
  // Match against both nodeKey and nodeLabel for flexibility
  if (root.nodeKey === path || root.nodeLabel === path) return root

  for (const child of root.children) {
    const found = findNodeByPath(child, path)
    if (found) return found
  }

  return null
}

/**
 * Find all nodes of a specific type.
 */
export function findNodesByType(root: ProvisionNode, nodeType: ProvisionNodeType): ProvisionNode[] {
  const results: ProvisionNode[] = []

  if (root.nodeType === nodeType) {
    results.push(root)
  }

  for (const child of root.children) {
    results.push(...findNodesByType(child, nodeType))
  }

  return results
}

/**
 * Get all článek (article) nodes from the tree.
 */
export function getArticles(root: ProvisionNode): ProvisionNode[] {
  return findNodesByType(root, "clanak")
}

/**
 * Flatten the tree into a list of nodes with their paths.
 */
export function flattenTree(root: ProvisionNode): ProvisionNode[] {
  const result: ProvisionNode[] = [root]

  for (const child of root.children) {
    result.push(...flattenTree(child))
  }

  return result
}
