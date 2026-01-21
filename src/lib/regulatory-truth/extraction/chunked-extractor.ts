/**
 * Chunked Extractor
 *
 * Processes extraction jobs from the chunk planner, handles truncation,
 * and stores results as immutable ExtractionArtifacts.
 */

import type { Prisma } from "@prisma/client"
import { db } from "../../db"
import {
  ExtractionJob,
  MAX_ASSERTIONS_PER_CHUNK,
  MAX_TOTAL_ASSERTIONS_PER_EVIDENCE,
} from "./chunk-planner"

// V2 Assertion types - atomic types require verbatim values, textual types require verbatim statements
export type AtomicAssertionType =
  | "THRESHOLD"
  | "RATE"
  | "AMOUNT"
  | "DEADLINE_DATE"
  | "PERIOD"
  | "REFERENCE"
export type TextualAssertionType =
  | "OBLIGATION"
  | "PROHIBITION"
  | "PROCEDURE"
  | "DEFINITION"
  | "EXCEPTION"
  | "ENTITY"
export type AssertionTypeValue = AtomicAssertionType | TextualAssertionType | "DEADLINE" // DEADLINE for v1 compat

// Value units for atomic assertions
export type ValueUnitType =
  | "PERCENT"
  | "EUR"
  | "HRK"
  | "DAYS"
  | "MONTHS"
  | "YEARS"
  | "DATE"
  | "TEXT_REF"
  | "COUNT"
  | "UNSPECIFIED"

// Span position within a quote
export interface SpanPosition {
  start: number
  end: number
}

// V2 atomic value with verbatim + canonical + span
export interface AtomicValue {
  verbatim: string // Exact substring from quote
  canonical: string // Normalized for machine processing
  unit: ValueUnitType
  span: SpanPosition
}

// V2 textual statement with verbatim + span
export interface TextualStatement {
  verbatim: string // Exact clause from quote
  span: SpanPosition
}

// V2 extracted tokens for textual assertions
export interface TextualTokens {
  subject?: string
  actionVerb?: string
  object?: string
}

export interface LegalAssertion {
  id: string
  assertionType: AssertionTypeValue
  domain: string
  subDomain?: string

  // V1 fields (kept for backward compat)
  extractedValue?: string
  displayValue?: string
  valueType?: string
  normalizedValue?: string

  // V2 fields (span-anchored)
  value?: AtomicValue // For atomic types
  statement?: TextualStatement // For textual types
  tokens?: TextualTokens // For textual types

  conditions?: string[]
  exactQuote: string
  contextBefore?: string
  contextAfter?: string
  articleNumber?: string
  paragraphNumber?: string
  pointNumber?: string
  lawReference: string
  nodePath: string
  confidence: number
  extractionNotes?: string
}

export interface ChunkExtractionResult {
  jobId: string
  evidenceId: string
  nodePath: string
  assertions: LegalAssertion[]
  truncated: boolean
  truncationReason?: "token_limit" | "max_assertions" | "other"
  inputRange: { startChar: number; endChar: number }
  tokensUsed?: number
  durationMs?: number
  error?: string
}

export interface EvidenceIngestionSummary {
  evidenceId: string
  totalChunks: number
  completedChunks: number
  failedChunks: number
  totalAssertions: number
  assertionsByType: Record<string, number>
  assertionsByDomain: Record<string, number>
  nodesWithAssertions: number
  totalNodes: number
  coveragePercent: number
  totalTokensUsed: number
  totalDurationMs: number
  status: "RUNNING" | "COMPLETED" | "PARTIAL_COVERAGE" | "FAILED"
  truncatedChunks: number
  errors: string[]
}

/**
 * Build the extraction prompt for a single chunk
 * Simplified format for better model compatibility
 */
