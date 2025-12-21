// src/lib/regulatory-truth/agents/releaser.ts

import { db } from "@/lib/db"
import {
  ReleaserInputSchema,
  ReleaserOutputSchema,
  type ReleaserInput,
  type ReleaserOutput,
} from "../schemas"
import { runAgent } from "./runner"
import { createHash } from "crypto"
import { logAuditEvent } from "../utils/audit-log"

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

/**
 * Calculate semver version based on previous version and rule risk tiers
 */
function calculateNextVersion(
  previousVersion: string | null,
  riskTiers: string[]
): { version: string; releaseType: "major" | "minor" | "patch" } {
  const [major, minor, patch] = previousVersion ? previousVersion.split(".").map(Number) : [0, 0, 0]

  // Check if any T0 (critical) rules exist
  if (riskTiers.includes("T0")) {
    return {
      version: `${major + 1}.0.0`,
      releaseType: "major",
    }
  }

  // Check if any T1 (high) rules exist
  if (riskTiers.includes("T1")) {
    return {
      version: `${major}.${minor + 1}.0`,
      releaseType: "minor",
    }
  }

  // Otherwise it's a patch (T2/T3 changes)
  return {
    version: `${major}.${minor}.${patch + 1}`,
    releaseType: "patch",
  }
}

/**
 * Compute deterministic content hash for rules including full content
 */
function computeContentHash(
  rules: Array<{
    id: string
    conceptSlug: string
    appliesWhen: string
    value: string
    effectiveFrom: Date
    effectiveUntil: Date | null
  }>
): string {
  // Sort by conceptSlug for deterministic hashing
  const sortedRules = [...rules].sort((a, b) => a.conceptSlug.localeCompare(b.conceptSlug))

  // Include all meaningful content in hash
  const content = sortedRules.map((r) => ({
    conceptSlug: r.conceptSlug,
    appliesWhen: r.appliesWhen,
    value: r.value,
    effectiveFrom: r.effectiveFrom.toISOString(),
    effectiveUntil: r.effectiveUntil?.toISOString() || null,
  }))

  return createHash("sha256").update(JSON.stringify(content), "utf8").digest("hex")
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

  // Use the agent's version if valid, otherwise use calculated
  const finalVersion = releaseOutput.version.match(/^\d+\.\d+\.\d+$/)
    ? releaseOutput.version
    : expectedVersion
  const finalReleaseType = releaseOutput.release_type || expectedReleaseType

  // Compute content hash with full rule content
  const contentHash = computeContentHash(
    rules.map((r) => ({
      id: r.id,
      conceptSlug: r.conceptSlug,
      appliesWhen: r.appliesWhen,
      value: r.value,
      effectiveFrom: r.effectiveFrom,
      effectiveUntil: r.effectiveUntil,
    }))
  )

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
      approvedBy: releaseOutput.approved_by,
      auditTrail: {
        source_evidence_count: evidenceIds.size,
        source_pointer_count: sourcePointerIds.size,
        review_count: reviewCount,
        human_approvals: humanApprovals,
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

  // Update rules status to PUBLISHED
  await db.regulatoryRule.updateMany({
    where: { id: { in: approvedRuleIds } },
    data: { status: "PUBLISHED" },
  })

  return {
    success: true,
    output: result.output,
    releaseId: release.id,
    publishedRuleIds: approvedRuleIds,
    error: null,
  }
}
