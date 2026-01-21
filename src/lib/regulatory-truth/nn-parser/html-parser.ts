import * as cheerio from "cheerio"
import { createHash } from "crypto"
import { ProvisionNodeType } from "@/generated/regulatory-client"
import type {
  ParseOutput,
  NodeOutput,
  DocumentMetadata,
  Warning,
  UnparsedSegment,
  ParseStats,
} from "./types"
import { extractText } from "./html-cleaner"
import { buildNodePath, parseArticleNumber, parseStavakNumber, parseTockaLabel } from "./node-path"
import { validateInvariants } from "./invariants"

// Container node types (can span children)
const CONTAINER_TYPES = new Set<ProvisionNodeType>([
  ProvisionNodeType.DOC,
  ProvisionNodeType.TITLE,
  ProvisionNodeType.CHAPTER,
  ProvisionNodeType.PART,
])

export function parseHtml(html: string): ParseOutput {
  const warnings: Warning[] = []
  const unparsedSegments: UnparsedSegment[] = []

  const $ = cheerio.load(html)

  // Extract clean text
  const cleanText = extractText(html)
  const cleanTextHash = createHash("sha256").update(cleanText).digest("hex")

  // Extract metadata
  const docMeta = extractMetadata($)

  // Parse nodes
  const nodes = parseNodes($, cleanText, warnings)

  // Validate invariants
  const validation = validateInvariants(nodes, cleanText)

  // Add validation violations as warnings
  for (const violation of validation.violations) {
    warnings.push({
      code: violation.invariantId,
      message: violation.message,
      nodePath: violation.nodePath,
    })
  }

  // Compute stats
  const stats = computeStats(nodes, cleanText.length)

  // Determine status
  let status: "SUCCESS" | "PARTIAL" | "FAILED" = "SUCCESS"
  if (validation.violations.length > 0) {
    status = "PARTIAL"
  }
  if (nodes.length === 0) {
    status = "PARTIAL"
    warnings.push({
      code: "NO_STRUCTURE",
      message: "No parseable structure found in document",
    })
  }

  return {
    status,
    warnings,
    unparsedSegments,
    docMeta,
    cleanText,
    cleanTextHash,
    nodes,
    stats,
  }
}

function extractMetadata($: cheerio.Root): DocumentMetadata {
  const title =
    $("title").text().trim() ||
    $("h1").first().text().trim() ||
    $('meta[property="og:title"]').attr("content") ||
    undefined

  // Try to determine text type from title
  let textType: string | undefined
  if (title) {
    const lowerTitle = title.toLowerCase()
    if (lowerTitle.includes("zakon")) textType = "zakon"
    else if (lowerTitle.includes("pravilnik")) textType = "pravilnik"
    else if (lowerTitle.includes("uredba")) textType = "uredba"
    else if (lowerTitle.includes("odluka")) textType = "odluka"
  }

  return { title, textType }
}

function parseNodes($: cheerio.Root, cleanText: string, warnings: Warning[]): NodeOutput[] {
  const nodes: NodeOutput[] = []

  // State tracking
  let currentArticle: string | null = null
  let currentStavak: string | null = null
  let currentArticleIndex: number | null = null
  let currentStavakIndex: number | null = null
  let articleOrderIndex = 0
  let stavakOrderIndex = 0
  let tockaOrderIndex = 0

  // Find all text blocks
  const textBlocks = findTextBlocks($)
  let searchCursor = 0

  for (const block of textBlocks) {
    const text = block.text.trim()
    if (!text) continue

    // Find position in cleanText
    const position = findTextPosition(cleanText, text, searchCursor)
    if (position === null) {
      warnings.push({
        code: "TEXT_NOT_FOUND",
        message: `Could not locate text in clean output: "${text.substring(0, 50)}..."`,
      })
      continue
    }

    searchCursor = Math.max(searchCursor, position.end)

    const rawText = cleanText.substring(position.start, position.end)

    // Check if this is an article header
    const articleNum = parseArticleNumber(text)
    if (articleNum) {
      currentArticle = articleNum
      currentStavak = null
      currentStavakIndex = null
      stavakOrderIndex = 0
      tockaOrderIndex = 0

      nodes.push({
        nodeType: ProvisionNodeType.CLANAK,
        nodePath: buildNodePath({ article: articleNum }),
        label: `Članak ${articleNum}.`,
        orderIndex: articleOrderIndex++,
        depth: 1,
        startOffset: position.start,
        endOffset: position.end,
        isContainer: false,
        rawText,
      })
      currentArticleIndex = nodes.length - 1
      continue
    }

    // Check if this is a stavak
    const stavakNum = parseStavakNumber(text)
    if (stavakNum && currentArticle) {
      currentStavak = stavakNum
      tockaOrderIndex = 0

      nodes.push({
        nodeType: ProvisionNodeType.STAVAK,
        nodePath: buildNodePath({ article: currentArticle, stavak: stavakNum }),
        label: `(${stavakNum})`,
        orderIndex: stavakOrderIndex++,
        depth: 2,
        parentPath: buildNodePath({ article: currentArticle }),
        startOffset: position.start,
        endOffset: position.end,
        isContainer: false,
        rawText,
      })
      currentStavakIndex = nodes.length - 1

      // Extend current article to include stavak content
      if (currentArticleIndex !== null) {
        const articleNode = nodes[currentArticleIndex]
        articleNode.endOffset = Math.max(articleNode.endOffset, position.end)
        articleNode.rawText = undefined
      }
      continue
    }

    // Check if this is a točka
    const tockaLabel = parseTockaLabel(text)
    if (tockaLabel && currentArticle && currentStavak) {
      nodes.push({
        nodeType: ProvisionNodeType.TOCKA,
        nodePath: buildNodePath({
          article: currentArticle,
          stavak: currentStavak,
          tocka: tockaLabel,
        }),
        label: tockaLabel === "bullet" ? "–" : `${tockaLabel})`,
        orderIndex: tockaOrderIndex++,
        depth: 3,
        parentPath: buildNodePath({ article: currentArticle, stavak: currentStavak }),
        startOffset: position.start,
        endOffset: position.end,
        isContainer: false,
        rawText,
      })

      // Extend current stavak and article to include tocka content
      if (currentStavakIndex !== null) {
        const stavakNode = nodes[currentStavakIndex]
        stavakNode.endOffset = Math.max(stavakNode.endOffset, position.end)
        stavakNode.rawText = undefined
      }
      if (currentArticleIndex !== null) {
        const articleNode = nodes[currentArticleIndex]
        articleNode.endOffset = Math.max(articleNode.endOffset, position.end)
        articleNode.rawText = undefined
      }
    }
  }

  return nodes
}

