// src/lib/regulatory-truth/agents/process-extractor.ts

import { db, dbReg } from "@/lib/db"
import { runAgent } from "./runner"
import { RegulatoryProcessSchema, type RegulatoryProcess } from "../schemas/process"
import { getExtractableContent } from "../utils/content-provider"
import { cleanContent } from "../utils/content-cleaner"
import { z } from "zod"

const ProcessExtractorInputSchema = z.object({
  evidenceId: z.string(),
  content: z.string(),
  url: z.string(),
})

const ProcessExtractorOutputSchema = z.object({
  processes: z.array(RegulatoryProcessSchema),
  extractionNotes: z.string().optional(),
})

type ProcessExtractorInput = z.infer<typeof ProcessExtractorInputSchema>
type ProcessExtractorOutput = z.infer<typeof ProcessExtractorOutputSchema>

export interface ProcessExtractionResult {
  success: boolean
  processes: RegulatoryProcess[]
  processIds: string[]
  error: string | null
}

/**
 * Extract regulatory processes from content with numbered steps
 */
export async function runProcessExtractor(evidenceId: string): Promise<ProcessExtractionResult> {
  const evidence = await dbReg.evidence.findUnique({
    where: { id: evidenceId },
  })

  if (!evidence) {
    return {
      success: false,
      processes: [],
      processIds: [],
      error: `Evidence not found: ${evidenceId}`,
    }
  }

  const { text: content } = await getExtractableContent(evidenceId)
  const cleanedContent = cleanContent(content, evidence.url)

  const input: ProcessExtractorInput = {
    evidenceId: evidence.id,
    content: cleanedContent.slice(0, 50000),
    url: evidence.url,
  }

  const result = await runAgent<ProcessExtractorInput, ProcessExtractorOutput>({
    agentType: "PROCESS_EXTRACTOR",
    input,
    inputSchema: ProcessExtractorInputSchema,
    outputSchema: ProcessExtractorOutputSchema,
    temperature: 0.1,
    evidenceId: evidence.id,
  })

  if (!result.success || !result.output) {
    return {
      success: false,
      processes: [],
      processIds: [],
      error: result.error ?? "Process extraction failed",
    }
  }

  const processIds: string[] = []

  for (const process of result.output.processes) {
    // Check if process already exists (upsert by slug)
    const existing = await db.regulatoryProcess.findUnique({
      where: { slug: process.slug },
    })

    if (existing) {
      console.log(`[process-extractor] Skipping existing process: ${process.slug}`)
      processIds.push(existing.id)
      continue
    }

    // Create process
    const dbProcess = await db.regulatoryProcess.create({
      data: {
        slug: process.slug,
        titleHr: process.titleHr,
        titleEn: process.titleEn,
        jurisdiction: process.jurisdiction,
        processType: process.processType,
        estimatedTime: process.estimatedTime,
        prerequisites: process.prerequisites as Record<string, unknown> | undefined,
        evidenceId: evidence.id,
      },
    })

    // Create steps
    for (const step of process.steps) {
      await db.processStep.create({
        data: {
          processId: dbProcess.id,
          orderNum: step.orderNum,
          actionHr: step.actionHr,
          actionEn: step.actionEn,
          requiresStepIds: step.requiresStepIds,
          requiresAssets: step.requiresAssets,
          onSuccessStepId: step.onSuccessStepId,
          onFailureStepId: step.onFailureStepId,
          failureAction: step.failureAction,
        },
      })
    }

    processIds.push(dbProcess.id)
  }

  console.log(`[process-extractor] Extracted ${processIds.length} processes from ${evidence.url}`)

  return {
    success: true,
    processes: result.output.processes,
    processIds,
    error: null,
  }
}
