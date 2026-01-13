// src/lib/regulatory-truth/agents/extractor.ts

import { db } from "@/lib/db"
import { dbReg } from "@/lib/db/regulatory"
import {
  ExtractorInputSchema,
  ExtractorOutputSchema,
  type ExtractorInput,
  type ExtractorOutput,
} from "../schemas"
import { runAgent } from "./runner"
import { cleanContent, getCleaningStats } from "../utils/content-cleaner"
import { validateExtraction } from "../utils/deterministic-validators"
import { withSoftFail } from "../utils/soft-fail"
import { getExtractableContent } from "../utils/content-provider"
import { isBlockedDomain } from "../utils/concept-resolver"
import { generateCoverageReport, saveCoverageReport } from "../quality/coverage-report"
import { normalizeQuotes } from "../utils/quote-normalizer"
import { isValidDomain } from "../schemas/common"
// PHASE-D: generatePointerEmbeddingsBatch import removed - no longer creating SourcePointers

// =============================================================================
// EXTRACTOR AGENT
// =============================================================================

export interface ExtractorResult {
  success: boolean
  output: ExtractorOutput | null
  /** @deprecated PHASE-D: SourcePointer creation removed. Use candidateFactIds instead. */
  sourcePointerIds: string[]
  /** PHASE-D: CandidateFacts created during extraction */
  candidateFactIds: string[]
  /** AgentRun ID for outcome updates */
  agentRunId: string | null
  error: string | null
}

/** Correlation options for tracking agent runs across the pipeline */
export interface CorrelationOptions {
  runId?: string
  jobId?: string
  parentJobId?: string
  sourceSlug?: string
  queueName?: string
}

/**
 * Check if content is JSON (starts with { or [)
 */
function isJsonContent(content: string): boolean {
  const trimmed = content.trim()
  return trimmed.startsWith("{") || trimmed.startsWith("[")
}

/**
 * Helper to find a value in a JSON object and return the key-value pair
 */
function findInJsonObject(obj: unknown, value: string, path: string = ""): string | null {
  if (typeof obj !== "object" || obj === null) return null

  for (const [key, val] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key
    const valStr = String(val)

    // Normalize value for comparison (remove thousand separators)
    const normalizedValue = value.replace(/[.,\s]/g, "")
    const normalizedVal = valStr.replace(/[.,\s]/g, "")

    // Check if this field contains the exact value
    if (normalizedVal === normalizedValue || valStr === value) {
      // Return as JSON key-value pair
      return `"${key}": ${JSON.stringify(val)}`
    }

    // Recurse into nested objects
    if (typeof val === "object" && val !== null) {
      const found = findInJsonObject(val, value, currentPath)
      if (found) return found
    }
  }
  return null
}

/**
 * Extract a verbatim quote from JSON content that contains the value.
 * For HNB exchange rate API and other JSON sources.
 */
function extractQuoteFromJson(content: string, value: string): string | null {
  try {
    const json = JSON.parse(content)

    // Strategy 1: Find a single key-value pair containing the value
    if (Array.isArray(json)) {
      for (const item of json) {
        const found = findInJsonObject(item, value)
        if (found) return found
      }
    } else {
      const found = findInJsonObject(json, value)
      if (found) return found
    }

    // Strategy 2: Fallback - return the whole JSON prettified (limited)
    const jsonStr = JSON.stringify(json, null, 2)
    const lines = jsonStr.split("\n")
    for (const line of lines) {
      if (line.includes(value)) {
        return line.trim()
      }
    }

    return null
  } catch (error) {
    console.warn(`[extractor] Failed to parse JSON for quote extraction: ${error}`)
    return null
  }
}

/**
 * Run the Extractor agent to extract data points from evidence
 */