function buildExtractionPrompt(job: ExtractionJob): string {
  return `Extract legal assertions from this Croatian regulatory text. Output ONLY valid JSON, no explanations.

ASSERTION TYPES:
- THRESHOLD: Numeric limits (e.g., "85.000,00 kuna")
- RATE: Percentages (e.g., "12 %")
- DEADLINE: Dates/deadlines
- OBLIGATION: Requirements, duties
- PROHIBITION: Forbidden actions
- PROCEDURE: Processes, steps
- DEFINITION: Term definitions
- EXCEPTION: Exemptions
- REFERENCE: Cross-references to other articles

RULES:
1. "extractedValue" must be EXACT text from the quote (copy verbatim)
2. "exactQuote" must be the sentence containing the value
3. Do NOT paraphrase or summarize

OUTPUT FORMAT (JSON only, no markdown):
{"assertions":[{"id":"a-1","assertionType":"RATE","domain":"pausalni-porez","extractedValue":"12 %","exactQuote":"stopa poreza na dohodak od samostalne djelatnosti iznosi 12 %","articleNumber":"${job.articleNumber || ""}","paragraphNumber":"${job.paragraphNumber || ""}","nodePath":"${job.nodePath}","lawReference":"Pravilnik o paušalnom oporezivanju","confidence":0.95}],"truncated":false}

TEXT (${job.nodePath}):
${job.text}

JSON:`
}

/**
 * Call the LLM to extract assertions from a chunk
 */
