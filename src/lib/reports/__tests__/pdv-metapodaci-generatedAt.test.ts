import { vi } from "vitest"

// Mock DB - this test uses pure XML generation
vi.mock("@/lib/db", () => ({ db: {} }))

import { generatePdvXml, VAT_RATES, type PdvFormData } from "../pdv-xml-generator"

describe("generatePdvXml metapodaci", () => {
  it("uses the provided generatedAt timestamp", () => {
    const data: PdvFormData = {
      companyOib: "12345678903",
      companyName: "Test d.o.o.",
      companyAddress: "Ulica 1",
      companyCity: "Zagreb",
      companyPostalCode: "10000",
      periodType: "MONTHLY",
      periodMonth: 3,
      periodYear: 2025,
      section1: {
        domestic: {
          standard: { rate: VAT_RATES.STANDARD, baseAmount: "1000.00", vatAmount: "250.00" },
          reduced: { rate: VAT_RATES.REDUCED, baseAmount: "0.00", vatAmount: "0.00" },
          superReduced: { rate: VAT_RATES.SUPER_REDUCED, baseAmount: "0.00", vatAmount: "0.00" },
        },
        euDeliveries: { goods: "0.00", services: "0.00" },
        exports: "0.00",
        exempt: "0.00",
        totalOutputVat: "250.00",
        totalBaseOutput: "1000.00",
      },
      section2: {
        domestic: {
          standard: { rate: VAT_RATES.STANDARD, baseAmount: "0.00", vatAmount: "0.00" },
          reduced: { rate: VAT_RATES.REDUCED, baseAmount: "0.00", vatAmount: "0.00" },
          superReduced: { rate: VAT_RATES.SUPER_REDUCED, baseAmount: "0.00", vatAmount: "0.00" },
        },
        euAcquisitions: {
          goods: { rate: VAT_RATES.STANDARD, baseAmount: "0.00", vatAmount: "0.00" },
          services: { rate: VAT_RATES.STANDARD, baseAmount: "0.00", vatAmount: "0.00" },
        },
        imports: { rate: VAT_RATES.STANDARD, baseAmount: "0.00", vatAmount: "0.00" },
        nonDeductible: "0.00",
        totalInputVat: "0.00",
        totalBaseInput: "0.00",
      },
      section3: { outputVat: "250.00", inputVat: "0.00", vatPayable: "250.00" },
    }

    const generatedAt = new Date("2025-03-31T12:34:56.000Z")
    const xml = generatePdvXml(data, { generatedAt } as any)

    expect(xml).toContain("<Datum>2025-03-31</Datum>")
    expect(xml).toContain("<Vrijeme>12:34:56</Vrijeme>")
  })
})
