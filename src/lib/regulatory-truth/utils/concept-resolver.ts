// src/lib/regulatory-truth/utils/concept-resolver.ts
// Canonical concept resolution to prevent duplicate rules

import { db } from "@/lib/db"

// =============================================================================
// KNOWN CANONICAL ALIASES
// =============================================================================

/**
 * Map of known alias patterns to canonical concept slugs.
 * These are based on actual duplicates found in the production database.
 * Exported for use by consolidator.
 */
export const CANONICAL_ALIASES: Record<string, string[]> = {
  // VAT standard rate (25%)
  "pdv-standardna-stopa": [
    "vat-standard-rate",
    "pdv-standard-rate",
    "standard-vat-rate",
    "vat-rate-standard",
  ],

  // VAT payment IBAN
  "pdv-drzavni-proracun-iban": [
    "vat-payment-iban",
    "hr-vat-payment-iban",
    "state-budget-iban-vat",
    "pdv-uplatni-racun-proracun",
    "pdv-uplatni-racun-proracuna",
    "vat-payment-account-iban",
  ],

  // Promotional gift threshold (22 EUR)
  "prag-promidzbenih-darova": [
    "promotional-gift-threshold",
    "representation-gift-threshold",
    "prag-darova-male-vrijednosti",
    "reprezentacija-mali-darovi-limit",
    "reprezentacija-dar-potrosacu-limit",
    "pdv-prag-darovi-potrosaci",
    "small-value-gift-threshold",
  ],

  // Document retention period
  "rok-cuvanja-dokumentacije": [
    "candidate-data-retention-period",
    "dokumentacija-natjecaj-rok-cuvanja",
    "procurement-documentation-retention-period",
  ],

  // Fiscalization 2.0 start date
  "fiskalizacija-2-0-datum": [
    "fiskalizacija-2-0-implementation-date",
    "fiskalizacija-2-0-start-date",
    "fiskalizacija-2-0-primjena",
    "regulation-application-date-2026",
  ],

  // Croatian VAT rates list
  "stope-pdv-hrvatska": [
    "croatian-vat-rates",
    "croatian-vat-rates-and-payment",
    "vat-rates-croatia",
    "vat-rates-hr",
  ],

  // e-Invoice KPD naming
  "eracun-kpd-uskladenost": [
    "eracun-kpd-item-naming-consistency",
    "eracun-kpd-naming-consistency",
    "eracun-kpd-item-naming-alignment",
    "eracun-kpd-naming-alignment",
  ],

  // Fixed conversion rate
  "fiksni-tecaj-konverzije-hrk-eur": [
    "fixed-conversion-rate-health-insurance",
    "eur-hrk-fixed-conversion-rate",
    "hrk-eur-conversion-rate",
  ],

  // Administrative fee for appeal decision
  "upravna-pristojba-zalba-rjesenje": ["administrative-fee-appeal-decision"],

  // Deadline date patterns (generic)
  "regulatory-deadline-2025-12-04": [
    "rok-podnosenja-prosinac-2025",
    "rok-podnosenja-2025-12-04",
    "zakonski-rok-2025-12-04",
    "rok-obveze-2025-12-04",
    "deadline-date-2025-12-04",
  ],

  // Standard work week hours (40)
  "standardni-radni-tjedan-zo": [
    "standard-working-week-health-insurance",
    "standard-work-week-hours",
  ],

  // Work experience requirements (5 years)
  "required-professional-experience-years": [
    "min-work-experience-requirement",
    "professional-experience-requirement",
  ],
}

// Invert the alias map for quick lookup
const ALIAS_TO_CANONICAL: Record<string, string> = {}
for (const [canonical, aliases] of Object.entries(CANONICAL_ALIASES)) {
  for (const alias of aliases) {
    ALIAS_TO_CANONICAL[alias] = canonical
  }
  // Also map canonical to itself
  ALIAS_TO_CANONICAL[canonical] = canonical
}

// =============================================================================
// BLOCKED DOMAINS (test data)
// =============================================================================

const BLOCKED_DOMAINS = ["heartbeat", "test", "synthetic", "debug"]

/**
 * Check if a domain should be blocked from rule creation
 */
export function isBlockedDomain(domain: string): boolean {
  return BLOCKED_DOMAINS.some(
    (blocked) => domain.toLowerCase() === blocked || domain.toLowerCase().includes(blocked)
  )
}

// =============================================================================
// TEXT NORMALIZATION
// =============================================================================

/**
 * Remove Croatian diacritics for comparison
 */
export function removeDiacritics(text: string): string {
  return text
    .replace(/č/g, "c")
    .replace(/ć/g, "c")
    .replace(/ž/g, "z")
    .replace(/š/g, "s")
    .replace(/đ/g, "d")
    .replace(/Č/g, "C")
    .replace(/Ć/g, "C")
    .replace(/Ž/g, "Z")
    .replace(/Š/g, "S")
    .replace(/Đ/g, "D")
}

