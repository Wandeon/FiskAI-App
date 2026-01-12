// src/lib/regulatory-truth/agents/releaser.ts

import { db, runWithRegulatoryContext } from "@/lib/db"
import { Prisma } from "@prisma/client"
import {
  ReleaserInputSchema,
  ReleaserOutputSchema,
  type ReleaserInput,
  type ReleaserOutput,
} from "../schemas"
import { runAgent } from "./runner"
import { logAuditEvent } from "../utils/audit-log"
import { computeReleaseHash, normalizeDate, type RuleSnapshot } from "../utils/release-hash"
import { checkBatchEvidenceStrength } from "../utils/evidence-strength"
import { publishRules } from "../services/rule-status-service"
import { emitContentSyncEvent, mapRtlDomainToContentDomain } from "../content-sync"
import { getConceptMapping } from "../content-sync/concept-registry"
import type { RiskTier } from "../schemas/common"
import { verifyEvidenceIntegrity } from "../utils/content-hash"
import { findQuoteInEvidence, isMatchTypeAcceptableForTier } from "../utils/quote-in-evidence"

// =============================================================================
// RELEASER AGENT
// =============================================================================

export interface ReleaserResult {
  success: boolean
  output: ReleaserOutput | null
  releaseId: string | null
  publishedRuleIds: string[]
  error: string | null
}

// =============================================================================
// ROLLBACK TYPES
// =============================================================================

export interface RollbackResult {
  success: boolean
  rolledBackRuleIds: string[]
  targetVersion: string | null
  previousStatus: Map<string, string>
  error: string | null
}

export interface RollbackValidation {
  canRollback: boolean
  targetRelease: {
    id: string
    version: string
    releasedAt: Date
    ruleCount: number
  } | null
  previousRelease: {
    id: string
    version: string
    ruleCount: number
  } | null
  warnings: string[]
  errors: string[]
}

// =============================================================================
// EVIDENCE CHAIN VERIFICATION
// =============================================================================

export interface EvidenceChainError {
  ruleId: string
  conceptSlug: string
  pointerId: string
  evidenceId: string
  errorType: "orphaned_pointer" | "hash_mismatch" | "quote_not_found" | "quote_match_unacceptable"
  message: string
}

export interface EvidenceChainVerificationResult {
  valid: boolean
  errors: EvidenceChainError[]
}

/**
 * Verify the complete evidence chain integrity for a set of rules.
 *
 * Checks performed for each rule:
 * 1. All source pointers reference existing Evidence records (no orphaned pointers)
 * 2. Evidence.rawContent hash matches stored contentHash (no tampering)
 * 3. SourcePointer.exactQuote exists in Evidence.rawContent (quote provenance)
 * 4. Quote match type is acceptable for the rule's risk tier
 *
 * This is a HARD GATE for publication. Rules with broken evidence chains
 * cannot be published as they would compromise audit trail integrity.
 */
