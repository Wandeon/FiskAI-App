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

  // Clean content to remove navigation noise before passing to LLM
  const cleanedContent = cleanContent(evidence.rawContent, evidence.url)
  const stats = getCleaningStats(evidence.rawContent, cleanedContent)
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

  for (const extraction of result.output.extractions) {
    const pointer = await db.sourcePointer.create({
      data: {
        evidenceId: evidence.id,
        domain: extraction.domain,
        valueType: extraction.value_type,
        extractedValue: String(extraction.extracted_value),
        displayValue: extraction.display_value ?? String(extraction.extracted_value),
        exactQuote: extraction.exact_quote,
        contextBefore: extraction.context_before,
        contextAfter: extraction.context_after,
        selector: extraction.selector,
        confidence: extraction.confidence,
        extractionNotes: extraction.extraction_notes,
      },
    })
    sourcePointerIds.push(pointer.id)
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

    try {
      console.log(`[extractor] Processing ${i + 1}/${unprocessedEvidence.length}: ${evidence.url}`)
      const result = await runExtractor(evidence.id)
      if (result.success) {
        processed++
        allPointerIds.push(...result.sourcePointerIds)
        console.log(`[extractor] ✓ Extracted ${result.sourcePointerIds.length} pointers`)
      } else {
        failed++
        errors.push(`${evidence.id}: ${result.error}`)
        console.log(`[extractor] ✗ Failed: ${result.error?.slice(0, 100)}`)
      }
    } catch (error) {
      failed++
      errors.push(`${evidence.id}: ${error}`)
      console.log(`[extractor] ✗ Error: ${error}`)
    }
  }

  return { processed, failed, sourcePointerIds: allPointerIds, errors }
}
