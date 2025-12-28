// src/lib/regulatory-truth/fetchers/hnb-fetcher.ts
// Tier 1 Structured Fetcher: HNB (Croatian National Bank) Exchange Rates
// API: https://api.hnb.hr/tecajn-eur/v3
// 100% reliable structured data - bypasses AI extraction entirely

import { db, runWithRegulatoryContext } from "@/lib/db"
import { hashContent } from "../utils/content-hash"
import { logAuditEvent } from "../utils/audit-log"

const HNB_API_BASE = "https://api.hnb.hr/tecajn-eur/v3"

export interface HNBExchangeRate {
  broj_tecajnice: string // Exchange list number
  datum_primjene: string // Application date (YYYY-MM-DD)
  drzava: string // Country name (Croatian)
  drzava_iso: string // Country ISO code
  valuta: string // Currency code
  sifra_valute: string // Currency numeric code
  kupovni_tecaj: string // Buying rate
  prodajni_tecaj: string // Selling rate
  srednji_tecaj: string // Middle rate
}

export interface HNBFetchResult {
  success: boolean
  date: string
  ratesCount: number
  rulesCreated: number
  error?: string
}

/**
 * Fetch exchange rates from HNB API for a specific date
 */
export async function fetchHNBRates(date: Date = new Date()): Promise<HNBExchangeRate[]> {
  const dateStr = date.toISOString().split("T")[0]
  const url = `${HNB_API_BASE}?datum-primjene=${dateStr}`

  console.log(`[hnb-fetcher] Fetching rates for ${dateStr}`)

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  })

  if (!response.ok) {
    throw new Error(`HNB API error: ${response.status} ${response.statusText}`)
  }

  const rates: HNBExchangeRate[] = await response.json()
  console.log(`[hnb-fetcher] Retrieved ${rates.length} exchange rates`)

  return rates
}

/**
 * Parse Croatian decimal format (1,234.56 -> 1234.56)
 */
function parseHRDecimal(value: string): number {
  return parseFloat(value.replace(",", "."))
}

/**
 * Create regulatory rules directly from HNB data
 * Bypasses AI extraction - 100% reliable structured data
 */
