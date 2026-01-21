/**
 * Chunk Planner for NN Document Extraction
 *
 * Splits documents into extraction-sized chunks at the correct granularity:
 * 1. Per Article (/članak:X)
 * 2. If article too long, per Paragraph (/članak:X/stavak:Y)
 * 3. If still too long, per Point (/članak:X/stavak:Y/točka:Z)
 * 4. Fallback: hard text window split with offsets
 *
 * Rule: Never send more than MAX_CHUNK_CHARS to the LLM per call.
 */

import { JSDOM } from "jsdom"

export const MAX_CHUNK_CHARS = 8000 // ~6-10K target, 8K default
export const MIN_CHUNK_CHARS = 500 // Don't create tiny chunks
export const MAX_CHUNKS_PER_EVIDENCE = 200
export const MAX_ASSERTIONS_PER_CHUNK = 50
export const MAX_TOTAL_ASSERTIONS_PER_EVIDENCE = 2000

export type ChunkLevel = "document" | "article" | "paragraph" | "point" | "window"

export interface ExtractionJob {
  evidenceId: string
  nodePath: string // e.g., "/članak:7/stavak:2/točka:3"
  text: string
  level: ChunkLevel
  startChar: number
  endChar: number
  articleNumber?: string
  paragraphNumber?: string
  pointNumber?: string
}

export interface ProvisionNode {
  type: "article" | "paragraph" | "point"
  number: string
  text: string
  startChar: number
  endChar: number
  children: ProvisionNode[]
}

export interface ChunkPlanResult {
  jobs: ExtractionJob[]
  totalChunks: number
  totalChars: number
  avgChunkSize: number
  levels: Record<ChunkLevel, number>
  truncatedToMaxChunks: boolean
}

/**
 * Strip HTML and return clean text
 */
export function stripHtml(html: string): string {
  const dom = new JSDOM(html)
  return dom.window.document.body?.textContent || ""
}

/**
 * Parse document into hierarchical ProvisionNodes
 */
export function parseProvisionTree(text: string): ProvisionNode[] {
  const articles: ProvisionNode[] = []

  // Match articles: "Članak X." or "Članak X"
  const articleRegex = /(?:^|\n)\s*(Članak\s+(\d+[a-z]?)\.?)\s*\n/gi
  const articleMatches: Array<{ index: number; number: string; fullMatch: string }> = []

  let match: RegExpExecArray | null
  while ((match = articleRegex.exec(text)) !== null) {
    articleMatches.push({
      index: match.index,
      number: match[2],
      fullMatch: match[1],
    })
  }

  // Extract each article's content and parse children
  for (let i = 0; i < articleMatches.length; i++) {
    const start = articleMatches[i].index
    const end = i < articleMatches.length - 1 ? articleMatches[i + 1].index : text.length
    const articleText = text.slice(start, end).trim()

    const article: ProvisionNode = {
      type: "article",
      number: articleMatches[i].number,
      text: articleText,
      startChar: start,
      endChar: end,
      children: parseArticleChildren(articleText, start, articleMatches[i].number),
    }

    articles.push(article)
  }

  return articles
}

/**
 * Parse paragraphs (stavak) and points (točka) within an article
 */
function parseArticleChildren(
  articleText: string,
  baseOffset: number,
  articleNumber: string
): ProvisionNode[] {
  const children: ProvisionNode[] = []

  // Match paragraphs: "(1)", "(2)", etc. at start of line or after text
  const paragraphRegex = /(?:^|\n)\s*\((\d+)\)\s*/gi
  const paragraphMatches: Array<{ index: number; number: string }> = []

  let match: RegExpExecArray | null
  while ((match = paragraphRegex.exec(articleText)) !== null) {
    paragraphMatches.push({
      index: match.index,
      number: match[1],
    })
  }

  // Extract each paragraph's content
  for (let i = 0; i < paragraphMatches.length; i++) {
    const start = paragraphMatches[i].index
    const end = i < paragraphMatches.length - 1 ? paragraphMatches[i + 1].index : articleText.length
    const paragraphText = articleText.slice(start, end).trim()

    const paragraph: ProvisionNode = {
      type: "paragraph",
      number: paragraphMatches[i].number,
      text: paragraphText,
      startChar: baseOffset + start,
      endChar: baseOffset + end,
      children: parseParagraphPoints(paragraphText, baseOffset + start),
    }

    children.push(paragraph)
  }

  return children
}

