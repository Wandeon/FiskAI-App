/**
 * Tests for blast-radius.ts
 *
 * Tests cover:
 * - Single file matches single component
 * - File matches multiple components (overlapping codeRefs)
 * - No matches returns empty
 * - Route group extraction from id
 * - codeRefs[] matching
 * - Each component type has working matchers
 * - Match type is recorded correctly
 */

import { describe, it, expect } from "vitest"
import {
  computeDirectImpact,
  computeTransitiveImpact,
  computeCriticalPathImpacts,
  DEFAULT_MAX_TRANSITIVE_NODES,
  type DirectImpact,
  type TransitiveImpact,
  type CriticalPathImpact,
} from "../system-registry/blast-radius"
import { buildGraph } from "../system-registry/dependency-graph"
import type { SystemComponent, ComponentDependency, CriticalPath } from "../system-registry/schema"

/**
 * Helper to create a minimal SystemComponent for testing.
 */
function makeComponent(
  componentId: string,
  type: SystemComponent["type"],
  codeRef: string | null,
  options: {
    codeRefs?: string[]
    dependencies?: ComponentDependency[]
  } = {}
): SystemComponent {
  return {
    componentId,
    type,
    name: componentId,
    status: "STABLE",
    criticality: "MEDIUM",
    owner: "team:test",
    docsRef: null,
    codeRef,
    codeRefs: options.codeRefs,
    dependencies: options.dependencies ?? [],
  }
}

