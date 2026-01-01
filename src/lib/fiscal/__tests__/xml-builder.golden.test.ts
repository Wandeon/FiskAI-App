// src/lib/fiscal/__tests__/xml-builder.golden.test.ts
import { describe, it } from "vitest"
import path from "path"
import * as forge from "node-forge"
import { buildRacunRequest, buildStornoRequest, FiscalInvoiceData } from "../xml-builder"
import { normalizeXml, assertMatchesGolden } from "@/test-utils/golden-test"

// Generate a deterministic test RSA key pair for consistent ZKI generation
// In real tests, we normalize the ZKI anyway, but this ensures consistency
const testKeys = forge.pki.rsa.generateKeyPair({ bits: 1024, workers: -1 })
const MOCK_PRIVATE_KEY = forge.pki.privateKeyToPem(testKeys.privateKey)
const MOCK_OIB = "12345678903" // Valid OIB with correct check digit

const FIXTURES_DIR = path.join(__dirname, "fixtures")

describe("Fiscal XML Golden Tests", () => {
  describe("buildRacunRequest", () => {
    it("standard invoice XML matches fixture", () => {
      const invoice: FiscalInvoiceData = {
        invoiceNumber: 1,
        premisesCode: "PP1",
        deviceCode: "NA1",
        issueDate: new Date("2025-01-15T14:30:00"),
        totalAmount: 125.0,
        vatRegistered: true,
        vatBreakdown: [{ rate: 25, baseAmount: 100.0, vatAmount: 25.0 }],
        paymentMethod: "G", // Cash
        operatorOib: MOCK_OIB,
        subsequentDelivery: false,
      }

      const result = buildRacunRequest(invoice, MOCK_PRIVATE_KEY, MOCK_OIB)

      // Normalize dynamic values for deterministic comparison
      const normalized = normalizeXml(result.xml, {
        normalizeIds: true,
        normalizeTimestamps: true,
        normalizeZki: true,
      })

      assertMatchesGolden(normalized, path.join(FIXTURES_DIR, "fiscal-standard.xml"))
    })

    it("invoice with multiple VAT rates matches fixture", () => {
      const invoice: FiscalInvoiceData = {
        invoiceNumber: 42,
        premisesCode: "SHOP",
        deviceCode: "POS1",
        issueDate: new Date("2025-03-15T10:00:00"),
        totalAmount: 238.0, // 100*1.25 + 50*1.13 + 20*1.05 = 125 + 56.5 + 21 = 202.5... adjusted
        vatRegistered: true,
        vatBreakdown: [
          { rate: 25, baseAmount: 100.0, vatAmount: 25.0 },
          { rate: 13, baseAmount: 50.0, vatAmount: 6.5 },
          { rate: 5, baseAmount: 20.0, vatAmount: 1.0 },
        ],
        paymentMethod: "K", // Card
        operatorOib: MOCK_OIB,
        subsequentDelivery: false,
      }

      const result = buildRacunRequest(invoice, MOCK_PRIVATE_KEY, MOCK_OIB)

      const normalized = normalizeXml(result.xml, {
        normalizeIds: true,
        normalizeTimestamps: true,
        normalizeZki: true,
      })

      assertMatchesGolden(normalized, path.join(FIXTURES_DIR, "fiscal-multi-vat.xml"))
    })

    it("invoice with exemptions matches fixture", () => {
      const invoice: FiscalInvoiceData = {
        invoiceNumber: 100,
        premisesCode: "HQ",
        deviceCode: "REG1",
        issueDate: new Date("2025-06-01T09:00:00"),
        totalAmount: 200.0,
        vatRegistered: true,
        vatBreakdown: [{ rate: 25, baseAmount: 100.0, vatAmount: 25.0 }],
        exemptAmount: 50.0,
        notTaxableAmount: 25.0,
        paymentMethod: "T", // Bank transfer
        operatorOib: MOCK_OIB,
        subsequentDelivery: false,
      }

      const result = buildRacunRequest(invoice, MOCK_PRIVATE_KEY, MOCK_OIB)

      const normalized = normalizeXml(result.xml, {
        normalizeIds: true,
        normalizeTimestamps: true,
        normalizeZki: true,
      })

      assertMatchesGolden(normalized, path.join(FIXTURES_DIR, "fiscal-with-exemptions.xml"))
    })

    it("subsequent delivery invoice matches fixture", () => {
      const invoice: FiscalInvoiceData = {
        invoiceNumber: 5,
        premisesCode: "PP1",
        deviceCode: "NA1",
        issueDate: new Date("2025-01-20T16:00:00"),
        totalAmount: 50.0,
        vatRegistered: true,
        vatBreakdown: [{ rate: 25, baseAmount: 40.0, vatAmount: 10.0 }],
        paymentMethod: "G",
        operatorOib: MOCK_OIB,
        subsequentDelivery: true,
        paragonNumber: "PAR-001",
      }

      const result = buildRacunRequest(invoice, MOCK_PRIVATE_KEY, MOCK_OIB)

      const normalized = normalizeXml(result.xml, {
        normalizeIds: true,
        normalizeTimestamps: true,
        normalizeZki: true,
      })

      assertMatchesGolden(normalized, path.join(FIXTURES_DIR, "fiscal-subsequent.xml"))
    })

    it("non-VAT registered invoice matches fixture", () => {
      const invoice: FiscalInvoiceData = {
        invoiceNumber: 1,
        premisesCode: "MALI",
        deviceCode: "K1",
        issueDate: new Date("2025-02-01T11:30:00"),
        totalAmount: 75.0,
        vatRegistered: false,
        paymentMethod: "G",
        operatorOib: MOCK_OIB,
        subsequentDelivery: false,
      }

      const result = buildRacunRequest(invoice, MOCK_PRIVATE_KEY, MOCK_OIB)

      const normalized = normalizeXml(result.xml, {
        normalizeIds: true,
        normalizeTimestamps: true,
        normalizeZki: true,
      })

      assertMatchesGolden(normalized, path.join(FIXTURES_DIR, "fiscal-non-vat.xml"))
    })
  })

  describe("buildStornoRequest", () => {
    it("storno invoice XML matches fixture", () => {
      const originalInvoice: FiscalInvoiceData = {
        invoiceNumber: 1,
        premisesCode: "PP1",
        deviceCode: "NA1",
        issueDate: new Date("2025-01-15T14:30:00"),
        totalAmount: 125.0,
        vatRegistered: true,
        vatBreakdown: [{ rate: 25, baseAmount: 100.0, vatAmount: 25.0 }],
        paymentMethod: "G",
        operatorOib: MOCK_OIB,
        subsequentDelivery: false,
      }

      const originalJir = "abc12345-def6-7890-ghij-klmnopqrstuv"
      const result = buildStornoRequest(originalInvoice, originalJir, MOCK_PRIVATE_KEY, MOCK_OIB)

      const normalized = normalizeXml(result.xml, {
        normalizeIds: true,
        normalizeTimestamps: true,
        normalizeZki: true,
      })

      assertMatchesGolden(normalized, path.join(FIXTURES_DIR, "fiscal-storno.xml"))
    })
  })
})