async function callLlmForExtraction(
  job: ExtractionJob,
  ollamaEndpoint: string,
  ollamaApiKey: string,
  ollamaModel: string
): Promise<{
  assertions: LegalAssertion[]
  truncated: boolean
  truncationReason?: string
  tokensUsed: number
  rawResponse: string
}> {
  const prompt = buildExtractionPrompt(job)

  const response = await fetch(`${ollamaEndpoint}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ollamaApiKey}`,
    },
    body: JSON.stringify({
      model: ollamaModel,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 4096, // Bounded output
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`LLM API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  const rawResponse = data.choices?.[0]?.message?.content || ""
  const tokensUsed = data.usage?.total_tokens || 0

  // Parse JSON from response - try multiple approaches with repair
  let assertions: LegalAssertion[] = []
  let truncated = false
  let truncationReason: string | undefined

  // Clean up response - remove markdown, trim, find JSON
  let cleanResponse = rawResponse
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim()

  // Find the first { and last } to extract JSON
  const firstBrace = cleanResponse.indexOf("{")
  const lastBrace = cleanResponse.lastIndexOf("}")
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleanResponse = cleanResponse.slice(firstBrace, lastBrace + 1)
  }

  // Try 1: Full JSON parse
  try {
    const parsed = JSON.parse(cleanResponse)
    assertions = parsed.assertions || []
    truncated = parsed.truncated || false
    truncationReason = parsed.truncationReason
  } catch {
    // Try 2: Fix common JSON issues and retry
    const fixedJson = cleanResponse
      // Remove trailing commas before ] or }
      .replace(/,\s*]/g, "]")
      .replace(/,\s*}/g, "}")
      // Fix unquoted keys (simple cases)
      .replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3')

    try {
      const parsed = JSON.parse(fixedJson)
      assertions = parsed.assertions || []
      truncated = parsed.truncated || false
      truncationReason = parsed.truncationReason
    } catch {
      // Try 3: Extract individual assertion objects from partial JSON
      const assertionPattern =
        /\{\s*"id":\s*"[^"]+",\s*"assertionType":\s*"[^"]+",[\s\S]*?"confidence":\s*[\d.]+[^}]*\}/g
      const matches = cleanResponse.matchAll(assertionPattern)

      for (const match of matches) {
        try {
          // Try to fix common JSON issues
          let fixed = match[0]
          // Remove trailing commas before closing braces
          fixed = fixed.replace(/,\s*}/g, "}")
          // Ensure proper closing
          if (!fixed.endsWith("}")) {
            fixed += "}"
          }
          const assertion = JSON.parse(fixed)
          if (assertion.id && assertion.assertionType) {
            assertions.push(assertion)
          }
        } catch {
          // Skip malformed individual assertions
        }
      }

      // If we found some assertions, mark as truncated
      if (assertions.length > 0) {
        truncated = true
        truncationReason = "token_limit"
      }
    }
  }

  if (assertions.length === 0) {
    throw new Error(`No assertions extracted from response: ${rawResponse.slice(0, 200)}`)
  }

  return {
    assertions,
    truncated,
    truncationReason,
    tokensUsed,
    rawResponse,
  }
}

/**
 * Process a single extraction job
 */
export async function processExtractionJob(
  job: ExtractionJob,
  ollamaEndpoint: string,
  ollamaApiKey: string,
  ollamaModel: string
): Promise<ChunkExtractionResult> {
  const startTime = Date.now()
  const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  try {
    const llmResult = await callLlmForExtraction(job, ollamaEndpoint, ollamaApiKey, ollamaModel)

    // Check for max assertions limit
    const truncatedByLimit = llmResult.assertions.length >= MAX_ASSERTIONS_PER_CHUNK
    const assertions = llmResult.assertions.slice(0, MAX_ASSERTIONS_PER_CHUNK)

    return {
      jobId,
      evidenceId: job.evidenceId,
      nodePath: job.nodePath,
      assertions,
      truncated: llmResult.truncated || truncatedByLimit,
      truncationReason: truncatedByLimit
        ? "max_assertions"
        : llmResult.truncated
          ? "token_limit"
          : undefined,
      inputRange: { startChar: job.startChar, endChar: job.endChar },
      tokensUsed: llmResult.tokensUsed,
      durationMs: Date.now() - startTime,
    }
  } catch (error) {
    return {
      jobId,
      evidenceId: job.evidenceId,
      nodePath: job.nodePath,
      assertions: [],
      truncated: false,
      inputRange: { startChar: job.startChar, endChar: job.endChar },
      durationMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Run chunked extraction for all jobs from an evidence
 */
export async function runChunkedExtraction(
  jobs: ExtractionJob[],
  options: {
    ollamaEndpoint: string
    ollamaApiKey: string
    ollamaModel: string
    delayBetweenChunks?: number // ms
    onProgress?: (completed: number, total: number, current: ChunkExtractionResult) => void
  }
): Promise<{
  results: ChunkExtractionResult[]
  summary: EvidenceIngestionSummary
}> {
  const results: ChunkExtractionResult[] = []
  const summary: EvidenceIngestionSummary = {
    evidenceId: jobs[0]?.evidenceId || "",
    totalChunks: jobs.length,
    completedChunks: 0,
    failedChunks: 0,
    totalAssertions: 0,
    assertionsByType: {},
    assertionsByDomain: {},
    nodesWithAssertions: 0,
    totalNodes: jobs.length,
    coveragePercent: 0,
    totalTokensUsed: 0,
    totalDurationMs: 0,
    status: "RUNNING",
    truncatedChunks: 0,
    errors: [],
  }

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i]

    // Check total assertions limit
    if (summary.totalAssertions >= MAX_TOTAL_ASSERTIONS_PER_EVIDENCE) {
      summary.status = "PARTIAL_COVERAGE"
      summary.errors.push(
        `Stopped: reached max assertions limit (${MAX_TOTAL_ASSERTIONS_PER_EVIDENCE})`
      )
      break
    }

    const result = await processExtractionJob(
      job,
      options.ollamaEndpoint,
      options.ollamaApiKey,
      options.ollamaModel
    )

    results.push(result)

    // Update summary
    if (result.error) {
      summary.failedChunks++
      summary.errors.push(`${result.nodePath}: ${result.error}`)
    } else {
      summary.completedChunks++
      summary.totalAssertions += result.assertions.length
      summary.totalTokensUsed += result.tokensUsed || 0
      summary.totalDurationMs += result.durationMs || 0

      if (result.assertions.length > 0) {
        summary.nodesWithAssertions++
      }

      if (result.truncated) {
        summary.truncatedChunks++
      }

      // Count by type and domain
      for (const assertion of result.assertions) {
        const type = assertion.assertionType || "UNKNOWN"
        const domain = assertion.domain || "unknown"
        summary.assertionsByType[type] = (summary.assertionsByType[type] || 0) + 1
        summary.assertionsByDomain[domain] = (summary.assertionsByDomain[domain] || 0) + 1
      }
    }

    // Progress callback
    if (options.onProgress) {
      options.onProgress(i + 1, jobs.length, result)
    }

    // Rate limiting
    if (options.delayBetweenChunks && i < jobs.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, options.delayBetweenChunks))
    }
  }

  // Calculate coverage
  summary.coveragePercent =
    summary.totalNodes > 0
      ? Math.round((summary.nodesWithAssertions / summary.totalNodes) * 100)
      : 0

  // Set final status
  if (summary.failedChunks === summary.totalChunks) {
    summary.status = "FAILED"
  } else if (summary.failedChunks > 0 || summary.truncatedChunks > 0) {
    summary.status = "PARTIAL_COVERAGE"
  } else {
    summary.status = "COMPLETED"
  }

  return { results, summary }
}

/**
 * Detect if an assertion is v2 (has span-anchored value or statement)
 */
function isV2Assertion(assertion: LegalAssertion): boolean {
  return !!(assertion.value?.verbatim || assertion.statement?.verbatim)
}

/**
 * Build the assertionPayload JSON for v2 assertions
 */
function buildAssertionPayload(assertion: LegalAssertion): Prisma.InputJsonValue | undefined {
  if (!isV2Assertion(assertion)) {
    return undefined
  }

  // Atomic types have value field
  if (assertion.value) {
    const span: Prisma.InputJsonObject = {
      start: assertion.value.span.start,
      end: assertion.value.span.end,
    }
    const value: Prisma.InputJsonObject = {
      verbatim: assertion.value.verbatim,
      canonical: assertion.value.canonical,
      unit: assertion.value.unit,
      span,
    }
    const payload: Prisma.InputJsonObject = {
      type: "atomic",
      assertionType: assertion.assertionType,
      value,
      conditions: assertion.conditions || [],
    }
    return payload
  }

  // Textual types have statement field
  if (assertion.statement) {
    const span: Prisma.InputJsonObject = {
      start: assertion.statement.span.start,
      end: assertion.statement.span.end,
    }
    const statement: Prisma.InputJsonObject = {
      verbatim: assertion.statement.verbatim,
      span,
    }
    const tokens: Prisma.InputJsonObject = {
      ...(assertion.tokens?.subject ? { subject: assertion.tokens.subject } : {}),
      ...(assertion.tokens?.actionVerb ? { actionVerb: assertion.tokens.actionVerb } : {}),
      ...(assertion.tokens?.object ? { object: assertion.tokens.object } : {}),
    }

    const payload: Prisma.InputJsonObject = {
      type: "textual",
      assertionType: assertion.assertionType,
      statement,
      tokens,
      conditions: assertion.conditions || [],
    }
    return payload
  }

  return undefined
}

/**
 * Get extracted value for backwards compatibility
 * V2: Use verbatim from value or statement
 * V1: Use extractedValue or displayValue
 */
function getExtractedValue(assertion: LegalAssertion): string | undefined {
  if (assertion.value?.verbatim) {
    return assertion.value.verbatim
  }
  if (assertion.statement?.verbatim) {
    return assertion.statement.verbatim
  }
  return assertion.extractedValue || assertion.displayValue
}

/**
 * Get value type for backwards compatibility
 * V2: Use unit from value
 * V1: Use valueType
 */
function getValueType(assertion: LegalAssertion): string | undefined {
  if (assertion.value?.unit) {
    return assertion.value.unit
  }
  return assertion.valueType
}

// Valid Prisma AssertionType enum values
type PrismaAssertionType =
  | "THRESHOLD"
  | "RATE"
  | "AMOUNT"
  | "DEADLINE_DATE"
  | "PERIOD"
  | "REFERENCE"
  | "OBLIGATION"
  | "PROCEDURE"
  | "DEFINITION"
  | "PROHIBITION"
  | "PERMISSION"
  | "EXCEPTION"
  | "ENTITY"

// Map model output types to valid Prisma enum values
const ASSERTION_TYPE_MAP: Record<string, PrismaAssertionType | null> = {
  // Direct mappings
  THRESHOLD: "THRESHOLD",
  RATE: "RATE",
  AMOUNT: "AMOUNT",
  DEADLINE_DATE: "DEADLINE_DATE",
  PERIOD: "PERIOD",
  REFERENCE: "REFERENCE",
  OBLIGATION: "OBLIGATION",
  PROCEDURE: "PROCEDURE",
  DEFINITION: "DEFINITION",
  PROHIBITION: "PROHIBITION",
  PERMISSION: "PERMISSION",
  EXCEPTION: "EXCEPTION",
  ENTITY: "ENTITY",
  // Aliases (model outputs these, map to valid enum)
  DEADLINE: "DEADLINE_DATE",
  VALUE: "AMOUNT",
}

/**
 * Map assertion type to valid Prisma enum value
 * Returns null for unknown types (will be stored in extractorNotes only)
 */
function mapAssertionType(modelType: string): PrismaAssertionType | null {
  const normalized = modelType?.toUpperCase() || ""
  return ASSERTION_TYPE_MAP[normalized] || null
}

/**
 * Store extraction results in database
 */
export async function storeExtractionResults(
  evidenceId: string,
  results: ChunkExtractionResult[],
  summary: EvidenceIngestionSummary
): Promise<{ agentRunId: string; candidateFactIds: string[] }> {
  const candidateFactIds: string[] = []

  // Create AgentRun record
  // Valid AgentRunStatus: RUNNING, COMPLETED, FAILED
  // Valid AgentRunOutcome: SUCCESS_APPLIED, SUCCESS_NO_CHANGE, VALIDATION_REJECTED, etc.
  const agentRun = await db.agentRun.create({
    data: {
      agentType: "EXTRACTOR",
      status: summary.failedChunks === summary.totalChunks ? "FAILED" : "COMPLETED",
      outcome:
        summary.totalAssertions > 0
          ? "SUCCESS_APPLIED"
          : summary.failedChunks > 0
            ? "PARSE_FAILED"
            : "SUCCESS_NO_CHANGE",
      evidenceId,
      input: {
        totalChunks: summary.totalChunks,
        method: "chunked",
      },
      output: {
        summary,
        chunksProcessed: results.length,
      },
      tokensUsed: summary.totalTokensUsed,
      durationMs: summary.totalDurationMs,
      inputChars: results.reduce(
        (sum, r) => sum + (r.inputRange.endChar - r.inputRange.startChar),
        0
      ),
      itemsProduced: summary.totalAssertions,
    },
  })

  // Create CandidateFacts for each assertion
  for (const result of results) {
    for (const assertion of result.assertions) {
      const isV2 = isV2Assertion(assertion)
      const assertionPayload = buildAssertionPayload(assertion)

      const candidateFact = await db.candidateFact.create({
        data: {
          suggestedConceptSlug: `${assertion.domain}/${assertion.assertionType.toLowerCase()}`,
          suggestedDomain: assertion.domain,
          // V1 fields for backward compatibility
          extractedValue: getExtractedValue(assertion),
          suggestedValueType: getValueType(assertion),
          overallConfidence: assertion.confidence,
          legalReferenceRaw: assertion.lawReference,
          groundingQuotes: [
            {
              quote: assertion.exactQuote,
              nodePath: assertion.nodePath,
              articleNumber: assertion.articleNumber,
              paragraphNumber: assertion.paragraphNumber,
            },
          ],
          extractorNotes: JSON.stringify({
            assertionType: assertion.assertionType,
            displayValue: assertion.displayValue,
            normalizedValue: assertion.normalizedValue,
            conditions: assertion.conditions,
            agentRunId: agentRun.id,
          }),
          status: "CAPTURED",
          // V2 fields for span-anchored extraction (map model output to valid enum)
          assertionType: mapAssertionType(assertion.assertionType) ?? undefined,
          assertionPayload: assertionPayload ?? undefined,
          payloadVersion: isV2 ? 2 : 1,
        },
      })
      candidateFactIds.push(candidateFact.id)
    }
  }

  return { agentRunId: agentRun.id, candidateFactIds }
}

/**
 * Print extraction summary
 */
export function printExtractionSummary(summary: EvidenceIngestionSummary): void {
  console.log("\n" + "=".repeat(80))
  console.log("EXTRACTION SUMMARY")
  console.log("=".repeat(80))
  console.log()
  console.log(`Status: ${summary.status}`)
  console.log(
    `Chunks: ${summary.completedChunks}/${summary.totalChunks} completed, ${summary.failedChunks} failed`
  )
  console.log(`Truncated chunks: ${summary.truncatedChunks}`)
  console.log()
  console.log(`Total assertions: ${summary.totalAssertions}`)
  console.log(
    `Nodes with assertions: ${summary.nodesWithAssertions}/${summary.totalNodes} (${summary.coveragePercent}%)`
  )
  console.log()
  console.log(`Tokens used: ${summary.totalTokensUsed}`)
  console.log(`Duration: ${(summary.totalDurationMs / 1000).toFixed(1)}s`)
  console.log()
  console.log("By assertion type:")
  for (const [type, count] of Object.entries(summary.assertionsByType).sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`  ${type}: ${count}`)
  }
  console.log()
  console.log("By domain:")
  for (const [domain, count] of Object.entries(summary.assertionsByDomain).sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`  ${domain}: ${count}`)
  }

  if (summary.errors.length > 0) {
    console.log()
    console.log(`Errors (${summary.errors.length}):`)
    for (const err of summary.errors.slice(0, 10)) {
      console.log(`  - ${err.slice(0, 100)}`)
    }
    if (summary.errors.length > 10) {
      console.log(`  ... and ${summary.errors.length - 10} more`)
    }
  }
}
