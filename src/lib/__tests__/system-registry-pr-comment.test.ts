import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  formatPRComment,
  mapOwnerToMention,
  shouldShowTransitiveImpact,
  getCriticalPathComponentIds,
  type BlastAnalysis,
} from "../system-registry/formatters/pr-comment"
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

describe("mapOwnerToMention", () => {
  it("maps team:security to @fiskai/security", () => {
    assert.equal(mapOwnerToMention("team:security"), "@fiskai/security")
  })

  it("maps team:billing to @fiskai/billing", () => {
    assert.equal(mapOwnerToMention("team:billing"), "@fiskai/billing")
  })

  it("maps team:platform to @fiskai/platform", () => {
    assert.equal(mapOwnerToMention("team:platform"), "@fiskai/platform")
  })

  it("returns empty string for null/undefined/empty", () => {
    assert.equal(mapOwnerToMention(""), "")
    assert.equal(mapOwnerToMention(null as unknown as string), "")
    assert.equal(mapOwnerToMention(undefined as unknown as string), "")
  })

  it("preserves existing GitHub mentions", () => {
    assert.equal(mapOwnerToMention("@fiskai/security"), "@fiskai/security")
    assert.equal(mapOwnerToMention("@user"), "@user")
  })

  it("returns unknown formats as-is", () => {
    assert.equal(mapOwnerToMention("unknown-format"), "unknown-format")
  })
})

describe("shouldShowTransitiveImpact", () => {
  it("shows CRITICAL impacts regardless of distance", () => {
    const impact = makeTransitiveImpact("crit-comp", "CRITICAL", 5)
    assert.equal(shouldShowTransitiveImpact(impact, new Set()), true)
  })

  it("shows HIGH impacts regardless of distance", () => {
    const impact = makeTransitiveImpact("high-comp", "HIGH", 10)
    assert.equal(shouldShowTransitiveImpact(impact, new Set()), true)
  })

  it("shows MEDIUM impacts if distance is 1", () => {
    const impact = makeTransitiveImpact("medium-comp", "MEDIUM", 1)
    assert.equal(shouldShowTransitiveImpact(impact, new Set()), true)
  })

  it("shows LOW impacts if distance is 1", () => {
    const impact = makeTransitiveImpact("low-comp", "LOW", 1)
    assert.equal(shouldShowTransitiveImpact(impact, new Set()), true)
  })

  it("shows MEDIUM impacts if on critical path", () => {
    const impact = makeTransitiveImpact("medium-comp", "MEDIUM", 5)
    const criticalPathIds = new Set(["medium-comp"])
    assert.equal(shouldShowTransitiveImpact(impact, criticalPathIds), true)
  })

  it("shows LOW impacts if on critical path", () => {
    const impact = makeTransitiveImpact("low-comp", "LOW", 10)
    const criticalPathIds = new Set(["low-comp"])
    assert.equal(shouldShowTransitiveImpact(impact, criticalPathIds), true)
  })

  it("hides MEDIUM impacts if distance > 1 and not on critical path", () => {
    const impact = makeTransitiveImpact("medium-comp", "MEDIUM", 2)
    assert.equal(shouldShowTransitiveImpact(impact, new Set()), false)
  })

  it("hides LOW impacts if distance > 1 and not on critical path", () => {
    const impact = makeTransitiveImpact("low-comp", "LOW", 3)
    assert.equal(shouldShowTransitiveImpact(impact, new Set()), false)
  })
})

describe("getCriticalPathComponentIds", () => {
  it("returns empty set for empty input", () => {
    const result = getCriticalPathComponentIds([])
    assert.equal(result.size, 0)
  })

  it("extracts component IDs from single path", () => {
    const paths = [makeCriticalPathImpact("path-1", "Path 1", 0, ["comp-a", "comp-b"])]
    const result = getCriticalPathComponentIds(paths)
    assert.equal(result.size, 2)
    assert.ok(result.has("comp-a"))
    assert.ok(result.has("comp-b"))
  })

  it("extracts component IDs from multiple paths", () => {
    const paths = [
      makeCriticalPathImpact("path-1", "Path 1", 0, ["comp-a", "comp-b"]),
      makeCriticalPathImpact("path-2", "Path 2", 0, ["comp-b", "comp-c"]),
    ]
    const result = getCriticalPathComponentIds(paths)
    assert.equal(result.size, 3)
    assert.ok(result.has("comp-a"))
    assert.ok(result.has("comp-b"))
    assert.ok(result.has("comp-c"))
  })
})

