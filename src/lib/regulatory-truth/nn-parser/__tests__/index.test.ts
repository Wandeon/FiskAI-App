import { describe, it, expect } from "vitest"
import { NNParser, getParserVersion, getParserConfigHash } from "../index"

describe("NNParser", () => {
  describe("metadata", () => {
    it("has parserId", () => {
      expect(NNParser.parserId).toBe("nn-parser")
    })

    it("has parserVersion", () => {
      expect(NNParser.parserVersion).toMatch(/^\d+\.\d+\.\d+$|^[a-f0-9]{7,}$/)
    })

    it("has parseConfigHash", () => {
      expect(NNParser.parseConfigHash).toMatch(/^[a-f0-9]{64}$/)
    })
  })

  describe("parse", () => {
    it("parses HTML content", async () => {
      const result = await NNParser.parse({
        evidenceId: "test-123",
        contentClass: "HTML",
        artifact: {
          id: "artifact-123",
          kind: "HTML_RAW",
          content: '<html><body><p class="clanak">Članak 1.</p><p>Content</p></body></html>',
          contentHash: "abc123",
        },
      })

      expect(result.status).toBe("SUCCESS")
      expect(result.cleanText).toContain("Članak 1")
    })
  })

  describe("version helpers", () => {
    it("getParserVersion returns consistent value", () => {
      expect(getParserVersion()).toBe(getParserVersion())
    })

    it("getParserConfigHash changes with config", () => {
      const hash1 = getParserConfigHash({ someOption: true })
      const hash2 = getParserConfigHash({ someOption: false })
      expect(hash1).not.toBe(hash2)
    })
  })
})