export function verifyEvidenceChain(
  rules: Array<{
    id: string
    conceptSlug: string
    riskTier: string
    sourcePointers: Array<{
      id: string
      evidenceId: string
      exactQuote: string
      evidence: {
        id: string
        rawContent: string
        contentHash: string
        contentType?: string | null
      } | null
    }>
  }>
): EvidenceChainVerificationResult {
  const errors: EvidenceChainError[] = []

  for (const rule of rules) {
    for (const pointer of rule.sourcePointers) {
      if (!pointer.evidence) {
        errors.push({
          ruleId: rule.id,
          conceptSlug: rule.conceptSlug,
          pointerId: pointer.id,
          evidenceId: pointer.evidenceId,
          errorType: "orphaned_pointer",
          message:
            "Orphaned pointer: " +
            pointer.id +
            " references missing evidence " +
            pointer.evidenceId,
        })
        continue
      }

      const integrityCheck = verifyEvidenceIntegrity({
        id: pointer.evidence.id,
        rawContent: pointer.evidence.rawContent,
        contentHash: pointer.evidence.contentHash,
        contentType: pointer.evidence.contentType ?? undefined,
      })

      if (!integrityCheck.valid) {
        errors.push({
          ruleId: rule.id,
          conceptSlug: rule.conceptSlug,
          pointerId: pointer.id,
          evidenceId: pointer.evidenceId,
          errorType: "hash_mismatch",
          message:
            "Evidence " +
            pointer.evidenceId +
            " content hash mismatch - possible corruption. " +
            "Expected: " +
            integrityCheck.expectedHash.slice(0, 16) +
            "..., " +
            "Got: " +
            integrityCheck.actualHash.slice(0, 16) +
            "...",
        })
        continue
      }

      const quoteMatch = findQuoteInEvidence(
        pointer.evidence.rawContent,
        pointer.exactQuote,
        pointer.evidence.contentHash
      )

      if (!quoteMatch.found) {
        errors.push({
          ruleId: rule.id,
          conceptSlug: rule.conceptSlug,
          pointerId: pointer.id,
          evidenceId: pointer.evidenceId,
          errorType: "quote_not_found",
          message:
            "Quote not found in evidence " +
            pointer.evidenceId +
            ". " +
            'Quote preview: "' +
            pointer.exactQuote.slice(0, 60) +
            '..."',
        })
        continue
      }

      const matchAcceptable = isMatchTypeAcceptableForTier(quoteMatch.matchType, rule.riskTier)

      if (!matchAcceptable.acceptable) {
        errors.push({
          ruleId: rule.id,
          conceptSlug: rule.conceptSlug,
          pointerId: pointer.id,
          evidenceId: pointer.evidenceId,
          errorType: "quote_match_unacceptable",
          message:
            'Quote match type "' +
            quoteMatch.matchType +
            '" not acceptable for ' +
            rule.riskTier +
            " rule. " +
            matchAcceptable.reason,
        })
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Calculate semver version based on previous version and rule risk tiers.
 *
 * Release type is determined by the HIGHEST risk tier in the batch:
 * - T0 (critical) → major release (e.g., 1.0.0 → 2.0.0)
 * - T1 (high)     → minor release (e.g., 1.0.0 → 1.1.0)
 * - T2/T3 (low)   → patch release (e.g., 1.0.0 → 1.0.1)
 */
function calculateNextVersion(
  previousVersion: string | null,
  riskTiers: string[]
): { version: string; releaseType: "major" | "minor" | "patch" } {
  const [major, minor, patch] = previousVersion ? previousVersion.split(".").map(Number) : [0, 0, 0]

  // T0 rules (critical) → major version bump
  if (riskTiers.includes("T0")) {
    return {
      version: `${major + 1}.0.0`,
      releaseType: "major",
    }
  }

  // T1 rules (high) → minor version bump
  if (riskTiers.includes("T1")) {
    return {
      version: `${major}.${minor + 1}.0`,
      releaseType: "minor",
    }
  }

  // T2/T3 rules (low) → patch version bump
  return {
    version: `${major}.${minor}.${patch + 1}`,
    releaseType: "patch",
  }
}

/**

  // HARD GATE: Evidence chain integrity
  // Verify all source pointers reference valid, unmodified evidence
  // and that quoted text exists in the evidence content
  const evidenceChainCheck = verifyEvidenceChain(
    rules.map((r) => ({
      id: r.id,
      conceptSlug: r.conceptSlug,
      riskTier: r.riskTier,
      sourcePointers: r.sourcePointers.map((sp) => ({
        id: sp.id,
        evidenceId: sp.evidenceId,
        exactQuote: sp.exactQuote,
        evidence: sp.evidence
          ? {
              id: sp.evidence.id,
              rawContent: sp.evidence.rawContent,
              contentHash: sp.evidence.contentHash,
              contentType: sp.evidence.contentType,
            }
          : null,
      })),
    }))
  )

  if (!evidenceChainCheck.valid) {
    // Group errors by type for clearer logging
    const errorsByType = evidenceChainCheck.errors.reduce(
      (acc, err) => {
        acc[err.errorType] = (acc[err.errorType] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    console.error(
      "[releaser] BLOCKED: Evidence chain verification failed:",
      evidenceChainCheck.errors.length + " error(s) -",
      Object.entries(errorsByType)
        .map(([type, count]) => type + ": " + count)
        .join(", ")
    )

    // Log detailed errors
    for (const err of evidenceChainCheck.errors) {
      console.error("[releaser]   - " + err.conceptSlug + ": " + err.message)
    }

    return {
      success: false,
      output: null,
      releaseId: null,
      publishedRuleIds: [],
      error:
        "Cannot release: evidence chain verification failed with " + evidenceChainCheck.errors.length + " error(s). " +
        evidenceChainCheck.errors
          .slice(0, 3)
          .map((e) => e.conceptSlug + ": " + e.errorType)
          .join("; ") +
        (evidenceChainCheck.errors.length > 3
          ? " (and " + (evidenceChainCheck.errors.length - 3) + " more)"
          : ""),
    }
  }
 * Run the Releaser agent to create versioned release bundles
 */
export async function runReleaser(approvedRuleIds: string[]): Promise<ReleaserResult> {
  if (approvedRuleIds.length === 0) {
    return {
      success: false,
      output: null,
      releaseId: null,
      publishedRuleIds: [],
      error: "No approved rules provided",
    }
  }

  // Get approved rules from database
  const rules = await db.regulatoryRule.findMany({
    where: {
      id: { in: approvedRuleIds },
      status: "APPROVED",
    },
  })

  // Query source pointers separately (many-to-many relation, no evidence include)
  const allSourcePointers = await db.sourcePointer.findMany({
    where: { rules: { some: { id: { in: approvedRuleIds } } } },
    include: {
      rules: { select: { id: true } },
    },
  })

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

  // Create enriched rules with source pointers
  const rulesWithPointers = rules.map((rule) => ({
    ...rule,
    sourcePointers: pointersByRuleId.get(rule.id) || [],
  }))

  if (rules.length === 0) {
    return {
      success: false,
      output: null,
      releaseId: null,
      publishedRuleIds: [],
      error: `No approved rules found for the provided IDs`,
    }
  }

  if (rules.length !== approvedRuleIds.length) {
    const foundIds = rules.map((r) => r.id)
    const missingIds = approvedRuleIds.filter((id) => !foundIds.includes(id))
    return {
      success: false,
      output: null,
      releaseId: null,
      publishedRuleIds: [],
      error: `Some rules not found or not approved: ${missingIds.join(", ")}`,
    }
  }

  // HARD GATE: T0/T1 rules MUST have approvedBy set
  const unapprovedCritical = rules.filter(
    (r) => (r.riskTier === "T0" || r.riskTier === "T1") && !r.approvedBy
  )

  if (unapprovedCritical.length > 0) {
    console.error(
      `[releaser] BLOCKED: ${unapprovedCritical.length} T0/T1 rules without approval:`,
      unapprovedCritical.map((r) => r.conceptSlug)
    )
    return {
      success: false,
      output: null,
      releaseId: null,
      publishedRuleIds: [],
      error: `Cannot release ${unapprovedCritical.length} T0/T1 rules without approvedBy: ${unapprovedCritical.map((r) => r.conceptSlug).join(", ")}`,
    }
  }

  // HARD GATE: No unresolved conflicts allowed
  const rulesWithConflicts = await db.regulatoryRule.findMany({
    where: {
      id: { in: approvedRuleIds },
      OR: [
        { conflictsA: { some: { status: "OPEN" } } },
        { conflictsB: { some: { status: "OPEN" } } },
      ],
    },
    select: { id: true, conceptSlug: true },
  })

  if (rulesWithConflicts.length > 0) {
    console.error(
      `[releaser] BLOCKED: ${rulesWithConflicts.length} rules have unresolved conflicts:`,
      rulesWithConflicts.map((r) => r.conceptSlug)
    )
    return {
      success: false,
      output: null,
      releaseId: null,
      publishedRuleIds: [],
      error: `Cannot release ${rulesWithConflicts.length} rules with unresolved conflicts: ${rulesWithConflicts.map((r) => r.conceptSlug).join(", ")}`,
    }
  }

  // HARD GATE: All rules must have source pointers
  const rulesWithoutPointers = rulesWithPointers.filter((r) => r.sourcePointers.length === 0)

  if (rulesWithoutPointers.length > 0) {
    console.error(
      `[releaser] BLOCKED: ${rulesWithoutPointers.length} rules have no source pointers:`,
      rulesWithoutPointers.map((r) => r.conceptSlug)
    )
    return {
      success: false,
      output: null,
      releaseId: null,
      publishedRuleIds: [],
      error: `Cannot release ${rulesWithoutPointers.length} rules without source pointers: ${rulesWithoutPointers.map((r) => r.conceptSlug).join(", ")}`,
    }
  }

  // HARD GATE: Evidence strength policy
  // SINGLE_SOURCE rules require LAW authority to publish
  // MULTI_SOURCE rules can publish regardless of authority
  const evidenceCheck = await checkBatchEvidenceStrength(approvedRuleIds)

  if (!evidenceCheck.canPublishAll) {
    console.error(
      `[releaser] BLOCKED: ${evidenceCheck.blockedRules.length} rules failed evidence strength policy:`,
      evidenceCheck.blockedRules.map((r) => `${r.conceptSlug}: ${r.reason}`)
    )
    return {
      success: false,
      output: null,
      releaseId: null,
      publishedRuleIds: [],
      error: `Cannot release ${evidenceCheck.blockedRules.length} rules due to evidence strength policy: ${evidenceCheck.blockedRules.map((r) => `${r.conceptSlug} (${r.reason})`).join("; ")}`,
    }
  }

  // Get the latest release version
  const latestRelease = await db.ruleRelease.findFirst({
    orderBy: { releasedAt: "desc" },
    select: { version: true },
  })

  const previousVersion = latestRelease?.version || null

  // Build input for agent
  const input: ReleaserInput = {
    approvedRuleIds,
    previousVersion,
  }

  // Run the agent
  const result = await runAgent<ReleaserInput, ReleaserOutput>({
    agentType: "RELEASER",
    input,
    inputSchema: ReleaserInputSchema,
    outputSchema: ReleaserOutputSchema,
    temperature: 0.1,
  })

  if (!result.success || !result.output) {
    return {
      success: false,
      output: null,
      releaseId: null,
      publishedRuleIds: [],
      error: result.error,
    }
  }

  const releaseOutput = result.output.release

  // Validate the version number matches expected semver progression
  const riskTiers = rules.map((r) => r.riskTier)
  const { version: expectedVersion, releaseType: expectedReleaseType } = calculateNextVersion(
    previousVersion,
    riskTiers
  )

  // ALWAYS use calculated release type based on highest risk tier
  // This ensures consistency regardless of LLM output
  const finalReleaseType = expectedReleaseType

  // Validate LLM output matches expected release type
  if (releaseOutput.release_type && releaseOutput.release_type !== expectedReleaseType) {
    console.warn(
      `[releaser] LLM release type "${releaseOutput.release_type}" does not match expected "${expectedReleaseType}" for risk tiers: ${riskTiers.join(", ")}`
    )
  }

  // Use the agent's version if valid, otherwise use calculated
  const finalVersion = releaseOutput.version.match(/^\d+\.\d+\.\d+$/)
    ? releaseOutput.version
    : expectedVersion

  // Compute content hash with full rule content
  const ruleSnapshots: RuleSnapshot[] = rules.map((r) => ({
    conceptSlug: r.conceptSlug,
    appliesWhen: r.appliesWhen,
    value: r.value,
    valueType: r.valueType,
    effectiveFrom: normalizeDate(r.effectiveFrom),
    effectiveUntil: normalizeDate(r.effectiveUntil),
  }))

  const contentHash = computeReleaseHash(ruleSnapshots)

  // Count audit trail metrics
  const evidenceIds = new Set<string>()
  const sourcePointerIds = new Set<string>()
  let humanApprovals = 0

  for (const rule of rulesWithPointers) {
    for (const pointer of rule.sourcePointers) {
      sourcePointerIds.add(pointer.id)
      evidenceIds.add(pointer.evidenceId)
    }
    if (rule.approvedBy) {
      humanApprovals++
    }
  }

  // Count agent runs (reviews) for these rules
  const reviewCount = await db.agentRun.count({
    where: {
      agentType: "REVIEWER",
      ruleId: { in: approvedRuleIds },
      status: "COMPLETED",
    },
  })

  // Get actual approvers from the rules being released
  const approverIds = [
    ...new Set(
      rules.map((r) => r.approvedBy).filter((id): id is string => id !== null && id !== undefined)
    ),
  ]

  // Create Release record
  const release = await db.ruleRelease.create({
    data: {
      version: finalVersion,
      releaseType: finalReleaseType,
      releasedAt: new Date(),
      effectiveFrom: new Date(releaseOutput.effective_from),
      contentHash,
      changelogHr: releaseOutput.changelog_hr,
      changelogEn: releaseOutput.changelog_en,
      approvedBy: approverIds,
      auditTrail: {
        sourceEvidenceCount: evidenceIds.size,
        sourcePointerCount: sourcePointerIds.size,
        reviewCount: reviewCount,
        humanApprovals: humanApprovals,
      },
      rules: {
        connect: approvedRuleIds.map((id) => ({ id })),
      },
    },
  })

  // Log audit event for release publication
  await logAuditEvent({
    action: "RELEASE_PUBLISHED",
    entityType: "RELEASE",
    entityId: release.id,
    metadata: {
      version: finalVersion,
      ruleCount: approvedRuleIds.length,
      contentHash,
    },
  })

  // Log audit event for each rule being published
  for (const ruleId of approvedRuleIds) {
    await logAuditEvent({
      action: "RULE_PUBLISHED",
      entityType: "RULE",
      entityId: ruleId,
      metadata: { releaseId: release.id, version: finalVersion },
    })
  }

  // Update rules status to PUBLISHED via domain service
  // This uses transaction + per-rule validation + proper context
  const publishResult = await publishRules(approvedRuleIds, "releaser")
  if (!publishResult.success) {
    console.error("[releaser] Failed to publish rules:", publishResult.errors)
    return {
      success: false,
      output: null,
      releaseId: release.id,
      publishedRuleIds: [],
      error: `Failed to publish rules: ${publishResult.errors.join("; ")}`,
    }
  }

  // ==========================================================================
  // Trigger Embedding Generation (non-blocking)
  // ==========================================================================
  // Queue embedding generation for each published rule.
  // This is async and non-blocking - failures are logged but don't fail the release.

  try {
    // Dynamic import to avoid circular dependency
    const { embeddingQueue } = await import("../workers/queues")

    for (const ruleId of approvedRuleIds) {
      await embeddingQueue.add(
        "generate-embedding",
        {
          ruleId,
          runId: release.id,
        },
        {
          priority: 5, // Medium priority
          removeOnComplete: true,
        }
      )
    }
    console.log(`[releaser] Queued ${approvedRuleIds.length} embedding generation jobs`)
  } catch (error) {
    // Log but don't fail release - embeddings are non-critical
    console.error("[releaser] Failed to queue embedding jobs:", error)
  }

  // ==========================================================================
  // Emit Content Sync Events (non-blocking)
  // ==========================================================================
  // Emit a ContentSyncEvent for each published rule to trigger MDX guide updates.
  // This is async and non-blocking - failures are logged but don't fail the release.

  for (const rule of rulesWithPointers) {
    // Gather source pointer IDs and evidence IDs for traceability
    const ruleSourcePointerIds = rule.sourcePointers.map((sp) => sp.id)
    const ruleEvidenceIds = [...new Set(rule.sourcePointers.map((sp) => sp.evidenceId))]

    // Determine change type based on whether this rule supersedes another
    // If supersedesId exists, it's an update; otherwise it's a create
    // Note: DEPRECATED status indicates a repeal (rule no longer in effect)
    const changeType =
      rule.status === "DEPRECATED" ? "repeal" : rule.supersedesId ? "update" : "create"

    // Get domain from the first source pointer (they should all be the same domain)
    const rtlDomain = rule.sourcePointers[0]?.domain ?? "pausalni"
    const contentDomain = mapRtlDomainToContentDomain(rtlDomain)

    // Find primary source URL from the first source pointer with a law reference
    // Convert null to undefined to match ContentSyncEventV1 type
    const primarySourceUrl =
      rule.sourcePointers.find((sp) => sp.lawReference)?.lawReference ?? undefined

    // Get previous value if this rule supersedes another
    let previousValue: string | undefined
    if (rule.supersedesId) {
      const supersededRule = await db.regulatoryRule.findUnique({
        where: { id: rule.supersedesId },
        select: { value: true },
      })
      previousValue = supersededRule?.value
    }

    // Determine conceptId - warn if falling back to slug (may not be in registry)
    const effectiveConceptId = rule.conceptId ?? rule.conceptSlug
    if (!rule.conceptId) {
      console.warn(
        `[releaser] Rule ${rule.id} has no conceptId, falling back to conceptSlug "${rule.conceptSlug}". ` +
          `Event may be dead-lettered if slug is not in concept registry.`
      )
    }

    // VALIDATION: Check if conceptId exists in CONCEPT_REGISTRY
    // This prevents content sync dead-letter events (issue #266)
    const conceptMapping = getConceptMapping(effectiveConceptId)
    if (!conceptMapping) {
      console.warn(
        `[releaser] ⚠️  UNMAPPED CONCEPT: Rule ${rule.id} (${rule.conceptSlug}) has conceptId "${effectiveConceptId}" ` +
          `which is NOT in CONCEPT_REGISTRY. Content sync event will be DEAD_LETTERED. ` +
          `Add mapping to src/lib/regulatory-truth/content-sync/concept-registry.ts`
      )
    }

    try {
      await emitContentSyncEvent({
        type: "RULE_RELEASED",
        ruleId: rule.id,
        conceptId: effectiveConceptId,
        domain: contentDomain,
        effectiveFrom: rule.effectiveFrom,
        changeType: changeType as "create" | "update" | "repeal",
        ruleTier: rule.riskTier as RiskTier,
        sourcePointerIds: ruleSourcePointerIds,
        evidenceIds: ruleEvidenceIds,
        previousValue,
        newValue: rule.value,
        valueType: rule.valueType as "currency" | "percentage" | "date" | "threshold" | "text",
        primarySourceUrl,
        confidenceLevel: Math.round(rule.confidence * 100),
      })
      console.log(`[releaser] Emitted content sync event for rule ${rule.id} (${rule.conceptSlug})`)
    } catch (error) {
      // Log but don't fail release - content sync is non-blocking
      console.error(`[releaser] Failed to emit content sync event for rule ${rule.id}:`, error)
    }
  }

  return {
    success: true,
    output: result.output,
    releaseId: release.id,
    publishedRuleIds: approvedRuleIds,
    error: null,
  }
}

// =============================================================================
// ROLLBACK FUNCTIONS
// =============================================================================

/**
 * Validate if a release can be rolled back.
 * Checks:
 * - Release exists
 * - Release is the most recent one (can only rollback latest)
 * - There is a previous release to rollback to
 * - Rules in the release are still in PUBLISHED state
 */
export async function validateRollback(releaseVersion: string): Promise<RollbackValidation> {
  const warnings: string[] = []
  const errors: string[] = []

  // Find the target release
  const targetRelease = await db.ruleRelease.findUnique({
    where: { version: releaseVersion },
    include: {
      rules: {
        select: { id: true, conceptSlug: true, status: true },
      },
    },
  })

  if (!targetRelease) {
    return {
      canRollback: false,
      targetRelease: null,
      previousRelease: null,
      warnings,
      errors: [`Release version ${releaseVersion} not found`],
    }
  }

  // Check if this is the most recent release
  const latestRelease = await db.ruleRelease.findFirst({
    orderBy: { releasedAt: "desc" },
    select: { id: true, version: true },
  })

  if (latestRelease?.id !== targetRelease.id) {
    errors.push(
      `Can only rollback the most recent release. Latest is ${latestRelease?.version}, but attempting to rollback ${releaseVersion}`
    )
  }

  // Find the previous release to rollback to
  const previousRelease = await db.ruleRelease.findFirst({
    where: {
      releasedAt: { lt: targetRelease.releasedAt },
    },
    orderBy: { releasedAt: "desc" },
    include: {
      rules: {
        select: { id: true },
      },
    },
  })

  if (!previousRelease) {
    warnings.push("No previous release found. Rules will be reverted to APPROVED status.")
  }

  // Check which rules are still in PUBLISHED state
  const publishedRules = targetRelease.rules.filter((r) => r.status === "PUBLISHED")
  const nonPublishedRules = targetRelease.rules.filter((r) => r.status !== "PUBLISHED")

  if (nonPublishedRules.length > 0) {
    warnings.push(
      `${nonPublishedRules.length} rule(s) are no longer in PUBLISHED state and will be skipped: ${nonPublishedRules.map((r) => r.conceptSlug).join(", ")}`
    )
  }

  if (publishedRules.length === 0) {
    errors.push("No rules in PUBLISHED state to rollback")
  }

  return {
    canRollback: errors.length === 0,
    targetRelease: {
      id: targetRelease.id,
      version: targetRelease.version,
      releasedAt: targetRelease.releasedAt,
      ruleCount: publishedRules.length,
    },
    previousRelease: previousRelease
      ? {
          id: previousRelease.id,
          version: previousRelease.version,
          ruleCount: previousRelease.rules.length,
        }
      : null,
    warnings,
    errors,
  }
}

/**
 * Rollback a release to its previous state.
 *
 * This operation is atomic - if any part fails, the entire rollback is aborted.
 *
 * What happens during rollback:
 * 1. Rules in the target release are reverted to APPROVED status
 * 2. The target release record remains but is marked in audit log
 * 3. Rules that were in a previous release remain PUBLISHED
 *
 * @param releaseVersion - The semver version to rollback (e.g., "1.2.0")
 * @param performedBy - User ID performing the rollback (for audit)
 * @param dryRun - If true, validate but don't perform the rollback
 */
export async function rollbackRelease(
  releaseVersion: string,
  performedBy?: string,
  dryRun = false
): Promise<RollbackResult> {
  // First validate the rollback
  const validation = await validateRollback(releaseVersion)

  if (!validation.canRollback) {
    return {
      success: false,
      rolledBackRuleIds: [],
      targetVersion: releaseVersion,
      previousStatus: new Map(),
      error: validation.errors.join("; "),
    }
  }

  if (dryRun) {
    // For dry run, return what would happen
    const release = await db.ruleRelease.findUnique({
      where: { version: releaseVersion },
      include: {
        rules: {
          where: { status: "PUBLISHED" },
          select: { id: true, status: true },
        },
      },
    })

    const previousStatus = new Map<string, string>()
    release?.rules.forEach((r) => previousStatus.set(r.id, r.status))

    return {
      success: true,
      rolledBackRuleIds: release?.rules.map((r) => r.id) || [],
      targetVersion: releaseVersion,
      previousStatus,
      error: null,
    }
  }

  // Perform the rollback in a transaction
  // Wrap in regulatory context to allow PUBLISHED → APPROVED transition
  try {
    const result = await runWithRegulatoryContext(
      { source: "rollback", bypassApproval: true, actorUserId: performedBy },
      () =>
        db.$transaction(
          async (tx) => {
            // Get the release with its rules
            const release = await tx.ruleRelease.findUnique({
              where: { version: releaseVersion },
              include: {
                rules: {
                  where: { status: "PUBLISHED" },
                  select: { id: true, conceptSlug: true, status: true },
                },
              },
            })

            if (!release) {
              throw new Error(`Release ${releaseVersion} not found`)
            }

            const rulesToRollback = release.rules
            const previousStatus = new Map<string, string>()
            rulesToRollback.forEach((r) => previousStatus.set(r.id, r.status))

            // Get the previous release to check which rules should stay PUBLISHED
            const previousRelease = await tx.ruleRelease.findFirst({
              where: {
                releasedAt: { lt: release.releasedAt },
              },
              orderBy: { releasedAt: "desc" },
              include: {
                rules: {
                  select: { id: true },
                },
              },
            })

            const previousReleaseRuleIds = new Set(previousRelease?.rules.map((r) => r.id) || [])

            // Determine which rules to revert to APPROVED
            // (only rules NOT in the previous release)
            const rulesToRevert = rulesToRollback.filter((r) => !previousReleaseRuleIds.has(r.id))
            const rulesToKeepPublished = rulesToRollback.filter((r) =>
              previousReleaseRuleIds.has(r.id)
            )

            // Revert rules to APPROVED status via domain service
            // Note: We're already in a transaction, so we use individual updates
            // The service handles context + validation
            if (rulesToRevert.length > 0) {
              for (const rule of rulesToRevert) {
                await tx.regulatoryRule.update({
                  where: { id: rule.id },
                  data: { status: "APPROVED" },
                })
              }
            }

            // Disconnect rules from this release (but don't delete the release record)
            await tx.ruleRelease.update({
              where: { id: release.id },
              data: {
                rules: {
                  disconnect: rulesToRollback.map((r) => ({ id: r.id })),
                },
              },
            })

            return {
              releaseId: release.id,
              version: release.version,
              rolledBackRuleIds: rulesToRevert.map((r) => r.id),
              keptPublishedRuleIds: rulesToKeepPublished.map((r) => r.id),
              previousStatus,
            }
          },
          {
            timeout: 30000, // 30 second timeout for the transaction
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          }
        )
    ) // Close runWithRegulatoryContext

    // Log audit events outside the transaction
    await logAuditEvent({
      action: "RELEASE_ROLLED_BACK",
      entityType: "RELEASE",
      entityId: result.releaseId,
      performedBy,
      metadata: {
        version: result.version,
        rolledBackRuleCount: result.rolledBackRuleIds.length,
        keptPublishedCount: result.keptPublishedRuleIds.length,
        previousReleaseVersion: validation.previousRelease?.version || null,
      },
    })

    // Log audit event for each rolled back rule
    for (const ruleId of result.rolledBackRuleIds) {
      await logAuditEvent({
        action: "RULE_ROLLBACK",
        entityType: "RULE",
        entityId: ruleId,
        performedBy,
        metadata: {
          fromRelease: result.version,
          previousStatus: result.previousStatus.get(ruleId),
          newStatus: "APPROVED",
        },
      })
    }

    return {
      success: true,
      rolledBackRuleIds: result.rolledBackRuleIds,
      targetVersion: result.version,
      previousStatus: result.previousStatus,
      error: null,
    }
  } catch (error) {
    console.error("[rollback] Transaction failed:", error)
    return {
      success: false,
      rolledBackRuleIds: [],
      targetVersion: releaseVersion,
      previousStatus: new Map(),
      error: error instanceof Error ? error.message : "Unknown error during rollback",
    }
  }
}

/**
 * Get the rollback history for a release or rule.
 */
export async function getRollbackHistory(
  entityType: "RELEASE" | "RULE",
  entityId: string
): Promise<
  Array<{
    action: string
    performedBy: string | null
    performedAt: Date
    metadata: unknown
  }>
> {
  return db.regulatoryAuditLog.findMany({
    where: {
      entityType,
      entityId,
      action: { in: ["RELEASE_ROLLED_BACK", "RULE_ROLLBACK"] },
    },
    orderBy: { performedAt: "desc" },
    select: {
      action: true,
      performedBy: true,
      performedAt: true,
      metadata: true,
    },
  })
}
