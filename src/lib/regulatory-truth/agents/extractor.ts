// src/lib/regulatory-truth/agents/extractor.ts

import { db } from "@/lib/db"
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

// =============================================================================
// EXTRACTOR AGENT
// =============================================================================

export interface ExtractorResult {
  success: boolean
  output: ExtractorOutput | null
  sourcePointerIds: string[]
  error: string | null
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
function findInJsonObject(obj: any, value: string, path: string = ""): string | null {
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
export async function runExtractor(evidenceId: string): Promise<ExtractorResult> {
  // Get evidence from database
  const evidence = await db.evidence.findUnique({
    where: { id: evidenceId },
    include: { source: true },
  })

  if (!evidence) {
    return {
      success: false,
      output: null,
      sourcePointerIds: [],
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
  })

  if (!result.success || !result.output) {
    return {
      success: false,
      output: null,
      sourcePointerIds: [],
      error: result.error,
    }
  }

  // Store source pointers
  const sourcePointerIds: string[] = []
  const rejectedExtractions: Array<{ extraction: any; errors: string[] }> = []

  for (const extraction of result.output.extractions) {
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
    const validation = validateExtraction(extraction)

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

      await db.extractionRejected.create({
        data: {
          evidenceId: evidence.id,
          rejectionType,
          rawOutput: extraction as any,
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

    const pointer = await db.sourcePointer.create({
      data: {
        evidenceId: evidence.id,
        domain: extraction.domain,
        valueType: extraction.value_type,
        extractedValue: String(extraction.extracted_value),
        displayValue: extraction.display_value ?? String(extraction.extracted_value),
        exactQuote: normalizedQuote,
        contextBefore: normalizedContextBefore,
        contextAfter: normalizedContextAfter,
        selector: extraction.selector,
        // Article anchoring
        articleNumber: extraction.article_number,
        paragraphNumber: extraction.paragraph_number,
        lawReference: extraction.law_reference,
        confidence: extraction.confidence,
        extractionNotes: extraction.extraction_notes,
      },
    })
    sourcePointerIds.push(pointer.id)
  }

  // Log rejection stats
  if (rejectedExtractions.length > 0) {
    console.warn(
      `[extractor] Rejected ${rejectedExtractions.length}/${result.output.extractions.length} extractions`
    )
  }

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

  return {
    success: true,
    output: result.output,
    sourcePointerIds,
    error: null,
  }
}

/**
 * Run extractor on multiple unprocessed evidence records
 */
export async function runExtractorBatch(limit: number = 20): Promise<{
  processed: number
  failed: number
  sourcePointerIds: string[]
  errors: string[]
}> {
  // Find evidence without source pointers
  const unprocessedEvidence = await db.evidence.findMany({
    where: {
      sourcePointers: { none: {} },
    },
    take: limit,
    orderBy: { fetchedAt: "asc" },
  })

  let processed = 0
  let failed = 0
  const allPointerIds: string[] = []
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
      allPointerIds.push(...softFailResult.data.sourcePointerIds)
      console.log(`[extractor] ✓ Extracted ${softFailResult.data.sourcePointerIds.length} pointers`)
    } else {
      failed++
      const errorMsg = softFailResult.error || softFailResult.data?.error || "Unknown error"
      errors.push(`${evidence.id}: ${errorMsg}`)
      console.log(`[extractor] ✗ Failed: ${errorMsg.slice(0, 100)}`)
    }
  }

  return { processed, failed, sourcePointerIds: allPointerIds, errors }
}