describe("formatPRComment", () => {
  describe("empty analysis", () => {
    it("produces minimal valid markdown with just title", () => {
      const analysis = makeEmptyAnalysis()
      const result = formatPRComment(analysis)

      // Should have title
      assert.ok(result.includes("## "))
      assert.ok(result.includes("Blast Radius: LOW"))

      // Should not have other sections
      assert.ok(!result.includes("You touched:"))
      assert.ok(!result.includes("This may affect:"))
      assert.ok(!result.includes("Critical paths impacted:"))
      assert.ok(!result.includes("Owners to notify:"))
    })

    it("produces valid markdown", () => {
      const analysis = makeEmptyAnalysis()
      const result = formatPRComment(analysis)

      // Basic markdown validation - starts with heading
      assert.ok(result.startsWith("## "))
      // No consecutive newlines at start or end
      assert.ok(!result.startsWith("\n"))
    })
  })

  describe("title section", () => {
    it("shows correct score in title", () => {
      const analysis = makeEmptyAnalysis()
      analysis.score = makeBlastScore("CRITICAL")
      const result = formatPRComment(analysis)
      assert.ok(result.includes("Blast Radius: CRITICAL"))
    })

    it("shows LOW score for empty analysis", () => {
      const analysis = makeEmptyAnalysis()
      const result = formatPRComment(analysis)
      assert.ok(result.includes("Blast Radius: LOW"))
    })
  })

  describe("direct impacts section", () => {
    it("shows touched components", () => {
      const analysis = makeEmptyAnalysis()
      analysis.directImpacts = [
        makeDirectImpact("lib-auth", "HIGH"),
        makeDirectImpact("route-group-users", "MEDIUM"),
      ]
      const result = formatPRComment(analysis)

      assert.ok(result.includes("**You touched:**"))
      assert.ok(result.includes("`lib-auth`"))
      assert.ok(result.includes("`route-group-users`"))
    })

    it("omits section when no direct impacts", () => {
      const analysis = makeEmptyAnalysis()
      const result = formatPRComment(analysis)
      assert.ok(!result.includes("You touched:"))
    })
  })

  describe("transitive impacts section", () => {
    it("shows filtered transitive impacts", () => {
      const analysis = makeEmptyAnalysis()
      analysis.transitiveImpacts = [
        makeTransitiveImpact("worker-sync", "CRITICAL", 1, ["lib-auth"]),
        makeTransitiveImpact("integration-stripe", "HIGH", 2, ["lib-billing"]),
      ]
      const result = formatPRComment(analysis)

      assert.ok(result.includes("**This may affect:**"))
      assert.ok(result.includes("`worker-sync`"))
      assert.ok(result.includes("`integration-stripe`"))
    })

    it("shows criticality icons", () => {
      const analysis = makeEmptyAnalysis()
      analysis.transitiveImpacts = [
        makeTransitiveImpact("crit-comp", "CRITICAL", 1, []),
        makeTransitiveImpact("high-comp", "HIGH", 1, []),
      ]
      const result = formatPRComment(analysis)

      // Red circle for CRITICAL
      assert.ok(result.includes("\u{1F534}"))
      // Orange circle for HIGH
      assert.ok(result.includes("\u{1F7E0}"))
    })

    it("shows hop count", () => {
      const analysis = makeEmptyAnalysis()
      analysis.transitiveImpacts = [
        makeTransitiveImpact("comp-1", "CRITICAL", 1, []),
        makeTransitiveImpact("comp-2", "CRITICAL", 3, []),
      ]
      const result = formatPRComment(analysis)

      assert.ok(result.includes("1 hop"))
      assert.ok(result.includes("3 hops"))
    })

    it("filters out low-priority transitive impacts", () => {
      const analysis = makeEmptyAnalysis()
      analysis.transitiveImpacts = [
        makeTransitiveImpact("high-comp", "HIGH", 5, []), // shown: HIGH
        makeTransitiveImpact("low-comp", "LOW", 5, []), // hidden: LOW, distance > 1
      ]
      const result = formatPRComment(analysis)

      assert.ok(result.includes("`high-comp`"))
      // low-comp should not appear in "may affect" but should be in details
      const mayAffectSection = result.split("<details>")[0]
      assert.ok(!mayAffectSection.includes("`low-comp`"))
    })

    it("shows on critical path annotation", () => {
      const analysis = makeEmptyAnalysis()
      analysis.transitiveImpacts = [makeTransitiveImpact("billing-lib", "MEDIUM", 2, [])]
      analysis.criticalPathImpacts = [
        makeCriticalPathImpact("path-billing", "Billing", 0, ["billing-lib"]),
      ]
      const result = formatPRComment(analysis)

      assert.ok(result.includes("on critical path"))
    })

    it("omits section when no transitive impacts pass filter", () => {
      const analysis = makeEmptyAnalysis()
      analysis.transitiveImpacts = [
        makeTransitiveImpact("low-comp", "LOW", 5, []), // hidden
      ]
      const result = formatPRComment(analysis)

      const beforeDetails = result.split("<details>")[0]
      assert.ok(!beforeDetails.includes("This may affect:"))
    })
  })

  describe("critical paths section", () => {
    it("shows impacted critical paths", () => {
      const analysis = makeEmptyAnalysis()
      analysis.criticalPathImpacts = [
        makeCriticalPathImpact("path-billing", "Billing", 1, ["lib-billing"]),
      ]
      const result = formatPRComment(analysis)

      assert.ok(result.includes("**Critical paths impacted:**"))
      assert.ok(result.includes("Billing"))
      assert.ok(result.includes("distance: 1"))
    })

    it("shows multiple paths", () => {
      const analysis = makeEmptyAnalysis()
      analysis.criticalPathImpacts = [
        makeCriticalPathImpact("path-billing", "Billing", 0, []),
        makeCriticalPathImpact("path-auth", "Authentication", 1, []),
      ]
      const result = formatPRComment(analysis)

      assert.ok(result.includes("Billing"))
      assert.ok(result.includes("Authentication"))
    })

    it("omits section when no critical paths", () => {
      const analysis = makeEmptyAnalysis()
      const result = formatPRComment(analysis)
      assert.ok(!result.includes("Critical paths impacted:"))
    })
  })

  describe("owners section", () => {
    it("shows owner mentions", () => {
      const analysis = makeEmptyAnalysis()
      analysis.owners = ["team:security", "team:billing"]
      const result = formatPRComment(analysis)

      assert.ok(result.includes("**Owners to notify:**"))
      assert.ok(result.includes("@fiskai/security"))
      assert.ok(result.includes("@fiskai/billing"))
    })

    it("omits section when no owners", () => {
      const analysis = makeEmptyAnalysis()
      const result = formatPRComment(analysis)
      assert.ok(!result.includes("Owners to notify:"))
    })
  })

  describe("details section", () => {
    it("includes expandable details section", () => {
      const analysis = makeEmptyAnalysis()
      analysis.directImpacts = [makeDirectImpact("lib-auth", "HIGH")]
      const result = formatPRComment(analysis)

      assert.ok(result.includes("<details>"))
      assert.ok(result.includes("<summary>Full impact analysis</summary>"))
      assert.ok(result.includes("</details>"))
    })

    it("shows direct impacts table in details", () => {
      const analysis = makeEmptyAnalysis()
      analysis.directImpacts = [makeDirectImpact("lib-auth", "HIGH")]
      const result = formatPRComment(analysis)

      assert.ok(result.includes("### Direct Impacts"))
      assert.ok(result.includes("| Component | Type | Criticality | Match Type | Files |"))
    })

    it("shows transitive impacts table in details", () => {
      const analysis = makeEmptyAnalysis()
      analysis.transitiveImpacts = [
        makeTransitiveImpact("worker-sync", "HIGH", 2, ["lib-auth", "lib-db"]),
      ]
      const result = formatPRComment(analysis)

      assert.ok(result.includes("### Transitive Impacts"))
      assert.ok(result.includes("| Component | Type | Criticality | Distance | Path Through |"))
      assert.ok(result.includes("`lib-auth` -> `lib-db`"))
    })

    it("shows truncation notice in details", () => {
      const analysis = makeEmptyAnalysis()
      analysis.transitiveImpacts = [makeTransitiveImpact("comp", "HIGH", 1, [])]
      analysis.truncated = true
      const result = formatPRComment(analysis)

      assert.ok(result.includes("### Transitive Impacts (truncated)"))
    })

    it("shows critical paths table in details", () => {
      const analysis = makeEmptyAnalysis()
      analysis.criticalPathImpacts = [
        makeCriticalPathImpact("path-billing", "Billing", 0, ["lib-billing"]),
      ]
      const result = formatPRComment(analysis)

      assert.ok(result.includes("### Critical Paths"))
      assert.ok(result.includes("| Path | ID | Distance | Impacted Components |"))
    })

    it("shows score breakdown when bumps exist", () => {
      const analysis = makeEmptyAnalysis()
      analysis.directImpacts = [makeDirectImpact("lib-auth", "LOW")]
      analysis.score = makeBlastScore("MEDIUM", "LOW", [
        { from: "LOW", to: "MEDIUM", reason: "Critical path impacted" },
      ])
      const result = formatPRComment(analysis)

      assert.ok(result.includes("### Score Breakdown"))
      assert.ok(result.includes("Base score: **LOW**"))
      assert.ok(result.includes("Final score: **MEDIUM**"))
      assert.ok(result.includes("LOW -> MEDIUM"))
      assert.ok(result.includes("Critical path impacted"))
    })

    it("omits details section when no impacts", () => {
      const analysis = makeEmptyAnalysis()
      const result = formatPRComment(analysis)
      assert.ok(!result.includes("<details>"))
    })
  })

  describe("full example", () => {
    it("produces complete output matching design format", () => {
      const analysis: BlastAnalysis = {
        directImpacts: [
          makeDirectImpact("lib-auth", "HIGH", "team:security"),
          makeDirectImpact("route-group-users", "MEDIUM"),
        ],
        transitiveImpacts: [
          makeTransitiveImpact("worker-subscription-sync", "CRITICAL", 1, ["lib-auth"]),
          makeTransitiveImpact("integration-stripe", "HIGH", 2, ["lib-billing"]),
        ],
        criticalPathImpacts: [
          makeCriticalPathImpact("path-billing", "Billing", 1, ["integration-stripe"]),
        ],
        score: makeBlastScore("HIGH", "MEDIUM", [
          {
            from: "MEDIUM",
            to: "HIGH",
            reason: "Critical path impacted: Billing",
          },
        ]),
        owners: ["team:security", "team:billing"],
        truncated: false,
      }

      const result = formatPRComment(analysis)

      // Check structure
      assert.ok(result.includes("## "))
      assert.ok(result.includes("Blast Radius: HIGH"))
      assert.ok(result.includes("**You touched:**"))
      assert.ok(result.includes("**This may affect:**"))
      assert.ok(result.includes("**Critical paths impacted:**"))
      assert.ok(result.includes("**Owners to notify:**"))
      assert.ok(result.includes("<details>"))

      // Check content
      assert.ok(result.includes("`lib-auth`"))
      assert.ok(result.includes("`route-group-users`"))
      assert.ok(result.includes("`worker-subscription-sync`"))
      assert.ok(result.includes("@fiskai/security"))
      assert.ok(result.includes("@fiskai/billing"))
      assert.ok(result.includes("Billing"))
    })
  })

  describe("markdown validity", () => {
    it("produces valid markdown with balanced tags", () => {
      const analysis: BlastAnalysis = {
        directImpacts: [makeDirectImpact("lib-auth", "HIGH")],
        transitiveImpacts: [makeTransitiveImpact("worker", "HIGH", 1, [])],
        criticalPathImpacts: [makeCriticalPathImpact("path", "Path", 0, [])],
        score: makeBlastScore("HIGH", "MEDIUM", [{ from: "MEDIUM", to: "HIGH", reason: "test" }]),
        owners: ["team:security"],
        truncated: false,
      }

      const result = formatPRComment(analysis)

      // Check balanced details tags
      const detailsOpens = (result.match(/<details>/g) || []).length
      const detailsCloses = (result.match(/<\/details>/g) || []).length
      assert.equal(detailsOpens, detailsCloses)

      // Check balanced summary tags
      const summaryOpens = (result.match(/<summary>/g) || []).length
      const summaryCloses = (result.match(/<\/summary>/g) || []).length
      assert.equal(summaryOpens, summaryCloses)

      // Check balanced code ticks
      const backticks = (result.match(/`/g) || []).length
      assert.equal(backticks % 2, 0) // Should be even number
    })

    it("has no orphaned newlines", () => {
      const analysis = makeEmptyAnalysis()
      analysis.directImpacts = [makeDirectImpact("comp", "HIGH")]
      const result = formatPRComment(analysis)

      // No more than 2 consecutive newlines
      assert.ok(!result.includes("\n\n\n"))
    })
  })
})
