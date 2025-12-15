// src/lib/knowledge-hub/__tests__/calculations.test.ts
import { describe, it } from "node:test"
import assert from "node:assert"
import {
  calculatePausalMonthlyCosts,
  calculatePausalAnnualCosts,
  calculateContributions,
  calculateTZContribution,
  calculateJdooCosts,
} from "../calculations"

describe("Knowledge Hub Calculations", () => {
  describe("calculatePausalMonthlyCosts", () => {
    it("should calculate monthly costs for 25000 EUR annual revenue", () => {
      const result = calculatePausalMonthlyCosts(25000)
      assert.strictEqual(result.contributions, 262.51)
      assert.strictEqual(result.hok, 11.4)
      // quarterlyTax / 3 = 137.70 / 3 = 45.90
      assert.strictEqual(result.tax, 45.9)
    })
  })

  describe("calculatePausalAnnualCosts", () => {
    it("should calculate annual costs for 25000 EUR revenue", () => {
      const result = calculatePausalAnnualCosts(25000)
      assert.strictEqual(result.contributions, 3150.12) // 262.51 * 12
      assert.strictEqual(result.hok, 136.8) // 34.20 * 4
      assert.strictEqual(result.tax, 550.8) // bracket 4
      assert.strictEqual(result.total, 3837.72)
    })
  })

  describe("calculateContributions", () => {
    it("should break down monthly contributions", () => {
      const result = calculateContributions()
      assert.strictEqual(result.mioI, 107.88)
      assert.strictEqual(result.mioII, 35.96)
      assert.strictEqual(result.hzzo, 118.67)
      assert.strictEqual(result.total, 262.51)
    })
  })

  describe("calculateTZContribution", () => {
    it("should calculate TZ for group 3 (services) at 50000 EUR", () => {
      const result = calculateTZContribution(50000, "GROUP_3")
      // 50000 * 0.0008527 = 42.635
      assert.ok(result >= 42 && result <= 43)
    })
  })

  describe("calculateJdooCosts", () => {
    it("should calculate costs with mandatory director salary", () => {
      const result = calculateJdooCosts(50000, false)
      // monthlyDirectorSalary: 700
      assert.strictEqual(result.monthlyDirectorSalary, 700)
      // yearlyContributions: 700 * 12 * 0.365 = 3066
      assert.strictEqual(result.yearlyContributions, 3066)
      // estimatedCosts: 50000 * 0.2 = 10000
      // directorSalaryCost: 700 * 12 * 1.365 = 11466
      // taxableProfit: 50000 - 10000 - 11466 = 28534
      // yearlyTax: 28534 * 0.10 = 2853.4 -> 2853
      assert.strictEqual(result.yearlyTax, 2853)
      // effectiveTaxRate: (2853 / 50000) * 100 = 5.706%
      assert.ok(result.effectiveTaxRate > 5.7 && result.effectiveTaxRate < 5.71)
    })

    it("should calculate costs without director salary (has other employment)", () => {
      const result = calculateJdooCosts(50000, true)
      assert.strictEqual(result.monthlyDirectorSalary, 0)
      assert.strictEqual(result.yearlyContributions, 0)
      // estimatedCosts: 50000 * 0.2 = 10000
      // taxableProfit: 50000 - 10000 = 40000
      // yearlyTax: 40000 * 0.10 = 4000
      assert.strictEqual(result.yearlyTax, 4000)
      // effectiveTaxRate: (4000 / 50000) * 100 = 8%
      assert.strictEqual(result.effectiveTaxRate, 8)
    })

    it("should handle high revenue with 18% profit tax above 1M", () => {
      const result = calculateJdooCosts(1500000, false)
      // estimatedCosts: 1500000 * 0.2 = 300000
      // directorSalaryCost: 700 * 12 * 1.365 = 11466
      // taxableProfit: 1500000 - 300000 - 11466 = 1188534
      // yearlyTax: 1000000 * 0.10 + 188534 * 0.18 = 100000 + 33936.12 = 133936.12 -> 133936
      assert.strictEqual(result.yearlyTax, 133936)
    })
  })
})
