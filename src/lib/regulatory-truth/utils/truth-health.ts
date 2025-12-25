// src/lib/regulatory-truth/utils/truth-health.ts
// Collects truth health metrics and stores snapshots

import { db } from "@/lib/db"
import { findDuplicateRuleGroups } from "./consolidator"
import { isBlockedDomain } from "./concept-resolver"
import { getEvidenceStrengthMetrics } from "./evidence-strength"

export interface TruthHealthMetrics {
  // Rule counts by status
  totalRules: number
  publishedRules: number
  approvedRules: number
  pendingReviewRules: number
  draftRules: number
  rejectedRules: number

  // Pointer coverage metrics
  totalPointers: number
  unlinkedPointers: number
  unlinkedPointersRate: number

  // Evidence quality
  rulesWithMultiplePointers: number
  multiplePointerRate: number
  publishedWithTwoPlus: number
  publishedPointerCoverage: number

  // Consolidation health
  duplicateGroupsDetected: number
  testDataLeakage: number
  aliasResolutionsToday: number

  // Concept health
  totalConcepts: number
  conceptsWithRules: number
  orphanedConcepts: number

  // Evidence strength metrics
  multiSourceRules: number
  singleSourceRules: number
  singleSourceCanPublish: number
  singleSourceBlocked: number

  // Alerts
  alertsTriggered: string[]
}

/**
 * Collect current truth health metrics
 */
export async function collectTruthHealthMetrics(): Promise<TruthHealthMetrics> {
  const alerts: string[] = []

  // Rule counts by status
  const rulesByStatus = await db.regulatoryRule.groupBy({
    by: ["status"],
    _count: true,
  })

  const statusCounts: Record<string, number> = {}
  for (const group of rulesByStatus) {
    statusCounts[group.status] = group._count
  }

  const publishedRules = statusCounts["PUBLISHED"] || 0
  const approvedRules = statusCounts["APPROVED"] || 0
  const pendingReviewRules = statusCounts["PENDING_REVIEW"] || 0
  const draftRules = statusCounts["DRAFT"] || 0
  const rejectedRules = statusCounts["REJECTED"] || 0
  const totalRules = Object.values(statusCounts).reduce((a, b) => a + b, 0)

  // Pointer coverage (SourcePointer has many-to-many relationship with rules)
  const totalPointers = await db.sourcePointer.count()
  const linkedPointers = await db.sourcePointer.count({
    where: { rules: { some: {} } },
  })
  const unlinkedPointers = totalPointers - linkedPointers
  const unlinkedPointersRate = totalPointers > 0 ? unlinkedPointers / totalPointers : 0

  if (unlinkedPointersRate > 0.1) {
    alerts.push(
      `HIGH_UNLINKED_POINTERS: ${(unlinkedPointersRate * 100).toFixed(1)}% pointers not linked to rules`
    )
  }

  // Rules with multiple pointers
  const rulesWithPointers = await db.regulatoryRule.findMany({
    where: { status: { not: "REJECTED" } },
    include: { _count: { select: { sourcePointers: true } } },
  })

  const nonRejectedCount = rulesWithPointers.length
  const rulesWithMultiplePointers = rulesWithPointers.filter(
    (r) => r._count.sourcePointers > 1
  ).length
  const multiplePointerRate =
    nonRejectedCount > 0 ? rulesWithMultiplePointers / nonRejectedCount : 0

  // PUBLISHED rules with >=2 pointers
  const publishedRulesWithPointers = await db.regulatoryRule.findMany({
    where: { status: "PUBLISHED" },
    include: { _count: { select: { sourcePointers: true } } },
  })
  const publishedWithTwoPlus = publishedRulesWithPointers.filter(
    (r) => r._count.sourcePointers >= 2
  ).length
  const publishedPointerCoverage = publishedRules > 0 ? publishedWithTwoPlus / publishedRules : 0

  if (publishedPointerCoverage < 0.5 && publishedRules > 0) {
    alerts.push(
      `LOW_PUBLISHED_COVERAGE: Only ${(publishedPointerCoverage * 100).toFixed(1)}% of PUBLISHED rules have >=2 pointers`
    )
  }

  // Duplicate detection
  const duplicateGroups = await findDuplicateRuleGroups()
  const duplicateGroupsDetected = duplicateGroups.length

  if (duplicateGroupsDetected > 0) {
    alerts.push(`DUPLICATES_DETECTED: ${duplicateGroupsDetected} duplicate groups found`)
  }

  // Test data leakage (pointers from test domains linked to non-rejected rules)
  const testPointers = await db.sourcePointer.findMany({
    where: {
      rules: { some: { status: { not: "REJECTED" } } },
    },
    select: { domain: true },
  })
  const testDataLeakage = testPointers.filter((p) => isBlockedDomain(p.domain)).length

  if (testDataLeakage > 0) {
    alerts.push(`TEST_DATA_LEAKAGE: ${testDataLeakage} test domain pointers linked to rules`)
  }

  // Alias resolutions today (from regulatory audit log)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const aliasResolutionsToday = await db.regulatoryAuditLog.count({
    where: {
      action: "RULE_MERGED",
      performedAt: { gte: todayStart },
    },
  })

  // Concept health
  const totalConcepts = await db.concept.count()
  const conceptsWithRules = await db.concept.count({
    where: { rules: { some: {} } },
  })
  const orphanedConcepts = totalConcepts - conceptsWithRules

  if (orphanedConcepts > totalConcepts * 0.3 && totalConcepts > 10) {
    alerts.push(`HIGH_ORPHANED_CONCEPTS: ${orphanedConcepts} concepts have no rules`)
  }

  // Evidence strength metrics
  const evidenceMetrics = await getEvidenceStrengthMetrics()

  if (evidenceMetrics.singleSourceBlocked > 0) {
    alerts.push(
      `SINGLE_SOURCE_BLOCKED: ${evidenceMetrics.singleSourceBlocked} rules blocked from publishing (need corroboration)`
    )
  }

  return {
    totalRules,
    publishedRules,
    approvedRules,
    pendingReviewRules,
    draftRules,
    rejectedRules,
    totalPointers,
    unlinkedPointers,
    unlinkedPointersRate,
    rulesWithMultiplePointers,
    multiplePointerRate,
    publishedWithTwoPlus,
    publishedPointerCoverage,
    duplicateGroupsDetected,
    testDataLeakage,
    aliasResolutionsToday,
    totalConcepts,
    conceptsWithRules,
    orphanedConcepts,
    multiSourceRules: evidenceMetrics.multiSourceRules,
    singleSourceRules: evidenceMetrics.singleSourceRules,
    singleSourceCanPublish: evidenceMetrics.singleSourceCanPublish,
    singleSourceBlocked: evidenceMetrics.singleSourceBlocked,
    alertsTriggered: alerts,
  }
}

