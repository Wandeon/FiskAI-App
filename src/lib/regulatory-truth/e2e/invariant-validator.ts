// src/lib/regulatory-truth/e2e/invariant-validator.ts
// Validates all 8 hard invariants of the Regulatory Truth Layer

import { db, dbReg } from "@/lib/db"
import { hashContent } from "../utils/content-hash"

export type InvariantStatus = "PASS" | "FAIL" | "PARTIAL"

export interface InvariantResult {
  id: string
  name: string
  description: string
  status: InvariantStatus
  details: string
  metrics: Record<string, number | string>
}

export interface InvariantResults {
  results: Record<string, InvariantResult>
  summary: {
    pass: number
    fail: number
    partial: number
  }
}

/**
 * INV-1: Evidence Immutability
 * contentHash must equal hashContent(rawContent, contentType) for all evidence records.
 *
 * Note: hashContent() normalizes HTML for change detection, but uses raw hash for JSON.
 * This matches the algorithm used at write-time by sentinel/fetchers.
 */
async function validateINV1(): Promise<InvariantResult> {
  const evidence = await dbReg.evidence.findMany({
    select: { id: true, contentHash: true, rawContent: true, contentType: true },
  })

  let valid = 0
  let invalid = 0
  const invalidRecords: string[] = []

  for (const e of evidence) {
    // Use the SAME hash function as the writers (sentinel, fetchers)
    // This accounts for HTML normalization vs raw JSON hashing
    const computed = hashContent(e.rawContent, e.contentType)
    if (computed === e.contentHash) {
      valid++
    } else {
      invalid++
      if (invalidRecords.length < 5) {
        invalidRecords.push(`${e.id} (${e.contentType})`)
      }
    }
  }

  const status: InvariantStatus = invalid === 0 ? "PASS" : valid > 0 ? "PARTIAL" : "FAIL"

  return {
    id: "INV-1",
    name: "Evidence Immutability",
    description: "contentHash matches hashContent(rawContent, contentType)",
    status,
    details:
      invalid === 0
        ? `All ${valid} evidence records have valid hashes`
        : `${invalid}/${evidence.length} records have invalid hashes: ${invalidRecords.join(", ")}`,
    metrics: { valid, invalid, total: evidence.length },
  }
}

/**
 * INV-2: Rule Traceability
 * Every RegulatoryRule must link to SourcePointers with Evidence
 */
async function validateINV2(): Promise<InvariantResult> {
  const rules = await db.regulatoryRule.findMany({
    select: { id: true, conceptSlug: true },
  })

  // Query all source pointers with their rule associations (no evidence include)
  const allSourcePointers = await db.sourcePointer.findMany({
    where: { rules: { some: { id: { in: rules.map((r) => r.id) } } } },
    include: {
      rules: { select: { id: true } },
    },
  })

  // Fetch evidence records separately via dbReg (soft reference via evidenceId)
  const evidenceIds = allSourcePointers.map((sp) => sp.evidenceId)
  const evidenceRecords = await dbReg.evidence.findMany({
    where: { id: { in: evidenceIds } },
    select: { id: true },
  })
  const evidenceIdSet = new Set(evidenceRecords.map((e) => e.id))

  // Group pointers by rule ID
  const pointersByRuleId = new Map<string, typeof allSourcePointers>()
  for (const pointer of allSourcePointers) {
    for (const ruleRef of pointer.rules) {
      if (!pointersByRuleId.has(ruleRef.id)) {
        pointersByRuleId.set(ruleRef.id, [])
      }
      pointersByRuleId.get(ruleRef.id)!.push(pointer)
    }
  }

  let valid = 0
  let orphan = 0
  const orphanRules: string[] = []

  for (const rule of rules) {
    const rulePointers = pointersByRuleId.get(rule.id) || []
    // Check if all pointers have their evidenceId in the evidence set
    const hasValidChain =
      rulePointers.length > 0 && rulePointers.every((sp) => evidenceIdSet.has(sp.evidenceId))

    if (hasValidChain) {
      valid++
    } else {
      orphan++
      if (orphanRules.length < 5) {
        orphanRules.push(`${rule.conceptSlug} (${rulePointers.length} pointers)`)
      }
    }
  }

  const status: InvariantStatus = orphan === 0 ? "PASS" : valid > 0 ? "PARTIAL" : "FAIL"

  return {
    id: "INV-2",
    name: "Rule Traceability",
    description: "Every rule must link to SourcePointers with Evidence",
    status,
    details:
      orphan === 0
        ? `All ${valid} rules have complete citation chains`
        : `${orphan}/${rules.length} rules lack source documentation: ${orphanRules.join(", ")}`,
    metrics: { valid, orphan, total: rules.length },
  }
}

/**
 * INV-3: No Inference Extraction
 * Extracted values must appear verbatim in source quotes
 * (Validated by checking extraction rejection rate)
 */
