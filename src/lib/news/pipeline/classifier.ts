/**
 * AI Pipeline - Pass 1: Classification
 * Assesses news impact and suggests categorization
 */

import type { NewsItem } from "@/lib/db/schema/news"
import { callDeepSeekJSON } from "./deepseek-client"

export interface ClassificationResult {
  impact: "high" | "medium" | "low"
  reasoning: string
  suggestedCategory: string // Required now
  suggestedSubcategory?: string
  keyDates?: string[] // Extract any dates/deadlines mentioned
  keyNumbers?: string[] // Extract any amounts/percentages mentioned
  suggestedTags?: string[] // Extract relevant topic tags
}

const CLASSIFICATION_PROMPT = `Ti si urednik FiskAI portala za hrvatske poduzetnike i računovođe.

## ZADATAK 1: PROCIJENI UTJECAJ

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

## ZADATAK 2: PREDLOŽI KATEGORIJU

Glavne kategorije:
- porezi (PDV, porez na dobit, porez na dohodak, doprinosi)
- propisi (zakoni, pravilnici, rokovi)
- poslovanje (financije, računovodstvo, upravljanje)

Potkategorije:
- porezi: pdv, porez-na-dobit, porez-na-dohodak, doprinosi
- propisi: zakoni, pravilnici, rokovi
- poslovanje: financije, racunovodstvo, upravljanje

## ZADATAK 3: IZVUCI KLJUČNE PODATKE

Pronađi i izvuci:
- Sve datume i rokove (npr. "1. siječnja 2025", "do kraja godine")
- Sve brojeve i iznose (npr. "20%", "10.000 EUR", "3 mjeseca")

## ZADATAK 4: GENERIRAJ OZNAKE (TAGS)

Izvuci 2-5 relevantnih tema/ključnih riječi iz vijesti. Oznake trebaju biti:
- Specifične (ne općenite)
- Korisne za pretraživanje i otkrivanje srodnog sadržaja
- Na hrvatskom jeziku
- Primjeri: "e-računi", "fiskalizacija", "paušalni-obrt", "PDV", "registar-ugovora"

## VIJEST ZA ANALIZU:
Naslov: {title}

{content}

Odgovori ISKLJUČIVO u JSON formatu:
{
  "impact": "high" | "medium" | "low",
  "reasoning": "kratko obrazloženje odluke",
  "suggestedCategory": "porezi" | "propisi" | "poslovanje",
  "suggestedSubcategory": "pdv" | "porez-na-dobit" | ... (ako je primjenjivo),
  "keyDates": ["datum1", "datum2"],
  "keyNumbers": ["broj1", "broj2"],
  "suggestedTags": ["oznaka1", "oznaka2", "oznaka3"]
}`

/**
 * Classify a news item by impact level and suggest category
 */
export async function classifyNewsItem(item: NewsItem): Promise<ClassificationResult> {
  const content = item.originalContent || item.summaryHr || ""
  const prompt = CLASSIFICATION_PROMPT.replace("{title}", item.originalTitle).replace(
    "{content}",
    content.substring(0, 3000) // Limit content length
  )

  try {
    const result = await callDeepSeekJSON<ClassificationResult>(prompt, {
      temperature: 0.3,
      maxTokens: 800,
    })

    // Validate impact
    if (!["high", "medium", "low"].includes(result.impact)) {
      throw new Error(`Invalid impact level: ${result.impact}`)
    }

    // Validate reasoning
    if (!result.reasoning || result.reasoning.length < 10) {
      throw new Error("Classification reasoning too short or missing")
    }

    // Default category if missing
    if (!result.suggestedCategory) {
      result.suggestedCategory = "poslovanje"
    }

    // Validate category
    const validCategories = ["porezi", "propisi", "poslovanje"]
    if (!validCategories.includes(result.suggestedCategory)) {
      result.suggestedCategory = "poslovanje"
    }

    // Ensure arrays exist
    if (!Array.isArray(result.keyDates)) {
      result.keyDates = []
    }
    if (!Array.isArray(result.keyNumbers)) {
      result.keyNumbers = []
    }
    if (!Array.isArray(result.suggestedTags)) {
      result.suggestedTags = []
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

  for (const item of items) {
    try {
      const classification = await classifyNewsItem(item)
      results.set(item.id, classification)
    } catch (error) {
      console.error(`Failed to classify item ${item.id}:`, error)
    }
  }

  return results
}
