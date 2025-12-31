// src/lib/assistant/reasoning/__tests__/feature-flags.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  isReasoningEnabled,
  getReasoningMode,
  isInReasoningBeta,
  getReasoningModeForUser,
  ReasoningMode,
} from "../feature-flags"
import { resetGlobalConfig } from "@/lib/config/features"

describe("Feature Flags", () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
    // Reset cached config so new env vars take effect
    resetGlobalConfig()
  })

  afterEach(() => {
    process.env = originalEnv
    resetGlobalConfig()
  })

  describe("isReasoningEnabled", () => {
    it("returns false when flag is not set", () => {
      delete process.env.REASONING_UX_ENABLED
      expect(isReasoningEnabled()).toBe(false)
    })

    it("returns true when flag is set to true", () => {
      process.env.REASONING_UX_ENABLED = "true"
      expect(isReasoningEnabled()).toBe(true)
    })

    it("returns false when flag is set to false", () => {
      process.env.REASONING_UX_ENABLED = "false"
      expect(isReasoningEnabled()).toBe(false)
    })
  })

  describe("getReasoningMode", () => {
    it("returns shadow when REASONING_MODE is shadow", () => {
      process.env.REASONING_MODE = "shadow"
      expect(getReasoningMode()).toBe("shadow")
    })

    it("returns live when REASONING_MODE is live", () => {
      process.env.REASONING_MODE = "live"
      expect(getReasoningMode()).toBe("live")
    })

    it("returns off when not set", () => {
      delete process.env.REASONING_MODE
      expect(getReasoningMode()).toBe("off")
    })

    it("returns off when set to invalid value", () => {
      process.env.REASONING_MODE = "invalid"
      expect(getReasoningMode()).toBe("off")
    })
  })

  describe("isInReasoningBeta", () => {
    it("returns false when percentage is 0", () => {
      process.env.REASONING_BETA_PERCENTAGE = "0"
      expect(isInReasoningBeta("user123")).toBe(false)
    })

    it("returns true when percentage is 100", () => {
      process.env.REASONING_BETA_PERCENTAGE = "100"
      expect(isInReasoningBeta("user123")).toBe(true)
    })

    it("returns false when percentage is not set", () => {
      delete process.env.REASONING_BETA_PERCENTAGE
      expect(isInReasoningBeta("user123")).toBe(false)
    })

    it("returns consistent results for the same userId", () => {
      process.env.REASONING_BETA_PERCENTAGE = "50"
      const result1 = isInReasoningBeta("test-user-123")
      const result2 = isInReasoningBeta("test-user-123")
      expect(result1).toBe(result2)
    })

    it("distributes users roughly according to percentage", () => {
      process.env.REASONING_BETA_PERCENTAGE = "50"
      let inBeta = 0
      const sampleSize = 1000

      for (let i = 0; i < sampleSize; i++) {
        if (isInReasoningBeta(`user-${i}`)) {
          inBeta++
        }
      }

      // Expect roughly 50% (with some tolerance)
      const percentage = inBeta / sampleSize
      expect(percentage).toBeGreaterThan(0.35)
      expect(percentage).toBeLessThan(0.65)
    })
  })

  describe("getReasoningModeForUser", () => {
    it("returns off when mode is off", () => {
      process.env.REASONING_MODE = "off"
      expect(getReasoningModeForUser("user123")).toBe("off")
    })

    it("returns shadow when mode is shadow (regardless of beta)", () => {
      process.env.REASONING_MODE = "shadow"
      process.env.REASONING_BETA_PERCENTAGE = "0"
      expect(getReasoningModeForUser("user123")).toBe("shadow")
    })

    it("returns off when mode is live but no userId provided", () => {
      process.env.REASONING_MODE = "live"
      process.env.REASONING_BETA_PERCENTAGE = "100"
      expect(getReasoningModeForUser()).toBe("off")
    })

    it("returns live when mode is live and user is in beta", () => {
      process.env.REASONING_MODE = "live"
      process.env.REASONING_BETA_PERCENTAGE = "100"
      expect(getReasoningModeForUser("user123")).toBe("live")
    })

    it("returns off when mode is live but user is not in beta", () => {
      process.env.REASONING_MODE = "live"
      process.env.REASONING_BETA_PERCENTAGE = "0"
      expect(getReasoningModeForUser("user123")).toBe("off")
    })
  })
})
