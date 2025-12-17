// src/lib/fiscal-data/__tests__/data-integrity.test.ts

import { describe, it, expect } from "vitest"
import {
  CONTRIBUTIONS,
  TAX_RATES,
  THRESHOLDS,
  DEADLINES,
  PAYMENT_DETAILS,
  CHAMBER_FEES,
} from "../index"

describe("CONTRIBUTIONS data integrity", () => {
  it("has valid year", () => {
    expect(CONTRIBUTIONS.year).toBeGreaterThanOrEqual(2024)
  })

  it("has lastVerified date in ISO format", () => {
    expect(CONTRIBUTIONS.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it("has all required contribution rates", () => {
    expect(CONTRIBUTIONS.rates.MIO_I.rate).toBe(0.15)
    expect(CONTRIBUTIONS.rates.MIO_II.rate).toBe(0.05)
    expect(CONTRIBUTIONS.rates.HZZO.rate).toBe(0.165)
  })

  it("has valid IBANs (HR format, HR + 19 digits)", () => {
    expect(CONTRIBUTIONS.rates.MIO_I.iban).toMatch(/^HR\d{19}$/)
    expect(CONTRIBUTIONS.rates.MIO_II.iban).toMatch(/^HR\d{19}$/)
    expect(CONTRIBUTIONS.rates.HZZO.iban).toMatch(/^HR\d{19}$/)
  })

  it("monthly contributions sum correctly", () => {
    const sum =
      CONTRIBUTIONS.monthly.mioI + CONTRIBUTIONS.monthly.mioII + CONTRIBUTIONS.monthly.hzzo
    expect(sum).toBeCloseTo(CONTRIBUTIONS.monthly.total, 2)
  })

  it("has positive minimum base", () => {
    expect(CONTRIBUTIONS.base.minimum).toBeGreaterThan(0)
  })

  it("has maximum base greater than minimum", () => {
    expect(CONTRIBUTIONS.base.maximum).toBeGreaterThan(CONTRIBUTIONS.base.minimum)
  })

  it("monthly contributions calculated from minimum base are correct", () => {
    const expectedMioI =
      Math.round(CONTRIBUTIONS.base.minimum * CONTRIBUTIONS.rates.MIO_I.rate * 100) / 100
    const expectedMioII =
      Math.round(CONTRIBUTIONS.base.minimum * CONTRIBUTIONS.rates.MIO_II.rate * 100) / 100
    const expectedHzzo =
      Math.round(CONTRIBUTIONS.base.minimum * CONTRIBUTIONS.rates.HZZO.rate * 100) / 100

    expect(CONTRIBUTIONS.monthly.mioI).toBeCloseTo(expectedMioI, 2)
    expect(CONTRIBUTIONS.monthly.mioII).toBeCloseTo(expectedMioII, 2)
    expect(CONTRIBUTIONS.monthly.hzzo).toBeCloseTo(expectedHzzo, 2)
  })

  it("has valid model codes", () => {
    expect(CONTRIBUTIONS.rates.MIO_I.model).toBe("HR68")
    expect(CONTRIBUTIONS.rates.MIO_II.model).toBe("HR68")
    expect(CONTRIBUTIONS.rates.HZZO.model).toBe("HR68")
  })
})

describe("TAX_RATES data integrity", () => {
  it("has valid year", () => {
    expect(TAX_RATES.income.year).toBeGreaterThanOrEqual(2024)
    expect(TAX_RATES.corporate.year).toBeGreaterThanOrEqual(2024)
    expect(TAX_RATES.pausal.year).toBeGreaterThanOrEqual(2024)
  })

  it("has lastVerified dates in ISO format", () => {
    expect(TAX_RATES.income.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(TAX_RATES.corporate.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(TAX_RATES.pausal.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it("has income tax brackets in ascending order", () => {
    const brackets = TAX_RATES.income.brackets
    expect(brackets.length).toBeGreaterThan(0)

    for (let i = 1; i < brackets.length; i++) {
      expect(brackets[i].min).toBeGreaterThan(brackets[i - 1].min)
    }
  })

  it("has valid personal allowance", () => {
    expect(TAX_RATES.income.personalAllowance).toBeGreaterThan(0)
  })

  it("has corporate tax rates", () => {
    expect(TAX_RATES.corporate.small.rate).toBe(0.1)
    expect(TAX_RATES.corporate.large.rate).toBe(0.18)
  })

  it("has corporate thresholds properly defined", () => {
    expect(TAX_RATES.corporate.small.maxRevenue).toBeGreaterThan(0)
    expect(TAX_RATES.corporate.large.minRevenue).toBe(TAX_RATES.corporate.small.maxRevenue)
  })

  it("has paušalni tax rate and max revenue", () => {
    expect(TAX_RATES.pausal.rate).toBe(0.12)
    expect(TAX_RATES.pausal.maxRevenue).toBeGreaterThan(0)
  })

  it("has paušalni brackets in ascending order", () => {
    const brackets = TAX_RATES.pausal.brackets
    expect(brackets.length).toBeGreaterThan(0)

    for (let i = 1; i < brackets.length; i++) {
      expect(brackets[i].min).toBeGreaterThan(brackets[i - 1].min)
    }
  })

  it("paušalni quarterly tax is calculated correctly", () => {
    TAX_RATES.pausal.brackets.forEach((bracket) => {
      expect(bracket.quarterlyTax).toBeCloseTo(bracket.annualTax / 4, 2)
    })
  })

  it("income tax brackets have valid rate ranges", () => {
    TAX_RATES.income.brackets.forEach((bracket) => {
      expect(bracket.rate).toBeGreaterThan(0)
      expect(bracket.rate).toBeLessThanOrEqual(1)

      if (bracket.rateWithSurtax) {
        expect(bracket.rateWithSurtax).toBeGreaterThan(bracket.rate)
      }
    })
  })
})

describe("THRESHOLDS data integrity", () => {
  it("has valid year", () => {
    expect(THRESHOLDS.year).toBeGreaterThanOrEqual(2024)
  })

  it("has lastVerified date in ISO format", () => {
    expect(THRESHOLDS.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it("has PDV threshold", () => {
    expect(THRESHOLDS.pdv.value).toBeGreaterThan(0)
    expect(THRESHOLDS.pdv.unit).toBe("EUR")
  })

  it("has paušalni limit", () => {
    expect(THRESHOLDS.pausalni.value).toBeGreaterThan(0)
    expect(THRESHOLDS.pausalni.unit).toBe("EUR")
  })

  it("has cash B2B limit", () => {
    expect(THRESHOLDS.cashB2B.value).toBeGreaterThan(0)
    expect(THRESHOLDS.cashB2B.unit).toBe("EUR")
  })

  it("has asset capitalization threshold", () => {
    expect(THRESHOLDS.assetCapitalization.value).toBeGreaterThan(0)
    expect(THRESHOLDS.assetCapitalization.unit).toBe("EUR")
  })

  it("has effective dates in ISO format", () => {
    expect(THRESHOLDS.pdv.effectiveFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(THRESHOLDS.pausalni.effectiveFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(THRESHOLDS.cashB2B.effectiveFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(THRESHOLDS.assetCapitalization.effectiveFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it("has previous values for historical thresholds", () => {
    expect(THRESHOLDS.pdv.previousValue).toBeGreaterThan(0)
    expect(THRESHOLDS.pausalni.previousValue).toBeGreaterThan(0)
  })
})

describe("DEADLINES data integrity", () => {
  it("has valid year", () => {
    expect(DEADLINES.year).toBeGreaterThanOrEqual(2024)
  })

  it("has lastVerified date in ISO format", () => {
    expect(DEADLINES.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it("has contribution deadlines with valid format", () => {
    expect(DEADLINES.contributions.monthly.dates).toBeInstanceOf(Array)
    expect(DEADLINES.contributions.monthly.dates.length).toBeGreaterThan(0)
    expect(DEADLINES.contributions.monthly.frequency).toBe("monthly")
  })

  it("has paušalni tax deadlines", () => {
    expect(DEADLINES.pausalTax.dates).toBeInstanceOf(Array)
    expect(DEADLINES.pausalTax.dates.length).toBe(4) // Quarterly
    expect(DEADLINES.pausalTax.frequency).toBe("quarterly")
  })

  it("has HOK deadlines", () => {
    expect(DEADLINES.hok.dates).toBeInstanceOf(Array)
    expect(DEADLINES.hok.dates.length).toBe(4) // Quarterly
    expect(DEADLINES.hok.frequency).toBe("quarterly")
  })

  it("deadline dates are in valid format", () => {
    const datePattern = /^\d{2}\.\d{2}$/

    DEADLINES.pausalTax.dates.forEach((date) => {
      expect(date).toMatch(datePattern)
    })

    DEADLINES.hok.dates.forEach((date) => {
      expect(date).toMatch(datePattern)
    })
  })

  it("has annual filing deadlines", () => {
    expect(DEADLINES.annualFiling.dohodak.dates.length).toBeGreaterThan(0)
    expect(DEADLINES.annualFiling.dobit.dates.length).toBeGreaterThan(0)
  })
})

describe("PAYMENT_DETAILS data integrity", () => {
  it("has valid year", () => {
    expect(PAYMENT_DETAILS.year).toBeGreaterThanOrEqual(2024)
  })

  it("has lastVerified date in ISO format", () => {
    expect(PAYMENT_DETAILS.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it("has all required payment accounts", () => {
    expect(PAYMENT_DETAILS.accounts.stateBudget).toBeDefined()
    expect(PAYMENT_DETAILS.accounts.mioII).toBeDefined()
    expect(PAYMENT_DETAILS.accounts.hzzo).toBeDefined()
    expect(PAYMENT_DETAILS.accounts.hok).toBeDefined()
  })

  it("all IBANs are valid HR format (HR + 19 digits)", () => {
    const ibanPattern = /^HR\d{19}$/

    expect(PAYMENT_DETAILS.accounts.stateBudget.iban).toMatch(ibanPattern)
    expect(PAYMENT_DETAILS.accounts.mioII.iban).toMatch(ibanPattern)
    expect(PAYMENT_DETAILS.accounts.hzzo.iban).toMatch(ibanPattern)
    expect(PAYMENT_DETAILS.accounts.hok.iban).toMatch(ibanPattern)
  })

  it("all accounts have HR68 model", () => {
    expect(PAYMENT_DETAILS.accounts.stateBudget.model).toBe("HR68")
    expect(PAYMENT_DETAILS.accounts.mioII.model).toBe("HR68")
    expect(PAYMENT_DETAILS.accounts.hzzo.model).toBe("HR68")
    expect(PAYMENT_DETAILS.accounts.hok.model).toBe("HR68")
  })

  it("all accounts have poziv na broj format defined", () => {
    expect(PAYMENT_DETAILS.accounts.stateBudget.pozivNaBrojFormat).toBeDefined()
    expect(PAYMENT_DETAILS.accounts.mioII.pozivNaBrojFormat).toBeDefined()
    expect(PAYMENT_DETAILS.accounts.hzzo.pozivNaBrojFormat).toBeDefined()
    expect(PAYMENT_DETAILS.accounts.hok.pozivNaBrojFormat).toBeDefined()
  })

  it("contribution account IBANs match CONTRIBUTIONS data", () => {
    expect(PAYMENT_DETAILS.accounts.stateBudget.iban).toBe(CONTRIBUTIONS.rates.MIO_I.iban)
    expect(PAYMENT_DETAILS.accounts.mioII.iban).toBe(CONTRIBUTIONS.rates.MIO_II.iban)
    expect(PAYMENT_DETAILS.accounts.hzzo.iban).toBe(CONTRIBUTIONS.rates.HZZO.iban)
  })
})

describe("CHAMBER_FEES data integrity", () => {
  it("has valid year", () => {
    expect(CHAMBER_FEES.year).toBeGreaterThanOrEqual(2024)
  })

  it("has lastVerified date in ISO format", () => {
    expect(CHAMBER_FEES.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it("has HOK monthly fee", () => {
    expect(CHAMBER_FEES.hok.monthly).toBeGreaterThan(0)
  })

  it("quarterly is 3x monthly", () => {
    expect(CHAMBER_FEES.hok.quarterly).toBeCloseTo(CHAMBER_FEES.hok.monthly * 3, 2)
  })

  it("annual is 12x monthly", () => {
    expect(CHAMBER_FEES.hok.annual).toBeCloseTo(CHAMBER_FEES.hok.monthly * 12, 2)
  })

  it("has HOK deadlines", () => {
    expect(CHAMBER_FEES.hok.deadlines).toBeInstanceOf(Array)
    expect(CHAMBER_FEES.hok.deadlines.length).toBe(4)
  })

  it("HOK deadlines match DEADLINES data", () => {
    expect(CHAMBER_FEES.hok.deadlines).toEqual(DEADLINES.hok.dates)
  })

  it("has TZ groups defined", () => {
    expect(CHAMBER_FEES.tz.groups).toBeInstanceOf(Array)
    expect(CHAMBER_FEES.tz.groups.length).toBeGreaterThan(0)
  })

  it("TZ groups have valid rates", () => {
    CHAMBER_FEES.tz.groups.forEach((group) => {
      expect(group.rate).toBeGreaterThan(0)
      expect(group.rate).toBeLessThan(1)
      expect(group.id).toBeDefined()
      expect(group.description).toBeDefined()
      expect(group.activities).toBeInstanceOf(Array)
    })
  })

  it("TZ group rates are in descending order (tourism highest)", () => {
    const rates = CHAMBER_FEES.tz.groups.map((g) => g.rate)
    for (let i = 1; i < rates.length; i++) {
      expect(rates[i]).toBeLessThanOrEqual(rates[i - 1])
    }
  })
})

describe("Cross-data consistency", () => {
  it("paušalni threshold matches between THRESHOLDS and TAX_RATES", () => {
    expect(THRESHOLDS.pausalni.value).toBe(TAX_RATES.pausal.maxRevenue)
  })

  it("PDV and paušalni thresholds are equal (both 60000 EUR)", () => {
    expect(THRESHOLDS.pdv.value).toBe(THRESHOLDS.pausalni.value)
  })

  it("all years are consistent across data sources", () => {
    const year = CONTRIBUTIONS.year
    expect(TAX_RATES.income.year).toBe(year)
    expect(TAX_RATES.corporate.year).toBe(year)
    expect(TAX_RATES.pausal.year).toBe(year)
    expect(THRESHOLDS.year).toBe(year)
    expect(DEADLINES.year).toBe(year)
    expect(PAYMENT_DETAILS.year).toBe(year)
    expect(CHAMBER_FEES.year).toBe(year)
  })

  it("all lastVerified dates are in the same year or current year", () => {
    const dates = [
      CONTRIBUTIONS.lastVerified,
      TAX_RATES.income.lastVerified,
      TAX_RATES.corporate.lastVerified,
      TAX_RATES.pausal.lastVerified,
      THRESHOLDS.lastVerified,
      DEADLINES.lastVerified,
      PAYMENT_DETAILS.lastVerified,
      CHAMBER_FEES.lastVerified,
    ]

    const years = dates.map((date) => new Date(date).getFullYear())
    const uniqueYears = [...new Set(years)]

    // All verification dates should be within 1 year of each other
    expect(Math.max(...uniqueYears) - Math.min(...uniqueYears)).toBeLessThanOrEqual(1)
  })
})
