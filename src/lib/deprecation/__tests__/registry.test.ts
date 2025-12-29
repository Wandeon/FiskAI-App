/**
 * Tests for feature deprecation registry
 */

import {
  getDeprecationInfo,
  isFeatureDeprecated,
  isFeatureSunset,
  getFeaturePhase,
  getFeaturesByPhase,
  getDaysUntilSunset,
  getDeprecationSummary,
  DEPRECATED_FEATURES,
} from "../registry"
import type { DeprecationInfo } from "../types"

describe("deprecation registry", () => {
  describe("getDeprecationInfo", () => {
    it("returns null for non-existent feature", () => {
      expect(getDeprecationInfo("NON_EXISTENT")).toBeNull()
    })

    it("returns null for active features not in registry", () => {
      expect(getDeprecationInfo("F001")).toBeNull()
    })
  })

  describe("isFeatureDeprecated", () => {
    it("returns false for non-existent features", () => {
      expect(isFeatureDeprecated("NON_EXISTENT")).toBe(false)
    })

    it("returns false for active features", () => {
      expect(isFeatureDeprecated("F001")).toBe(false)
    })
  })

  describe("isFeatureSunset", () => {
    it("returns false for non-existent features", () => {
      expect(isFeatureSunset("NON_EXISTENT")).toBe(false)
    })
  })

  describe("getFeaturePhase", () => {
    it("returns active for non-existent features", () => {
      expect(getFeaturePhase("NON_EXISTENT")).toBe("active")
    })

    it("returns active for features not in registry", () => {
      expect(getFeaturePhase("F001")).toBe("active")
    })
  })

  describe("getFeaturesByPhase", () => {
    it("returns empty array when no features in phase", () => {
      // Most features should be active and not in registry
      const deprecated = getFeaturesByPhase("deprecated")
      expect(Array.isArray(deprecated)).toBe(true)
    })
  })

  describe("getDaysUntilSunset", () => {
    it("returns null for non-existent features", () => {
      expect(getDaysUntilSunset("NON_EXISTENT")).toBeNull()
    })
  })

  describe("getDeprecationSummary", () => {
    it("returns valid summary structure", () => {
      const summary = getDeprecationSummary()
      expect(summary).toHaveProperty("totalDeprecated")
      expect(summary).toHaveProperty("upcomingSunsets")
      expect(summary).toHaveProperty("recentlySunset")
      expect(summary).toHaveProperty("usageStats")
      expect(typeof summary.totalDeprecated).toBe("number")
      expect(Array.isArray(summary.upcomingSunsets)).toBe(true)
      expect(Array.isArray(summary.recentlySunset)).toBe(true)
      expect(Array.isArray(summary.usageStats)).toBe(true)
    })
  })

  describe("DEPRECATED_FEATURES validation", () => {
    it("all entries have required fields", () => {
      for (const feature of DEPRECATED_FEATURES) {
        expect(feature.featureId).toBeDefined()
        expect(feature.featureName).toBeDefined()
        expect(feature.announcedAt).toBeDefined()
        expect(feature.sunsetDate).toBeDefined()
        expect(feature.phase).toBeDefined()
        expect(feature.reason).toBeDefined()
        expect(feature.owner).toBeDefined()
        expect(typeof feature.showBanner).toBe("boolean")
        expect(typeof feature.showConsoleWarning).toBe("boolean")
      }
    })

    it("all dates are valid ISO format", () => {
      for (const feature of DEPRECATED_FEATURES) {
        expect(() => new Date(feature.announcedAt)).not.toThrow()
        expect(() => new Date(feature.sunsetDate)).not.toThrow()
        expect(new Date(feature.announcedAt).toISOString()).toContain(feature.announcedAt)
        expect(new Date(feature.sunsetDate).toISOString()).toContain(feature.sunsetDate)
      }
    })

    it("sunset date is after announcement date", () => {
      for (const feature of DEPRECATED_FEATURES) {
        const announced = new Date(feature.announcedAt)
        const sunset = new Date(feature.sunsetDate)
        expect(sunset.getTime()).toBeGreaterThan(announced.getTime())
      }
    })

    it("phase is valid lifecycle phase", () => {
      const validPhases = ["active", "deprecated", "sunset"]
      for (const feature of DEPRECATED_FEATURES) {
        expect(validPhases).toContain(feature.phase)
      }
    })

    it("owner follows team:slug format", () => {
      for (const feature of DEPRECATED_FEATURES) {
        expect(feature.owner).toMatch(/^team:[a-z-]+$/)
      }
    })
  })
})

describe("deprecation with mock data", () => {
  // Helper to create mock deprecation info
  function createMockDeprecation(overrides: Partial<DeprecationInfo> = {}): DeprecationInfo {
    const today = new Date()
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)

    return {
      featureId: "TEST001",
      featureName: "Test Feature",
      announcedAt: today.toISOString().split("T")[0],
      sunsetDate: thirtyDaysFromNow.toISOString().split("T")[0],
      phase: "deprecated",
      reason: "Test deprecation",
      owner: "team:platform",
      showBanner: true,
      showConsoleWarning: true,
      ...overrides,
    }
  }

  it("mock deprecation has valid structure", () => {
    const mock = createMockDeprecation()
    expect(mock.featureId).toBe("TEST001")
    expect(mock.phase).toBe("deprecated")
  })

  it("can override mock properties", () => {
    const mock = createMockDeprecation({
      featureId: "CUSTOM001",
      phase: "sunset",
    })
    expect(mock.featureId).toBe("CUSTOM001")
    expect(mock.phase).toBe("sunset")
  })
})