/**
 * Parse points (točka) within a paragraph
 */
function parseParagraphPoints(paragraphText: string, baseOffset: number): ProvisionNode[] {
  const points: ProvisionNode[] = []

  // Match points: "1.", "2.", "a)", "b)", etc.
  const pointRegex = /(?:^|\n)\s*(\d+\.|[a-z]\))\s*/gi
  const pointMatches: Array<{ index: number; number: string }> = []

  let match: RegExpExecArray | null
  while ((match = pointRegex.exec(paragraphText)) !== null) {
    pointMatches.push({
      index: match.index,
      number: match[1].replace(/[.)]$/, ""),
    })
  }

  // Extract each point's content
  for (let i = 0; i < pointMatches.length; i++) {
    const start = pointMatches[i].index
    const end = i < pointMatches.length - 1 ? pointMatches[i + 1].index : paragraphText.length
    const pointText = paragraphText.slice(start, end).trim()

    points.push({
      type: "point",
      number: pointMatches[i].number,
      text: pointText,
      startChar: baseOffset + start,
      endChar: baseOffset + end,
      children: [],
    })
  }

  return points
}

/**
 * Build nodePath string from node hierarchy
 */
function buildNodePath(
  articleNumber?: string,
  paragraphNumber?: string,
  pointNumber?: string
): string {
  let path = ""
  if (articleNumber) path += `/članak:${articleNumber}`
  if (paragraphNumber) path += `/stavak:${paragraphNumber}`
  if (pointNumber) path += `/točka:${pointNumber}`
  return path || "/document"
}

/**
 * Split text into window chunks when granularity options are exhausted
 */
function splitIntoWindows(
  text: string,
  baseOffset: number,
  basePath: string,
  maxChars: number = MAX_CHUNK_CHARS
): ExtractionJob[] {
  const jobs: ExtractionJob[] = []
  let offset = 0
  let windowIndex = 0

  while (offset < text.length) {
    // Try to split at sentence boundary
    let chunkEnd = Math.min(offset + maxChars, text.length)

    if (chunkEnd < text.length) {
      // Look for sentence boundary (. followed by space or newline)
      const lastSentence = text.lastIndexOf(". ", chunkEnd)
      if (lastSentence > offset + MIN_CHUNK_CHARS) {
        chunkEnd = lastSentence + 1
      }
    }

    const chunkText = text.slice(offset, chunkEnd).trim()
    if (chunkText.length >= MIN_CHUNK_CHARS) {
      jobs.push({
        evidenceId: "", // Will be filled by caller
        nodePath: `${basePath}/window:${windowIndex}`,
        text: chunkText,
        level: "window",
        startChar: baseOffset + offset,
        endChar: baseOffset + chunkEnd,
      })
      windowIndex++
    }

    offset = chunkEnd
  }

  return jobs
}

/**
 * Create extraction jobs from a ProvisionNode, splitting if too large
 */
