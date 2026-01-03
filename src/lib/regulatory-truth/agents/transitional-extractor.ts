// src/lib/regulatory-truth/agents/transitional-extractor.ts

import { db, dbReg } from "@/lib/db"
import { runAgent } from "./runner"
import { TransitionalProvisionSchema, type TransitionalProvision } from "../schemas/transitional"
import { getExtractableContent } from "../utils/content-provider"
import { cleanContent } from "../utils/content-cleaner"
import { z } from "zod"

const TransitionalExtractorInputSchema = z.object({
  evidenceId: z.string(),
  content: z.string(),
  url: z.string(),
})

const TransitionalExtractorOutputSchema = z.object({
  provisions: z.array(TransitionalProvisionSchema),
  extractionNotes: z.string().optional(),
})

type TransitionalExtractorInput = z.infer<typeof TransitionalExtractorInputSchema>
type TransitionalExtractorOutput = z.infer<typeof TransitionalExtractorOutputSchema>

export interface TransitionalExtractionResult {
  success: boolean
  provisions: TransitionalProvision[]
  provisionIds: string[]
  error: string | null
}

/**
 * Extract transitional provisions (date-based rule changes) from content
 */
export async function runTransitionalExtractor(
  evidenceId: string
): Promise<TransitionalExtractionResult> {
  const evidence = await dbReg.evidence.findUnique({
    where: { id: evidenceId },
  })

  if (!evidence) {
    return {
      success: false,
      provisions: [],
      provisionIds: [],
      error: `Evidence not found: ${evidenceId}`,
    }
  }

  const { text: content } = await getExtractableContent(evidenceId)
  const cleanedContent = cleanContent(content, evidence.url)

  const input: TransitionalExtractorInput = {
    evidenceId: evidence.id,
    content: cleanedContent.slice(0, 50000),
    url: evidence.url,
  }

  const result = await runAgent<TransitionalExtractorInput, TransitionalExtractorOutput>({
    agentType: "TRANSITIONAL_EXTRACTOR",
    input,
    inputSchema: TransitionalExtractorInputSchema,
    outputSchema: TransitionalExtractorOutputSchema,
    temperature: 0.1,
    evidenceId: evidence.id,
  })

  if (!result.success || !result.output) {
    return {
      success: false,
      provisions: [],
      provisionIds: [],
      error: result.error ?? "Transitional extraction failed",
    }
  }

  const provisionIds: string[] = []

  for (const provision of result.output.provisions) {
    // Create transitional provision with DateTime conversion for cutoffDate
    const dbProvision = await db.transitionalProvision.create({
      data: {
        fromRule: provision.fromRule,
        toRule: provision.toRule,
        cutoffDate: new Date(provision.cutoffDate),
        logicExpr: provision.logicExpr,
        appliesRule: provision.appliesRule,
        explanationHr: provision.explanationHr,
        explanationEn: provision.explanationEn,
        pattern: provision.pattern,
        sourceArticle: provision.sourceArticle,
        evidenceId: evidence.id,
      },
    })

    provisionIds.push(dbProvision.id)
  }

  console.log(
    `[transitional-extractor] Extracted ${provisionIds.length} provisions from ${evidence.url}`
  )

  return {
    success: true,
    provisions: result.output.provisions,
    provisionIds,
    error: null,
  }
}