describe("computeDirectImpact", () => {
  describe("basic matching", () => {
    it("returns empty array when no files provided", () => {
      const components = [makeComponent("lib-auth", "LIB", "src/lib/auth/")]
      const result = computeDirectImpact([], components)
      expect(result).toEqual([])
    })

    it("returns empty array when no components provided", () => {
      const result = computeDirectImpact(["src/lib/auth/session.ts"], [])
      expect(result).toEqual([])
    })

    it("returns empty array when no matches found", () => {
      const components = [makeComponent("lib-auth", "LIB", "src/lib/auth/")]
      const result = computeDirectImpact(["src/lib/billing/index.ts"], components)
      expect(result).toEqual([])
    })

    it("matches single file to single component", () => {
      const components = [makeComponent("lib-auth", "LIB", "src/lib/auth/")]
      const result = computeDirectImpact(["src/lib/auth/session.ts"], components)

      expect(result).toHaveLength(1)
      expect(result[0].component.componentId).toBe("lib-auth")
      expect(result[0].matchedFiles).toEqual(["src/lib/auth/session.ts"])
      expect(result[0].matchType).toBe("codeRef")
    })

    it("matches multiple files to single component", () => {
      const components = [makeComponent("lib-auth", "LIB", "src/lib/auth/")]
      const result = computeDirectImpact(
        ["src/lib/auth/session.ts", "src/lib/auth/utils.ts"],
        components
      )

      expect(result).toHaveLength(1)
      expect(result[0].component.componentId).toBe("lib-auth")
      expect(result[0].matchedFiles).toEqual([
        "src/lib/auth/session.ts",
        "src/lib/auth/utils.ts",
      ])
    })

    it("matches file to multiple components (overlapping codeRefs)", () => {
      const components = [
        makeComponent("lib-auth", "LIB", "src/lib/auth/"),
        makeComponent("lib-auth-utils", "LIB", "src/lib/auth/utils/"),
      ]
      const result = computeDirectImpact(
        ["src/lib/auth/utils/helpers.ts"],
        components
      )

      expect(result).toHaveLength(2)
      const componentIds = result.map((r) => r.component.componentId).sort()
      expect(componentIds).toEqual(["lib-auth", "lib-auth-utils"])
    })

    it("handles file path without trailing slash in codeRef", () => {
      const components = [makeComponent("lib-auth", "LIB", "src/lib/auth")]
      const result = computeDirectImpact(["src/lib/auth/session.ts"], components)

      expect(result).toHaveLength(1)
      expect(result[0].component.componentId).toBe("lib-auth")
    })

    it("handles exact file match for single-file codeRefs", () => {
      const components = [
        makeComponent(
          "integration-fina-cis",
          "INTEGRATION",
          "src/lib/fiscal/porezna-client.ts"
        ),
      ]
      const result = computeDirectImpact(
        ["src/lib/fiscal/porezna-client.ts"],
        components
      )

      expect(result).toHaveLength(1)
      expect(result[0].component.componentId).toBe("integration-fina-cis")
    })

    it("normalizes paths with leading ./", () => {
      const components = [makeComponent("lib-auth", "LIB", "./src/lib/auth/")]
      const result = computeDirectImpact(["src/lib/auth/session.ts"], components)

      expect(result).toHaveLength(1)
      expect(result[0].component.componentId).toBe("lib-auth")
    })
  })

  describe("codeRefs[] matching", () => {
    it("matches file via codeRefs when codeRef is null", () => {
      const components = [
        makeComponent("lib-multi", "LIB", null, {
          codeRefs: ["src/lib/foo/", "src/lib/bar/"],
        }),
      ]
      const result = computeDirectImpact(["src/lib/foo/index.ts"], components)

      expect(result).toHaveLength(1)
      expect(result[0].component.componentId).toBe("lib-multi")
      expect(result[0].matchType).toBe("codeRefs")
    })

    it("matches file via codeRefs when codeRef exists but does not match", () => {
      const components = [
        makeComponent("lib-multi", "LIB", "src/lib/main/", {
          codeRefs: ["src/lib/secondary/"],
        }),
      ]
      const result = computeDirectImpact(["src/lib/secondary/helper.ts"], components)

      expect(result).toHaveLength(1)
      expect(result[0].matchType).toBe("codeRefs")
    })

    it("prefers codeRef match type when codeRef matches", () => {
      const components = [
        makeComponent("lib-multi", "LIB", "src/lib/main/", {
          codeRefs: ["src/lib/secondary/"],
        }),
      ]
      const result = computeDirectImpact(["src/lib/main/index.ts"], components)

      expect(result).toHaveLength(1)
      expect(result[0].matchType).toBe("codeRef")
    })

    it("handles multiple codeRefs", () => {
      const components = [
        makeComponent("lib-multi", "LIB", null, {
          codeRefs: ["src/lib/a/", "src/lib/b/", "src/lib/c/"],
        }),
      ]

      const result = computeDirectImpact(
        ["src/lib/a/file.ts", "src/lib/c/file.ts"],
        components
      )

      expect(result).toHaveLength(1)
      expect(result[0].matchedFiles).toEqual(["src/lib/a/file.ts", "src/lib/c/file.ts"])
    })
  })

  describe("ROUTE_GROUP matching", () => {
    it("extracts group name from route-group-auth", () => {
      const components = [
        makeComponent("route-group-auth", "ROUTE_GROUP", "src/app/api/auth/"),
      ]
      const result = computeDirectImpact(["src/app/api/auth/route.ts"], components)

      expect(result).toHaveLength(1)
      expect(result[0].component.componentId).toBe("route-group-auth")
      expect(result[0].matchType).toBe("route_group")
    })

    it("extracts hyphenated group name correctly", () => {
      const components = [
        makeComponent("route-group-e-invoices", "ROUTE_GROUP", "src/app/api/e-invoices/"),
      ]
      const result = computeDirectImpact(
        ["src/app/api/e-invoices/[id]/route.ts"],
        components
      )

      expect(result).toHaveLength(1)
      expect(result[0].component.componentId).toBe("route-group-e-invoices")
    })

    it("matches route group via computed path, not just codeRef", () => {
      // Even if codeRef is null, route groups should match via ID pattern
      const components = [
        makeComponent("route-group-billing", "ROUTE_GROUP", null),
      ]
      const result = computeDirectImpact(["src/app/api/billing/route.ts"], components)

      expect(result).toHaveLength(1)
      expect(result[0].matchType).toBe("route_group")
    })

    it("does not match route group for wrong API path", () => {
      const components = [
        makeComponent("route-group-auth", "ROUTE_GROUP", "src/app/api/auth/"),
      ]
      const result = computeDirectImpact(["src/app/api/billing/route.ts"], components)

      expect(result).toEqual([])
    })

    it("matches nested route files", () => {
      const components = [
        makeComponent("route-group-admin", "ROUTE_GROUP", "src/app/api/admin/"),
      ]
      const result = computeDirectImpact(
        ["src/app/api/admin/users/[id]/route.ts"],
        components
      )

      expect(result).toHaveLength(1)
    })
  })

  describe("WORKER matching", () => {
    it("matches worker via codeRef", () => {
      const components = [
        makeComponent(
          "worker-sentinel",
          "WORKER",
          "src/lib/regulatory-truth/workers/sentinel.worker.ts"
        ),
      ]
      const result = computeDirectImpact(
        ["src/lib/regulatory-truth/workers/sentinel.worker.ts"],
        components
      )

      expect(result).toHaveLength(1)
      expect(result[0].component.componentId).toBe("worker-sentinel")
      expect(result[0].matchType).toBe("worker")
    })

    it("matches worker via codeRefs", () => {
      const components = [
        makeComponent("worker-multi", "WORKER", null, {
          codeRefs: ["src/workers/main.ts", "src/workers/helpers/"],
        }),
      ]
      const result = computeDirectImpact(["src/workers/helpers/util.ts"], components)

      expect(result).toHaveLength(1)
      expect(result[0].matchType).toBe("worker")
    })

    it("does not match worker for unrelated file", () => {
      const components = [
        makeComponent(
          "worker-sentinel",
          "WORKER",
          "src/lib/regulatory-truth/workers/sentinel.worker.ts"
        ),
      ]
      const result = computeDirectImpact(
        ["src/lib/regulatory-truth/workers/extractor.worker.ts"],
        components
      )

      expect(result).toEqual([])
    })
  })

  describe("QUEUE matching", () => {
    it("matches queue via allowed factory path and codeRef", () => {
      const components = [
        makeComponent(
          "queue-sentinel",
          "QUEUE",
          "src/lib/regulatory-truth/workers/queues.ts"
        ),
      ]
      const result = computeDirectImpact(
        ["src/lib/regulatory-truth/workers/queues.ts"],
        components
      )

      expect(result).toHaveLength(1)
      expect(result[0].component.componentId).toBe("queue-sentinel")
      expect(result[0].matchType).toBe("queue")
    })

    it("matches all queues when queues.ts is changed", () => {
      const components = [
        makeComponent(
          "queue-sentinel",
          "QUEUE",
          "src/lib/regulatory-truth/workers/queues.ts"
        ),
        makeComponent(
          "queue-extract",
          "QUEUE",
          "src/lib/regulatory-truth/workers/queues.ts"
        ),
        makeComponent(
          "queue-compose",
          "QUEUE",
          "src/lib/regulatory-truth/workers/queues.ts"
        ),
      ]
      const result = computeDirectImpact(
        ["src/lib/regulatory-truth/workers/queues.ts"],
        components
      )

      expect(result).toHaveLength(3)
      const ids = result.map((r) => r.component.componentId).sort()
      expect(ids).toEqual(["queue-compose", "queue-extract", "queue-sentinel"])
    })

    it("does not match queue for non-allowed path", () => {
      const components = [
        makeComponent(
          "queue-sentinel",
          "QUEUE",
          "src/lib/regulatory-truth/workers/queues.ts"
        ),
      ]
      const result = computeDirectImpact(
        ["src/lib/other/queues.ts"],
        components
      )

      expect(result).toEqual([])
    })
  })

  describe("INTEGRATION matching", () => {
    it("matches integration via codeRef", () => {
      const components = [
        makeComponent("integration-stripe", "INTEGRATION", "src/lib/stripe/"),
      ]
      const result = computeDirectImpact(["src/lib/stripe/client.ts"], components)

      expect(result).toHaveLength(1)
      expect(result[0].component.componentId).toBe("integration-stripe")
      expect(result[0].matchType).toBe("integration")
    })

    it("matches integration via codeRefs", () => {
      const components = [
        makeComponent("integration-multi", "INTEGRATION", null, {
          codeRefs: ["src/lib/integrations/foo/", "src/app/api/foo/webhooks/"],
        }),
      ]
      const result = computeDirectImpact(
        ["src/app/api/foo/webhooks/route.ts"],
        components
      )

      expect(result).toHaveLength(1)
      expect(result[0].matchType).toBe("integration")
    })
  })

  describe("LIB matching", () => {
    it("matches lib via codeRef", () => {
      const components = [makeComponent("lib-utils", "LIB", "src/lib/utils/")]
      const result = computeDirectImpact(["src/lib/utils/helpers.ts"], components)

      expect(result).toHaveLength(1)
      expect(result[0].matchType).toBe("codeRef")
    })

    it("matches lib via codeRefs", () => {
      const components = [
        makeComponent("lib-shared", "LIB", "src/lib/shared/", {
          codeRefs: ["src/app/shared/"],
        }),
      ]
      const result = computeDirectImpact(["src/app/shared/types.ts"], components)

      expect(result).toHaveLength(1)
      expect(result[0].matchType).toBe("codeRefs")
    })
  })

  describe("MODULE matching", () => {
    it("matches module via codeRef", () => {
      const components = [
        makeComponent("module-invoicing", "MODULE", "src/lib/modules/definitions.ts"),
      ]
      const result = computeDirectImpact(
        ["src/lib/modules/definitions.ts"],
        components
      )

      expect(result).toHaveLength(1)
      expect(result[0].component.componentId).toBe("module-invoicing")
    })
  })

  describe("UI matching", () => {
    it("matches UI component via codeRef", () => {
      const components = [makeComponent("ui-portal-app", "UI", "src/app/(app)/")]
      const result = computeDirectImpact(
        ["src/app/(app)/dashboard/page.tsx"],
        components
      )

      expect(result).toHaveLength(1)
      expect(result[0].component.componentId).toBe("ui-portal-app")
    })
  })

  describe("JOB matching", () => {
    it("matches job via codeRef", () => {
      const components = [
        makeComponent("job-fiscal-processor", "JOB", "src/app/api/cron/fiscal/"),
      ]
      const result = computeDirectImpact(
        ["src/app/api/cron/fiscal/route.ts"],
        components
      )

      expect(result).toHaveLength(1)
      expect(result[0].component.componentId).toBe("job-fiscal-processor")
    })
  })

  describe("STORE matching", () => {
    it("matches store via codeRef", () => {
      const components = [
        makeComponent("store-postgresql", "STORE", "prisma/schema.prisma"),
      ]
      const result = computeDirectImpact(["prisma/schema.prisma"], components)

      expect(result).toHaveLength(1)
      expect(result[0].component.componentId).toBe("store-postgresql")
    })
  })

  describe("edge cases", () => {
    it("handles component with null codeRef and no codeRefs", () => {
      const components = [makeComponent("lib-unknown", "LIB", null)]
      const result = computeDirectImpact(["src/lib/unknown/file.ts"], components)

      expect(result).toEqual([])
    })

    it("handles empty codeRefs array", () => {
      const components = [
        makeComponent("lib-empty", "LIB", null, { codeRefs: [] }),
      ]
      const result = computeDirectImpact(["src/lib/empty/file.ts"], components)

      expect(result).toEqual([])
    })

    it("deduplicates files when same file matches via codeRef and codeRefs", () => {
      const components = [
        makeComponent("lib-overlap", "LIB", "src/lib/overlap/", {
          codeRefs: ["src/lib/overlap/"],
        }),
      ]
      const result = computeDirectImpact(["src/lib/overlap/file.ts"], components)

      expect(result).toHaveLength(1)
      expect(result[0].matchedFiles).toEqual(["src/lib/overlap/file.ts"])
      // Should prefer codeRef match type
      expect(result[0].matchType).toBe("codeRef")
    })

    it("returns sorted results by componentId", () => {
      const components = [
        makeComponent("lib-zebra", "LIB", "src/lib/zebra/"),
        makeComponent("lib-alpha", "LIB", "src/lib/alpha/"),
        makeComponent("lib-middle", "LIB", "src/lib/middle/"),
      ]
      const result = computeDirectImpact(
        [
          "src/lib/zebra/file.ts",
          "src/lib/alpha/file.ts",
          "src/lib/middle/file.ts",
        ],
        components
      )

      expect(result).toHaveLength(3)
      expect(result.map((r) => r.component.componentId)).toEqual([
        "lib-alpha",
        "lib-middle",
        "lib-zebra",
      ])
    })

    it("returns sorted matchedFiles within each impact", () => {
      const components = [makeComponent("lib-test", "LIB", "src/lib/test/")]
      const result = computeDirectImpact(
        ["src/lib/test/z.ts", "src/lib/test/a.ts", "src/lib/test/m.ts"],
        components
      )

      expect(result).toHaveLength(1)
      expect(result[0].matchedFiles).toEqual([
        "src/lib/test/a.ts",
        "src/lib/test/m.ts",
        "src/lib/test/z.ts",
      ])
    })
  })
})