export async function runExtractor(
  evidenceId: string,
  correlationOpts?: CorrelationOptions
): Promise<ExtractorResult> {
  // Get evidence from database
  const evidence = await dbReg.evidence.findUnique({
    where: { id: evidenceId },
    include: { source: true },
  })

  if (!evidence) {
    return {
      success: false,
      output: null,
      sourcePointerIds: [],
      candidateFactIds: [],
      agentRunId: null,
      error: `Evidence not found: ${evidenceId}`,
    }
  }

  // GUARD: Skip test domain evidence - should not be processed
  try {
    const urlDomain = new URL(evidence.url).hostname
    if (isBlockedDomain(urlDomain)) {
      console.log(`[extractor] Skipping test domain evidence: ${urlDomain}`)
      return {
        success: false,
        output: null,
        sourcePointerIds: [],
        candidateFactIds: [],
        agentRunId: null,
        error: `Blocked test domain: ${urlDomain}`,
      }
    }
  } catch {
    // If URL parsing fails, continue with extraction
  }

  // Get content from artifact or rawContent via content provider
  const { text: content, source, artifactKind } = await getExtractableContent(evidenceId)
  console.log(
    `[extractor] Using ${source}${artifactKind ? `:${artifactKind}` : ""} for ${evidenceId}`
  )

  // Clean content to remove navigation noise before passing to LLM
  const cleanedContent = cleanContent(content, evidence.url)
  const stats = getCleaningStats(content, cleanedContent)
  console.log(
    `[extractor] Cleaned content for ${evidence.url}: ${stats.originalLength} → ${stats.cleanedLength} chars (${stats.reductionPercent}% reduction, ${stats.newsItemsFound} news items found)`
  )

  // Build input for agent with cleaned content
  const input: ExtractorInput = {
    evidenceId: evidence.id,
    content: cleanedContent,
    contentType: evidence.contentType as "html" | "pdf" | "xml",
    sourceUrl: evidence.url,
  }

  // Run the agent
  const result = await runAgent<ExtractorInput, ExtractorOutput>({
    agentType: "EXTRACTOR",
    input,
    inputSchema: ExtractorInputSchema,
    outputSchema: ExtractorOutputSchema,
    temperature: 0.1,
    evidenceId: evidence.id,
    // Pass correlation options from worker
    runId: correlationOpts?.runId,
    jobId: correlationOpts?.jobId,
    parentJobId: correlationOpts?.parentJobId,
    sourceSlug: correlationOpts?.sourceSlug ?? evidence.source?.slug,
    queueName: correlationOpts?.queueName ?? "extract",
  })

  if (!result.success || !result.output) {
    return {
      success: false,
      output: null,
      sourcePointerIds: [],
      candidateFactIds: [],
      agentRunId: result.runId,
      error: result.error,
    }
  }

  // PHASE-D: Store CandidateFacts (SourcePointer creation removed)
  const candidateFactIds: string[] = []
  const rejectedExtractions: Array<{
    extraction: ExtractorOutput["extractions"][number]
    errors: string[]
  }> = []

  for (const extraction of result.output.extractions) {
    // GUARD: Validate domain is in the standard DomainSchema
    // This prevents domain leakage from LLM hallucinations
    if (!isValidDomain(extraction.domain)) {
      rejectedExtractions.push({
        extraction,
        errors: [`Invalid domain: '${extraction.domain}' is not in DomainSchema`],
      })
      console.warn(
        `[extractor] Rejected extraction for invalid domain '${extraction.domain}' - not in DomainSchema`
      )

      // Store in dead-letter table for analysis
      await dbReg.extractionRejected.create({
        data: {
          evidenceId: evidence.id,
          rejectionType: "INVALID_DOMAIN",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma JSON field accepts any serializable value
          rawOutput: extraction as unknown as Record<string, unknown>,
          errorDetails: `Domain '${extraction.domain}' is not in DomainSchema. Valid domains: pausalni, pdv, porez_dohodak, doprinosi, fiskalizacija, rokovi, obrasci`,
        },
      })

      continue
    }

    // For JSON content, fix the quote to be a verbatim JSON fragment
    if (evidence.contentType === "json" || isJsonContent(content)) {
      const jsonQuote = extractQuoteFromJson(content, String(extraction.extracted_value))
      if (jsonQuote) {
        extraction.exact_quote = jsonQuote
        extraction.extraction_notes =
          `${extraction.extraction_notes || ""} [AUTO-CORRECTED: Quote extracted from JSON response]`.trim()
      }
    }

    // Validate extraction before storing
    // Pass both original and cleaned content for proper quote verification (issue #750)
    const validation = validateExtraction(extraction, {
      originalContent: content,
      cleanedContent: cleanedContent,
      requireBothMatch: true,
    })

    if (!validation.valid) {
      rejectedExtractions.push({ extraction, errors: validation.errors })
      console.warn(
        `[extractor] Rejected extraction for ${extraction.domain}.${extraction.value_type}: ${validation.errors.join(", ")}`
      )

      // Store in dead-letter table for analysis and reprocessing
      const rejectionType = validation.errors[0]?.includes("percentage")
        ? "OUT_OF_RANGE"
        : validation.errors[0]?.includes("currency")
          ? "INVALID_CURRENCY"
          : validation.errors[0]?.includes("date")
            ? "INVALID_DATE"
            : validation.errors[0]?.includes("not found")
              ? "NO_QUOTE_MATCH"
              : "VALIDATION_FAILED"

      await dbReg.extractionRejected.create({
        data: {
          evidenceId: evidence.id,
          rejectionType,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma JSON field accepts any serializable value
          rawOutput: extraction as unknown as Record<string, unknown>,
          errorDetails: validation.errors.join("; "),
        },
      })

      continue
    }

    // Log warnings for low-confidence extractions
    if (validation.warnings.length > 0) {
      console.warn(
        `[extractor] Warning for ${extraction.domain}.${extraction.value_type}: ${validation.warnings.join(", ")}`
      )
    }

    // Normalize quotes before storing to prevent verification failures
    // from smart quote auto-correction in source content
    const normalizedQuote = normalizeQuotes(extraction.exact_quote)
    const normalizedContextBefore = extraction.context_before
      ? normalizeQuotes(extraction.context_before)
      : undefined
    const normalizedContextAfter = extraction.context_after
      ? normalizeQuotes(extraction.context_after)
      : undefined

    // PHASE-D: CandidateFact is now the primary extraction storage
    // SourcePointer creation removed - Phase-1 system is canonical
    const candidateFact = await db.candidateFact.create({
      data: {
        suggestedDomain: extraction.domain,
        suggestedValueType: extraction.value_type,
        extractedValue: String(extraction.extracted_value),
        overallConfidence: extraction.confidence,
        valueConfidence: extraction.confidence,
        groundingQuotes: [
          {
            text: normalizedQuote,
            contextBefore: normalizedContextBefore || null,
            contextAfter: normalizedContextAfter || null,
            evidenceId: evidence.id,
            // PHASE-D: sourcePointerId removed - no longer creating SourcePointers
            articleNumber: extraction.article_number || null,
            lawReference: extraction.law_reference || null,
          },
        ],
        suggestedConceptSlug: `${extraction.domain}-${extraction.value_type}`.toLowerCase(),
        legalReferenceRaw: extraction.law_reference || null,
        extractorNotes: extraction.extraction_notes || null,
        suggestedPillar: extraction.domain,
        // Mark as captured but not yet reviewed
        status: "CAPTURED",
        promotionCandidate: extraction.confidence >= 0.9,
      },
    })
    candidateFactIds.push(candidateFact.id)
  }

  // Log rejection stats
  if (rejectedExtractions.length > 0) {
    console.warn(
      `[extractor] Rejected ${rejectedExtractions.length}/${result.output.extractions.length} extractions`
    )
  }

  // PHASE-D: SourcePointer embedding generation removed
  // Embeddings for CandidateFacts/RuleFacts are generated during promotion

  // Generate and save coverage report
  try {
    const coverageReport = await generateCoverageReport(evidenceId)
    await saveCoverageReport(coverageReport)
    console.log(
      `[extractor] Coverage: ${(coverageReport.coverageScore * 100).toFixed(0)}% (${coverageReport.isComplete ? "complete" : "incomplete"})`
    )
  } catch (coverageError) {
    console.warn(`[extractor] Failed to generate coverage report: ${coverageError}`)
  }

  // PHASE-D: Return candidateFactIds as the primary output
  // sourcePointerIds kept for backward compatibility (always empty)
  return {
    success: true,
    output: result.output,
    sourcePointerIds: [], // PHASE-D: Always empty - SourcePointer creation removed
    candidateFactIds,
    agentRunId: result.runId,
    error: null,
  }
}

