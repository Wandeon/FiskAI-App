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
    include: {
      sourcePointers: {
        include: {
          evidence: true,
        },
      },
    },
  })

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
  const rulesWithoutPointers = rules.filter((r) => r.sourcePointers.length === 0)

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

  for (const rule of rules) {
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
      status: "completed",
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
