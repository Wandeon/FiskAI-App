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
import { computeDirectImpact, type DirectImpact } from "../system-registry/blast-radius"
import type { SystemComponent, ComponentDependency } from "../system-registry/schema"

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
