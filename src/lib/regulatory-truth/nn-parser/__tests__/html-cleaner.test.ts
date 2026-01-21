import { describe, it, expect } from "vitest"
import { cleanHtml, extractText } from "../html-cleaner"

describe("HTML Cleaner", () => {
  describe("cleanHtml", () => {
    it("removes script and style tags", () => {
      const html =
        "<html><head><script>alert(1)</script><style>body{}</style></head><body>Content</body></html>"
      const result = cleanHtml(html)
      expect(result).not.toContain("<script>")
      expect(result).not.toContain("<style>")
      expect(result).toContain("Content")
    })

    it("normalizes whitespace", () => {
      const html = "<p>Hello     World</p>"
      const result = cleanHtml(html)
      expect(result).toContain("Hello World")
    })

    it("preserves article structure markers", () => {
      const html = "<p>Članak 1.</p><p>(1) First paragraph</p>"
      const result = cleanHtml(html)
      expect(result).toContain("Članak 1.")
      expect(result).toContain("(1)")
    })
  })

  describe("extractText", () => {
    it("extracts plain text from HTML", () => {
      const html = "<p>Hello <b>World</b></p>"
      const result = extractText(html)
      expect(result).toBe("Hello World")
    })

    it("handles line breaks correctly", () => {
      const html = "<p>Line 1</p><p>Line 2</p>"
      const result = extractText(html)
      expect(result).toContain("Line 1")
      expect(result).toContain("Line 2")
    })
  })
})
