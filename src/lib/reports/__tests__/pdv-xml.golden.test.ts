// src/lib/reports/__tests__/pdv-xml.golden.test.ts
import { describe, it } from "vitest"
import path from "path"
import { generatePdvXml, PdvFormData, VAT_RATES } from "../pdv-xml-generator"
import { assertMatchesGolden } from "@/test-utils/golden-test"

const FIXTURES_DIR = path.join(__dirname, "fixtures")

/**
 * Normalize PDV XML for deterministic comparison.
 * Removes dynamic timestamps that change between runs.
 */
function normalizePdvXml(xml: string): string {
  return xml
    .replace(/<Datum>\d{4}-\d{2}-\d{2}<\/Datum>/g, "<Datum>STABLE-DATE</Datum>")
    .replace(/<Vrijeme>\d{2}:\d{2}:\d{2}<\/Vrijeme>/g, "<Vrijeme>STABLE-TIME</Vrijeme>")
    .trim()
}

// Helper to create a base PdvFormData
function createBasePdvFormData(overrides: Partial<PdvFormData> = {}): PdvFormData {
  return {
    companyOib: "12345678903",
    companyName: "Test d.o.o.",
    companyAddress: "Ulica 1",
    companyCity: "Zagreb",
    companyPostalCode: "10000",
    periodType: "MONTHLY",
    periodMonth: 1,
    periodYear: 2025,
    section1: {
      domestic: {
        standard: { rate: VAT_RATES.STANDARD, baseAmount: 10000, vatAmount: 2500 },
        reduced: { rate: VAT_RATES.REDUCED, baseAmount: 0, vatAmount: 0 },
        superReduced: { rate: VAT_RATES.SUPER_REDUCED, baseAmount: 0, vatAmount: 0 },
      },
      euDeliveries: { goods: 0, services: 0 },
      exports: 0,
      exempt: 0,
      totalOutputVat: 2500,
      totalBaseOutput: 10000,
    },
    section2: {
      domestic: {
        standard: { rate: VAT_RATES.STANDARD, baseAmount: 4000, vatAmount: 1000 },
        reduced: { rate: VAT_RATES.REDUCED, baseAmount: 0, vatAmount: 0 },
        superReduced: { rate: VAT_RATES.SUPER_REDUCED, baseAmount: 0, vatAmount: 0 },
      },
      euAcquisitions: {
        goods: { rate: VAT_RATES.STANDARD, baseAmount: 0, vatAmount: 0 },
        services: { rate: VAT_RATES.STANDARD, baseAmount: 0, vatAmount: 0 },
      },
      imports: { rate: VAT_RATES.STANDARD, baseAmount: 0, vatAmount: 0 },
      nonDeductible: 0,
      totalInputVat: 1000,
      totalBaseInput: 4000,
    },
    section3: {
      outputVat: 2500,
      inputVat: 1000,
      vatPayable: 1500,
    },
    ...overrides,
  }
}

