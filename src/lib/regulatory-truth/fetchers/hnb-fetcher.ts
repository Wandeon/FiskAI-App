// src/lib/regulatory-truth/fetchers/hnb-fetcher.ts
// Tier 1 Structured Fetcher: HNB (Croatian National Bank) Exchange Rates
// API: https://api.hnb.hr/tecajn-eur/v3
// 100% reliable structured data - bypasses AI extraction entirely
//
// LIFECYCLE INVARIANT:
// Fetchers create DRAFT rules only. Approval and publication happen
// through the pipeline stage, which calls the domain service.
// This ensures all status transitions go through the same choke point.

import { db, dbReg } from "@/lib/db"
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
  /** Rule IDs created - for pipeline processing */
  ruleIds: string[]
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
 * Create regulatory rules as DRAFT from HNB data.
 *
 * LIFECYCLE: This function creates DRAFT rules only.
 * Approval and publication must go through the pipeline stage.
 *
 * Returns rule IDs for downstream processing.
 */
export async function createHNBRules(date: Date = new Date()): Promise<HNBFetchResult> {
  const dateStr = date.toISOString().split("T")[0]
  const ruleIds: string[] = []

  try {
    // Fetch rates
    const rates = await fetchHNBRates(date)

    if (rates.length === 0) {
      return {
        success: true,
        date: dateStr,
        ratesCount: 0,
        rulesCreated: 0,
        ruleIds: [],
        error: "No rates available for this date",
      }
    }

    // Find or create HNB source
    let source = await dbReg.regulatorySource.findFirst({
      where: { slug: "hnb" },
    })

    if (!source) {
      source = await dbReg.regulatorySource.create({
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
      const existingEvidence = await dbReg.evidence.findFirst({
        where: { contentHash },
      })

      if (existingEvidence) {
        console.log(`[hnb-fetcher] Skipping ${rate.valuta} - already exists`)
        continue
      }

      // Create Evidence record
      const evidence = await dbReg.evidence.create({
        data: {
          sourceId: source.id,
          url: `${HNB_API_BASE}?datum-primjene=${dateStr}&valuta=${rate.valuta}`,
          rawContent, // Store exact bytes that were hashed
          contentHash,
          contentType: "json",
          hasChanged: false,
        },
      })

      // Create SourcePointer with exact quote from structured data
      // IMPORTANT: exactQuote MUST exist verbatim in rawContent for provenance validation
      // For JSON evidence, we quote the actual JSON key-value pair
      const exactQuote = `"srednji_tecaj":"${rate.srednji_tecaj}"`
      const quoteStart = rawContent.indexOf(exactQuote)
      const quoteEnd = quoteStart !== -1 ? quoteStart + exactQuote.length : undefined

      // SKIP: Exchange rates are not part of the core tax domains (pausalni, pdv, etc.)
      // They should be handled through a dedicated exchange rate service, not the RTL pipeline
      // This prevents domain leakage into the regulatory database
      console.log(
        `[hnb-fetcher] Skipping SourcePointer creation for ${rate.valuta} - exchange rates not in DomainSchema`
      )

      // Note: We still create the Evidence and RegulatoryRule, but skip SourcePointer
      // to prevent non-standard domain leakage. The rule can reference the evidence directly.

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

      // Create RegulatoryRule as DRAFT
      // LIFECYCLE INVARIANT: Fetchers create DRAFT only
      const effectiveDate = new Date(rate.datum_primjene)
      const nextDay = new Date(effectiveDate)
      nextDay.setDate(nextDay.getDate() + 1)

      const rule = await db.regulatoryRule.create({
        data: {
          conceptId: concept.id,
          conceptSlug,
          titleHr: `Tečaj EUR/${rate.valuta} za ${rate.datum_primjene}`,
          titleEn: `Exchange Rate EUR/${rate.valuta} for ${rate.datum_primjene}`,
          // T3: Low risk - reference values used for currency conversion
          // NOT T0/T1 - exchange rates are not critical tax rates or legal deadlines
          riskTier: "T3",
          // PROCEDURE: Reference data from central bank, not binding law
          authorityLevel: "PROCEDURE",
          automationPolicy: "ALLOW", // Eligible for auto-approval via pipeline
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
          // DRAFT status - pipeline will approve and publish
          status: "DRAFT",
          // Note: No sourcePointers connected since we skip creating them for exchange rates
        },
      })

      // Log audit event for rule creation
      await logAuditEvent({
        action: "RULE_CREATED",
        entityType: "RULE",
        entityId: rule.id,
        metadata: {
          source: "hnb-fetcher",
          tier: "T0",
          currency: rate.valuta,
          date: dateStr,
          status: "DRAFT",
          awaitingPipeline: true,
        },
      })

      ruleIds.push(rule.id)
      rulesCreated++
    }

    console.log(`[hnb-fetcher] Created ${rulesCreated} DRAFT rules for ${dateStr}`)

    return {
      success: true,
      date: dateStr,
      ratesCount: rates.length,
      rulesCreated,
      ruleIds,
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error(`[hnb-fetcher] Error: ${errorMsg}`)
    return {
      success: false,
      date: dateStr,
      ratesCount: 0,
      rulesCreated: 0,
      ruleIds: [],
      error: errorMsg,
    }
  }
}

/**
 * Fetch historical rates for a date range.
 * Returns all created rule IDs for pipeline processing.
 */
export async function fetchHNBHistoricalRates(
  startDate: Date,
  endDate: Date
): Promise<{ total: number; created: number; ruleIds: string[]; errors: string[] }> {
  const results = { total: 0, created: 0, ruleIds: [] as string[], errors: [] as string[] }
  const current = new Date(startDate)

  while (current <= endDate) {
    try {
      const result = await createHNBRules(current)
      results.total += result.ratesCount
      results.created += result.rulesCreated
      results.ruleIds.push(...result.ruleIds)
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