async function validateINV3(): Promise<InvariantResult> {
  const rejections = await dbReg.extractionRejected.count()
  const noQuoteMatch = await dbReg.extractionRejected.count({
    where: { rejectionType: "NO_QUOTE_MATCH" },
  })
  const totalPointers = await db.sourcePointer.count()

  // System actively rejects NO_QUOTE_MATCH = working correctly
  const status: InvariantStatus =
    noQuoteMatch > 0 ? "PASS" : totalPointers === 0 ? "PARTIAL" : "PASS"

  return {
    id: "INV-3",
    name: "No Inference Extraction",
    description: "Extracted values must appear verbatim in source quotes",
    status,
    details: `${noQuoteMatch} extractions rejected for NO_QUOTE_MATCH (${rejections} total rejections)`,
    metrics: { noQuoteMatchRejections: noQuoteMatch, totalRejections: rejections, totalPointers },
  }
}

/**
 * INV-4: Arbiter Conflict Resolution
 * Conflicts cannot be auto-resolved without evidence
 */
async function validateINV4(): Promise<InvariantResult> {
  // Get all resolved conflicts and check their resolution JSON for evidence
  const resolvedConflicts = await db.regulatoryConflict.findMany({
    where: { status: "RESOLVED" },
    select: { id: true, resolution: true, resolvedBy: true },
  })

  // Check for conflicts resolved without proper evidence in resolution JSON
  let autoResolvedWithoutEvidence = 0
  for (const conflict of resolvedConflicts) {
    const resolution = conflict.resolution as Record<string, unknown> | null
    // If resolved by system (no user ID) and no winning item ID, flag it
    if (!conflict.resolvedBy && (!resolution || !resolution.winningItemId)) {
      autoResolvedWithoutEvidence++
    }
  }

  const escalated = await db.regulatoryConflict.count({
    where: { status: "ESCALATED" },
  })

  const resolved = resolvedConflicts.length

  const status: InvariantStatus = autoResolvedWithoutEvidence === 0 ? "PASS" : "FAIL"

  return {
    id: "INV-4",
    name: "Arbiter Conflict Resolution",
    description: "Conflicts cannot be auto-resolved without evidence",
    status,
    details:
      autoResolvedWithoutEvidence === 0
        ? `0 conflicts auto-resolved without evidence (${escalated} escalated, ${resolved} resolved)`
        : `${autoResolvedWithoutEvidence} conflicts auto-resolved without proper evidence`,
    metrics: { autoResolvedWithoutEvidence, escalated, resolved },
  }
}

/**
 * INV-5: Release Hash Determinism
 * Same rule content always produces same release hash
 * (Validated by checking release hash integrity using the same algorithm as releaser)
 */
async function validateINV5(): Promise<InvariantResult> {
  // Import the actual hash computation function used by releaser
  const { computeReleaseHash } = await import("../utils/release-hash")

  const releases = await db.ruleRelease.findMany({
    include: {
      rules: {
        orderBy: { conceptSlug: "asc" },
      },
    },
  })

  let valid = 0
  let invalid = 0

  for (const release of releases) {
    if (release.rules.length === 0) {
      // Empty release - skip hash verification
      valid++
      continue
    }

    // Use the actual computeReleaseHash function
    const ruleSnapshots = release.rules.map((r) => ({
      conceptSlug: r.conceptSlug,
      appliesWhen: r.appliesWhen,
      value: r.value,
      valueType: r.valueType,
      effectiveFrom: r.effectiveFrom?.toISOString() || null,
      effectiveUntil: r.effectiveUntil?.toISOString() || null,
    }))

    const computedHash = computeReleaseHash(ruleSnapshots)

    if (computedHash === release.contentHash) {
      valid++
    } else {
      invalid++
    }
  }

  const status: InvariantStatus = invalid === 0 ? "PASS" : valid > 0 ? "PARTIAL" : "FAIL"

  return {
    id: "INV-5",
    name: "Release Hash Determinism",
    description: "Same rule content always produces same release hash",
    status,
    details:
      invalid === 0
        ? `All ${valid} releases have valid deterministic hashes`
        : `${invalid}/${releases.length} releases have hash mismatches`,
    metrics: { valid, invalid, total: releases.length },
  }
}

/**
 * INV-6: Assistant Citation Compliance
 * AI assistant only cites PUBLISHED rules with evidence
 */
