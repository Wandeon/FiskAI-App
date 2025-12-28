import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  computeBlastScore,
  type DirectImpact,
  type CriticalPathImpact,
  type Criticality,
} from "../system-registry/blast-radius"
import type { SystemComponent } from "../system-registry/schema"

/**
 * Helper to create a mock SystemComponent.
 */
function makeComponent(
  componentId: string,
  criticality: Criticality,
  owner: string | null = null
): SystemComponent {
  return {
    componentId,
    type: "LIB",
    name: componentId,
    status: "STABLE",
    criticality,
    owner,
    docsRef: null,
    codeRef: `src/lib/${componentId}`,
    dependencies: [],
  }
}

/**
 * Helper to create a DirectImpact.
 */
function makeDirectImpact(
  componentId: string,
  criticality: Criticality,
  owner: string | null = null
): DirectImpact {
  return {
    component: makeComponent(componentId, criticality, owner),
    matchedFiles: [`src/lib/${componentId}/index.ts`],
    matchType: "codeRef",
  }
}

/**
 * Helper to create a CriticalPathImpact.
 */
function makeCriticalPathImpact(
  pathId: string,
  pathName: string,
  distance: number = 0
): CriticalPathImpact {
  return {
    pathId,
    pathName,
    distance,
    impactedComponents: [],
  }
}