interface TextBlock {
  text: string
  approximatePosition: number
  selector?: string
}

function findTextBlocks($: cheerio.Root): TextBlock[] {
  const blocks: TextBlock[] = []
  let position = 0

  // Find paragraph-like elements
  $("p, div.clanak, div.stavak, li, h1, h2, h3, h4, td").each((_, el) => {
    const text = $(el).text().trim()
    if (text) {
      blocks.push({
        text,
        approximatePosition: position,
        selector: generateSelector(el),
      })
      position += text.length + 1 // Approximate position tracking
    }
  })

  return blocks
}

function generateSelector(el: cheerio.Element): string {
  if (el.type !== "tag" && el.type !== "script" && el.type !== "style") {
    return "unknown"
  }

  const tagName = el.tagName?.toLowerCase() || el.name?.toLowerCase() || "unknown"
  const id = el.attribs?.id
  const className = el.attribs?.class?.split(" ")[0]

  if (id) return `#${id}`
  if (className) return `${tagName}.${className}`
  return tagName
}

interface TextPosition {
  start: number
  end: number
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function buildWhitespaceRegex(text: string): RegExp {
  const escaped = escapeRegExp(text.trim())
  const pattern = escaped.replace(/\s+/g, "\\s+")
  return new RegExp(pattern, "g")
}

function findTextPosition(
  cleanText: string,
  searchText: string,
  startIndex: number
): TextPosition | null {
  const trimmed = searchText.trim()
  if (!trimmed) return null

  const regex = buildWhitespaceRegex(trimmed)
  regex.lastIndex = startIndex
  const match = regex.exec(cleanText)

  if (!match) return null

  return {
    start: match.index,
    end: match.index + match[0].length,
  }
}

function computeStats(nodes: NodeOutput[], cleanTextLength: number): ParseStats {
  const byType: Partial<Record<ProvisionNodeType, number>> = {}
  let maxDepth = 0
  let coverageChars = 0

  // Track covered intervals for non-overlapping coverage
  const intervals: Array<{ start: number; end: number }> = []

  for (const node of nodes) {
    // Count by type
    byType[node.nodeType] = (byType[node.nodeType] || 0) + 1

    // Track max depth
    maxDepth = Math.max(maxDepth, node.depth)

    // Add to coverage (content nodes only)
    if (!node.isContainer) {
      intervals.push({ start: node.startOffset, end: node.endOffset })
    }
  }

  // Merge overlapping intervals for accurate coverage
  coverageChars = computeMergedCoverage(intervals)

  const coveragePercent = cleanTextLength > 0 ? (coverageChars / cleanTextLength) * 100 : 0

  return {
    nodeCount: nodes.length,
    maxDepth,
    byType,
    coverageChars,
    coveragePercent,
  }
}

function computeMergedCoverage(intervals: Array<{ start: number; end: number }>): number {
  if (intervals.length === 0) return 0

  // Sort by start
  const sorted = [...intervals].sort((a, b) => a.start - b.start)

  // Merge overlapping
  const merged: Array<{ start: number; end: number }> = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]
    const last = merged[merged.length - 1]

    if (current.start <= last.end) {
      // Overlapping - extend
      last.end = Math.max(last.end, current.end)
    } else {
      // Non-overlapping - add new
      merged.push(current)
    }
  }

  // Sum merged intervals
  return merged.reduce((sum, interval) => sum + (interval.end - interval.start), 0)
}
