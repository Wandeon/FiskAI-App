import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  formatGitHubCheck,
  CHECK_NAME,
  type CheckOutput,
  type EnforcementMode,
} from "../system-registry/formatters/github-check"
import type { BlastAnalysis } from "../system-registry/formatters/pr-comment"
import type {
  DirectImpact,
  TransitiveImpact,
  CriticalPathImpact,
  BlastScore,
  Criticality,
} from "../system-registry/blast-radius"
import type { SystemComponent } from "../system-registry/schema"

/**
 * Helper to create a mock SystemComponent.
 */
function makeComponent(
  componentId: string,
  criticality: Criticality,
  owner: string | null = null,
  type: SystemComponent["type"] = "LIB"
): SystemComponent {
  return {
    componentId,
    type,
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
 * Helper to create a TransitiveImpact.
 */
function makeTransitiveImpact(
  componentId: string,
  criticality: Criticality,
  distance: number,
  pathThrough: string[] = []
): TransitiveImpact {
  return {
    component: makeComponent(componentId, criticality),
    distance,
    pathThrough,
  }
}

/**
 * Helper to create a CriticalPathImpact.
 */
function makeCriticalPathImpact(
  pathId: string,
  pathName: string,
  distance: number = 0,
  impactedComponents: string[] = []
): CriticalPathImpact {
  return {
    pathId,
    pathName,
    distance,
    impactedComponents,
  }
}

/**
 * Helper to create a BlastScore.
 */
function makeBlastScore(
  score: Criticality = "LOW",
  baseScore: Criticality = "LOW",
  bumps: BlastScore["bumps"] = []
): BlastScore {
  return { score, baseScore, bumps }
}

/**
 * Helper to create a minimal BlastAnalysis.
 */
function makeEmptyAnalysis(): BlastAnalysis {
  return {
    directImpacts: [],
    transitiveImpacts: [],
    criticalPathImpacts: [],
    score: makeBlastScore(),
    owners: [],
    truncated: false,
  }
}

/**
 * Helper to create an analysis with a specific score.
 */
function makeAnalysisWithScore(score: Criticality): BlastAnalysis {
  const analysis = makeEmptyAnalysis()
  analysis.score = makeBlastScore(score, score, [])
  return analysis
}

describe("formatGitHubCheck", () => {
  describe("check name", () => {
    it("uses correct check name constant", () => {
      assert.equal(CHECK_NAME, "registry/blast-radius")
    })

    it("produces output with correct name", () => {
      const analysis = makeEmptyAnalysis()
      const result = formatGitHubCheck(analysis, "warn")
      assert.equal(result.name, "registry/blast-radius")
    })
  })

  describe("status mapping - LOW score", () => {
    it("produces success status", () => {
      const analysis = makeAnalysisWithScore("LOW")
      const result = formatGitHubCheck(analysis, "warn")
      assert.equal(result.status, "success")
      assert.equal(result.conclusion, "success")
    })

    it("produces success in fail mode too", () => {
      const analysis = makeAnalysisWithScore("LOW")
      const result = formatGitHubCheck(analysis, "fail")
      assert.equal(result.status, "success")
      assert.equal(result.conclusion, "success")
    })
  })

  describe("status mapping - MEDIUM score", () => {
    it("produces success status", () => {
      const analysis = makeAnalysisWithScore("MEDIUM")
      const result = formatGitHubCheck(analysis, "warn")
      assert.equal(result.status, "success")
      assert.equal(result.conclusion, "success")
    })

    it("produces success in fail mode too", () => {
      const analysis = makeAnalysisWithScore("MEDIUM")
      const result = formatGitHubCheck(analysis, "fail")
      assert.equal(result.status, "success")
      assert.equal(result.conclusion, "success")
    })
  })

  describe("status mapping - HIGH score", () => {
    it("produces neutral status in warn mode", () => {
      const analysis = makeAnalysisWithScore("HIGH")
      const result = formatGitHubCheck(analysis, "warn")
      assert.equal(result.status, "neutral")
      assert.equal(result.conclusion, "neutral")
    })

    it("produces neutral status in fail mode", () => {
      const analysis = makeAnalysisWithScore("HIGH")
      const result = formatGitHubCheck(analysis, "fail")
      assert.equal(result.status, "neutral")
      assert.equal(result.conclusion, "neutral")
    })
  })

  describe("status mapping - CRITICAL score", () => {
    it("produces neutral status in warn mode", () => {
      const analysis = makeAnalysisWithScore("CRITICAL")
      const result = formatGitHubCheck(analysis, "warn")
      assert.equal(result.status, "neutral")
      assert.equal(result.conclusion, "neutral")
    })

    it("produces failure status in fail mode", () => {
      const analysis = makeAnalysisWithScore("CRITICAL")
      const result = formatGitHubCheck(analysis, "fail")
      assert.equal(result.status, "failure")
      assert.equal(result.conclusion, "failure")
    })
  })

  describe("enforcement mode affects only CRITICAL", () => {
    const scores: Criticality[] = ["LOW", "MEDIUM", "HIGH"]

    for (const score of scores) {
      it(`${score} score is same in both modes`, () => {
        const analysis = makeAnalysisWithScore(score)
        const warnResult = formatGitHubCheck(analysis, "warn")
        const failResult = formatGitHubCheck(analysis, "fail")

        assert.equal(warnResult.status, failResult.status)
        assert.equal(warnResult.conclusion, failResult.conclusion)
      })
    }

    it("CRITICAL differs between modes", () => {
      const analysis = makeAnalysisWithScore("CRITICAL")
      const warnResult = formatGitHubCheck(analysis, "warn")
      const failResult = formatGitHubCheck(analysis, "fail")

      assert.notEqual(warnResult.status, failResult.status)
      assert.equal(warnResult.status, "neutral")
      assert.equal(failResult.status, "failure")
    })
  })

  describe("title generation", () => {
    it("includes score in title", () => {
      const analysis = makeAnalysisWithScore("HIGH")
      const result = formatGitHubCheck(analysis, "warn")
      assert.ok(result.title.includes("HIGH"))
    })

    it("includes description for LOW", () => {
      const analysis = makeAnalysisWithScore("LOW")
      const result = formatGitHubCheck(analysis, "warn")
      assert.ok(result.title.includes("Low impact"))
    })

    it("includes description for MEDIUM", () => {
      const analysis = makeAnalysisWithScore("MEDIUM")
      const result = formatGitHubCheck(analysis, "warn")
      assert.ok(result.title.includes("Moderate impact"))
    })

    it("includes description for HIGH", () => {
      const analysis = makeAnalysisWithScore("HIGH")
      const result = formatGitHubCheck(analysis, "warn")
      assert.ok(result.title.includes("High impact"))
    })

    it("includes description for CRITICAL", () => {
      const analysis = makeAnalysisWithScore("CRITICAL")
      const result = formatGitHubCheck(analysis, "warn")
      assert.ok(result.title.includes("Critical impact"))
    })
  })

  describe("summary generation", () => {
    it("includes score in summary", () => {
      const analysis = makeAnalysisWithScore("HIGH")
      const result = formatGitHubCheck(analysis, "warn")
      assert.ok(result.summary.includes("**Score:** HIGH"))
    })

    it("includes bump info when score was bumped", () => {
      const analysis = makeEmptyAnalysis()
      analysis.score = makeBlastScore("HIGH", "MEDIUM", [
        { from: "MEDIUM", to: "HIGH", reason: "Critical path" },
      ])
      const result = formatGitHubCheck(analysis, "warn")
      assert.ok(result.summary.includes("bumped from MEDIUM"))
    })

    it("includes direct impact count", () => {
      const analysis = makeEmptyAnalysis()
      analysis.directImpacts = [
        makeDirectImpact("lib-a", "HIGH"),
        makeDirectImpact("lib-b", "MEDIUM"),
      ]
      const result = formatGitHubCheck(analysis, "warn")
      assert.ok(result.summary.includes("2 direct impact(s)"))
    })

    it("includes transitive impact count", () => {
      const analysis = makeEmptyAnalysis()
      analysis.transitiveImpacts = [
        makeTransitiveImpact("lib-a", "HIGH", 1),
        makeTransitiveImpact("lib-b", "MEDIUM", 2),
        makeTransitiveImpact("lib-c", "LOW", 3),
      ]
      const result = formatGitHubCheck(analysis, "warn")
      assert.ok(result.summary.includes("3 transitive impact(s)"))
    })

    it("includes critical path count", () => {
      const analysis = makeEmptyAnalysis()
      analysis.criticalPathImpacts = [makeCriticalPathImpact("path-billing", "Billing", 0)]
      const result = formatGitHubCheck(analysis, "warn")
      assert.ok(result.summary.includes("1 critical path(s) affected"))
    })

    it("includes owners when present", () => {
      const analysis = makeEmptyAnalysis()
      analysis.owners = ["team:security", "team:billing"]
      const result = formatGitHubCheck(analysis, "warn")
      assert.ok(result.summary.includes("**Notify:**"))
      assert.ok(result.summary.includes("team:security"))
      assert.ok(result.summary.includes("team:billing"))
    })
  })

  describe("text (detailed) generation", () => {
    it("shows direct impacts list", () => {
      const analysis = makeEmptyAnalysis()
      analysis.directImpacts = [makeDirectImpact("lib-auth", "HIGH")]
      const result = formatGitHubCheck(analysis, "warn")

      assert.ok(result.text.includes("### Direct Impacts"))
      assert.ok(result.text.includes("`lib-auth`"))
      assert.ok(result.text.includes("HIGH"))
    })

    it("shows high-priority transitive impacts", () => {
      const analysis = makeEmptyAnalysis()
      analysis.transitiveImpacts = [
        makeTransitiveImpact("worker-sync", "CRITICAL", 1),
        makeTransitiveImpact("integration-stripe", "HIGH", 2),
        makeTransitiveImpact("util-format", "LOW", 3),
      ]
      const result = formatGitHubCheck(analysis, "warn")

      assert.ok(result.text.includes("### High-Priority Transitive Impacts"))
      assert.ok(result.text.includes("`worker-sync`"))
      assert.ok(result.text.includes("`integration-stripe`"))
      // LOW should be in the "additional" count, not listed
      assert.ok(result.text.includes("+1 additional"))
    })

    it("shows hop counts for transitive impacts", () => {
      const analysis = makeEmptyAnalysis()
      analysis.transitiveImpacts = [
        makeTransitiveImpact("worker-sync", "CRITICAL", 1),
        makeTransitiveImpact("integration-stripe", "HIGH", 3),
      ]
      const result = formatGitHubCheck(analysis, "warn")

      assert.ok(result.text.includes("1 hop)"))
      assert.ok(result.text.includes("3 hops)"))
    })

    it("shows truncation notice when truncated", () => {
      const analysis = makeEmptyAnalysis()
      analysis.transitiveImpacts = [makeTransitiveImpact("comp", "CRITICAL", 1)]
      analysis.truncated = true
      const result = formatGitHubCheck(analysis, "warn")

      assert.ok(result.text.includes("analysis truncated"))
    })

    it("shows critical paths", () => {
      const analysis = makeEmptyAnalysis()
      analysis.criticalPathImpacts = [makeCriticalPathImpact("path-billing", "Billing Flow", 1)]
      const result = formatGitHubCheck(analysis, "warn")

      assert.ok(result.text.includes("### Critical Paths Impacted"))
      assert.ok(result.text.includes("**Billing Flow**"))
      assert.ok(result.text.includes("distance: 1"))
    })

    it("shows score breakdown when bumps exist", () => {
      const analysis = makeEmptyAnalysis()
      analysis.score = makeBlastScore("HIGH", "MEDIUM", [
        { from: "MEDIUM", to: "HIGH", reason: "Critical path impacted" },
      ])
      const result = formatGitHubCheck(analysis, "warn")

      assert.ok(result.text.includes("### Score Breakdown"))
      assert.ok(result.text.includes("Base: **MEDIUM**"))
      assert.ok(result.text.includes("Final: **HIGH**"))
      assert.ok(result.text.includes("MEDIUM -> HIGH"))
      assert.ok(result.text.includes("Critical path impacted"))
    })

    it("shows minimal message for empty analysis", () => {
      const analysis = makeEmptyAnalysis()
      const result = formatGitHubCheck(analysis, "warn")
      assert.ok(result.text.includes("No significant impacts detected"))
    })
  })

  describe("annotations", () => {
    it("annotations are undefined in v1", () => {
      const analysis = makeEmptyAnalysis()
      const result = formatGitHubCheck(analysis, "warn")
      assert.equal(result.annotations, undefined)
    })

    it("annotations remain undefined even with impacts", () => {
      const analysis = makeEmptyAnalysis()
      analysis.directImpacts = [makeDirectImpact("lib-auth", "CRITICAL")]
      const result = formatGitHubCheck(analysis, "fail")
      assert.equal(result.annotations, undefined)
    })
  })

  describe("output format validity", () => {
    it("has all required fields", () => {
      const analysis = makeEmptyAnalysis()
      const result = formatGitHubCheck(analysis, "warn")

      assert.ok("name" in result)
      assert.ok("status" in result)
      assert.ok("conclusion" in result)
      assert.ok("title" in result)
      assert.ok("summary" in result)
      assert.ok("text" in result)
    })

    it("name is non-empty string", () => {
      const analysis = makeEmptyAnalysis()
      const result = formatGitHubCheck(analysis, "warn")
      assert.equal(typeof result.name, "string")
      assert.ok(result.name.length > 0)
    })

    it("status is valid enum value", () => {
      const analysis = makeEmptyAnalysis()
      const result = formatGitHubCheck(analysis, "warn")
      assert.ok(["success", "neutral", "failure"].includes(result.status))
    })

    it("conclusion is valid enum value", () => {
      const analysis = makeEmptyAnalysis()
      const result = formatGitHubCheck(analysis, "warn")
      assert.ok(["success", "neutral", "failure"].includes(result.conclusion))
    })

    it("title is non-empty string", () => {
      const analysis = makeEmptyAnalysis()
      const result = formatGitHubCheck(analysis, "warn")
      assert.equal(typeof result.title, "string")
      assert.ok(result.title.length > 0)
    })

    it("summary is non-empty string", () => {
      const analysis = makeEmptyAnalysis()
      const result = formatGitHubCheck(analysis, "warn")
      assert.equal(typeof result.summary, "string")
      assert.ok(result.summary.length > 0)
    })

    it("text is non-empty string", () => {
      const analysis = makeEmptyAnalysis()
      const result = formatGitHubCheck(analysis, "warn")
      assert.equal(typeof result.text, "string")
      assert.ok(result.text.length > 0)
    })

    it("status and conclusion are equal", () => {
      // In our implementation, status and conclusion are always the same
      const scores: Criticality[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
      const modes: EnforcementMode[] = ["warn", "fail"]

      for (const score of scores) {
        for (const mode of modes) {
          const analysis = makeAnalysisWithScore(score)
          const result = formatGitHubCheck(analysis, mode)
          assert.equal(result.status, result.conclusion)
        }
      }
    })
  })

  describe("full integration example", () => {
    it("produces complete output for complex analysis", () => {
      const analysis: BlastAnalysis = {
        directImpacts: [
          makeDirectImpact("lib-auth", "HIGH", "team:security"),
          makeDirectImpact("route-group-users", "MEDIUM"),
        ],
        transitiveImpacts: [
          makeTransitiveImpact("worker-subscription-sync", "CRITICAL", 1, ["lib-auth"]),
          makeTransitiveImpact("integration-stripe", "HIGH", 2, ["lib-billing"]),
          makeTransitiveImpact("util-format", "LOW", 3, []),
        ],
        criticalPathImpacts: [
          makeCriticalPathImpact("path-billing", "Billing", 1, ["integration-stripe"]),
        ],
        score: makeBlastScore("CRITICAL", "HIGH", [
          { from: "HIGH", to: "CRITICAL", reason: "Security team owns component" },
        ]),
        owners: ["team:security", "team:billing"],
        truncated: false,
      }

      // Test warn mode
      const warnResult = formatGitHubCheck(analysis, "warn")
      assert.equal(warnResult.name, "registry/blast-radius")
      assert.equal(warnResult.status, "neutral")
      assert.equal(warnResult.conclusion, "neutral")
      assert.ok(warnResult.title.includes("CRITICAL"))
      assert.ok(warnResult.summary.includes("2 direct impact(s)"))
      assert.ok(warnResult.summary.includes("3 transitive impact(s)"))
      assert.ok(warnResult.text.includes("lib-auth"))

      // Test fail mode
      const failResult = formatGitHubCheck(analysis, "fail")
      assert.equal(failResult.status, "failure")
      assert.equal(failResult.conclusion, "failure")
      // Other content should be the same
      assert.equal(failResult.title, warnResult.title)
      assert.equal(failResult.summary, warnResult.summary)
      assert.equal(failResult.text, warnResult.text)
    })
  })
})
