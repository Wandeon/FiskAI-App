// src/lib/regulatory-truth/agents/extractor.ts

import { db } from "@/lib/db"
import {
  ExtractorInputSchema,
  ExtractorOutputSchema,
  type ExtractorInput,
  type ExtractorOutput,
} from "../schemas"
import { runAgent } from "./runner"

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

  // Build input for agent
  const input: ExtractorInput = {
    evidenceId: evidence.id,
    content: evidence.rawContent,
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
        displayValue: extraction.display_value,
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
