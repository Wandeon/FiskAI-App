import { describe, it } from "node:test"
import assert from "node:assert"

const successResponse = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
  <soap:Body>
    <tns:RacunOdgovor xmlns:tns="http://www.apis-it.hr/fin/2012/types/f73">
      <tns:Jir>test-jir-123</tns:Jir>
      <tns:ZastKod>1234567890abcdef</tns:ZastKod>
    </tns:RacunOdgovor>
  </soap:Body>
</soap:Envelope>`

describe("porezna-client", () => {
  describe("XML response parsing", () => {
    it("should parse successful Porezna response", async () => {
      const { parseStringPromise } = await import("xml2js")

      const stripNamespace = (name: string): string => {
        const idx = name.indexOf(":")
        return idx >= 0 ? name.substring(idx + 1) : name
      }

      const parsed = await parseStringPromise(successResponse, {
        explicitArray: false,
        ignoreAttrs: false,
        tagNameProcessors: [stripNamespace],
      })

      const odgovor = parsed.Envelope?.Body?.RacunOdgovor

      assert.ok(odgovor, "Should have RacunOdgovor")
      assert.strictEqual(odgovor.Jir, "test-jir-123")
      assert.strictEqual(odgovor.ZastKod, "1234567890abcdef")
    })

    it("should strip XML namespaces", () => {
      const stripNamespace = (name: string): string => {
        const idx = name.indexOf(":")
        return idx >= 0 ? name.substring(idx + 1) : name
      }

      assert.strictEqual(stripNamespace("tns:Racun"), "Racun")
      assert.strictEqual(stripNamespace("Racun"), "Racun")
    })
  })
})
