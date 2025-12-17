/**
 * Utility Functions Tests
 */

import { describe, it, expect } from "vitest"
import { getValueByPath } from "../utils/get-value"
import { formatCurrency, formatPercentage } from "../utils/format"

describe("getValueByPath", () => {
  it("returns contribution rate for valid path", () => {
    const result = getValueByPath("CONTRIBUTIONS.rates.MIO_I.rate")
    expect(result).toBe(0.15)
  })

  it("returns threshold value for valid path", () => {
    const result = getValueByPath("THRESHOLDS.pdv.value")
    expect(result).toBe(60000)
  })

  it("returns undefined for invalid path", () => {
    const result = getValueByPath("INVALID.path.here")
    expect(result).toBeUndefined()
  })

  it("returns nested object when path points to object", () => {
    const result = getValueByPath("CONTRIBUTIONS.rates.MIO_I") as Record<string, unknown>
    expect(result).toHaveProperty("rate", 0.15)
    expect(result).toHaveProperty("name", "MIO I. stup")
  })
})

describe("formatCurrency", () => {
  it("formats EUR amounts with Croatian locale", () => {
    const result = formatCurrency(60000)
    expect(result).toMatch(/60\.000/)
    expect(result.includes("EUR")).toBe(true)
  })

  it("handles decimal amounts", () => {
    const result = formatCurrency(719.2)
    expect(result).toMatch(/719,20/)
  })
})

describe("formatPercentage", () => {
  it("formats decimal as percentage", () => {
    const result = formatPercentage(0.15)
    expect(result).toBe("15%")
  })

  it("formats percentage with decimals", () => {
    const result = formatPercentage(0.165, { decimals: 1 })
    expect(result).toBe("16,5%")
  })
})