export async function createHNBRules(date: Date = new Date()): Promise<HNBFetchResult> {
  const dateStr = date.toISOString().split("T")[0]

  try {
    // Fetch rates
    const rates = await fetchHNBRates(date)

    if (rates.length === 0) {
      return {
        success: true,
        date: dateStr,
        ratesCount: 0,
        rulesCreated: 0,
        error: "No rates available for this date",
      }
    }

    // Find or create HNB source
    let source = await db.regulatorySource.findFirst({
      where: { slug: "hnb" },
    })

    if (!source) {
      source = await db.regulatorySource.create({
        data: {
          slug: "hnb",
          name: "Hrvatska narodna banka",
          url: "https://www.hnb.hr",
          hierarchy: 3, // Podzakonski akt
          isActive: true,
        },
      })
    }

    let rulesCreated = 0

    for (const rate of rates) {
      const conceptSlug = `exchange-rate-eur-${rate.valuta.toLowerCase()}`
      // CRITICAL: Hash and store the SAME bytes (compact JSON)
      // See: docs/07_AUDITS/runs/evidence-immutability-INV-001.md finding F-1
      const rawContent = JSON.stringify(rate)
      const contentHash = hashContent(rawContent, "application/json")

      // Check if we already have this exact data
      const existingEvidence = await db.evidence.findFirst({
        where: { contentHash },
      })

      if (existingEvidence) {
        console.log(`[hnb-fetcher] Skipping ${rate.valuta} - already exists`)
        continue
      }

      // Create Evidence record
      const evidence = await db.evidence.create({
        data: {
          sourceId: source.id,
          url: `${HNB_API_BASE}?datum-primjene=${dateStr}&valuta=${rate.valuta}`,
          rawContent, // Store exact bytes that were hashed
          contentHash,
          contentType: "json",
          hasChanged: false,
        },
      })

      // Create SourcePointer
      const sourcePointer = await db.sourcePointer.create({
        data: {
          evidenceId: evidence.id,
          domain: "exchange-rate",
          valueType: "decimal",
          extractedValue: rate.srednji_tecaj,
          displayValue: `${rate.srednji_tecaj} ${rate.valuta}/EUR`,
          exactQuote: `EUR/${rate.valuta} = ${rate.srednji_tecaj}`,
          confidence: 1.0, // Tier 1: 100% confidence
        },
      })

      // Find or create Concept
      const concept = await db.concept.upsert({
        where: { slug: conceptSlug },
        create: {
          slug: conceptSlug,
          nameHr: `Tečaj EUR/${rate.valuta}`,
          nameEn: `Exchange Rate EUR/${rate.valuta}`,
          description: `Official HNB exchange rate for ${rate.drzava} (${rate.valuta})`,
          tags: ["exchange-rate", "hnb", rate.valuta.toLowerCase()],
        },
        update: {},
      })

      // Create RegulatoryRule
      const effectiveDate = new Date(rate.datum_primjene)
      const nextDay = new Date(effectiveDate)
      nextDay.setDate(nextDay.getDate() + 1)

      const rule = await db.regulatoryRule.create({
        data: {
          conceptId: concept.id,
          conceptSlug,
          titleHr: `Tečaj EUR/${rate.valuta} za ${rate.datum_primjene}`,
          titleEn: `Exchange Rate EUR/${rate.valuta} for ${rate.datum_primjene}`,
          riskTier: "T0", // Lowest risk - official rates
          authorityLevel: "LAW", // Official central bank rates
          automationPolicy: "ALLOW", // Tier 1: auto-allow
          appliesWhen: JSON.stringify({
            and: [
              { eq: ["currency_from", "EUR"] },
              { eq: ["currency_to", rate.valuta] },
              { date_in_range: ["transaction_date", rate.datum_primjene, rate.datum_primjene] },
            ],
          }),
          value: String(parseHRDecimal(rate.srednji_tecaj)),
          valueType: "decimal",
          outcome: `Use middle rate ${rate.srednji_tecaj} for EUR/${rate.valuta} conversion`,
          explanationHr: `Službeni srednji tečaj HNB-a za ${rate.datum_primjene}. Kupovni: ${rate.kupovni_tecaj}, Prodajni: ${rate.prodajni_tecaj}`,
          explanationEn: `Official HNB middle rate for ${rate.datum_primjene}. Buying: ${rate.kupovni_tecaj}, Selling: ${rate.prodajni_tecaj}`,
          effectiveFrom: effectiveDate,
          effectiveUntil: nextDay, // Daily rates
          confidence: 1.0,
          // INVARIANT: Use APPROVED status, then publish via unified gate
          status: "APPROVED",
          approvedAt: new Date(),
          approvedBy: "AUTO_HNB_FETCHER",
          sourcePointers: {
            connect: [{ id: sourcePointer.id }],
          },
        },
      })

      // Use unified publish gate for Tier 0 auto-publishing
      // This ensures all publish paths are audited and validated
      // Must use regulatory context to allow APPROVED → PUBLISHED transition
      await runWithRegulatoryContext({ source: "hnb-fetcher", bypassApproval: false }, () =>
        db.regulatoryRule.update({
          where: { id: rule.id },
          data: { status: "PUBLISHED" },
        })
      )

      // Log audit event with full provenance
      await logAuditEvent({
        action: "RULE_AUTO_PUBLISHED",
        entityType: "RULE",
        entityId: rule.id,
        metadata: {
          source: "hnb-fetcher",
          tier: 0, // T0 = lowest risk
          currency: rate.valuta,
          date: dateStr,
          automatedCreation: true,
          bypassedHumanReview: true,
          reason: "Official HNB exchange rate - Tier 0 data",
        },
      })

      rulesCreated++
    }

    console.log(`[hnb-fetcher] Created ${rulesCreated} rules for ${dateStr}`)

    return {
      success: true,
      date: dateStr,
      ratesCount: rates.length,
      rulesCreated,
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error(`[hnb-fetcher] Error: ${errorMsg}`)
    return {
      success: false,
      date: dateStr,
      ratesCount: 0,
      rulesCreated: 0,
      error: errorMsg,
    }
  }
}

/**
 * Fetch historical rates for a date range
 */
export async function fetchHNBHistoricalRates(
  startDate: Date,
  endDate: Date
): Promise<{ total: number; created: number; errors: string[] }> {
  const results = { total: 0, created: 0, errors: [] as string[] }
  const current = new Date(startDate)

  while (current <= endDate) {
    try {
      const result = await createHNBRules(current)
      results.total += result.ratesCount
      results.created += result.rulesCreated
      if (result.error) {
        results.errors.push(`${current.toISOString().split("T")[0]}: ${result.error}`)
      }
    } catch (error) {
      results.errors.push(`${current.toISOString().split("T")[0]}: ${error}`)
    }

    // Move to next day
    current.setDate(current.getDate() + 1)

    // Rate limiting - 1 second between requests
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  return results
}
