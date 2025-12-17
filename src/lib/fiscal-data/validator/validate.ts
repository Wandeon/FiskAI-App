// src/lib/fiscal-data/validator/validate.ts

import type { ValidationResult, ValidationSource } from "../types"
import { getValueByPath } from "../utils/get-value"
import { getAllSources, getPrimarySources } from "./sources"
import {
  formatDataPointsForPrompt,
  getDataPointDescription,
  type DataPointDescription,
} from "./data-point-descriptions"

// Ollama Cloud configuration (matches project-wide pattern from ollama-client.ts)
const OLLAMA_ENDPOINT = process.env.OLLAMA_ENDPOINT || "https://ollama.com"
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.1"
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY

/**
 * Get headers for Ollama API requests, including auth if API key is set
 */
function getOllamaHeaders(): HeadersInit {
  const headers: HeadersInit = { "Content-Type": "application/json" }
  if (OLLAMA_API_KEY) {
    headers["Authorization"] = `Bearer ${OLLAMA_API_KEY}`
  }
  return headers
}

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
  // Build detailed descriptions for each data point
  const dataPointDescriptions = formatDataPointsForPrompt(dataPoints)

  // Create explicit list of exact IDs to return
  const idList = dataPoints.map((dp, i) => `"${dp}"`).join(", ")

  const prompt = `Izvuci fiskalne vrijednosti iz teksta. Za svaku traženu stavku vrati JSON s TOČNIM ID-em.

## TRAŽENE STAVKE (koristi TOČNO ove ID-eve)

${dataPointDescriptions}

## TEKST

${text.slice(0, 8000)}

## FORMAT ODGOVORA

Vrati JSON array s objektima za SVAKU traženu stavku:
{
  "values": [
    {"dataPoint": "CONTRIBUTIONS.rates.MIO_I.rate", "value": 0.15, "confidence": 1.0, "extractedText": "doprinos za MIO I. stup iznosi 15%"},
    {"dataPoint": "TAX_RATES.income.brackets.0.rate", "value": null, "confidence": 0, "extractedText": "nije pronađeno"}
  ]
}

PRAVILA:
1. dataPoint MORA biti TOČNO jedan od: ${idList}
2. value: decimalni broj (15% → 0.15) ili null ako nije pronađeno
3. confidence: 1.0 (pronađeno), 0.5 (nejasno), 0 (nije pronađeno)
4. Vrati objekt za SVAKU traženu stavku, čak i ako nije pronađena`

  try {
    const response = await fetch(`${OLLAMA_ENDPOINT}/api/chat`, {
      method: "POST",
      headers: getOllamaHeaders(),
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [{ role: "user", content: prompt }],
        stream: false,
        format: "json", // Request JSON format for more reliable parsing
        options: {
          temperature: 0.1, // Low temperature for factual extraction
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => "")
      throw new Error(
        `Ollama API error: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ""}`
      )
    }

    const data = await response.json()
    const content = data.message?.content || ""

    // Debug: log raw response in dry-run mode
    if (process.env.DEBUG_VALIDATOR === "true") {
      console.log("[validator] Raw LLM response:", content.slice(0, 500))
    }

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
