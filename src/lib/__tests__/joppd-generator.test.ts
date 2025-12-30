import { describe, it } from "node:test"
import assert from "node:assert"
import { generateJoppdXml, type JoppdFormData } from "../joppd/joppd-generator"
import { validateJoppdXml } from "../joppd/joppd-xml-schema"

describe("JOPPD XML Generator", () => {
  it("generates valid JOPPD XML structure", () => {
    const input: JoppdFormData = {
      submissionId: "test-sub-1",
      companyOib: "12345678901",
      companyName: "Test Company d.o.o.",
      periodYear: 2025,
      periodMonth: 1,
      payoutId: "payout-1",
      payoutDate: new Date("2025-01-15T00:00:00Z"),
      createdAt: new Date("2025-01-15T10:00:00Z"),
      lines: [
        {
          lineNumber: 1,
          payoutLineId: "line-1",
          recipientName: "Ivo Ivic",
          recipientOib: "11111111111",
          grossAmount: 1000,
          netAmount: 700,
          taxAmount: 100,
          lineData: {
            municipalityCode: "01333",
            recipientType: "0001",
          },
        },
        {
          lineNumber: 2,
          payoutLineId: "line-2",
          recipientName: "Ana Anic",
          recipientOib: "22222222222",
          grossAmount: 2000,
          netAmount: 1400,
          taxAmount: 200,
          lineData: {
            municipalityCode: "01333",
          },
        },
      ],
    }

    const xml = generateJoppdXml(input)
    const validation = validateJoppdXml(xml)

    // Check Root
    assert.ok(xml.includes("<ObrazacJOPPD"), "Missing root element")
    assert.equal(validation.valid, true, "XML should pass schema validation")

    // Check Header
    assert.ok(xml.includes("<Metapodaci>"), "Missing Metapodaci")
    assert.ok(xml.includes("<DatumIzvjesca>2025-01-15</DatumIzvjesca>"), "Wrong report date")

    // Check Strana A
    assert.ok(xml.includes("<StranaA>"), "Missing StranaA")
    assert.ok(xml.includes("<BrojOsoba>2</BrojOsoba>"), "Wrong person count")

    // Check Aggregates
    // Gross: 1000 + 2000 = 3000.00
    assert.ok(xml.includes("<I>3000.00</I>"), "Wrong Gross Aggregate (I)")
    // Net: 700 + 1400 = 2100.00
    assert.ok(xml.includes("<V>2100.00</V>"), "Wrong Net Aggregate (V)")

    // Check Strana B
    assert.ok(xml.includes("<StranaB>"), "Missing StranaB")
    assert.ok(xml.includes("<P1>11111111111</P1>"), "Missing Recipient OIB 1")
    assert.ok(xml.includes("<P1>22222222222</P1>"), "Missing Recipient OIB 2")

    // Check Line Details
    assert.ok(xml.includes("<P11>1000.00</P11>"), "Missing Line 1 Gross")
    assert.ok(xml.includes("<P11>2000.00</P11>"), "Missing Line 2 Gross")
  })
})