describe("computeTransitiveImpact", () => {
  describe("basic cases", () => {
    it("returns empty when no transitive deps exist", () => {
      // A is directly impacted, but nothing depends on A
      const components = [makeComponent("A", "LIB", "src/lib/a/")]
      const graph = buildGraph(components)

      const result = computeTransitiveImpact(["A"], graph, components)

      expect(result.impacts).toEqual([])
      expect(result.truncated).toBe(false)
    })

    it("returns empty when direct components have no dependents", () => {
      // A depends on B, but B is the direct impact, so A is transitive
      // However, if we pass A as direct, and nothing depends on A, empty result
      const components = [
        makeComponent("A", "LIB", "src/lib/a/", {
          dependencies: [{ componentId: "B", type: "HARD" }],
        }),
        makeComponent("B", "LIB", "src/lib/b/"),
      ]
      const graph = buildGraph(components)

      // A is direct, nothing depends on A
      const result = computeTransitiveImpact(["A"], graph, components)

      expect(result.impacts).toEqual([])
      expect(result.truncated).toBe(false)
    })

    it("excludes direct components from results", () => {
      const components = [
        makeComponent("A", "LIB", "src/lib/a/", {
          dependencies: [{ componentId: "B", type: "HARD" }],
        }),
        makeComponent("B", "LIB", "src/lib/b/"),
      ]
      const graph = buildGraph(components)

      // B is direct, A depends on B
      const result = computeTransitiveImpact(["B"], graph, components)

      expect(result.impacts).toHaveLength(1)
      expect(result.impacts[0].component.componentId).toBe("A")
      // B should not be in results
      expect(result.impacts.some((i) => i.component.componentId === "B")).toBe(
        false
      )
    })
  })

  describe("distance calculation", () => {
    it("computes distance 1 for direct dependents", () => {
      const components = [
        makeComponent("A", "LIB", "src/lib/a/", {
          dependencies: [{ componentId: "B", type: "HARD" }],
        }),
        makeComponent("B", "LIB", "src/lib/b/"),
      ]
      const graph = buildGraph(components)

      const result = computeTransitiveImpact(["B"], graph, components)

      expect(result.impacts).toHaveLength(1)
      expect(result.impacts[0].distance).toBe(1)
    })

    it("computes correct distances for linear chain", () => {
      // A -> B -> C (A depends on B, B depends on C)
      const components = [
        makeComponent("A", "LIB", "src/lib/a/", {
          dependencies: [{ componentId: "B", type: "HARD" }],
        }),
        makeComponent("B", "LIB", "src/lib/b/", {
          dependencies: [{ componentId: "C", type: "HARD" }],
        }),
        makeComponent("C", "LIB", "src/lib/c/"),
      ]
      const graph = buildGraph(components)

      // C is direct impact
      const result = computeTransitiveImpact(["C"], graph, components)

      expect(result.impacts).toHaveLength(2)

      const impactB = result.impacts.find(
        (i) => i.component.componentId === "B"
      )
      const impactA = result.impacts.find(
        (i) => i.component.componentId === "A"
      )

      expect(impactB?.distance).toBe(1) // B directly depends on C
      expect(impactA?.distance).toBe(2) // A depends on B which depends on C
    })

    it("computes minimum distance for diamond pattern", () => {
      // Diamond: A -> B, A -> C, B -> D, C -> D
      // If D is direct, both B and C are distance 1
      // A is distance 2 (through either B or C)
      const components = [
        makeComponent("A", "LIB", "src/lib/a/", {
          dependencies: [
            { componentId: "B", type: "HARD" },
            { componentId: "C", type: "HARD" },
          ],
        }),
        makeComponent("B", "LIB", "src/lib/b/", {
          dependencies: [{ componentId: "D", type: "HARD" }],
        }),
        makeComponent("C", "LIB", "src/lib/c/", {
          dependencies: [{ componentId: "D", type: "HARD" }],
        }),
        makeComponent("D", "LIB", "src/lib/d/"),
      ]
      const graph = buildGraph(components)

      const result = computeTransitiveImpact(["D"], graph, components)

      expect(result.impacts).toHaveLength(3)

      const impactB = result.impacts.find(
        (i) => i.component.componentId === "B"
      )
      const impactC = result.impacts.find(
        (i) => i.component.componentId === "C"
      )
      const impactA = result.impacts.find(
        (i) => i.component.componentId === "A"
      )

      expect(impactB?.distance).toBe(1)
      expect(impactC?.distance).toBe(1)
      expect(impactA?.distance).toBe(2)
    })
  })

  describe("path reconstruction", () => {
    it("tracks path for distance 1", () => {
      const components = [
        makeComponent("A", "LIB", "src/lib/a/", {
          dependencies: [{ componentId: "B", type: "HARD" }],
        }),
        makeComponent("B", "LIB", "src/lib/b/"),
      ]
      const graph = buildGraph(components)

      const result = computeTransitiveImpact(["B"], graph, components)

      expect(result.impacts).toHaveLength(1)
      expect(result.impacts[0].pathThrough).toEqual(["B"])
    })

    it("tracks path for linear chain", () => {
      // A -> B -> C
      const components = [
        makeComponent("A", "LIB", "src/lib/a/", {
          dependencies: [{ componentId: "B", type: "HARD" }],
        }),
        makeComponent("B", "LIB", "src/lib/b/", {
          dependencies: [{ componentId: "C", type: "HARD" }],
        }),
        makeComponent("C", "LIB", "src/lib/c/"),
      ]
      const graph = buildGraph(components)

      const result = computeTransitiveImpact(["C"], graph, components)

      const impactB = result.impacts.find(
        (i) => i.component.componentId === "B"
      )
      const impactA = result.impacts.find(
        (i) => i.component.componentId === "A"
      )

      expect(impactB?.pathThrough).toEqual(["C"])
      expect(impactA?.pathThrough).toEqual(["C", "B"])
    })

    it("captures one valid path for diamond pattern", () => {
      // Diamond: A -> B, A -> C, B -> D, C -> D
      const components = [
        makeComponent("A", "LIB", "src/lib/a/", {
          dependencies: [
            { componentId: "B", type: "HARD" },
            { componentId: "C", type: "HARD" },
          ],
        }),
        makeComponent("B", "LIB", "src/lib/b/", {
          dependencies: [{ componentId: "D", type: "HARD" }],
        }),
        makeComponent("C", "LIB", "src/lib/c/", {
          dependencies: [{ componentId: "D", type: "HARD" }],
        }),
        makeComponent("D", "LIB", "src/lib/d/"),
      ]
      const graph = buildGraph(components)

      const result = computeTransitiveImpact(["D"], graph, components)

      const impactA = result.impacts.find(
        (i) => i.component.componentId === "A"
      )

      // A's path should be either ["D", "B"] or ["D", "C"]
      // It should have length 2 (distance is 2)
      expect(impactA?.pathThrough).toHaveLength(2)
      expect(impactA?.pathThrough[0]).toBe("D")
      expect(["B", "C"]).toContain(impactA?.pathThrough[1])
    })
  })

  describe("cycle handling", () => {
    it("handles cycles without infinite loop", () => {
      // A -> B -> A (cycle)
      const components = [
        makeComponent("A", "LIB", "src/lib/a/", {
          dependencies: [{ componentId: "B", type: "HARD" }],
        }),
        makeComponent("B", "LIB", "src/lib/b/", {
          dependencies: [{ componentId: "A", type: "HARD" }],
        }),
      ]
      const graph = buildGraph(components)

      // A is direct, B depends on A
      const result = computeTransitiveImpact(["A"], graph, components)

      expect(result.impacts).toHaveLength(1)
      expect(result.impacts[0].component.componentId).toBe("B")
      expect(result.impacts[0].distance).toBe(1)
      expect(result.truncated).toBe(false)
    })

    it("handles larger cycles", () => {
      // A -> B -> C -> A
      const components = [
        makeComponent("A", "LIB", "src/lib/a/", {
          dependencies: [{ componentId: "B", type: "HARD" }],
        }),
        makeComponent("B", "LIB", "src/lib/b/", {
          dependencies: [{ componentId: "C", type: "HARD" }],
        }),
        makeComponent("C", "LIB", "src/lib/c/", {
          dependencies: [{ componentId: "A", type: "HARD" }],
        }),
      ]
      const graph = buildGraph(components)

      const result = computeTransitiveImpact(["A"], graph, components)

      // B and C should be found, but A is direct (excluded)
      expect(result.impacts).toHaveLength(2)
      expect(
        result.impacts.some((i) => i.component.componentId === "B")
      ).toBe(true)
      expect(
        result.impacts.some((i) => i.component.componentId === "C")
      ).toBe(true)
      expect(result.truncated).toBe(false)
    })
  })

  describe("truncation", () => {
    it("truncates at maxNodes limit", () => {
      // Create a star pattern: many components depend on ROOT
      const components: SystemComponent[] = [
        makeComponent("ROOT", "LIB", "src/lib/root/"),
      ]

      for (let i = 0; i < 100; i++) {
        components.push(
          makeComponent(`DEP${i}`, "LIB", `src/lib/dep${i}/`, {
            dependencies: [{ componentId: "ROOT", type: "HARD" }],
          })
        )
      }

      const graph = buildGraph(components)
      const result = computeTransitiveImpact(["ROOT"], graph, components)

      expect(result.impacts.length).toBe(DEFAULT_MAX_TRANSITIVE_NODES)
      expect(result.truncated).toBe(true)
    })

    it("respects custom maxNodes parameter", () => {
      const components: SystemComponent[] = [
        makeComponent("ROOT", "LIB", "src/lib/root/"),
      ]

      for (let i = 0; i < 20; i++) {
        components.push(
          makeComponent(`DEP${i}`, "LIB", `src/lib/dep${i}/`, {
            dependencies: [{ componentId: "ROOT", type: "HARD" }],
          })
        )
      }

      const graph = buildGraph(components)
      const result = computeTransitiveImpact(["ROOT"], graph, components, 5)

      expect(result.impacts.length).toBe(5)
      expect(result.truncated).toBe(true)
    })

    it("does not truncate when under limit", () => {
      const components: SystemComponent[] = [
        makeComponent("ROOT", "LIB", "src/lib/root/"),
      ]

      for (let i = 0; i < 10; i++) {
        components.push(
          makeComponent(`DEP${i}`, "LIB", `src/lib/dep${i}/`, {
            dependencies: [{ componentId: "ROOT", type: "HARD" }],
          })
        )
      }

      const graph = buildGraph(components)
      const result = computeTransitiveImpact(["ROOT"], graph, components)

      expect(result.impacts.length).toBe(10)
      expect(result.truncated).toBe(false)
    })
  })

  describe("multiple direct components", () => {
    it("handles multiple direct components", () => {
      // A -> X, B -> Y
      const components = [
        makeComponent("A", "LIB", "src/lib/a/", {
          dependencies: [{ componentId: "X", type: "HARD" }],
        }),
        makeComponent("B", "LIB", "src/lib/b/", {
          dependencies: [{ componentId: "Y", type: "HARD" }],
        }),
        makeComponent("X", "LIB", "src/lib/x/"),
        makeComponent("Y", "LIB", "src/lib/y/"),
      ]
      const graph = buildGraph(components)

      const result = computeTransitiveImpact(["X", "Y"], graph, components)

      expect(result.impacts).toHaveLength(2)
      expect(
        result.impacts.some((i) => i.component.componentId === "A")
      ).toBe(true)
      expect(
        result.impacts.some((i) => i.component.componentId === "B")
      ).toBe(true)
    })

    it("handles overlapping transitive impacts from multiple direct components", () => {
      // A -> X, A -> Y (A depends on both X and Y)
      const components = [
        makeComponent("A", "LIB", "src/lib/a/", {
          dependencies: [
            { componentId: "X", type: "HARD" },
            { componentId: "Y", type: "HARD" },
          ],
        }),
        makeComponent("X", "LIB", "src/lib/x/"),
        makeComponent("Y", "LIB", "src/lib/y/"),
      ]
      const graph = buildGraph(components)

      // Both X and Y are direct, A depends on both
      const result = computeTransitiveImpact(["X", "Y"], graph, components)

      expect(result.impacts).toHaveLength(1)
      expect(result.impacts[0].component.componentId).toBe("A")
      expect(result.impacts[0].distance).toBe(1)
    })
  })

  describe("edge cases", () => {
    it("handles empty direct components", () => {
      const components = [makeComponent("A", "LIB", "src/lib/a/")]
      const graph = buildGraph(components)

      const result = computeTransitiveImpact([], graph, components)

      expect(result.impacts).toEqual([])
      expect(result.truncated).toBe(false)
    })

    it("handles non-existent direct component gracefully", () => {
      const components = [makeComponent("A", "LIB", "src/lib/a/")]
      const graph = buildGraph(components)

      // "Z" doesn't exist
      const result = computeTransitiveImpact(["Z"], graph, components)

      expect(result.impacts).toEqual([])
      expect(result.truncated).toBe(false)
    })

    it("handles undeclared dependency in graph", () => {
      // A depends on UNDECLARED, but UNDECLARED is not in components list
      const components = [
        makeComponent("A", "LIB", "src/lib/a/", {
          dependencies: [{ componentId: "UNDECLARED", type: "HARD" }],
        }),
      ]
      const graph = buildGraph(components)

      // UNDECLARED is direct, A depends on it
      const result = computeTransitiveImpact(["UNDECLARED"], graph, components)

      // A should still be found (it depends on UNDECLARED)
      expect(result.impacts).toHaveLength(1)
      expect(result.impacts[0].component.componentId).toBe("A")
    })

    it("returns sorted results by componentId", () => {
      const components = [
        makeComponent("Zebra", "LIB", "src/lib/zebra/", {
          dependencies: [{ componentId: "ROOT", type: "HARD" }],
        }),
        makeComponent("Alpha", "LIB", "src/lib/alpha/", {
          dependencies: [{ componentId: "ROOT", type: "HARD" }],
        }),
        makeComponent("Middle", "LIB", "src/lib/middle/", {
          dependencies: [{ componentId: "ROOT", type: "HARD" }],
        }),
        makeComponent("ROOT", "LIB", "src/lib/root/"),
      ]
      const graph = buildGraph(components)

      const result = computeTransitiveImpact(["ROOT"], graph, components)

      expect(result.impacts.map((i) => i.component.componentId)).toEqual([
        "Alpha",
        "Middle",
        "Zebra",
      ])
    })
  })
})

