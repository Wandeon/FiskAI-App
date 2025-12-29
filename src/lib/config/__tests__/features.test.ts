/**
 * Unified Feature Configuration Tests
 */

import { describe, it, beforeEach, afterEach } from "node:test"
import assert from "node:assert"
import {
  parseGlobalConfig,
  parseTenantFlags,
  getGlobalConfig,
  resetGlobalConfig,
  validateConfigOnStartup,
  getConfigDocumentation,
  GlobalFeatureConfigSchema,
} from "../features"

describe("Unified Feature Configuration", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    resetGlobalConfig()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    resetGlobalConfig()
  })

  describe("parseGlobalConfig", () => {
    it("returns defaults when no env vars set", () => {
      // Clear relevant env vars
      delete process.env.REASONING_UX_ENABLED
      delete process.env.REASONING_MODE
      delete process.env.REASONING_BETA_PERCENTAGE

      const config = parseGlobalConfig()

      assert.strictEqual(config.reasoning.enabled, false)
      assert.strictEqual(config.reasoning.mode, "off")
      assert.strictEqual(config.reasoning.betaPercentage, 0)

      assert.strictEqual(config.articleAgent.passThreshold, 0.8)
      assert.strictEqual(config.articleAgent.failThreshold, 0.5)
      assert.strictEqual(config.articleAgent.maxIterations, 3)

      assert.strictEqual(config.watchdog.enabled, true)
      assert.strictEqual(config.watchdog.staleSourceWarningDays, 7)

      assert.strictEqual(config.fiscal.demoMode, false)
    })

    it("parses env vars correctly", () => {
      process.env.REASONING_UX_ENABLED = "true"
      process.env.REASONING_MODE = "shadow"
      process.env.REASONING_BETA_PERCENTAGE = "50"
      process.env.ARTICLE_AGENT_PASS_THRESHOLD = "0.9"
      process.env.WATCHDOG_ENABLED = "false"
      process.env.FISCAL_DEMO_MODE = "true"

      const config = parseGlobalConfig()

      assert.strictEqual(config.reasoning.enabled, true)
      assert.strictEqual(config.reasoning.mode, "shadow")
      assert.strictEqual(config.reasoning.betaPercentage, 50)
      assert.strictEqual(config.articleAgent.passThreshold, 0.9)
      assert.strictEqual(config.watchdog.enabled, false)
      assert.strictEqual(config.fiscal.demoMode, true)
    })

    it("validates reasoning mode values", () => {
      process.env.REASONING_MODE = "invalid"
      const config = parseGlobalConfig()
      // Should fall back to default
      assert.strictEqual(config.reasoning.mode, "off")
    })
  })

  describe("parseTenantFlags", () => {
    it("returns empty object for null/undefined", () => {
      assert.deepStrictEqual(parseTenantFlags(null), {})
      assert.deepStrictEqual(parseTenantFlags(undefined), {})
    })

    it("parses valid flag objects", () => {
      const flags = { betaFeature: true, oldFeature: false }
      assert.deepStrictEqual(parseTenantFlags(flags), flags)
    })

    it("handles invalid data gracefully", () => {
      assert.deepStrictEqual(parseTenantFlags("not an object"), {})
      assert.deepStrictEqual(parseTenantFlags(123), {})
      assert.deepStrictEqual(parseTenantFlags([1, 2, 3]), {})
    })
  })

  describe("getGlobalConfig (singleton)", () => {
    it("caches config on first call", () => {
      process.env.REASONING_UX_ENABLED = "true"
      const config1 = getGlobalConfig()

      // Change env var
      process.env.REASONING_UX_ENABLED = "false"
      const config2 = getGlobalConfig()

      // Should still be cached value
      assert.strictEqual(config2.reasoning.enabled, true)
    })

    it("resets cache with resetGlobalConfig", () => {
      process.env.REASONING_UX_ENABLED = "true"
      getGlobalConfig()

      resetGlobalConfig()
      process.env.REASONING_UX_ENABLED = "false"

      const config = getGlobalConfig()
      assert.strictEqual(config.reasoning.enabled, false)
    })
  })

  describe("validateConfigOnStartup", () => {
    it("warns when reasoning is live but beta is 0", () => {
      process.env.REASONING_MODE = "live"
      process.env.REASONING_BETA_PERCENTAGE = "0"
      resetGlobalConfig()

      const { valid, warnings } = validateConfigOnStartup()

      assert.strictEqual(valid, false)
      assert.ok(
        warnings.includes(
          "Reasoning mode is 'live' but beta percentage is 0 - no users will see reasoning"
        )
      )
    })

    it("warns when fail threshold >= pass threshold", () => {
      process.env.ARTICLE_AGENT_PASS_THRESHOLD = "0.5"
      process.env.ARTICLE_AGENT_FAIL_THRESHOLD = "0.8"
      resetGlobalConfig()

      const { valid, warnings } = validateConfigOnStartup()

      assert.strictEqual(valid, false)
      assert.ok(
        warnings.includes(
          "Article agent fail threshold >= pass threshold - paragraphs cannot pass verification"
        )
      )
    })

    it("returns valid for correct configuration", () => {
      // Reset to defaults
      delete process.env.REASONING_MODE
      delete process.env.REASONING_BETA_PERCENTAGE
      delete process.env.ARTICLE_AGENT_PASS_THRESHOLD
      delete process.env.ARTICLE_AGENT_FAIL_THRESHOLD
      resetGlobalConfig()

      const { valid, warnings } = validateConfigOnStartup()

      assert.strictEqual(valid, true)
      assert.strictEqual(warnings.length, 0)
    })
  })

  describe("getConfigDocumentation", () => {
    it("returns documentation for all config options", () => {
      const docs = getConfigDocumentation()

      assert.ok(docs.length > 0)
      assert.ok(docs.every((d) => d.category))
      assert.ok(docs.every((d) => d.key))
      assert.ok(docs.every((d) => d.description))

      // Check specific entries exist
      const reasoningEnabled = docs.find((d) => d.key === "reasoning.enabled")
      assert.ok(reasoningEnabled)
      assert.strictEqual(reasoningEnabled?.envVar, "REASONING_UX_ENABLED")
    })
  })

  describe("Schema validation", () => {
    it("rejects invalid beta percentage", () => {
      const result = GlobalFeatureConfigSchema.safeParse({
        reasoning: { betaPercentage: 150 },
      })
      assert.strictEqual(result.success, false)
    })

    it("rejects invalid threshold values", () => {
      const result = GlobalFeatureConfigSchema.safeParse({
        articleAgent: { passThreshold: 1.5 },
      })
      assert.strictEqual(result.success, false)
    })
  })
})