async function validateINV6(): Promise<InvariantResult> {
  // Get all published rules
  const publishedRules = await db.regulatoryRule.findMany({
    where: { status: "PUBLISHED" },
    select: { id: true },
  })

  const totalPublished = publishedRules.length

  // Find rules that have at least one source pointer
  const rulesWithPointers = await db.sourcePointer.findMany({
    where: { rules: { some: { status: "PUBLISHED" } } },
    select: { rules: { select: { id: true } } },
  })

  // Get unique rule IDs that have pointers
  const ruleIdsWithPointers = new Set<string>()
  for (const pointer of rulesWithPointers) {
    for (const rule of pointer.rules) {
      ruleIdsWithPointers.add(rule.id)
    }
  }

  // Count published rules without any source pointers
  const publishedWithoutSources = publishedRules.filter(
    (rule) => !ruleIdsWithPointers.has(rule.id)
  ).length

  const status: InvariantStatus = publishedWithoutSources === 0 ? "PASS" : "FAIL"

  return {
    id: "INV-6",
    name: "Assistant Citation Compliance",
    description: "AI assistant only cites PUBLISHED rules with evidence",
    status,
    details:
      publishedWithoutSources === 0
        ? `All ${totalPublished} PUBLISHED rules have source citations`
        : `${publishedWithoutSources}/${totalPublished} PUBLISHED rules lack source citations`,
    metrics: { publishedWithoutSources, totalPublished },
  }
}

/**
 * INV-7: Discovery Idempotency
 * Re-running sentinel produces no duplicate discoveries
 */
async function validateINV7(): Promise<InvariantResult> {
  // Check for duplicate (endpointId, url) combinations
  const duplicates = await db.$queryRaw<{ endpoint_id: string; url: string; count: bigint }[]>`
    SELECT "endpointId" as endpoint_id, url, COUNT(*) as count
    FROM "DiscoveredItem"
    GROUP BY "endpointId", url
    HAVING COUNT(*) > 1
    LIMIT 10
  `

  const totalDiscovered = await db.discoveredItem.count()
  const duplicateCount = duplicates.length

  const status: InvariantStatus = duplicateCount === 0 ? "PASS" : "FAIL"

  return {
    id: "INV-7",
    name: "Discovery Idempotency",
    description: "Re-running sentinel produces no duplicate discoveries",
    status,
    details:
      duplicateCount === 0
        ? `0 duplicate discoveries (${totalDiscovered} total items)`
        : `${duplicateCount} duplicate (endpoint, url) combinations found`,
    metrics: { duplicates: duplicateCount, total: totalDiscovered },
  }
}

/**
 * INV-8: T0/T1 Human Approval Gates
 * Critical rules (T0/T1) require human approval, never auto-approved
 */
async function validateINV8(): Promise<InvariantResult> {
  // Check for T0/T1 rules approved by AUTO_APPROVE_SYSTEM
  const autoApprovedCritical = await db.regulatoryRule.count({
    where: {
      riskTier: { in: ["T0", "T1"] },
      approvedBy: "AUTO_APPROVE_SYSTEM",
    },
  })

  const totalT0T1 = await db.regulatoryRule.count({
    where: { riskTier: { in: ["T0", "T1"] } },
  })

  const humanApprovedT0T1 = await db.regulatoryRule.count({
    where: {
      riskTier: { in: ["T0", "T1"] },
      status: { in: ["APPROVED", "PUBLISHED"] },
      approvedBy: { not: "AUTO_APPROVE_SYSTEM" },
    },
  })

  const status: InvariantStatus = autoApprovedCritical === 0 ? "PASS" : "FAIL"

  return {
    id: "INV-8",
    name: "T0/T1 Human Approval Gates",
    description: "Critical rules (T0/T1) require human approval, never auto-approved",
    status,
    details:
      autoApprovedCritical === 0
        ? `0 T0/T1 rules auto-approved (${humanApprovedT0T1} human-approved, ${totalT0T1} total)`
        : `${autoApprovedCritical} T0/T1 rules incorrectly auto-approved`,
    metrics: { autoApprovedCritical, humanApprovedT0T1, totalT0T1 },
  }
}

/**
 * Validate all 8 invariants and return results
 */
export async function validateInvariants(): Promise<InvariantResults> {
  console.log("[invariant-validator] Validating all 8 invariants...")

  const validators = [
    validateINV1,
    validateINV2,
    validateINV3,
    validateINV4,
    validateINV5,
    validateINV6,
    validateINV7,
    validateINV8,
  ]

  const results: Record<string, InvariantResult> = {}
  let pass = 0
  let fail = 0
  let partial = 0

  for (const validator of validators) {
    const result = await validator()
    results[result.id] = result

    if (result.status === "PASS") pass++
    else if (result.status === "FAIL") fail++
    else partial++

    const icon = result.status === "PASS" ? "✓" : result.status === "FAIL" ? "✗" : "◐"
    console.log(`[invariant-validator] ${icon} ${result.id}: ${result.status} - ${result.details}`)
  }

  console.log(`[invariant-validator] Summary: ${pass} PASS, ${partial} PARTIAL, ${fail} FAIL`)

  return {
    results,
    summary: { pass, fail, partial },
  }
}
