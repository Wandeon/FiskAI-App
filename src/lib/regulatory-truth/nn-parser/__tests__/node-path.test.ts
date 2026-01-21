import { describe, it, expect } from "vitest"
import { buildNodePath, parseArticleNumber, parseStavakNumber, parseTockaLabel } from "../node-path"

describe("NodePath Builder", () => {
  describe("parseArticleNumber", () => {
    it('parses "Članak 1."', () => {
      expect(parseArticleNumber("Članak 1.")).toBe("1")
    })

    it('parses "Članak 28."', () => {
      expect(parseArticleNumber("Članak 28.")).toBe("28")
    })

    it('parses "Članak 1.a"', () => {
      expect(parseArticleNumber("Članak 1.a")).toBe("1a")
    })

    it("returns null for non-article text", () => {
      expect(parseArticleNumber("Some text")).toBeNull()
    })
  })

  describe("parseStavakNumber", () => {
    it('parses "(1)"', () => {
      expect(parseStavakNumber("(1) Text here")).toBe("1")
    })

    it('parses "(15)"', () => {
      expect(parseStavakNumber("(15) More text")).toBe("15")
    })

    it("returns null for non-stavak text", () => {
      expect(parseStavakNumber("Plain text")).toBeNull()
    })
  })

  describe("parseTockaLabel", () => {
    it('parses "a)"', () => {
      expect(parseTockaLabel("a) First item")).toBe("a")
    })

    it('parses "1."', () => {
      expect(parseTockaLabel("1. First item")).toBe("1")
    })

    it('parses "–" bullet', () => {
      expect(parseTockaLabel("– Item text")).toBe("bullet")
    })
  })

  describe("buildNodePath", () => {
    it("builds article path", () => {
      expect(buildNodePath({ article: "28" })).toBe("/članak:28")
    })

    it("builds article + stavak path", () => {
      expect(buildNodePath({ article: "28", stavak: "1" })).toBe("/članak:28/stavak:1")
    })

    it("builds full nested path", () => {
      expect(
        buildNodePath({
          article: "28",
          stavak: "1",
          tocka: "a",
          podtocka: "1",
        })
      ).toBe("/članak:28/stavak:1/točka:a/podtočka:1")
    })
  })
})
