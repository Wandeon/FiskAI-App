// src/lib/regulatory-truth/agents/content-classifier.ts
import { db, dbReg } from "@/lib/db"
import { runAgent } from "./runner"
import {
  ContentClassificationSchema,
  type ContentClassification,
  type ClassificationContentType,
} from "../schemas/content-classifier"
import { z } from "zod"

const ClassifierInputSchema = z.object({
  evidenceId: z.string(),
  content: z.string(),
  url: z.string(),
  contentType: z.string(),
})

type ClassifierInput = z.infer<typeof ClassifierInputSchema>

export interface ClassificationResult {
  success: boolean
  classification: ContentClassification | null
  error: string | null
}

/**
 * Classify content to determine which extractors to run
 */
export async function classifyContent(evidenceId: string): Promise<ClassificationResult> {
  const evidence = await dbReg.evidence.findUnique({
    where: { id: evidenceId },
  })

  if (!evidence) {
    return {
      success: false,
      classification: null,
      error: `Evidence not found: ${evidenceId}`,
    }
  }

  const input: ClassifierInput = {
    evidenceId: evidence.id,
    content: evidence.rawContent.slice(0, 15000), // Limit for classification
    url: evidence.url,
    contentType: evidence.contentType,
  }

  const result = await runAgent<ClassifierInput, ContentClassification>({
    agentType: "CONTENT_CLASSIFIER",
    input,
    inputSchema: ClassifierInputSchema,
    outputSchema: ContentClassificationSchema,
    temperature: 0.1,
    evidenceId: evidence.id,
  })

  if (!result.success || !result.output) {
    return {
      success: false,
      classification: null,
      error: result.error ?? "Classification failed",
    }
  }

  return {
    success: true,
    classification: result.output,
    error: null,
  }
}

/**
 * Map content type to extractor functions
 */
export function getExtractorsForType(type: ClassificationContentType): string[] {
  const extractorMap: Record<ClassificationContentType, string[]> = {
    LOGIC: ["claim-extractor"],
    PROCESS: ["process-extractor"],
    REFERENCE: ["reference-extractor"],
    DOCUMENT: ["asset-extractor"],
    TRANSITIONAL: ["transitional-extractor"],
    MIXED: ["claim-extractor", "process-extractor", "reference-extractor", "asset-extractor"],
    UNKNOWN: ["claim-extractor"], // Default to claims
  }
  return extractorMap[type]
}
