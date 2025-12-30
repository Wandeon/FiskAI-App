import { describe, it } from "node:test"
import assert from "node:assert"
import { buildRacunRequest, buildStornoRequest, FiscalInvoiceData } from "../xml-builder"
import * as forge from "node-forge"

// Generate a test RSA key pair
const testKeys = forge.pki.rsa.generateKeyPair({ bits: 1024, workers: -1 })
const MOCK_PRIVATE_KEY = forge.pki.privateKeyToPem(testKeys.privateKey)
const MOCK_OIB = "12345678903" // Valid OIB

describe("xml-builder", () => {
  describe("buildRacunRequest", () => {
    const validInvoice: FiscalInvoiceData = {
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

    it("should build valid RacunZahtjev XML structure", () => {
      const result = buildRacunRequest(validInvoice, MOCK_PRIVATE_KEY, MOCK_OIB)

      assert.ok(result.xml, "XML should be generated")
      assert.ok(result.zki, "ZKI should be generated")
      assert.ok(result.messageId, "Message ID should be generated")
      assert.ok(result.xml.includes("tns:RacunZahtjev"))
    })

    it("should format amounts correctly", () => {
      const result = buildRacunRequest(validInvoice, MOCK_PRIVATE_KEY, MOCK_OIB)
      assert.ok(result.xml.includes("<tns:IznosUkupno>125.00</tns:IznosUkupno>"))
    })

    it("should throw error for invalid company OIB", () => {
      assert.throws(
        () => buildRacunRequest(validInvoice, MOCK_PRIVATE_KEY, "12345678901"),
        /Invalid company OIB/
      )
    })
  })

  describe("buildStornoRequest", () => {
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

    it("should create storno with negative amounts", () => {
      const result = buildStornoRequest(originalInvoice, "test-jir", MOCK_PRIVATE_KEY, MOCK_OIB)

      assert.ok(result.xml.includes("-125.00"))
      assert.ok(result.xml.includes("STORNO test-jir"))
    })
  })
})
