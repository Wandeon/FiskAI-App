// src/lib/article-agent/extraction/claim-extractor.ts

import { callOllamaJSON } from "../llm/ollama-client"
import {
  CLAIM_EXTRACTION_SYSTEM,
  CLAIM_EXTRACTION_PROMPT,
  KEY_ENTITIES_PROMPT,
} from "../prompts/extraction"
import type { ClaimData, ClaimCategory, KeyEntities } from "../types"

interface ExtractedClaim {
  statement: string
  quote: string
  category: string
  confidence: number
}

export async function extractClaimsFromChunk(
  content: string,
  sourceUrl: string
): Promise<Omit<ClaimData, "id">[]> {
  const prompt = CLAIM_EXTRACTION_PROMPT.replace("{url}", sourceUrl).replace("{content}", content)

  try {
    const claims = await callOllamaJSON<ExtractedClaim[]>(prompt, {
      systemPrompt: CLAIM_EXTRACTION_SYSTEM,
      temperature: 0.2,
    })

    return claims.map((claim) => ({
      statement: claim.statement,
      quote: claim.quote || null,
      sourceUrl,
      category: normalizeCategory(claim.category),
      confidence: Math.max(0, Math.min(1, claim.confidence)),
    }))
  } catch (error) {
    console.error("Claim extraction failed for chunk:", error)
    return []
  }
}

function normalizeCategory(category: string): ClaimCategory {
  const normalized = category.toLowerCase().trim()
  const validCategories: ClaimCategory[] = [
    "deadline",
    "amount",
    "requirement",
    "entity",
    "general",
  ]

  if (validCategories.includes(normalized as ClaimCategory)) {
    return normalized as ClaimCategory
  }

  return "general"
}

export async function extractKeyEntities(
  claims: Array<{ statement: string }>
): Promise<KeyEntities> {
  const claimsText = claims.map((c) => `- ${c.statement}`).join("\n")
  const prompt = KEY_ENTITIES_PROMPT.replace("{claims}", claimsText)

  try {
    const entities = await callOllamaJSON<KeyEntities>(prompt, {
      temperature: 0.1,
    })

    return {
      names: entities.names || [],
      dates: entities.dates || [],
      amounts: entities.amounts || [],
      regulations: entities.regulations || [],
    }
  } catch (error) {
    console.error("Key entity extraction failed:", error)
    return { names: [], dates: [], amounts: [], regulations: [] }
  }
}