function createJobsFromNode(
  node: ProvisionNode,
  evidenceId: string,
  articleNumber?: string,
  paragraphNumber?: string,
  maxChars: number = MAX_CHUNK_CHARS
): ExtractionJob[] {
  const jobs: ExtractionJob[] = []

  if (node.type === "article") {
    articleNumber = node.number
  } else if (node.type === "paragraph") {
    paragraphNumber = node.number
  }

  const nodePath = buildNodePath(
    articleNumber,
    node.type === "paragraph" ? node.number : paragraphNumber,
    node.type === "point" ? node.number : undefined
  )

  // If node fits in one chunk, create single job
  if (node.text.length <= maxChars) {
    jobs.push({
      evidenceId,
      nodePath,
      text: node.text,
      level: node.type,
      startChar: node.startChar,
      endChar: node.endChar,
      articleNumber,
      paragraphNumber: node.type === "paragraph" ? node.number : paragraphNumber,
      pointNumber: node.type === "point" ? node.number : undefined,
    })
    return jobs
  }

  // Node is too large - try to split at children
  if (node.children.length > 0) {
    for (const child of node.children) {
      jobs.push(
        ...createJobsFromNode(
          child,
          evidenceId,
          articleNumber,
          node.type === "paragraph" ? node.number : paragraphNumber,
          maxChars
        )
      )
    }
    return jobs
  }

  // No children and too large - fall back to window splitting
  const windowJobs = splitIntoWindows(node.text, node.startChar, nodePath, maxChars)
  for (const job of windowJobs) {
    job.evidenceId = evidenceId
    job.articleNumber = articleNumber
    job.paragraphNumber = paragraphNumber
  }

  return windowJobs
}

/**
 * Plan extraction chunks for a document
 */
export function planChunks(
  evidenceId: string,
  rawContent: string,
  maxChars: number = MAX_CHUNK_CHARS
): ChunkPlanResult {
  // Strip HTML if present
  const isHtml = rawContent.trim().startsWith("<!") || rawContent.trim().startsWith("<html")
  const text = isHtml ? stripHtml(rawContent) : rawContent

  // Parse provision tree
  const articles = parseProvisionTree(text)

  const jobs: ExtractionJob[] = []
  const levels: Record<ChunkLevel, number> = {
    document: 0,
    article: 0,
    paragraph: 0,
    point: 0,
    window: 0,
  }

  // If no articles found, treat as single document chunk (or window split)
  if (articles.length === 0) {
    if (text.length <= maxChars) {
      jobs.push({
        evidenceId,
        nodePath: "/document",
        text,
        level: "document",
        startChar: 0,
        endChar: text.length,
      })
      levels.document = 1
    } else {
      const windowJobs = splitIntoWindows(text, 0, "/document", maxChars)
      for (const job of windowJobs) {
        job.evidenceId = evidenceId
      }
      jobs.push(...windowJobs)
      levels.window = windowJobs.length
    }
  } else {
    // Process each article
    for (const article of articles) {
      const articleJobs = createJobsFromNode(article, evidenceId, undefined, undefined, maxChars)
      jobs.push(...articleJobs)

      // Count levels
      for (const job of articleJobs) {
        levels[job.level]++
      }
    }
  }

  // Enforce max chunks limit
  const truncatedToMaxChunks = jobs.length > MAX_CHUNKS_PER_EVIDENCE
  const finalJobs = truncatedToMaxChunks ? jobs.slice(0, MAX_CHUNKS_PER_EVIDENCE) : jobs

  const totalChars = finalJobs.reduce((sum, job) => sum + job.text.length, 0)

  return {
    jobs: finalJobs,
    totalChunks: finalJobs.length,
    totalChars,
    avgChunkSize: finalJobs.length > 0 ? Math.round(totalChars / finalJobs.length) : 0,
    levels,
    truncatedToMaxChunks,
  }
}

/**
 * Print chunk plan summary
 */
export function printChunkPlan(plan: ChunkPlanResult): void {
  console.log("=== CHUNK PLAN ===")
  console.log(`Total chunks: ${plan.totalChunks}`)
  console.log(`Total chars: ${plan.totalChars}`)
  console.log(`Avg chunk size: ${plan.avgChunkSize} chars`)
  console.log(`Truncated to max: ${plan.truncatedToMaxChunks}`)
  console.log("\nBy level:")
  for (const [level, count] of Object.entries(plan.levels)) {
    if (count > 0) {
      console.log(`  ${level}: ${count}`)
    }
  }
  console.log("\nSample jobs (first 5):")
  for (const job of plan.jobs.slice(0, 5)) {
    console.log(`  ${job.nodePath}: ${job.text.length} chars`)
  }
  if (plan.jobs.length > 5) {
    console.log(`  ... and ${plan.jobs.length - 5} more`)
  }
}
