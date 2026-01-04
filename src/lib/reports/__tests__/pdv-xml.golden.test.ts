// src/lib/reports/__tests__/pdv-xml.golden.test.ts
import { describe, it, vi } from "vitest"

// Mock DB - this test only uses pure XML generation, no DB access
// The generator module imports db but this test doesn't use those code paths
vi.mock("@/lib/db", () => ({ db: {} }))
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
        standard: { rate: VAT_RATES.STANDARD, baseAmount: "10000.00", vatAmount: "2500.00" },
        reduced: { rate: VAT_RATES.REDUCED, baseAmount: "0.00", vatAmount: "0.00" },
        superReduced: { rate: VAT_RATES.SUPER_REDUCED, baseAmount: "0.00", vatAmount: "0.00" },
      },
      euDeliveries: { goods: "0.00", services: "0.00" },
      exports: "0.00",
      exempt: "0.00",
      totalOutputVat: "2500.00",
      totalBaseOutput: "10000.00",
    },
    section2: {
      domestic: {
        standard: { rate: VAT_RATES.STANDARD, baseAmount: "4000.00", vatAmount: "1000.00" },
        reduced: { rate: VAT_RATES.REDUCED, baseAmount: "0.00", vatAmount: "0.00" },
        superReduced: { rate: VAT_RATES.SUPER_REDUCED, baseAmount: "0.00", vatAmount: "0.00" },
      },
      euAcquisitions: {
        goods: { rate: VAT_RATES.STANDARD, baseAmount: "0.00", vatAmount: "0.00" },
        services: { rate: VAT_RATES.STANDARD, baseAmount: "0.00", vatAmount: "0.00" },
      },
      imports: { rate: VAT_RATES.STANDARD, baseAmount: "0.00", vatAmount: "0.00" },
      nonDeductible: "0.00",
      totalInputVat: "1000.00",
      totalBaseInput: "4000.00",
    },
    section3: {
      outputVat: "2500.00",
      inputVat: "1000.00",
      vatPayable: "1500.00",
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
            standard: { rate: 25, baseAmount: "8000.00", vatAmount: "2000.00" },
            reduced: { rate: 13, baseAmount: "3000.00", vatAmount: "390.00" },
            superReduced: { rate: 5, baseAmount: "1000.00", vatAmount: "50.00" },
          },
          euDeliveries: { goods: "0.00", services: "0.00" },
          exports: "0.00",
          exempt: "0.00",
          totalOutputVat: "2440.00",
          totalBaseOutput: "12000.00",
        },
        section2: {
          domestic: {
            standard: { rate: 25, baseAmount: "2000.00", vatAmount: "500.00" },
            reduced: { rate: 13, baseAmount: "1000.00", vatAmount: "130.00" },
            superReduced: { rate: 5, baseAmount: "500.00", vatAmount: "25.00" },
          },
          euAcquisitions: {
            goods: { rate: 25, baseAmount: "0.00", vatAmount: "0.00" },
            services: { rate: 25, baseAmount: "0.00", vatAmount: "0.00" },
          },
          imports: { rate: 25, baseAmount: "0.00", vatAmount: "0.00" },
          nonDeductible: "0.00",
          totalInputVat: "655.00",
          totalBaseInput: "3500.00",
        },
        section3: {
          outputVat: "2440.00",
          inputVat: "655.00",
          vatPayable: "1785.00",
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
            standard: { rate: 25, baseAmount: "1000.00", vatAmount: "250.00" },
            reduced: { rate: 13, baseAmount: "0.00", vatAmount: "0.00" },
            superReduced: { rate: 5, baseAmount: "0.00", vatAmount: "0.00" },
          },
          euDeliveries: { goods: "0.00", services: "0.00" },
          exports: "0.00",
          exempt: "0.00",
          totalOutputVat: "250.00",
          totalBaseOutput: "1000.00",
        },
        section2: {
          domestic: {
            standard: { rate: 25, baseAmount: "4000.00", vatAmount: "1000.00" },
            reduced: { rate: 13, baseAmount: "0.00", vatAmount: "0.00" },
            superReduced: { rate: 5, baseAmount: "0.00", vatAmount: "0.00" },
          },
          euAcquisitions: {
            goods: { rate: 25, baseAmount: "0.00", vatAmount: "0.00" },
            services: { rate: 25, baseAmount: "0.00", vatAmount: "0.00" },
          },
          imports: { rate: 25, baseAmount: "0.00", vatAmount: "0.00" },
          nonDeductible: "0.00",
          totalInputVat: "1000.00",
          totalBaseInput: "4000.00",
        },
        section3: {
          outputVat: "250.00",
          inputVat: "1000.00",
          vatPayable: "-750.00", // Refund
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
            standard: { rate: 25, baseAmount: "5000.00", vatAmount: "1250.00" },
            reduced: { rate: 13, baseAmount: "0.00", vatAmount: "0.00" },
            superReduced: { rate: 5, baseAmount: "0.00", vatAmount: "0.00" },
          },
          euDeliveries: { goods: "2000.00", services: "500.00" }, // Zero-rated EU deliveries
          exports: "1000.00", // Zero-rated exports
          exempt: "0.00",
          totalOutputVat: "1250.00",
          totalBaseOutput: "8500.00",
        },
        section2: {
          domestic: {
            standard: { rate: 25, baseAmount: "2000.00", vatAmount: "500.00" },
            reduced: { rate: 13, baseAmount: "0.00", vatAmount: "0.00" },
            superReduced: { rate: 5, baseAmount: "0.00", vatAmount: "0.00" },
          },
          euAcquisitions: {
            goods: { rate: 25, baseAmount: "1000.00", vatAmount: "250.00" }, // Reverse charge
            services: { rate: 25, baseAmount: "500.00", vatAmount: "125.00" }, // Reverse charge
          },
          imports: { rate: 25, baseAmount: "300.00", vatAmount: "75.00" },
          nonDeductible: "50.00",
          totalInputVat: "950.00",
          totalBaseInput: "3800.00",
        },
        section3: {
          outputVat: "1250.00",
          inputVat: "950.00",
          vatPayable: "300.00",
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
          marginScheme: "500.00",
          travelAgency: "200.00",
          usedGoods: "100.00",
        },
      })

      const xml = generatePdvXml(data)
      const normalized = normalizePdvXml(xml)

      assertMatchesGolden(normalized, path.join(FIXTURES_DIR, "pdv-special-provisions.xml"))
    })
  })
})
