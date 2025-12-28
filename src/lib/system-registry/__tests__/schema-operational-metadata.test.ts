import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  validateHealthCheck,
  validateSLO,
  validateAlertChannel,
  validateRunbook,
  validateOperationalMetadata,
  type HealthCheck,
  type SLO,
} from "../schema"

describe("Operational Metadata Validation", () => {
  describe("validateHealthCheck", () => {
    it("returns valid for undefined healthCheck", () => {
      const result = validateHealthCheck(undefined)
      assert.equal(result.valid, true)
      assert.deepEqual(result.errors, [])
    })

    it("returns valid for healthCheck with endpoint", () => {
      const healthCheck: HealthCheck = {
        endpoint: "/health",
        interval: "30s",
      }
      const result = validateHealthCheck(healthCheck)
      assert.equal(result.valid, true)
      assert.deepEqual(result.errors, [])
    })

    it("returns valid for healthCheck with command", () => {
      const healthCheck: HealthCheck = {
        command: "pg_isready -h localhost",
        interval: "60s",
      }
      const result = validateHealthCheck(healthCheck)
      assert.equal(result.valid, true)
      assert.deepEqual(result.errors, [])
    })

    it("returns valid for healthCheck with both endpoint and command", () => {
      const healthCheck: HealthCheck = {
        endpoint: "/health",
        command: "curl localhost:3000/health",
      }
      const result = validateHealthCheck(healthCheck)
      assert.equal(result.valid, true)
      assert.deepEqual(result.errors, [])
    })

    it("returns invalid for empty healthCheck object", () => {
      const healthCheck: HealthCheck = {}
      const result = validateHealthCheck(healthCheck)
      assert.equal(result.valid, false)
      assert.ok(result.errors.some((e) => e.includes("at least endpoint or command")))
    })

    it("returns invalid for healthCheck with only interval", () => {
      const healthCheck: HealthCheck = {
        interval: "30s",
      }
      const result = validateHealthCheck(healthCheck)
      assert.equal(result.valid, false)
      assert.ok(result.errors.some((e) => e.includes("at least endpoint or command")))
    })

    it("returns invalid for empty endpoint string", () => {
      const healthCheck: HealthCheck = {
        endpoint: "  ",
      }
      const result = validateHealthCheck(healthCheck)
      assert.equal(result.valid, false)
      assert.ok(result.errors.some((e) => e.includes("endpoint must be non-empty")))
    })

    it("returns invalid for empty command string", () => {
      const healthCheck: HealthCheck = {
        command: "",
      }
      const result = validateHealthCheck(healthCheck)
      assert.equal(result.valid, false)
      assert.ok(result.errors.some((e) => e.includes("command must be non-empty")))
    })
  })

  describe("validateSLO", () => {
    it("returns valid for undefined slo", () => {
      const result = validateSLO(undefined)
      assert.equal(result.valid, true)
      assert.deepEqual(result.errors, [])
    })

    it("returns valid for slo with availability", () => {
      const slo: SLO = {
        availability: "99.9%",
      }
      const result = validateSLO(slo)
      assert.equal(result.valid, true)
      assert.deepEqual(result.errors, [])
    })

    it("returns valid for slo with latencyP50", () => {
      const slo: SLO = {
        latencyP50: "100ms",
      }
      const result = validateSLO(slo)
      assert.equal(result.valid, true)
      assert.deepEqual(result.errors, [])
    })

    it("returns valid for slo with latencyP99", () => {
      const slo: SLO = {
        latencyP99: "500ms",
      }
      const result = validateSLO(slo)
      assert.equal(result.valid, true)
      assert.deepEqual(result.errors, [])
    })

    it("returns valid for slo with errorBudget", () => {
      const slo: SLO = {
        errorBudget: "0.1%",
      }
      const result = validateSLO(slo)
      assert.equal(result.valid, true)
      assert.deepEqual(result.errors, [])
    })

    it("returns valid for slo with multiple metrics", () => {
      const slo: SLO = {
        availability: "99.9%",
        latencyP50: "100ms",
        latencyP99: "500ms",
        errorBudget: "0.1%",
      }
      const result = validateSLO(slo)
      assert.equal(result.valid, true)
      assert.deepEqual(result.errors, [])
    })

    it("returns invalid for empty slo object", () => {
      const slo: SLO = {}
      const result = validateSLO(slo)
      assert.equal(result.valid, false)
      assert.ok(result.errors.some((e) => e.includes("at least one metric")))
    })

    it("returns invalid for empty availability string", () => {
      const slo: SLO = {
        availability: "",
      }
      const result = validateSLO(slo)
      assert.equal(result.valid, false)
      assert.ok(result.errors.some((e) => e.includes("availability must be non-empty")))
    })

    it("returns invalid for whitespace-only latencyP50", () => {
      const slo: SLO = {
        latencyP50: "   ",
      }
      const result = validateSLO(slo)
      assert.equal(result.valid, false)
      assert.ok(result.errors.some((e) => e.includes("latencyP50 must be non-empty")))
    })
  })

  describe("validateAlertChannel", () => {
    it("returns valid for undefined alertChannel", () => {
      const result = validateAlertChannel(undefined)
      assert.equal(result.valid, true)
      assert.deepEqual(result.errors, [])
    })

    it("returns valid for non-empty alertChannel", () => {
      const result = validateAlertChannel("#ops-critical")
      assert.equal(result.valid, true)
      assert.deepEqual(result.errors, [])
    })

    it("returns invalid for empty alertChannel", () => {
      const result = validateAlertChannel("")
      assert.equal(result.valid, false)
      assert.ok(result.errors.some((e) => e.includes("alertChannel must be non-empty")))
    })

    it("returns invalid for whitespace-only alertChannel", () => {
      const result = validateAlertChannel("   ")
      assert.equal(result.valid, false)
      assert.ok(result.errors.some((e) => e.includes("alertChannel must be non-empty")))
    })
  })

  describe("validateRunbook", () => {
    it("returns valid for undefined runbook", () => {
      const result = validateRunbook(undefined)
      assert.equal(result.valid, true)
      assert.deepEqual(result.errors, [])
    })

    it("returns valid for non-empty runbook", () => {
      const result = validateRunbook("docs/runbooks/auth.md")
      assert.equal(result.valid, true)
      assert.deepEqual(result.errors, [])
    })

    it("returns invalid for empty runbook", () => {
      const result = validateRunbook("")
      assert.equal(result.valid, false)
      assert.ok(result.errors.some((e) => e.includes("runbook must be non-empty")))
    })

    it("returns invalid for whitespace-only runbook", () => {
      const result = validateRunbook("  ")
      assert.equal(result.valid, false)
      assert.ok(result.errors.some((e) => e.includes("runbook must be non-empty")))
    })
  })

  describe("validateOperationalMetadata", () => {
    it("returns valid for component with no operational metadata", () => {
      const result = validateOperationalMetadata({})
      assert.equal(result.valid, true)
      assert.deepEqual(result.errors, [])
    })

    it("returns valid for component with complete operational metadata", () => {
      const result = validateOperationalMetadata({
        healthCheck: {
          endpoint: "/health",
          interval: "30s",
        },
        slo: {
          availability: "99.9%",
          latencyP99: "500ms",
        },
        alertChannel: "#ops-critical",
        runbook: "docs/runbooks/service.md",
      })
      assert.equal(result.valid, true)
      assert.deepEqual(result.errors, [])
    })

    it("collects errors from multiple invalid fields", () => {
      const result = validateOperationalMetadata({
        healthCheck: {}, // Invalid: no endpoint or command
        slo: {}, // Invalid: no metrics
        alertChannel: "", // Invalid: empty
        runbook: "  ", // Invalid: whitespace only
      })
      assert.equal(result.valid, false)
      assert.equal(result.errors.length, 4)
      assert.ok(result.errors.some((e) => e.includes("healthCheck")))
      assert.ok(result.errors.some((e) => e.includes("slo")))
      assert.ok(result.errors.some((e) => e.includes("alertChannel")))
      assert.ok(result.errors.some((e) => e.includes("runbook")))
    })

    it("returns valid for partial operational metadata", () => {
      const result = validateOperationalMetadata({
        healthCheck: {
          command: "pg_isready",
        },
        // No slo, alertChannel, or runbook
      })
      assert.equal(result.valid, true)
      assert.deepEqual(result.errors, [])
    })
  })
})