/**
 * Store a truth health snapshot
 */
export async function storeTruthHealthSnapshot(): Promise<{
  id: string
  alerts: string[]
}> {
  const metrics = await collectTruthHealthMetrics()

  const snapshot = await db.truthHealthSnapshot.create({
    data: metrics,
  })

  console.log(`[truth-health] Stored snapshot ${snapshot.id}`)
  if (metrics.alertsTriggered.length > 0) {
    console.log(`[truth-health] Alerts triggered: ${metrics.alertsTriggered.join(", ")}`)
  }

  return {
    id: snapshot.id,
    alerts: metrics.alertsTriggered,
  }
}

/**
 * Run consolidator health check (dry-run mode)
 * Returns alerts if issues are found
 */
export async function runConsolidatorHealthCheck(): Promise<{
  healthy: boolean
  alerts: string[]
  duplicateGroups: number
  testDataLeakage: number
}> {
  const alerts: string[] = []

  // Find duplicate groups
  const duplicateGroups = await findDuplicateRuleGroups()
  if (duplicateGroups.length > 0) {
    alerts.push(`DUPLICATES_DETECTED: ${duplicateGroups.length} duplicate groups found`)
    for (const group of duplicateGroups.slice(0, 3)) {
      alerts.push(
        `  - ${group.canonicalSlug}: ${group.rules.length} rules with value "${group.value}"`
      )
    }
  }

  // Check for test data leakage (pointers from test domains linked to non-rejected rules)
  const testPointers = await db.sourcePointer.findMany({
    where: {
      rules: { some: { status: { not: "REJECTED" } } },
    },
    select: { domain: true },
  })

  const leakedPointers = testPointers.filter((p) => isBlockedDomain(p.domain))

  if (leakedPointers.length > 0) {
    alerts.push(
      `TEST_DATA_LEAKAGE: ${leakedPointers.length} test domain pointers in non-rejected rules`
    )
  }

  const healthy = alerts.length === 0

  return {
    healthy,
    alerts,
    duplicateGroups: duplicateGroups.length,
    testDataLeakage: leakedPointers.length,
  }
}