/**
 * Normalize a concept slug for comparison
 */
export function normalizeSlug(slug: string): string {
  return removeDiacritics(slug.toLowerCase().trim())
}

// =============================================================================
// CONCEPT RESOLUTION
// =============================================================================

export interface ResolvedConcept {
  canonicalSlug: string
  existingConceptId: string | null
  existingRuleId: string | null
  shouldMerge: boolean
  mergeReason: string | null
}

/**
 * Resolve a concept slug to its canonical form.
 * Returns the canonical slug and whether an existing concept/rule was found.
 */
export async function resolveCanonicalConcept(
  proposedSlug: string,
  value: string,
  valueType: string,
  effectiveFrom: Date
): Promise<ResolvedConcept> {
  // Step 1: Check if this is a known alias
  const normalizedSlug = normalizeSlug(proposedSlug)
  let canonicalSlug = ALIAS_TO_CANONICAL[proposedSlug] || proposedSlug

  // Step 2: Check for existing concept with this canonical slug
  let existingConcept = await db.concept.findFirst({
    where: { slug: canonicalSlug },
  })

  // Step 3: If no concept found, try to find by normalized slug
  if (!existingConcept) {
    const allConcepts = await db.concept.findMany({
      select: { id: true, slug: true },
    })

    const matchingConcept = allConcepts.find(
      (c) =>
        normalizeSlug(c.slug) === normalizedSlug || ALIAS_TO_CANONICAL[c.slug] === canonicalSlug
    )

    if (matchingConcept) {
      existingConcept = await db.concept.findUnique({
        where: { id: matchingConcept.id },
      })
      canonicalSlug = matchingConcept.slug // Use existing slug as canonical
    }
  }

  // Step 4: Check for existing rule with same value + valueType + overlapping time
  const existingRule = await db.regulatoryRule.findFirst({
    where: {
      value: value,
      valueType: valueType,
      status: { in: ["PUBLISHED", "APPROVED", "PENDING_REVIEW", "DRAFT"] },
      OR: [
        // Open-ended rules (no effectiveUntil)
        { effectiveUntil: null },
        // Rules where new effectiveFrom falls within range
        {
          effectiveFrom: { lte: effectiveFrom },
          effectiveUntil: { gte: effectiveFrom },
        },
      ],
    },
    orderBy: { createdAt: "asc" }, // Prefer oldest rule
  })

  if (existingRule) {
    return {
      canonicalSlug: existingRule.conceptSlug,
      existingConceptId: existingRule.conceptId,
      existingRuleId: existingRule.id,
      shouldMerge: true,
      mergeReason: `Existing rule found with same value "${value}" (${valueType}) and overlapping time window`,
    }
  }

  return {
    canonicalSlug,
    existingConceptId: existingConcept?.id || null,
    existingRuleId: null,
    shouldMerge: false,
    mergeReason: null,
  }
}

/**
 * Add source pointers to an existing rule instead of creating a new one.
 * This merges evidence from multiple extractions into one authoritative rule.
 */
export async function mergePointersToExistingRule(
  existingRuleId: string,
  sourcePointerIds: string[]
): Promise<{ success: boolean; addedPointers: number }> {
  // Get existing pointer IDs
  const existingPointers = await db.regulatoryRule.findUnique({
    where: { id: existingRuleId },
    select: {
      sourcePointers: { select: { id: true } },
    },
  })

  const existingIds = new Set(existingPointers?.sourcePointers.map((p) => p.id) || [])
  const newIds = sourcePointerIds.filter((id) => !existingIds.has(id))

  if (newIds.length === 0) {
    return { success: true, addedPointers: 0 }
  }

  // Add new pointers to existing rule
  await db.regulatoryRule.update({
    where: { id: existingRuleId },
    data: {
      sourcePointers: {
        connect: newIds.map((id) => ({ id })),
      },
      composerNotes: {
        set: `[AUTO-MERGED] Added ${newIds.length} additional source pointers on ${new Date().toISOString()}`,
      },
    },
  })

  console.log(
    `[concept-resolver] Merged ${newIds.length} pointers to existing rule ${existingRuleId}`
  )

  return { success: true, addedPointers: newIds.length }
}

/**
 * Update concept aliases in the database
 */
export async function syncCanonicalAliases(): Promise<number> {
  let updated = 0

  for (const [canonicalSlug, aliases] of Object.entries(CANONICAL_ALIASES)) {
    // Find or create the canonical concept
    const concept = await db.concept.findFirst({
      where: { slug: canonicalSlug },
    })

    if (concept) {
      await db.concept.update({
        where: { id: concept.id },
        data: { aliases: aliases },
      })
      updated++
    }
  }

  return updated
}
