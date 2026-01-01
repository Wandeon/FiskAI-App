// src/lib/assistant/query-engine/citation-builder.ts
import type { RuleCandidate } from "./rule-selector"
import type { CitationBlock, SourceCard, AuthorityLevel } from "@/lib/assistant/types"
import {
  checkEvidenceFreshness,
  formatFreshnessWarning,
  calculateFreshnessPenalty,
} from "@/lib/assistant/utils/evidence-freshness"

const MAX_SUPPORTING = 3

export function buildCitations(rules: RuleCandidate[]): CitationBlock | null {
  // Filter to rules that have source pointers
  const citableRules = rules.filter((r) => r.sourcePointers && r.sourcePointers.length > 0)

  if (citableRules.length === 0) return null

  const [primaryRule, ...supportingRules] = citableRules

  const primary = ruleToSourceCard(primaryRule)
  if (!primary) return null

  const supporting = supportingRules
    .slice(0, MAX_SUPPORTING)
    .map(ruleToSourceCard)
    .filter((s): s is SourceCard => s !== null)

  return { primary, supporting }
}

function ruleToSourceCard(rule: RuleCandidate): SourceCard | null {
  const pointer = rule.sourcePointers[0]
  if (!pointer) return null

  // Evidence provenance for fail-closed validation
  const evidence = pointer.evidence
  if (!evidence) return null

  const authority = rule.authorityLevel as AuthorityLevel

  // Check evidence freshness (GitHub issue #158)
  const freshnessCheck = checkEvidenceFreshness(
    evidence.fetchedAt,
    authority,
    (evidence as { hasChanged?: boolean }).hasChanged ?? false
  )

  // Apply freshness penalty to confidence
  const freshnessPenalty = calculateFreshnessPenalty(freshnessCheck)
  const adjustedConfidence = rule.confidence * freshnessPenalty

  // Format freshness warning if needed
  const freshnessWarning = formatFreshnessWarning(freshnessCheck)

  return {
    id: rule.id,
    title: rule.titleHr,
    authority,
    reference: pointer.lawReference || undefined,
    quote: pointer.exactQuote,
    url: evidence.url || "",
    effectiveFrom: rule.effectiveFrom.toISOString().split("T")[0],
    confidence: adjustedConfidence,
    // Evidence provenance (required for primary citations)
    evidenceId: evidence.id,
    fetchedAt: evidence.fetchedAt?.toISOString() || new Date().toISOString(),
    // Freshness metadata (GitHub issue #158)
    freshnessStatus: freshnessCheck.status,
    freshnessWarning: freshnessWarning || undefined,
    daysSinceFetch: freshnessCheck.daysSinceFetch,
  }
}
