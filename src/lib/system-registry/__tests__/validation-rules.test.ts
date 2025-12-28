import { describe, it, beforeEach, afterEach } from "node:test"
import assert from "node:assert/strict"
import { mkdirSync, rmSync, writeFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import { applyValidationRules, enforceRules } from "../compute-drift"
import type { SystemComponent, DriftResult } from "../schema"

/**
 * Creates a minimal SystemComponent for testing.
 */
function createComponent(overrides: Partial<SystemComponent>): SystemComponent {
  return {
    componentId: "test-component",
    type: "WORKER",
    name: "Test Component",
    status: "STABLE",
    criticality: "MEDIUM",
    owner: "team:platform",
    docsRef: null,
    codeRef: null,
    dependencies: [],
    ...overrides,
  }
}

/**
 * Creates an empty DriftResult for testing enforceRules.
 */
function createEmptyDriftResult(): DriftResult {
  return {
    observedNotDeclared: [],
    declaredNotObserved: [],
    metadataGaps: [],
    codeRefInvalid: [],
    unknownIntegrations: [],
    governanceViolations: [],
    deprecatedOwners: [],
    summary: {
      observedTotal: 0,
      declaredTotal: 0,
      observedNotDeclaredCount: 0,
      declaredNotObservedCount: 0,
      metadataGapCount: 0,
      codeRefInvalidCount: 0,
      unknownIntegrationCount: 0,
      criticalIssues: 0,
      highIssues: 0,
    },
    typeCoverage: [],
  }
}

describe("Validation Rules", () => {
  describe("critical-needs-health", () => {
    it("warns when CRITICAL component has no healthCheck", () => {
      const component = createComponent({
        componentId: "critical-no-health",
        type: "MODULE", // Use MODULE to avoid service-needs-slo rule
        criticality: "CRITICAL",
        healthCheck: undefined,
      })

      const results = applyValidationRules([component])

      const healthWarning = results.find((r) => r.rule === "critical-needs-health")
      assert.ok(healthWarning)
      assert.equal(healthWarning.action, "WARN")
      assert.equal(healthWarning.message, "CRITICAL component should define healthCheck")
    })

    it("does not warn when CRITICAL component has healthCheck", () => {
      const component = createComponent({
        componentId: "critical-with-health",
        criticality: "CRITICAL",
        healthCheck: { endpoint: "/health" },
      })

      const results = applyValidationRules([component])

      const healthWarning = results.find((r) => r.rule === "critical-needs-health")
      assert.equal(healthWarning, undefined)
    })

    it("does not warn when non-CRITICAL component has no healthCheck", () => {
      const component = createComponent({
        componentId: "high-no-health",
        criticality: "HIGH",
        healthCheck: undefined,
      })

      const results = applyValidationRules([component])

      const healthWarning = results.find((r) => r.rule === "critical-needs-health")
      assert.equal(healthWarning, undefined)
    })
  })

  describe("service-needs-slo", () => {
    it("warns when WORKER has no SLO", () => {
      const component = createComponent({
        componentId: "worker-no-slo",
        type: "WORKER",
        slo: undefined,
      })

      const results = applyValidationRules([component])

      const sloWarning = results.find((r) => r.rule === "service-needs-slo")
      assert.ok(sloWarning)
      assert.equal(sloWarning.action, "WARN")
      assert.equal(sloWarning.message, "Service component should define SLO targets")
    })

    it("warns when INTEGRATION has no SLO", () => {
      const component = createComponent({
        componentId: "integration-no-slo",
        type: "INTEGRATION",
        slo: undefined,
      })

      const results = applyValidationRules([component])

      const sloWarning = results.find((r) => r.rule === "service-needs-slo")
      assert.ok(sloWarning)
      assert.equal(sloWarning.action, "WARN")
    })

    it("does not warn when WORKER has SLO", () => {
      const component = createComponent({
        componentId: "worker-with-slo",
        type: "WORKER",
        slo: { availability: "99.9%" },
      })

      const results = applyValidationRules([component])

      const sloWarning = results.find((r) => r.rule === "service-needs-slo")
      assert.equal(sloWarning, undefined)
    })

    it("does not warn for non-service types without SLO", () => {
      const component = createComponent({
        componentId: "module-no-slo",
        type: "MODULE",
        slo: undefined,
      })

      const results = applyValidationRules([component])

      const sloWarning = results.find((r) => r.rule === "service-needs-slo")
      assert.equal(sloWarning, undefined)
    })
  })

  describe("slo-needs-alert", () => {
    it("fails when component has SLO but no alertChannel", () => {
      const component = createComponent({
        componentId: "slo-no-alert",
        slo: { availability: "99.9%" },
        alertChannel: undefined,
      })

      const results = applyValidationRules([component])

      const alertFailure = results.find((r) => r.rule === "slo-needs-alert")
      assert.ok(alertFailure)
      assert.equal(alertFailure.action, "FAIL")
      assert.equal(alertFailure.message, "Component with SLO must have alertChannel")
    })

    it("does not fail when component has SLO and alertChannel", () => {
      const component = createComponent({
        componentId: "slo-with-alert",
        slo: { availability: "99.9%" },
        alertChannel: "#ops-critical",
      })

      const results = applyValidationRules([component])

      const alertFailure = results.find((r) => r.rule === "slo-needs-alert")
      assert.equal(alertFailure, undefined)
    })

    it("does not fail when component has no SLO", () => {
      const component = createComponent({
        componentId: "no-slo-no-alert",
        slo: undefined,
        alertChannel: undefined,
      })

      const results = applyValidationRules([component])

      const alertFailure = results.find((r) => r.rule === "slo-needs-alert")
      assert.equal(alertFailure, undefined)
    })
  })

  describe("runbook-exists", () => {
    let testDir: string

    beforeEach(() => {
      testDir = join(tmpdir(), `validation-rules-test-${Date.now()}`)
      mkdirSync(testDir, { recursive: true })
    })

    afterEach(() => {
      rmSync(testDir, { recursive: true, force: true })
    })

    it("warns when runbook path does not exist", () => {
      const component = createComponent({
        componentId: "invalid-runbook",
        runbook: "docs/runbooks/nonexistent.md",
      })

      const results = applyValidationRules([component], testDir)

      const runbookWarning = results.find((r) => r.rule === "runbook-exists")
      assert.ok(runbookWarning)
      assert.equal(runbookWarning.action, "WARN")
      assert.equal(runbookWarning.message, "Runbook path does not exist")
    })

    it("does not warn when runbook path exists", () => {
      // Create the runbook file
      const runbookDir = join(testDir, "docs/runbooks")
      mkdirSync(runbookDir, { recursive: true })
      writeFileSync(join(runbookDir, "service.md"), "# Runbook")

      const component = createComponent({
        componentId: "valid-runbook",
        runbook: "docs/runbooks/service.md",
      })

      const results = applyValidationRules([component], testDir)

      const runbookWarning = results.find((r) => r.rule === "runbook-exists")
      assert.equal(runbookWarning, undefined)
    })

    it("does not warn when no runbook is defined", () => {
      const component = createComponent({
        componentId: "no-runbook",
        runbook: undefined,
      })

      const results = applyValidationRules([component], testDir)

      const runbookWarning = results.find((r) => r.rule === "runbook-exists")
      assert.equal(runbookWarning, undefined)
    })
  })

  describe("enforceRules integration", () => {
    let testDir: string

    beforeEach(() => {
      testDir = join(tmpdir(), `enforce-rules-test-${Date.now()}`)
      mkdirSync(testDir, { recursive: true })
    })

    afterEach(() => {
      rmSync(testDir, { recursive: true, force: true })
    })

    it("includes validation rule failures in enforcement result", () => {
      const component = createComponent({
        componentId: "slo-without-alert",
        slo: { availability: "99.9%" },
        alertChannel: undefined,
      })

      const driftResult = createEmptyDriftResult()
      const result = enforceRules(driftResult, [], [component], testDir)

      assert.equal(result.passed, false)
      assert.equal(result.failures.length, 1)
      assert.equal(result.failures[0].rule, "slo-needs-alert")
    })

    it("includes validation rule warnings in enforcement result", () => {
      const component = createComponent({
        componentId: "critical-missing-health",
        type: "MODULE", // Use MODULE to avoid service-needs-slo rule
        criticality: "CRITICAL",
        healthCheck: undefined,
      })

      const driftResult = createEmptyDriftResult()
      const result = enforceRules(driftResult, [], [component], testDir)

      // Should pass because only warnings
      assert.equal(result.passed, true)
      const healthWarning = result.warnings.find((w) => w.rule === "critical-needs-health")
      assert.ok(healthWarning)
    })

    it("combines multiple validation rule results", () => {
      const components: SystemComponent[] = [
        createComponent({
          componentId: "worker-missing-slo",
          type: "WORKER",
          slo: undefined,
        }),
        createComponent({
          componentId: "component-with-invalid-runbook",
          runbook: "docs/nonexistent.md",
        }),
      ]

      const driftResult = createEmptyDriftResult()
      const result = enforceRules(driftResult, [], components, testDir)

      // Both are warnings, so should pass
      assert.equal(result.passed, true)
      assert.ok(result.warnings.length >= 2)
    })
  })
})