describe("DEFAULT_MAX_TRANSITIVE_NODES constant", () => {
  it("is exported and equals 50", () => {
    expect(DEFAULT_MAX_TRANSITIVE_NODES).toBe(50)
  })
})

/**
 * Helper to create a minimal CriticalPath for testing.
 */
function makeCriticalPath(
  pathId: string,
  name: string,
  components: string[],
  reason: string = "Test reason"
): CriticalPath {
  return {
    pathId,
    name,
    components,
    reason,
  }
}

/**
 * Helper to create a TransitiveImpact for testing.
 */
function makeTransitiveImpact(
  componentId: string,
  distance: number,
  pathThrough: string[] = []
): TransitiveImpact {
  return {
    component: makeComponent(componentId, "LIB", `src/lib/${componentId}/`),
    distance,
    pathThrough,
  }
}

describe("computeCriticalPathImpacts", () => {
  describe("basic cases", () => {
    it("returns empty array when no critical paths provided", () => {
      const result = computeCriticalPathImpacts(
        ["lib-auth"],
        [],
        []
      )
      expect(result).toEqual([])
    })

    it("returns empty array when no impacts provided", () => {
      const criticalPaths = [
        makeCriticalPath("path-billing", "Billing Path", ["lib-billing", "integration-stripe"]),
      ]
      const result = computeCriticalPathImpacts([], [], criticalPaths)
      expect(result).toEqual([])
    })

    it("returns empty array when no critical path components are impacted", () => {
      const criticalPaths = [
        makeCriticalPath("path-billing", "Billing Path", ["lib-billing", "integration-stripe"]),
      ]
      const result = computeCriticalPathImpacts(
        ["lib-auth"], // Not in billing path
        [],
        criticalPaths
      )
      expect(result).toEqual([])
    })
  })

  describe("direct impact (distance 0)", () => {
    it("returns distance 0 when direct component is on critical path", () => {
      const criticalPaths = [
        makeCriticalPath("path-billing", "Billing Path", ["lib-billing", "integration-stripe"]),
      ]
      const result = computeCriticalPathImpacts(
        ["lib-billing"],
        [],
        criticalPaths
      )

      expect(result).toHaveLength(1)
      expect(result[0].pathId).toBe("path-billing")
      expect(result[0].pathName).toBe("Billing Path")
      expect(result[0].distance).toBe(0)
      expect(result[0].impactedComponents).toEqual(["lib-billing"])
    })

    it("lists all direct impact components on the path", () => {
      const criticalPaths = [
        makeCriticalPath("path-billing", "Billing Path", ["lib-billing", "integration-stripe", "route-group-webhooks"]),
      ]
      const result = computeCriticalPathImpacts(
        ["lib-billing", "route-group-webhooks"],
        [],
        criticalPaths
      )

      expect(result).toHaveLength(1)
      expect(result[0].distance).toBe(0)
      expect(result[0].impactedComponents).toEqual(["lib-billing", "route-group-webhooks"])
    })

    it("returns distance 0 even when transitive impacts exist", () => {
      const criticalPaths = [
        makeCriticalPath("path-billing", "Billing Path", ["lib-billing", "integration-stripe"]),
      ]
      const transitiveImpacts = [
        makeTransitiveImpact("integration-stripe", 2, ["other", "component"]),
      ]
      const result = computeCriticalPathImpacts(
        ["lib-billing"], // Direct impact
        transitiveImpacts,
        criticalPaths
      )

      expect(result).toHaveLength(1)
      expect(result[0].distance).toBe(0) // Direct takes precedence
      expect(result[0].impactedComponents).toContain("lib-billing")
      expect(result[0].impactedComponents).toContain("integration-stripe")
    })
  })

  describe("transitive impact", () => {
    it("returns correct distance for transitive impact", () => {
      const criticalPaths = [
        makeCriticalPath("path-auth", "Authentication Path", ["lib-auth", "store-postgresql"]),
      ]
      const transitiveImpacts = [
        makeTransitiveImpact("lib-auth", 3, ["A", "B", "C"]),
      ]
      const result = computeCriticalPathImpacts(
        [],
        transitiveImpacts,
        criticalPaths
      )

      expect(result).toHaveLength(1)
      expect(result[0].pathId).toBe("path-auth")
      expect(result[0].distance).toBe(3)
      expect(result[0].impactedComponents).toEqual(["lib-auth"])
    })

    it("returns minimum distance when multiple path components have different distances", () => {
      const criticalPaths = [
        makeCriticalPath("path-fiscal", "Fiscalization Path", ["lib-fiscal", "integration-fina-cis", "job-fiscal-processor"]),
      ]
      const transitiveImpacts = [
        makeTransitiveImpact("lib-fiscal", 1, ["direct"]),
        makeTransitiveImpact("integration-fina-cis", 4, ["A", "B", "C", "D"]),
        makeTransitiveImpact("job-fiscal-processor", 2, ["X", "Y"]),
      ]
      const result = computeCriticalPathImpacts(
        [],
        transitiveImpacts,
        criticalPaths
      )

      expect(result).toHaveLength(1)
      expect(result[0].distance).toBe(1) // Minimum of 1, 4, 2
      expect(result[0].impactedComponents).toEqual([
        "integration-fina-cis",
        "job-fiscal-processor",
        "lib-fiscal",
      ])
    })
  })

  describe("multiple critical paths", () => {
    it("returns multiple impacts when multiple paths are affected", () => {
      const criticalPaths = [
        makeCriticalPath("path-auth", "Authentication Path", ["lib-auth"]),
        makeCriticalPath("path-billing", "Billing Path", ["lib-billing"]),
        makeCriticalPath("path-fiscal", "Fiscalization Path", ["lib-fiscal"]),
      ]
      const result = computeCriticalPathImpacts(
        ["lib-auth", "lib-billing"],
        [],
        criticalPaths
      )

      expect(result).toHaveLength(2)
      expect(result.map(r => r.pathId)).toEqual(["path-auth", "path-billing"])
    })

    it("only returns affected paths", () => {
      const criticalPaths = [
        makeCriticalPath("path-auth", "Authentication Path", ["lib-auth"]),
        makeCriticalPath("path-billing", "Billing Path", ["lib-billing"]),
        makeCriticalPath("path-fiscal", "Fiscalization Path", ["lib-fiscal"]),
      ]
      const result = computeCriticalPathImpacts(
        ["lib-auth"],
        [],
        criticalPaths
      )

      expect(result).toHaveLength(1)
      expect(result[0].pathId).toBe("path-auth")
    })

    it("handles paths with different distances correctly", () => {
      const criticalPaths = [
        makeCriticalPath("path-auth", "Authentication Path", ["lib-auth"]),
        makeCriticalPath("path-billing", "Billing Path", ["lib-billing"]),
      ]
      const transitiveImpacts = [
        makeTransitiveImpact("lib-billing", 2, ["X", "Y"]),
      ]
      const result = computeCriticalPathImpacts(
        ["lib-auth"], // Direct impact to auth
        transitiveImpacts, // Transitive impact to billing
        criticalPaths
      )

      expect(result).toHaveLength(2)

      const authImpact = result.find(r => r.pathId === "path-auth")
      const billingImpact = result.find(r => r.pathId === "path-billing")

      expect(authImpact?.distance).toBe(0) // Direct
      expect(billingImpact?.distance).toBe(2) // Transitive
    })
  })

  describe("edge cases", () => {
    it("handles duplicate components in transitive impacts", () => {
      const criticalPaths = [
        makeCriticalPath("path-test", "Test Path", ["lib-test"]),
      ]
      // Same component with different distances (shouldn't happen normally, but handle gracefully)
      const transitiveImpacts = [
        makeTransitiveImpact("lib-test", 3, ["A", "B", "C"]),
        makeTransitiveImpact("lib-test", 1, ["X"]),
      ]
      const result = computeCriticalPathImpacts(
        [],
        transitiveImpacts,
        criticalPaths
      )

      expect(result).toHaveLength(1)
      expect(result[0].distance).toBe(1) // Should use minimum
    })

    it("returns sorted results by pathId", () => {
      const criticalPaths = [
        makeCriticalPath("path-zebra", "Zebra Path", ["lib-z"]),
        makeCriticalPath("path-alpha", "Alpha Path", ["lib-a"]),
        makeCriticalPath("path-middle", "Middle Path", ["lib-m"]),
      ]
      const result = computeCriticalPathImpacts(
        ["lib-z", "lib-a", "lib-m"],
        [],
        criticalPaths
      )

      expect(result).toHaveLength(3)
      expect(result.map(r => r.pathId)).toEqual([
        "path-alpha",
        "path-middle",
        "path-zebra",
      ])
    })

    it("returns sorted impactedComponents within each result", () => {
      const criticalPaths = [
        makeCriticalPath("path-test", "Test Path", ["lib-z", "lib-a", "lib-m"]),
      ]
      const result = computeCriticalPathImpacts(
        ["lib-z", "lib-a", "lib-m"],
        [],
        criticalPaths
      )

      expect(result).toHaveLength(1)
      expect(result[0].impactedComponents).toEqual(["lib-a", "lib-m", "lib-z"])
    })

    it("handles path with no components", () => {
      const criticalPaths = [
        makeCriticalPath("path-empty", "Empty Path", []),
      ]
      const result = computeCriticalPathImpacts(
        ["lib-auth"],
        [],
        criticalPaths
      )

      expect(result).toEqual([])
    })

    it("handles component that is both direct and transitive (direct wins)", () => {
      const criticalPaths = [
        makeCriticalPath("path-test", "Test Path", ["lib-test"]),
      ]
      const transitiveImpacts = [
        makeTransitiveImpact("lib-test", 5, ["A", "B", "C", "D", "E"]),
      ]
      const result = computeCriticalPathImpacts(
        ["lib-test"], // Also a direct impact
        transitiveImpacts,
        criticalPaths
      )

      expect(result).toHaveLength(1)
      expect(result[0].distance).toBe(0) // Direct takes precedence
    })
  })

  describe("integration with real CRITICAL_PATHS structure", () => {
    it("works with production-like critical path definitions", () => {
      // Simulate production critical paths structure
      const criticalPaths: CriticalPath[] = [
        {
          pathId: "path-fiscalization",
          name: "Fiscalization Path",
          components: [
            "module-fiscalization",
            "lib-fiscal",
            "integration-fina-cis",
            "job-fiscal-processor",
            "job-fiscal-retry",
            "job-certificate-check",
          ],
          reason: "Legal requirement - invoice fiscalization with Croatian Tax Authority",
          sloTarget: "99.9% success rate, <5s processing time",
        },
        {
          pathId: "path-billing",
          name: "Billing Path",
          components: [
            "route-group-billing",
            "lib-billing",
            "integration-stripe",
            "route-group-webhooks",
          ],
          reason: "Money movement - subscription billing and payment processing",
          sloTarget: "99.95% uptime, webhooks processed <30s",
        },
      ]

      // Simulate: lib-fiscal is directly changed, and integration-stripe is transitively affected
      const transitiveImpacts = [
        makeTransitiveImpact("integration-stripe", 2, ["A", "B"]),
      ]

      const result = computeCriticalPathImpacts(
        ["lib-fiscal"],
        transitiveImpacts,
        criticalPaths
      )

      expect(result).toHaveLength(2)

      const fiscalImpact = result.find(r => r.pathId === "path-fiscalization")
      const billingImpact = result.find(r => r.pathId === "path-billing")

      expect(fiscalImpact).toBeDefined()
      expect(fiscalImpact?.distance).toBe(0)
      expect(fiscalImpact?.impactedComponents).toContain("lib-fiscal")

      expect(billingImpact).toBeDefined()
      expect(billingImpact?.distance).toBe(2)
      expect(billingImpact?.impactedComponents).toContain("integration-stripe")
    })
  })
})