/**
 * Run extractor on multiple unprocessed evidence records
 * PHASE-D: Updated to use CandidateFact for tracking processed evidence
 */
export async function runExtractorBatch(limit: number = 20): Promise<{
  processed: number
  failed: number
  /** @deprecated PHASE-D: Always empty - use candidateFactIds instead */
  sourcePointerIds: string[]
  candidateFactIds: string[]
  errors: string[]
}> {
  // PHASE-D: Find evidence that hasn't been processed (no CandidateFacts link to it)
  // Query all evidence IDs that have CandidateFacts via groundingQuotes JSON
  const candidateFactsWithEvidence = await db.candidateFact.findMany({
    select: { groundingQuotes: true },
  })
  // Extract unique evidenceIds from groundingQuotes JSON
  const processedEvidenceIds = new Set<string>()
  for (const cf of candidateFactsWithEvidence) {
    const quotes = cf.groundingQuotes as Array<{ evidenceId?: string }> | null
    if (quotes) {
      for (const quote of quotes) {
        if (quote.evidenceId) {
          processedEvidenceIds.add(quote.evidenceId)
        }
      }
    }
  }

  // Find evidence not in that list
  const unprocessedEvidence = await dbReg.evidence.findMany({
    where: {
      id: {
        notIn: processedEvidenceIds.size > 0 ? Array.from(processedEvidenceIds) : ["__none__"],
      },
    },
    take: limit,
    orderBy: { fetchedAt: "asc" },
  })

  let processed = 0
  let failed = 0
  const allCandidateFactIds: string[] = []
  const errors: string[] = []

  for (let i = 0; i < unprocessedEvidence.length; i++) {
    const evidence = unprocessedEvidence[i]

    // Rate limiting: wait 5 seconds between API calls to avoid 429 errors
    if (i > 0) {
      console.log(`[extractor] Rate limiting: waiting 5s before next extraction...`)
      await new Promise((resolve) => setTimeout(resolve, 5000))
    }

    console.log(`[extractor] Processing ${i + 1}/${unprocessedEvidence.length}: ${evidence.url}`)

    // Use soft-fail wrapper to prevent single failures from blocking entire batch
    const softFailResult = await withSoftFail(() => runExtractor(evidence.id), null, {
      operation: "extractor_batch",
      entityType: "evidence",
      entityId: evidence.id,
      metadata: {
        url: evidence.url,
        batchIndex: i,
        batchSize: unprocessedEvidence.length,
      },
    })

    if (softFailResult.success && softFailResult.data?.success) {
      processed++
      allCandidateFactIds.push(...softFailResult.data.candidateFactIds)
      console.log(
        `[extractor] ✓ Extracted ${softFailResult.data.candidateFactIds.length} candidate facts`
      )
    } else {
      failed++
      const errorMsg = softFailResult.error || softFailResult.data?.error || "Unknown error"
      errors.push(`${evidence.id}: ${errorMsg}`)
      console.log(`[extractor] ✗ Failed: ${errorMsg.slice(0, 100)}`)
    }
  }

  return {
    processed,
    failed,
    sourcePointerIds: [], // PHASE-D: Always empty for backward compatibility
    candidateFactIds: allCandidateFactIds,
    errors,
  }
}
