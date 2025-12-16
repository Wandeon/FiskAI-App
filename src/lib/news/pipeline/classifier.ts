/**
 * AI Pipeline - Pass 1: Classification
 * Assesses news impact and suggests categorization
 */

import type { NewsItem } from "@/lib/db/schema/news"
import { callDeepSeekJSON } from "./deepseek-client"

export interface ClassificationResult {
  impact: "high" | "medium" | "low"
  reasoning: string
  suggestedCategory?: string
}

const CLASSIFICATION_PROMPT = `Ti si urednik FiskAI portala za hrvatske poduzetnike i računovođe.

Procijeni ovu vijest prema UTJECAJU na poslovanje:

VISOK UTJECAJ (individual post):
- Nova zakonska obveza
- Promjena porezne stope ili praga
- Novi rok za prijavu/plaćanje
- Značajna kazna ili kontrola
- Direktno utječe na svakodnevno poslovanje

SREDNJI UTJECAJ (digest):
- Informativno ali nije hitno
- Trendovi u industriji
- Najave budućih promjena
- Statistike i izvještaji

NIZAK UTJECAJ (skip):
- Nije relevantno za poduzetnike
- Previše općenito
- Zabava, sport, politika bez poslovnog konteksta

Vijest: {title}
{content}

Odgovori JSON: {"impact": "high|medium|low", "reasoning": "..."}`

/**
 * Classify a news item by impact level
 */
export async function classifyNewsItem(item: NewsItem): Promise<ClassificationResult> {
  const prompt = CLASSIFICATION_PROMPT.replace("{title}", item.originalTitle).replace(
    "{content}",
    item.originalContent || item.summaryHr || ""
  )

  try {
    const result = await callDeepSeekJSON<ClassificationResult>(prompt, {
      temperature: 0.3, // Lower temperature for more consistent classification
      maxTokens: 500,
    })

    // Validate response
    if (!["high", "medium", "low"].includes(result.impact)) {
      throw new Error(`Invalid impact level: ${result.impact}`)
    }

    if (!result.reasoning || result.reasoning.length < 10) {
      throw new Error("Classification reasoning too short or missing")
    }

    return result
  } catch (error) {
    console.error("Classification failed for item:", item.id, error)
    throw new Error(`Failed to classify news item: ${(error as Error).message}`)
  }
}

/**
 * Classify multiple news items in batch
 */
export async function classifyNewsItems(
  items: NewsItem[]
): Promise<Map<string, ClassificationResult>> {
  const results = new Map<string, ClassificationResult>()

  // Process items sequentially to avoid rate limits
  // Can be optimized later with concurrency control
  for (const item of items) {
    try {
      const classification = await classifyNewsItem(item)
      results.set(item.id, classification)
    } catch (error) {
      console.error(`Failed to classify item ${item.id}:`, error)
      // Continue with other items
    }
  }

  return results
}