describe("PDV XML Golden Tests", () => {
  describe("generatePdvXml", () => {
    it("monthly VAT return matches fixture", () => {
      const data = createBasePdvFormData({
        periodMonth: 1,
        periodYear: 2025,
      })

      const xml = generatePdvXml(data)
      const normalized = normalizePdvXml(xml)

      assertMatchesGolden(normalized, path.join(FIXTURES_DIR, "pdv-monthly.xml"))
    })

    it("quarterly VAT return matches fixture", () => {
      const data = createBasePdvFormData({
        periodType: "QUARTERLY",
        periodMonth: undefined,
        periodQuarter: 1,
        periodYear: 2025,
      })

      const xml = generatePdvXml(data)
      const normalized = normalizePdvXml(xml)

      assertMatchesGolden(normalized, path.join(FIXTURES_DIR, "pdv-quarterly.xml"))
    })

    it("VAT with multiple rates matches fixture", () => {
      const data = createBasePdvFormData({
        periodMonth: 3,
        periodYear: 2025,
        section1: {
          domestic: {
            standard: { rate: 25, baseAmount: 8000, vatAmount: 2000 },
            reduced: { rate: 13, baseAmount: 3000, vatAmount: 390 },
            superReduced: { rate: 5, baseAmount: 1000, vatAmount: 50 },
          },
          euDeliveries: { goods: 0, services: 0 },
          exports: 0,
          exempt: 0,
          totalOutputVat: 2440,
          totalBaseOutput: 12000,
        },
        section2: {
          domestic: {
            standard: { rate: 25, baseAmount: 2000, vatAmount: 500 },
            reduced: { rate: 13, baseAmount: 1000, vatAmount: 130 },
            superReduced: { rate: 5, baseAmount: 500, vatAmount: 25 },
          },
          euAcquisitions: {
            goods: { rate: 25, baseAmount: 0, vatAmount: 0 },
            services: { rate: 25, baseAmount: 0, vatAmount: 0 },
          },
          imports: { rate: 25, baseAmount: 0, vatAmount: 0 },
          nonDeductible: 0,
          totalInputVat: 655,
          totalBaseInput: 3500,
        },
        section3: {
          outputVat: 2440,
          inputVat: 655,
          vatPayable: 1785,
        },
      })

      const xml = generatePdvXml(data)
      const normalized = normalizePdvXml(xml)

      assertMatchesGolden(normalized, path.join(FIXTURES_DIR, "pdv-multi-rate.xml"))
    })

    it("VAT refund (negative payable) matches fixture", () => {
      const data = createBasePdvFormData({
        periodMonth: 6,
        periodYear: 2025,
        section1: {
          domestic: {
            standard: { rate: 25, baseAmount: 1000, vatAmount: 250 },
            reduced: { rate: 13, baseAmount: 0, vatAmount: 0 },
            superReduced: { rate: 5, baseAmount: 0, vatAmount: 0 },
          },
          euDeliveries: { goods: 0, services: 0 },
          exports: 0,
          exempt: 0,
          totalOutputVat: 250,
          totalBaseOutput: 1000,
        },
        section2: {
          domestic: {
            standard: { rate: 25, baseAmount: 4000, vatAmount: 1000 },
            reduced: { rate: 13, baseAmount: 0, vatAmount: 0 },
            superReduced: { rate: 5, baseAmount: 0, vatAmount: 0 },
          },
          euAcquisitions: {
            goods: { rate: 25, baseAmount: 0, vatAmount: 0 },
            services: { rate: 25, baseAmount: 0, vatAmount: 0 },
          },
          imports: { rate: 25, baseAmount: 0, vatAmount: 0 },
          nonDeductible: 0,
          totalInputVat: 1000,
          totalBaseInput: 4000,
        },
        section3: {
          outputVat: 250,
          inputVat: 1000,
          vatPayable: -750, // Refund
        },
      })

      const xml = generatePdvXml(data)
      const normalized = normalizePdvXml(xml)

      assertMatchesGolden(normalized, path.join(FIXTURES_DIR, "pdv-refund.xml"))
    })

    it("VAT with EU transactions matches fixture", () => {
      const data = createBasePdvFormData({
        periodMonth: 9,
        periodYear: 2025,
        section1: {
          domestic: {
            standard: { rate: 25, baseAmount: 5000, vatAmount: 1250 },
            reduced: { rate: 13, baseAmount: 0, vatAmount: 0 },
            superReduced: { rate: 5, baseAmount: 0, vatAmount: 0 },
          },
          euDeliveries: { goods: 2000, services: 500 }, // Zero-rated EU deliveries
          exports: 1000, // Zero-rated exports
          exempt: 0,
          totalOutputVat: 1250,
          totalBaseOutput: 8500,
        },
        section2: {
          domestic: {
            standard: { rate: 25, baseAmount: 2000, vatAmount: 500 },
            reduced: { rate: 13, baseAmount: 0, vatAmount: 0 },
            superReduced: { rate: 5, baseAmount: 0, vatAmount: 0 },
          },
          euAcquisitions: {
            goods: { rate: 25, baseAmount: 1000, vatAmount: 250 }, // Reverse charge
            services: { rate: 25, baseAmount: 500, vatAmount: 125 }, // Reverse charge
          },
          imports: { rate: 25, baseAmount: 300, vatAmount: 75 },
          nonDeductible: 50,
          totalInputVat: 950,
          totalBaseInput: 3800,
        },
        section3: {
          outputVat: 1250,
          inputVat: 950,
          vatPayable: 300,
        },
      })

      const xml = generatePdvXml(data)
      const normalized = normalizePdvXml(xml)

      assertMatchesGolden(normalized, path.join(FIXTURES_DIR, "pdv-with-eu.xml"))
    })

    it("VAT with special provisions matches fixture", () => {
      const data = createBasePdvFormData({
        periodMonth: 12,
        periodYear: 2025,
        section4: {
          marginScheme: 500,
          travelAgency: 200,
          usedGoods: 100,
        },
      })

      const xml = generatePdvXml(data)
      const normalized = normalizePdvXml(xml)

      assertMatchesGolden(normalized, path.join(FIXTURES_DIR, "pdv-special-provisions.xml"))
    })
  })
})