describe("computeBlastScore", () => {
  describe("base score computation", () => {
    it("returns LOW with no direct impacts", () => {
      const result = computeBlastScore([], [], [])

      assert.equal(result.baseScore, "LOW")
      assert.equal(result.score, "LOW")
      assert.equal(result.bumps.length, 0)
    })

    it("returns max criticality from direct impacts as base score", () => {
      const directImpacts = [
        makeDirectImpact("low-comp", "LOW"),
        makeDirectImpact("high-comp", "HIGH"),
        makeDirectImpact("medium-comp", "MEDIUM"),
      ]

      const result = computeBlastScore(directImpacts, [], [])

      assert.equal(result.baseScore, "HIGH")
      assert.equal(result.score, "HIGH")
      assert.equal(result.bumps.length, 0)
    })

    it("handles single CRITICAL component", () => {
      const directImpacts = [makeDirectImpact("crit-comp", "CRITICAL")]

      const result = computeBlastScore(directImpacts, [], [])

      assert.equal(result.baseScore, "CRITICAL")
      assert.equal(result.score, "CRITICAL")
      assert.equal(result.bumps.length, 0)
    })
  })

  describe("critical path bump", () => {
    it("bumps tier when critical path is impacted", () => {
      const directImpacts = [makeDirectImpact("low-comp", "LOW")]
      const criticalPaths = [makeCriticalPathImpact("path-billing", "Billing Path")]

      const result = computeBlastScore(directImpacts, criticalPaths, [])

      assert.equal(result.baseScore, "LOW")
      assert.equal(result.score, "MEDIUM")
      assert.equal(result.bumps.length, 1)
      assert.equal(result.bumps[0].from, "LOW")
      assert.equal(result.bumps[0].to, "MEDIUM")
      assert.ok(result.bumps[0].reason.includes("Critical path impacted"))
      assert.ok(result.bumps[0].reason.includes("Billing Path"))
    })

    it("includes all path names in bump reason", () => {
      const directImpacts = [makeDirectImpact("low-comp", "LOW")]
      const criticalPaths = [
        makeCriticalPathImpact("path-billing", "Billing Path"),
        makeCriticalPathImpact("path-auth", "Authentication Path"),
      ]

      const result = computeBlastScore(directImpacts, criticalPaths, [])

      assert.ok(result.bumps[0].reason.includes("Billing Path"))
      assert.ok(result.bumps[0].reason.includes("Authentication Path"))
    })

    it("does not bump when no critical paths impacted", () => {
      const directImpacts = [makeDirectImpact("medium-comp", "MEDIUM")]

      const result = computeBlastScore(directImpacts, [], [])

      assert.equal(result.score, "MEDIUM")
      assert.equal(result.bumps.length, 0)
    })
  })

  describe("security owner bump", () => {
    it("bumps tier when security team owns impacted component", () => {
      const directImpacts = [makeDirectImpact("auth-lib", "LOW", "team:security")]

      const result = computeBlastScore(directImpacts, [], [])

      assert.equal(result.baseScore, "LOW")
      assert.equal(result.score, "MEDIUM")
      assert.equal(result.bumps.length, 1)
      assert.equal(result.bumps[0].from, "LOW")
      assert.equal(result.bumps[0].to, "MEDIUM")
      assert.ok(result.bumps[0].reason.includes("Security team"))
    })

    it("does not bump for non-security team owners", () => {
      const directImpacts = [makeDirectImpact("billing-lib", "LOW", "team:billing")]

      const result = computeBlastScore(directImpacts, [], [])

      assert.equal(result.score, "LOW")
      assert.equal(result.bumps.length, 0)
    })

    it("does not bump for null owner", () => {
      const directImpacts = [makeDirectImpact("some-lib", "LOW", null)]

      const result = computeBlastScore(directImpacts, [], [])

      assert.equal(result.score, "LOW")
      assert.equal(result.bumps.length, 0)
    })
  })

  describe("governance issues bump", () => {
    it("bumps tier when governance issues exist", () => {
      const directImpacts = [makeDirectImpact("some-comp", "LOW")]
      const governanceIssues = ["Missing owner for CRITICAL component"]

      const result = computeBlastScore(directImpacts, [], governanceIssues)

      assert.equal(result.baseScore, "LOW")
      assert.equal(result.score, "MEDIUM")
      assert.equal(result.bumps.length, 1)
      assert.equal(result.bumps[0].from, "LOW")
      assert.equal(result.bumps[0].to, "MEDIUM")
      assert.ok(result.bumps[0].reason.includes("Governance issues"))
      assert.ok(result.bumps[0].reason.includes("Missing owner"))
    })

    it("includes all governance issues in bump reason", () => {
      const directImpacts = [makeDirectImpact("some-comp", "LOW")]
      const governanceIssues = ["Missing owner", "Missing docs"]

      const result = computeBlastScore(directImpacts, [], governanceIssues)

      assert.ok(result.bumps[0].reason.includes("Missing owner"))
      assert.ok(result.bumps[0].reason.includes("Missing docs"))
    })

    it("does not bump when no governance issues", () => {
      const directImpacts = [makeDirectImpact("some-comp", "MEDIUM")]

      const result = computeBlastScore(directImpacts, [], [])

      assert.equal(result.score, "MEDIUM")
      assert.equal(result.bumps.length, 0)
    })
  })

  describe("multiple bumps accumulate", () => {
    it("accumulates all three bump types", () => {
      const directImpacts = [makeDirectImpact("auth-lib", "LOW", "team:security")]
      const criticalPaths = [makeCriticalPathImpact("path-auth", "Auth Path")]
      const governanceIssues = ["Missing docs"]

      const result = computeBlastScore(directImpacts, criticalPaths, governanceIssues)

      assert.equal(result.baseScore, "LOW")
      assert.equal(result.score, "CRITICAL")
      assert.equal(result.bumps.length, 3)

      // Verify bump chain: LOW -> MEDIUM -> HIGH -> CRITICAL
      assert.equal(result.bumps[0].from, "LOW")
      assert.equal(result.bumps[0].to, "MEDIUM")
      assert.equal(result.bumps[1].from, "MEDIUM")
      assert.equal(result.bumps[1].to, "HIGH")
      assert.equal(result.bumps[2].from, "HIGH")
      assert.equal(result.bumps[2].to, "CRITICAL")
    })

    it("accumulates two bumps correctly", () => {
      const directImpacts = [makeDirectImpact("some-lib", "MEDIUM")]
      const criticalPaths = [makeCriticalPathImpact("path-billing", "Billing")]
      const governanceIssues = ["Missing owner"]

      const result = computeBlastScore(directImpacts, criticalPaths, governanceIssues)

      assert.equal(result.baseScore, "MEDIUM")
      assert.equal(result.score, "CRITICAL")
      assert.equal(result.bumps.length, 2)

      assert.equal(result.bumps[0].from, "MEDIUM")
      assert.equal(result.bumps[0].to, "HIGH")
      assert.equal(result.bumps[1].from, "HIGH")
      assert.equal(result.bumps[1].to, "CRITICAL")
    })
  })

  describe("CRITICAL ceiling", () => {
    it("cannot bump past CRITICAL", () => {
      const directImpacts = [makeDirectImpact("crit-comp", "CRITICAL", "team:security")]
      const criticalPaths = [makeCriticalPathImpact("path-billing", "Billing")]
      const governanceIssues = ["Missing docs"]

      const result = computeBlastScore(directImpacts, criticalPaths, governanceIssues)

      assert.equal(result.baseScore, "CRITICAL")
      assert.equal(result.score, "CRITICAL")
      // No bumps recorded because CRITICAL cannot be bumped
      assert.equal(result.bumps.length, 0)
    })

    it("stops bumping once CRITICAL is reached", () => {
      const directImpacts = [makeDirectImpact("high-comp", "HIGH", "team:security")]
      const criticalPaths = [makeCriticalPathImpact("path-billing", "Billing")]
      const governanceIssues = ["Missing docs"]

      const result = computeBlastScore(directImpacts, criticalPaths, governanceIssues)

      assert.equal(result.baseScore, "HIGH")
      assert.equal(result.score, "CRITICAL")
      // Only one bump: HIGH -> CRITICAL (from critical path)
      // Security and governance bumps don't apply because already at CRITICAL
      assert.equal(result.bumps.length, 1)
      assert.equal(result.bumps[0].from, "HIGH")
      assert.equal(result.bumps[0].to, "CRITICAL")
    })
  })

  describe("LOW stays LOW with no bumps", () => {
    it("LOW component with no bumps stays LOW", () => {
      const directImpacts = [makeDirectImpact("low-lib", "LOW", "team:billing")]

      const result = computeBlastScore(directImpacts, [], [])

      assert.equal(result.baseScore, "LOW")
      assert.equal(result.score, "LOW")
      assert.equal(result.bumps.length, 0)
    })

    it("empty inputs result in LOW", () => {
      const result = computeBlastScore([], [], [])

      assert.equal(result.baseScore, "LOW")
      assert.equal(result.score, "LOW")
      assert.equal(result.bumps.length, 0)
    })
  })

  describe("each bump type works independently", () => {
    it("only critical path bump works", () => {
      const directImpacts = [makeDirectImpact("comp", "MEDIUM", "team:billing")]
      const criticalPaths = [makeCriticalPathImpact("path-x", "Path X")]

      const result = computeBlastScore(directImpacts, criticalPaths, [])

      assert.equal(result.baseScore, "MEDIUM")
      assert.equal(result.score, "HIGH")
      assert.equal(result.bumps.length, 1)
      assert.ok(result.bumps[0].reason.includes("Critical path"))
    })

    it("only security owner bump works", () => {
      const directImpacts = [makeDirectImpact("comp", "MEDIUM", "team:security")]

      const result = computeBlastScore(directImpacts, [], [])

      assert.equal(result.baseScore, "MEDIUM")
      assert.equal(result.score, "HIGH")
      assert.equal(result.bumps.length, 1)
      assert.ok(result.bumps[0].reason.includes("Security team"))
    })

    it("only governance bump works", () => {
      const directImpacts = [makeDirectImpact("comp", "MEDIUM", "team:billing")]

      const result = computeBlastScore(directImpacts, [], ["Some issue"])

      assert.equal(result.baseScore, "MEDIUM")
      assert.equal(result.score, "HIGH")
      assert.equal(result.bumps.length, 1)
      assert.ok(result.bumps[0].reason.includes("Governance"))
    })
  })
})
