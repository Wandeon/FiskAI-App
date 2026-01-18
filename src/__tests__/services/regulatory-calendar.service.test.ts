// src/__tests__/services/regulatory-calendar.service.test.ts

/**
 * Unit tests for RegulatoryCalendarService
 *
 * These are pure unit tests with no database dependencies.
 * They verify the service correctly wraps the fiscal-data module.
 */

import {
  RegulatoryCalendarService,
  regulatoryCalendarService,
} from "@/lib/services/regulatory-calendar.service"

describe("RegulatoryCalendarService", () => {
  let service: RegulatoryCalendarService

  beforeEach(() => {
    service = new RegulatoryCalendarService()
  })

  // ===========================================================================
  // THRESHOLDS
  // ===========================================================================

  describe("getPausalLimit", () => {
    it("returns 60000 EUR for 2025", () => {
      expect(service.getPausalLimit()).toBe(60000)
    })

    it("returns the same value when year is current year", () => {
      const currentYear = new Date().getFullYear()
      expect(service.getPausalLimit(currentYear)).toBe(60000)
    })

    it("returns historical value for 2024", () => {
      // 2024 had a different limit (39816.84)
      const limit2024 = service.getPausalLimit(2024)
      expect(limit2024).toBe(39816.84)
    })
  })

  describe("getVatThreshold", () => {
    it("returns 60000 EUR for 2025", () => {
      expect(service.getVatThreshold()).toBe(60000)
    })

    it("returns historical value for 2024", () => {
      // 2024 had a different threshold (40000)
      const threshold2024 = service.getVatThreshold(2024)
      expect(threshold2024).toBe(40000)
    })
  })

  // ===========================================================================
  // VAT RATES
  // ===========================================================================

  describe("getVatRate", () => {
    it("returns 0.25 (25%) for standard rate", () => {
      expect(service.getVatRate("standard")).toBe(0.25)
    })

    it("returns 0.13 (13%) for reduced rate", () => {
      expect(service.getVatRate("reduced")).toBe(0.13)
    })

    it("returns 0.05 (5%) for reduced2 rate", () => {
      expect(service.getVatRate("reduced2")).toBe(0.05)
    })

    it("throws for unknown VAT rate type", () => {
      // @ts-expect-error - Testing invalid input
      expect(() => service.getVatRate("invalid")).toThrow("Unknown VAT rate type")
    })
  })

  // ===========================================================================
  // TAX RATES
  // ===========================================================================

  describe("getTaxRate", () => {
    it("returns 0.12 (12%) for pausal tax rate", () => {
      expect(service.getTaxRate("pausal")).toBe(0.12)
    })

    it("throws for unknown tax type", () => {
      // @ts-expect-error - Testing invalid input
      expect(() => service.getTaxRate("invalid")).toThrow("Unknown tax rate type")
    })
  })

  describe("getPausalTaxBracket", () => {
    it("returns correct bracket for revenue under 11300", () => {
      const bracket = service.getPausalTaxBracket(10000)
      expect(bracket.min).toBe(0)
      expect(bracket.max).toBe(11300)
      expect(bracket.annualTax).toBe(203.4)
      expect(bracket.quarterlyTax).toBe(50.85)
    })

    it("returns correct bracket for revenue in middle range", () => {
      const bracket = service.getPausalTaxBracket(25000)
      expect(bracket.min).toBe(19900.01)
      expect(bracket.max).toBe(30600)
      expect(bracket.annualTax).toBe(550.8)
      expect(bracket.quarterlyTax).toBe(137.7)
    })

    it("returns highest bracket for revenue at 60000", () => {
      const bracket = service.getPausalTaxBracket(60000)
      expect(bracket.min).toBe(50000.01)
      expect(bracket.max).toBe(60000)
      expect(bracket.annualTax).toBe(1080.0)
      expect(bracket.quarterlyTax).toBe(270.0)
    })
  })

  // ===========================================================================
  // CONTRIBUTIONS
  // ===========================================================================

  describe("getContribution", () => {
    it("returns MIO_I rate info", () => {
      const contribution = service.getContribution("MIO_I")
      expect(contribution.rate).toBe(0.15)
      expect(contribution.name).toBe("MIO I. stup")
      expect(contribution.iban).toBeTruthy()
    })

    it("returns MIO_II rate info", () => {
      const contribution = service.getContribution("MIO_II")
      expect(contribution.rate).toBe(0.05)
      expect(contribution.name).toBe("MIO II. stup")
    })

    it("returns HZZO rate info", () => {
      const contribution = service.getContribution("HZZO")
      expect(contribution.rate).toBe(0.165)
      expect(contribution.name).toBe("HZZO")
    })

    it("returns combined MIO rate when type is MIO", () => {
      const contribution = service.getContribution("MIO")
      expect(contribution.rate).toBe(0.15) // MIO_I rate
      expect(contribution.combinedRate).toBe(0.2) // MIO_I + MIO_II
    })

    it("throws for unknown contribution type", () => {
      // @ts-expect-error - Testing invalid input
      expect(() => service.getContribution("INVALID")).toThrow("Unknown contribution type")
    })
  })

  describe("getMonthlyContributions", () => {
    it("returns correct values at minimum base", () => {
      const contributions = service.getMonthlyContributions()
      expect(contributions.base).toBe(719.2)
      expect(contributions.mioI).toBe(107.88)
      expect(contributions.mioII).toBe(35.96)
      expect(contributions.hzzo).toBe(118.67)
      expect(contributions.total).toBe(262.51)
    })

    it("calculates correctly for custom base", () => {
      const contributions = service.getMonthlyContributions(1000)
      expect(contributions.base).toBe(1000)
      expect(contributions.mioI).toBe(150) // 1000 * 0.15
      expect(contributions.mioII).toBe(50) // 1000 * 0.05
      expect(contributions.hzzo).toBe(165) // 1000 * 0.165
      expect(contributions.total).toBe(365) // sum
    })

    it("clamps to minimum base when below minimum", () => {
      const contributions = service.getMonthlyContributions(100)
      expect(contributions.base).toBe(719.2) // Clamped to minimum
    })
  })

  describe("getMinimumContributionBase", () => {
    it("returns 719.2 EUR", () => {
      expect(service.getMinimumContributionBase()).toBe(719.2)
    })
  })

  describe("getMaximumContributionBase", () => {
    it("returns 9360 EUR", () => {
      expect(service.getMaximumContributionBase()).toBe(9360)
    })
  })

  // ===========================================================================
  // DEADLINES
  // ===========================================================================

  describe("getNextDeadline", () => {
    it("returns a future date for pausalTax", () => {
      const now = new Date()
      const deadline = service.getNextDeadline("pausalTax")
      expect(deadline).toBeInstanceOf(Date)
      expect(deadline.getTime()).toBeGreaterThan(now.getTime())
    })

    it("returns a future date for contributions", () => {
      const now = new Date()
      const deadline = service.getNextDeadline("contributions")
      expect(deadline).toBeInstanceOf(Date)
      expect(deadline.getTime()).toBeGreaterThan(now.getTime())
    })

    it("returns a future date for hok", () => {
      const now = new Date()
      const deadline = service.getNextDeadline("hok")
      expect(deadline).toBeInstanceOf(Date)
      expect(deadline.getTime()).toBeGreaterThan(now.getTime())
    })

    it("returns a future date for dohodak", () => {
      const now = new Date()
      const deadline = service.getNextDeadline("dohodak")
      expect(deadline).toBeInstanceOf(Date)
      expect(deadline.getTime()).toBeGreaterThan(now.getTime())
    })

    it("returns a future date for dobit", () => {
      const now = new Date()
      const deadline = service.getNextDeadline("dobit")
      expect(deadline).toBeInstanceOf(Date)
      expect(deadline.getTime()).toBeGreaterThan(now.getTime())
    })

    it("calculates deadline from specified date", () => {
      const fromDate = new Date("2025-01-01")
      const deadline = service.getNextDeadline("pausalTax", fromDate)
      // First quarterly deadline after Jan 1 is Jan 31
      expect(deadline.getMonth()).toBe(0) // January
      expect(deadline.getDate()).toBe(31)
    })

    it("throws for unknown deadline type", () => {
      // @ts-expect-error - Testing invalid input
      expect(() => service.getNextDeadline("invalid")).toThrow("Unknown deadline type")
    })
  })

  describe("getUpcomingDeadlines", () => {
    it("returns an array of deadlines", () => {
      const deadlines = service.getUpcomingDeadlines(90)
      expect(Array.isArray(deadlines)).toBe(true)
    })

    it("returns deadlines with required properties", () => {
      const deadlines = service.getUpcomingDeadlines(90)
      if (deadlines.length > 0) {
        const deadline = deadlines[0]
        expect(deadline).toHaveProperty("name")
        expect(deadline).toHaveProperty("date")
        expect(deadline).toHaveProperty("description")
        expect(deadline.date).toBeInstanceOf(Date)
      }
    })

    it("returns deadlines sorted by date", () => {
      const deadlines = service.getUpcomingDeadlines(180)
      for (let i = 1; i < deadlines.length; i++) {
        expect(deadlines[i].date.getTime()).toBeGreaterThanOrEqual(deadlines[i - 1].date.getTime())
      }
    })
  })

  // ===========================================================================
  // DATE HELPERS
  // ===========================================================================

  describe("getCurrentYear", () => {
    it("returns current year", () => {
      const expected = new Date().getFullYear()
      expect(service.getCurrentYear()).toBe(expected)
    })
  })

  describe("getEffectiveDate", () => {
    it("returns current date", () => {
      const now = new Date()
      const effectiveDate = service.getEffectiveDate()
      // Allow 1 second tolerance
      expect(Math.abs(effectiveDate.getTime() - now.getTime())).toBeLessThan(1000)
    })
  })

  describe("getCurrentQuarter", () => {
    it("returns a number between 1 and 4", () => {
      const quarter = service.getCurrentQuarter()
      expect(quarter).toBeGreaterThanOrEqual(1)
      expect(quarter).toBeLessThanOrEqual(4)
    })
  })

  describe("getCurrentMonth", () => {
    it("returns current month (1-indexed)", () => {
      const expected = new Date().getMonth() + 1
      expect(service.getCurrentMonth()).toBe(expected)
    })
  })

  // ===========================================================================
  // TOKEN VALUES
  // ===========================================================================

  describe("getTokenValues", () => {
    it("returns all expected token values", () => {
      const tokens = service.getTokenValues()

      // Thresholds
      expect(tokens.pausal_limit).toBe(60000)
      expect(tokens.vat_threshold).toBe(60000)

      // VAT rates
      expect(tokens.vat_rate_standard).toBe(0.25)
      expect(tokens.vat_rate_reduced).toBe(0.13)
      expect(tokens.vat_rate_reduced2).toBe(0.05)

      // Pausal tax
      expect(tokens.pausal_tax_rate).toBe(0.12)

      // Contribution rates
      expect(tokens.mio_i_rate).toBe(0.15)
      expect(tokens.mio_ii_rate).toBe(0.05)
      expect(tokens.hzzo_rate).toBe(0.165)
      expect(tokens.total_contribution_rate).toBe(0.365)

      // Monthly amounts
      expect(tokens.monthly_mio_i).toBe(107.88)
      expect(tokens.monthly_mio_ii).toBe(35.96)
      expect(tokens.monthly_hzzo).toBe(118.67)
      expect(tokens.monthly_contributions_total).toBe(262.51)

      // Base limits
      expect(tokens.contribution_base_minimum).toBe(719.2)
      expect(tokens.contribution_base_maximum).toBe(9360)

      // Date/time
      expect(tokens.current_year).toBe(new Date().getFullYear())
      expect(tokens.current_quarter).toBeGreaterThanOrEqual(1)
      expect(tokens.current_quarter).toBeLessThanOrEqual(4)
      expect(tokens.current_month).toBeGreaterThanOrEqual(1)
      expect(tokens.current_month).toBeLessThanOrEqual(12)
    })
  })

  // ===========================================================================
  // SINGLETON
  // ===========================================================================

  describe("singleton export", () => {
    it("exports a singleton instance", () => {
      expect(regulatoryCalendarService).toBeInstanceOf(RegulatoryCalendarService)
    })

    it("singleton works correctly", () => {
      expect(regulatoryCalendarService.getPausalLimit()).toBe(60000)
      expect(regulatoryCalendarService.getVatRate("standard")).toBe(0.25)
    })
  })
})
