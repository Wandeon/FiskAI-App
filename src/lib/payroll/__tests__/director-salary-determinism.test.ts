import { computeDirectorSalaryPayroll } from "../director-salary"

describe("computeDirectorSalaryPayroll", () => {
  it("computes contributions + tax deterministically without JS number coercion", () => {
    const contributions = {
      year: 2025,
      lastVerified: "2025-01-01",
      source: "test",
      rates: {
        MIO_I: {
          rate: 0.15,
          name: "MIO I",
          iban: "HR1210010051863000160",
          model: "HR68",
          pozivNaBroj: "123",
        },
        MIO_II: {
          rate: 0.05,
          name: "MIO II",
          iban: "HR1210010051863000160",
          model: "HR68",
          pozivNaBroj: "123",
        },
        HZZO: {
          rate: 0.165,
          name: "HZZO",
          iban: "HR1210010051863000160",
          model: "HR68",
          pozivNaBroj: "123",
        },
      },
      base: { minimum: 0, maximum: 1000000 },
      monthly: { mioI: 0, mioII: 0, hzzo: 0, total: 0 },
    } as any

    const incomeTax = {
      year: 2025,
      lastVerified: "2025-01-01",
      source: "test",
      personalAllowance: 560,
      brackets: [
        { min: 0, max: 50400, rate: 0.2 },
        { min: 50400.01, max: null, rate: 0.3 },
      ],
    } as any

    const municipality = {
      year: 2025,
      lastVerified: "2025-01-01",
      source: "test",
      entries: [
        {
          postalCode: "10000",
          city: "Zagreb",
          municipality: "Zagreb",
          county: "Grad Zagreb",
          prirezRate: 0.18,
        },
      ],
    } as any

    const originalNumber = globalThis.Number
    ;(globalThis as any).Number = () => {
      throw new Error("Number() coercion is forbidden for money computations")
    }

    try {
      const result = computeDirectorSalaryPayroll({
        grossAmount: "1000.00",
        postalCode: "10000",
        incomeTax,
        contributions,
        municipality,
      })

      expect(result.employeeContributions.mio1).toBe("150.00")
      expect(result.employeeContributions.mio2).toBe("50.00")
      expect(result.employerContributions.hzzo).toBe("165.00")
      expect(result.tax.baseTax).toBe("48.00")
      expect(result.tax.surtax).toBe("8.64")
      expect(result.tax.totalTax).toBe("56.64")
      expect(result.netAmount).toBe("743.36")
    } finally {
      ;(globalThis as any).Number = originalNumber
    }
  })
})
