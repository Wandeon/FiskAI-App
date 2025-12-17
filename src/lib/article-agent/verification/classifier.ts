// src/lib/article-agent/verification/classifier.ts

import { callOllamaJSON } from "../llm/ollama-client"
import { CLASSIFICATION_SYSTEM, CLASSIFICATION_PROMPT } from "../prompts/verification"
import type { SupportLevel } from "../types"

export interface ClassificationResult {
  relationship: SupportLevel
  confidence: number
  explanation: string
}

export async function classifySupport(
  paragraph: string,
  evidence: string
): Promise<ClassificationResult> {
  const prompt = CLASSIFICATION_PROMPT.replace("{paragraph}", paragraph).replace(
    "{evidence}",
    evidence
  )

  try {
    const result = await callOllamaJSON<ClassificationResult>(prompt, {
      systemPrompt: CLASSIFICATION_SYSTEM,
      temperature: 0.1,
    })

    // Validate and normalize
    const validRelationships: SupportLevel[] = [
      "SUPPORTED",
      "PARTIALLY_SUPPORTED",
      "NOT_SUPPORTED",
      "CONTRADICTED",
    ]

    if (!validRelationships.includes(result.relationship)) {
      result.relationship = "NOT_SUPPORTED"
    }

    result.confidence = Math.max(0, Math.min(1, result.confidence))

    return result
  } catch (error) {
    console.error("Classification failed:", error)
    return {
      relationship: "NOT_SUPPORTED",
      confidence: 0,
      explanation: "Klasifikacija nije uspjela",
    }
  }
}

export async function classifyParagraphAgainstChunks(
  paragraph: string,
  chunks: Array<{ id: string; content: string; similarity: number; claimIds: string[] }>
): Promise<
  Array<{
    chunkId: string
    classification: ClassificationResult
    similarity: number
    claimIds: string[]
  }>
> {
  const results = await Promise.all(
    chunks.map(async (chunk) => ({
      chunkId: chunk.id,
      classification: await classifySupport(paragraph, chunk.content),
      similarity: chunk.similarity,
      claimIds: chunk.claimIds,
    }))
  )

  return results
}
