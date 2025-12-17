// src/lib/fiscal-data/validator/validate.ts

import type { ValidationResult, ValidationSource } from "../types"
import { getValueByPath } from "../utils/get-value"
import { getAllSources, getPrimarySources } from "./sources"

// Ollama configuration
const OLLAMA_API_URL = process.env.OLLAMA_API_URL || "http://localhost:11434"
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.1"

/**
 * Fetch page content and convert to text
 */
async function fetchPageContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "FiskAI-Validator/1.0 (fiscal data validation)",
        Accept: "text/html,application/xhtml+xml,application/xml",
        "Accept-Language": "hr-HR,hr;q=0.9,en;q=0.8",
      },
      // Timeout after 30 seconds
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const html = await response.text()

    // Basic HTML to text conversion
    const text = html
      // Remove scripts and styles
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      // Remove HTML tags
      .replace(/<[^>]+>/g, " ")
      // Decode HTML entities
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num)))
      // Normalize whitespace
      .replace(/\s+/g, " ")
      .trim()

    return text
  } catch (error) {
    console.error(`[validator] Failed to fetch ${url}:`, error)
    throw error
  }
}

/**
 * Extract fiscal values from text using Ollama
 */
async function extractValuesWithOllama(
  text: string,
  dataPoints: string[]
): Promise<
  Array<{
    dataPoint: string
    value: number | string | null
    confidence: number
    extractedText: string
  }>
> {
  const prompt = `Analiziraj sljedeći tekst s hrvatske državne web stranice i izvuci fiskalne podatke.

Tražim sljedeće vrijednosti:
${dataPoints.map((dp) => `- ${dp}`).join("\n")}

TEKST:
${text.slice(0, 6000)}

Vrati ISKLJUČIVO JSON u ovom formatu (bez dodatnog teksta):
{
  "values": [
    {
      "dataPoint": "naziv točke podatka",
      "value": brojčana_vrijednost_ili_null,
      "confidence": 0.0_do_1.0,
      "extractedText": "relevantan tekst iz dokumenta"
    }
  ]
}

VAŽNO:
- Za postotke vrati decimalni broj (npr. 0.15 za 15%)
- Za novčane iznose vrati broj bez valute (npr. 60000 za 60.000 EUR)
- Ako vrijednost nije pronađena, vrati null za value i 0 za confidence
- extractedText treba sadržavati rečenicu iz koje je vrijednost izvučena`

  try {
    const response = await fetch(`${OLLAMA_API_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [{ role: "user", content: prompt }],
        stream: false,
        options: {
          temperature: 0.1, // Low temperature for factual extraction
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.message?.content || ""

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error("[validator] Could not parse Ollama response as JSON")
      return dataPoints.map((dp) => ({
        dataPoint: dp,
        value: null,
        confidence: 0,
        extractedText: "Failed to parse response",
      }))
    }

    const parsed = JSON.parse(jsonMatch[0])
    return parsed.values || []
  } catch (error) {
    console.error("[validator] Ollama extraction failed:", error)
    return dataPoints.map((dp) => ({
      dataPoint: dp,
      value: null,
      confidence: 0,
      extractedText: `Error: ${error}`,
    }))
  }
}

/**
 * Compare extracted values with current values
 */
function compareValues(
  extracted: Array<{
    dataPoint: string
    value: number | string | null
    confidence: number
    extractedText: string
  }>,
  sourceUrl: string
): ValidationResult[] {
  return extracted.map((ext) => {
    const currentValue = getValueByPath(ext.dataPoint)

    // Handle nested objects with .value property
    const currentNumeric =
      typeof currentValue === "object" && currentValue !== null && "value" in currentValue
        ? (currentValue as { value: number }).value
        : currentValue

    let status: ValidationResult["status"] = "uncertain"

    if (ext.value === null || ext.confidence < 0.5) {
      status = "uncertain"
    } else if (currentNumeric === ext.value) {
      status = "match"
    } else if (typeof currentNumeric === "number" && typeof ext.value === "number") {
      // Allow small floating point differences
      const diff = Math.abs(currentNumeric - ext.value)
      const percentDiff = diff / Math.max(currentNumeric, ext.value)
      status = percentDiff < 0.001 ? "match" : "mismatch"
    } else {
      status = "mismatch"
    }

    return {
      dataPoint: ext.dataPoint,
      currentValue: currentNumeric as number | string,
      foundValue: ext.value,
      status,
      confidence: ext.confidence,
      sourceUrl,
      extractedText: ext.extractedText,
      checkedAt: new Date().toISOString(),
    }
  })
}

/**
 * Validate a single source
 */
async function validateSource(source: ValidationSource): Promise<ValidationResult[]> {
  console.log(`[validator] Checking ${source.id}: ${source.url}`)

  try {
    const text = await fetchPageContent(source.url)
    const extracted = await extractValuesWithOllama(text, source.dataPoints)
    const results = compareValues(extracted, source.url)

    console.log(
      `[validator] ${source.id}: ${results.filter((r) => r.status === "match").length} matches, ${results.filter((r) => r.status === "mismatch").length} mismatches`
    )

    return results
  } catch (error) {
    console.error(`[validator] Failed to validate ${source.id}:`, error)

    return source.dataPoints.map((dp) => ({
      dataPoint: dp,
      currentValue: getValueByPath(dp) as number | string,
      foundValue: null,
      status: "error" as const,
      confidence: 0,
      sourceUrl: source.url,
      extractedText: `Error: ${error}`,
      checkedAt: new Date().toISOString(),
    }))
  }
}

/**
 * Run full validation across all sources
 */
export async function validateAllSources(primaryOnly: boolean = true): Promise<ValidationResult[]> {
  const sources = primaryOnly ? getPrimarySources() : getAllSources()
  const allResults: ValidationResult[] = []

  for (const source of sources) {
    const results = await validateSource(source)
    allResults.push(...results)

    // Small delay between requests to be respectful
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }

  return allResults
}

/**
 * Get validation summary
 */
export function getValidationSummary(results: ValidationResult[]) {
  return {
    total: results.length,
    matches: results.filter((r) => r.status === "match").length,
    mismatches: results.filter((r) => r.status === "mismatch").length,
    uncertain: results.filter((r) => r.status === "uncertain").length,
    errors: results.filter((r) => r.status === "error").length,
    highConfidenceMismatches: results.filter(
      (r) => r.status === "mismatch" && r.confidence >= 0.85
    ),
  }
}

/**
 * Filter results that should be included in PR
 */
export function getChangesForPR(results: ValidationResult[]): ValidationResult[] {
  return results.filter((r) => r.status === "mismatch" && r.confidence >= 0.8)
}
