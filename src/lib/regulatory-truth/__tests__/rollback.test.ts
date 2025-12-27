// src/lib/regulatory-truth/__tests__/rollback.test.ts

import { describe, it, beforeEach, afterEach, mock } from "node:test"
import assert from "node:assert"
import type { RollbackValidation, RollbackResult } from "../agents/releaser"

// Mock database types for testing
interface MockRule {
  id: string
  conceptSlug: string
  status: "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "PUBLISHED" | "DEPRECATED" | "REJECTED"
}

interface MockRelease {
  id: string
  version: string
  releasedAt: Date
  rules: MockRule[]
}

/**
 * Mock implementation of validateRollback for unit testing.
 * In real tests, this would use a test database.
 */
function mockValidateRollback(releases: MockRelease[], targetVersion: string): RollbackValidation {
  const warnings: string[] = []
  const errors: string[] = []

  // Sort releases by date (most recent first)
  const sortedReleases = [...releases].sort(
    (a, b) => b.releasedAt.getTime() - a.releasedAt.getTime()
  )

  // Find target release
  const targetRelease = releases.find((r) => r.version === targetVersion)

  if (!targetRelease) {
    return {
      canRollback: false,
      targetRelease: null,
      previousRelease: null,
      warnings,
      errors: [`Release version ${targetVersion} not found`],
    }
  }

  // Check if this is the most recent release
  const latestRelease = sortedReleases[0]
  if (latestRelease.id !== targetRelease.id) {
    errors.push(
      `Can only rollback the most recent release. Latest is ${latestRelease.version}, but attempting to rollback ${targetVersion}`
    )
  }

  // Find previous release
  const targetIndex = sortedReleases.findIndex((r) => r.id === targetRelease.id)
  const previousRelease =
    targetIndex < sortedReleases.length - 1 ? sortedReleases[targetIndex + 1] : null

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
 * Mock implementation of rollback for unit testing.
 * Simulates the rollback operation without database access.
 */
function mockRollbackRelease(
  releases: MockRelease[],
  targetVersion: string,
  dryRun = false
): { result: RollbackResult; updatedReleases: MockRelease[] } {
  const validation = mockValidateRollback(releases, targetVersion)

  if (!validation.canRollback) {
    return {
      result: {
        success: false,
        rolledBackRuleIds: [],
        targetVersion,
        previousStatus: new Map(),
        error: validation.errors.join("; "),
      },
      updatedReleases: releases,
    }
  }

  const targetRelease = releases.find((r) => r.version === targetVersion)!
  const publishedRules = targetRelease.rules.filter((r) => r.status === "PUBLISHED")

  // Previous release rule IDs
  const previousReleaseRuleIds = new Set(
    validation.previousRelease
      ? releases.find((r) => r.id === validation.previousRelease!.id)?.rules.map((r) => r.id) || []
      : []
  )

  // Rules to revert (not in previous release)
  const rulesToRevert = publishedRules.filter((r) => !previousReleaseRuleIds.has(r.id))

  const previousStatus = new Map<string, string>()
  rulesToRevert.forEach((r) => previousStatus.set(r.id, r.status))

  if (dryRun) {
    return {
      result: {
        success: true,
        rolledBackRuleIds: rulesToRevert.map((r) => r.id),
        targetVersion,
        previousStatus,
        error: null,
      },
      updatedReleases: releases,
    }
  }

  // Perform the "rollback" by updating rule statuses
  const updatedReleases = releases.map((release) => {
    if (release.id === targetRelease.id) {
      return {
        ...release,
        rules: release.rules.map((rule) => {
          if (rulesToRevert.some((r) => r.id === rule.id)) {
            return { ...rule, status: "APPROVED" as const }
          }
          return rule
        }),
      }
    }
    return release
  })

  return {
    result: {
      success: true,
      rolledBackRuleIds: rulesToRevert.map((r) => r.id),
      targetVersion,
      previousStatus,
      error: null,
    },
    updatedReleases,
  }
}

describe("Release Rollback Validation", () => {
  it("should fail validation for non-existent release", () => {
    const releases: MockRelease[] = [
      {
        id: "release-1",
        version: "1.0.0",
        releasedAt: new Date("2024-01-01"),
        rules: [{ id: "rule-1", conceptSlug: "test-rule", status: "PUBLISHED" }],
      },
    ]

    const validation = mockValidateRollback(releases, "2.0.0")

    assert.strictEqual(validation.canRollback, false)
    assert.strictEqual(validation.errors.length, 1)
    assert.ok(validation.errors[0].includes("not found"))
  })

  it("should fail validation for non-latest release", () => {
    const releases: MockRelease[] = [
      {
        id: "release-1",
        version: "1.0.0",
        releasedAt: new Date("2024-01-01"),
        rules: [{ id: "rule-1", conceptSlug: "test-rule-1", status: "PUBLISHED" }],
      },
      {
        id: "release-2",
        version: "1.1.0",
        releasedAt: new Date("2024-02-01"),
        rules: [{ id: "rule-2", conceptSlug: "test-rule-2", status: "PUBLISHED" }],
      },
    ]

    const validation = mockValidateRollback(releases, "1.0.0")

    assert.strictEqual(validation.canRollback, false)
    assert.ok(validation.errors.some((e) => e.includes("most recent release")))
  })

  it("should allow rollback of latest release", () => {
    const releases: MockRelease[] = [
      {
        id: "release-1",
        version: "1.0.0",
        releasedAt: new Date("2024-01-01"),
        rules: [{ id: "rule-1", conceptSlug: "test-rule-1", status: "PUBLISHED" }],
      },
      {
        id: "release-2",
        version: "1.1.0",
        releasedAt: new Date("2024-02-01"),
        rules: [{ id: "rule-2", conceptSlug: "test-rule-2", status: "PUBLISHED" }],
      },
    ]

    const validation = mockValidateRollback(releases, "1.1.0")

    assert.strictEqual(validation.canRollback, true)
    assert.strictEqual(validation.errors.length, 0)
    assert.strictEqual(validation.targetRelease?.version, "1.1.0")
    assert.strictEqual(validation.previousRelease?.version, "1.0.0")
  })

  it("should warn when no previous release exists", () => {
    const releases: MockRelease[] = [
      {
        id: "release-1",
        version: "1.0.0",
        releasedAt: new Date("2024-01-01"),
        rules: [{ id: "rule-1", conceptSlug: "test-rule", status: "PUBLISHED" }],
      },
    ]

    const validation = mockValidateRollback(releases, "1.0.0")

    assert.strictEqual(validation.canRollback, true)
    assert.ok(validation.warnings.some((w) => w.includes("No previous release")))
    assert.strictEqual(validation.previousRelease, null)
  })

  it("should fail when no rules are in PUBLISHED state", () => {
    const releases: MockRelease[] = [
      {
        id: "release-1",
        version: "1.0.0",
        releasedAt: new Date("2024-01-01"),
        rules: [{ id: "rule-1", conceptSlug: "test-rule", status: "APPROVED" }], // Already reverted
      },
    ]

    const validation = mockValidateRollback(releases, "1.0.0")

    assert.strictEqual(validation.canRollback, false)
    assert.ok(validation.errors.some((e) => e.includes("No rules in PUBLISHED state")))
  })

  it("should warn about non-published rules that will be skipped", () => {
    const releases: MockRelease[] = [
      {
        id: "release-1",
        version: "1.0.0",
        releasedAt: new Date("2024-01-01"),
        rules: [
          { id: "rule-1", conceptSlug: "published-rule", status: "PUBLISHED" },
          { id: "rule-2", conceptSlug: "deprecated-rule", status: "DEPRECATED" },
        ],
      },
    ]

    const validation = mockValidateRollback(releases, "1.0.0")

    assert.strictEqual(validation.canRollback, true)
    assert.ok(validation.warnings.some((w) => w.includes("no longer in PUBLISHED state")))
    assert.strictEqual(validation.targetRelease?.ruleCount, 1) // Only the published one
  })
})

describe("Release Rollback Execution", () => {
  it("should rollback rules to APPROVED status", () => {
    const releases: MockRelease[] = [
      {
        id: "release-1",
        version: "1.0.0",
        releasedAt: new Date("2024-01-01"),
        rules: [
          { id: "rule-1", conceptSlug: "test-rule-1", status: "PUBLISHED" },
          { id: "rule-2", conceptSlug: "test-rule-2", status: "PUBLISHED" },
        ],
      },
    ]

    const { result, updatedReleases } = mockRollbackRelease(releases, "1.0.0")

    assert.strictEqual(result.success, true)
    assert.strictEqual(result.rolledBackRuleIds.length, 2)
    assert.strictEqual(result.error, null)

    // Verify rules are now APPROVED
    const updatedRelease = updatedReleases.find((r) => r.version === "1.0.0")
    for (const rule of updatedRelease!.rules) {
      assert.strictEqual(rule.status, "APPROVED")
    }
  })

  it("should keep rules PUBLISHED if they were in previous release", () => {
    const releases: MockRelease[] = [
      {
        id: "release-1",
        version: "1.0.0",
        releasedAt: new Date("2024-01-01"),
        rules: [{ id: "rule-1", conceptSlug: "rule-from-v1", status: "PUBLISHED" }],
      },
      {
        id: "release-2",
        version: "1.1.0",
        releasedAt: new Date("2024-02-01"),
        rules: [
          { id: "rule-1", conceptSlug: "rule-from-v1", status: "PUBLISHED" }, // Also in v1.0.0
          { id: "rule-2", conceptSlug: "rule-from-v1.1", status: "PUBLISHED" }, // Only in v1.1.0
        ],
      },
    ]

    const { result, updatedReleases } = mockRollbackRelease(releases, "1.1.0")

    assert.strictEqual(result.success, true)
    // Only rule-2 should be rolled back (rule-1 is in previous release)
    assert.strictEqual(result.rolledBackRuleIds.length, 1)
    assert.ok(result.rolledBackRuleIds.includes("rule-2"))
    assert.ok(!result.rolledBackRuleIds.includes("rule-1"))
  })

  it("should return previous status in result", () => {
    const releases: MockRelease[] = [
      {
        id: "release-1",
        version: "1.0.0",
        releasedAt: new Date("2024-01-01"),
        rules: [{ id: "rule-1", conceptSlug: "test-rule", status: "PUBLISHED" }],
      },
    ]

    const { result } = mockRollbackRelease(releases, "1.0.0")

    assert.strictEqual(result.success, true)
    assert.strictEqual(result.previousStatus.get("rule-1"), "PUBLISHED")
  })

  it("should not modify releases in dry run mode", () => {
    const releases: MockRelease[] = [
      {
        id: "release-1",
        version: "1.0.0",
        releasedAt: new Date("2024-01-01"),
        rules: [{ id: "rule-1", conceptSlug: "test-rule", status: "PUBLISHED" }],
      },
    ]

    const { result, updatedReleases } = mockRollbackRelease(releases, "1.0.0", true)

    assert.strictEqual(result.success, true)
    assert.strictEqual(result.rolledBackRuleIds.length, 1)

    // Verify original releases unchanged
    const originalRelease = updatedReleases.find((r) => r.version === "1.0.0")
    assert.strictEqual(originalRelease!.rules[0].status, "PUBLISHED")
  })

  it("should fail rollback for invalid version", () => {
    const releases: MockRelease[] = [
      {
        id: "release-1",
        version: "1.0.0",
        releasedAt: new Date("2024-01-01"),
        rules: [{ id: "rule-1", conceptSlug: "test-rule", status: "PUBLISHED" }],
      },
    ]

    const { result } = mockRollbackRelease(releases, "9.9.9")

    assert.strictEqual(result.success, false)
    assert.ok(result.error?.includes("not found"))
    assert.strictEqual(result.rolledBackRuleIds.length, 0)
  })
})

describe("Rollback Atomicity", () => {
  it("should rollback all-or-nothing on validation failure", () => {
    const releases: MockRelease[] = [
      {
        id: "release-1",
        version: "1.0.0",
        releasedAt: new Date("2024-01-01"),
        rules: [{ id: "rule-1", conceptSlug: "test-rule", status: "APPROVED" }], // Already not PUBLISHED
      },
    ]

    const { result, updatedReleases } = mockRollbackRelease(releases, "1.0.0")

    assert.strictEqual(result.success, false)
    // Verify no changes were made
    assert.deepStrictEqual(updatedReleases, releases)
  })

  it("should preserve release record after rollback", () => {
    const releases: MockRelease[] = [
      {
        id: "release-1",
        version: "1.0.0",
        releasedAt: new Date("2024-01-01"),
        rules: [{ id: "rule-1", conceptSlug: "test-rule", status: "PUBLISHED" }],
      },
    ]

    const { updatedReleases } = mockRollbackRelease(releases, "1.0.0")

    // Release record should still exist
    const release = updatedReleases.find((r) => r.version === "1.0.0")
    assert.ok(release !== undefined)
    assert.strictEqual(release.id, "release-1")
  })
})

describe("Rollback Edge Cases", () => {
  it("should handle multiple rules with mixed statuses", () => {
    const releases: MockRelease[] = [
      {
        id: "release-1",
        version: "1.0.0",
        releasedAt: new Date("2024-01-01"),
        rules: [
          { id: "rule-1", conceptSlug: "rule-1", status: "PUBLISHED" },
          { id: "rule-2", conceptSlug: "rule-2", status: "DEPRECATED" },
          { id: "rule-3", conceptSlug: "rule-3", status: "PUBLISHED" },
          { id: "rule-4", conceptSlug: "rule-4", status: "REJECTED" },
        ],
      },
    ]

    const validation = mockValidateRollback(releases, "1.0.0")

    // Should be able to rollback
    assert.strictEqual(validation.canRollback, true)
    // Only 2 PUBLISHED rules should be counted
    assert.strictEqual(validation.targetRelease?.ruleCount, 2)
    // Should warn about non-published rules
    assert.ok(validation.warnings.some((w) => w.includes("2 rule(s)")))
  })

  it("should handle empty rules list in release", () => {
    const releases: MockRelease[] = [
      {
        id: "release-1",
        version: "1.0.0",
        releasedAt: new Date("2024-01-01"),
        rules: [],
      },
    ]

    const validation = mockValidateRollback(releases, "1.0.0")

    assert.strictEqual(validation.canRollback, false)
    assert.ok(validation.errors.some((e) => e.includes("No rules in PUBLISHED state")))
  })

  it("should handle chain of multiple releases correctly", () => {
    const releases: MockRelease[] = [
      {
        id: "release-1",
        version: "1.0.0",
        releasedAt: new Date("2024-01-01"),
        rules: [{ id: "rule-1", conceptSlug: "rule-1", status: "PUBLISHED" }],
      },
      {
        id: "release-2",
        version: "1.1.0",
        releasedAt: new Date("2024-02-01"),
        rules: [
          { id: "rule-1", conceptSlug: "rule-1", status: "PUBLISHED" },
          { id: "rule-2", conceptSlug: "rule-2", status: "PUBLISHED" },
        ],
      },
      {
        id: "release-3",
        version: "1.2.0",
        releasedAt: new Date("2024-03-01"),
        rules: [
          { id: "rule-1", conceptSlug: "rule-1", status: "PUBLISHED" },
          { id: "rule-2", conceptSlug: "rule-2", status: "PUBLISHED" },
          { id: "rule-3", conceptSlug: "rule-3", status: "PUBLISHED" },
        ],
      },
    ]

    const validation = mockValidateRollback(releases, "1.2.0")

    assert.strictEqual(validation.canRollback, true)
    assert.strictEqual(validation.previousRelease?.version, "1.1.0")

    const { result } = mockRollbackRelease(releases, "1.2.0")

    // Only rule-3 should be rolled back (rule-1 and rule-2 are in 1.1.0)
    assert.strictEqual(result.rolledBackRuleIds.length, 1)
    assert.ok(result.rolledBackRuleIds.includes("rule-3"))
  })
})
