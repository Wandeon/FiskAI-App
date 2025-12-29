import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { computeDrift, enforceRules } from "../system-registry/compute-drift"

describe("System Registry enforcement", () => {
  it("treats invalid owners as missing owners for CRITICAL components", () => {
    const observed = [
      {
        componentId: "module-test",
        type: "MODULE" as const,
        name: "Test Module",
        observedAt: ["src/lib/test"],
        discoveryMethod: "directory-exists" as const,
      },
    ]
    const declared = [
      {
        componentId: "module-test",
        type: "MODULE" as const,
        name: "Test Module",
        status: "STABLE" as const,
        criticality: "CRITICAL" as const,
        owner: "team:not-real",
        docsRef: "docs/README.md",
        codeRef: "src",
        dependencies: [],
        dependents: [],
        criticalPaths: [],
      },
    ]

    const drift = computeDrift(observed, declared, process.cwd())
    const gaps = drift.metadataGaps.find((g) => g.componentId === "module-test")

    assert.ok(gaps)
    assert.ok(gaps?.gaps?.includes("NO_OWNER"))

    const enforcement = enforceRules(drift)
    assert.ok(enforcement.failures.some((f) => f.componentId === "module-test"))
  })

  it("fails when ANY observed route group is not declared", () => {
    const observed = [
      {
        componentId: "route-group-foo",
        type: "ROUTE_GROUP" as const,
        name: "Foo API",
        observedAt: ["src/app/api/foo"],
        discoveryMethod: "route-scan" as const,
      },
    ]
    const declared: any[] = []

    const drift = computeDrift(observed, declared, process.cwd())
    const enforcement = enforceRules(drift)

    assert.ok(enforcement.failures.some((f) => f.componentId === "route-group-foo"))
  })
})
