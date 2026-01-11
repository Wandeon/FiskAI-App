/**
 * Streaming Sitemap Parser Tests
 *
 * Tests the SAX-based streaming XML parser for sitemaps.
 * Covers: chunk boundaries, limits, normalization, error handling.
 */

import { describe, it, expect } from "vitest"
import {
  parseSitemapIndexLocs,
  parseUrlsetLocs,
  StreamingParserLimitError,
  StreamingParserError,
  STREAMING_PARSER_DEFAULTS,
} from "../streaming-sitemap-parser"

/**
 * Helper: Convert string to async iterable of chunks
 */
async function* stringToChunks(str: string, chunkSize?: number): AsyncGenerator<Uint8Array> {
  const encoder = new TextEncoder()
  const bytes = encoder.encode(str)

  if (chunkSize) {
    for (let i = 0; i < bytes.length; i += chunkSize) {
      yield bytes.slice(i, i + chunkSize)
    }
  } else {
    yield bytes
  }
}

/**
 * Helper: Convert array of strings to async iterable of chunks
 * Each string becomes one chunk - useful for testing specific boundaries
 */
async function* stringsToChunks(strings: string[]): AsyncGenerator<Uint8Array> {
  const encoder = new TextEncoder()
  for (const str of strings) {
    yield encoder.encode(str)
  }
}

/**
 * Helper: Collect all yields from async generator
 */
async function collectAll<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const results: T[] = []
  for await (const item of gen) {
    results.push(item)
  }
  return results
}

describe("parseSitemapIndexLocs", () => {
  describe("basic functionality", () => {
    it("parses simple sitemap index", async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <sitemap>
            <loc>https://example.com/sitemap1.xml</loc>
          </sitemap>
          <sitemap>
            <loc>https://example.com/sitemap2.xml</loc>
          </sitemap>
        </sitemapindex>`

      const urls = await collectAll(parseSitemapIndexLocs(stringToChunks(xml)))

      expect(urls).toHaveLength(2)
      expect(urls[0]).toBe("https://example.com/sitemap1.xml")
      expect(urls[1]).toBe("https://example.com/sitemap2.xml")
    })

    it("handles empty sitemap index", async () => {
      const xml = `<?xml version="1.0"?>
        <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        </sitemapindex>`

      const urls = await collectAll(parseSitemapIndexLocs(stringToChunks(xml)))
      expect(urls).toHaveLength(0)
    })
  })

  describe("chunk boundary handling", () => {
    it("handles split <loc> tag across chunks", async () => {
      // Split: <lo | c>https://example.com</loc>
      const chunks = [
        "<sitemapindex><sitemap><lo",
        "c>https://example.com/test.xml</loc></sitemap></sitemapindex>",
      ]

      const urls = await collectAll(parseSitemapIndexLocs(stringsToChunks(chunks)))

      expect(urls).toHaveLength(1)
      expect(urls[0]).toBe("https://example.com/test.xml")
    })

    it("handles split URL text across chunks", async () => {
      // Split: https://exa | mple.com/path
      const chunks = [
        "<sitemapindex><sitemap><loc>https://exa",
        "mple.com/sitemap.xml</loc></sitemap></sitemapindex>",
      ]

      const urls = await collectAll(parseSitemapIndexLocs(stringsToChunks(chunks)))

      expect(urls).toHaveLength(1)
      expect(urls[0]).toBe("https://example.com/sitemap.xml")
    })

    it("handles multi-byte UTF-8 split across chunks", async () => {
      // Croatian character "ž" is 2 bytes (0xC5 0xBE)
      // Split the URL so the multi-byte char crosses chunk boundary
      const url = "https://example.com/straži.xml"
      const encoder = new TextEncoder()
      const fullXml = `<sitemapindex><sitemap><loc>${url}</loc></sitemap></sitemapindex>`
      const bytes = encoder.encode(fullXml)

      // Find position of "ž" and split there
      const zPosition = fullXml.indexOf("ž")
      const bytePosition = encoder.encode(fullXml.substring(0, zPosition)).length

      // Split in the middle of the multi-byte character
      const chunk1 = bytes.slice(0, bytePosition + 1) // First byte of ž
      const chunk2 = bytes.slice(bytePosition + 1) // Rest including second byte of ž

      async function* splitChunks(): AsyncGenerator<Uint8Array> {
        yield chunk1
        yield chunk2
      }

      const urls = await collectAll(parseSitemapIndexLocs(splitChunks()))

      expect(urls).toHaveLength(1)
      expect(urls[0]).toContain("stra") // URL should be intact
    })

    it("handles closing tag split across chunks", async () => {
      // Split: </lo | c>
      const chunks = [
        "<sitemapindex><sitemap><loc>https://example.com/test.xml</lo",
        "c></sitemap></sitemapindex>",
      ]

      const urls = await collectAll(parseSitemapIndexLocs(stringsToChunks(chunks)))

      expect(urls).toHaveLength(1)
      expect(urls[0]).toBe("https://example.com/test.xml")
    })
  })

  describe("streaming liveness", () => {
    it("yields first URL before consuming entire stream", async () => {
      // Create a generator that tracks how many chunks have been REQUESTED
      // (not how many have been yielded by the source)
      let chunksRequested = 0
      const totalChunks = 102

      async function* trackingChunks(): AsyncGenerator<Uint8Array> {
        const encoder = new TextEncoder()

        // First chunk contains complete first <loc>
        chunksRequested++
        yield encoder.encode(
          "<sitemapindex><sitemap><loc>https://example.com/first.xml</loc></sitemap>"
        )

        // Many more chunks
        for (let i = 0; i < 100; i++) {
          chunksRequested++
          yield encoder.encode(`<sitemap><loc>https://example.com/chunk${i}.xml</loc></sitemap>`)
        }

        chunksRequested++
        yield encoder.encode("</sitemapindex>")
      }

      const gen = parseSitemapIndexLocs(trackingChunks())

      // Get first URL
      const first = await gen.next()

      expect(first.done).toBe(false)
      expect(first.value).toBe("https://example.com/first.xml")

      // First URL should be yielded after consuming only a few chunks
      // NOT after all 102 chunks (which would indicate buffering)
      // Allow some slack for async iteration mechanics
      expect(chunksRequested).toBeLessThan(totalChunks / 2)

      // Clean up generator
      await gen.return(undefined)
    })
  })

  describe("namespace handling", () => {
    it("handles namespaced loc tags", async () => {
      const xml = `<?xml version="1.0"?>
        <ns:sitemapindex xmlns:ns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <ns:sitemap>
            <ns:loc>https://example.com/namespaced.xml</ns:loc>
          </ns:sitemap>
        </ns:sitemapindex>`

      const urls = await collectAll(parseSitemapIndexLocs(stringToChunks(xml)))

      expect(urls).toHaveLength(1)
      expect(urls[0]).toBe("https://example.com/namespaced.xml")
    })

    it("handles mixed namespace prefixes", async () => {
      const xml = `<?xml version="1.0"?>
        <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
          <sitemap>
            <loc>https://example.com/mixed.xml</loc>
          </sitemap>
        </sitemapindex>`

      const urls = await collectAll(parseSitemapIndexLocs(stringToChunks(xml)))

      expect(urls).toHaveLength(1)
    })
  })

  describe("CDATA handling", () => {
    it("handles CDATA wrapped URLs", async () => {
      const xml = `<?xml version="1.0"?>
        <sitemapindex>
          <sitemap>
            <loc><![CDATA[https://example.com/cdata.xml]]></loc>
          </sitemap>
        </sitemapindex>`

      const urls = await collectAll(parseSitemapIndexLocs(stringToChunks(xml)))

      expect(urls).toHaveLength(1)
      expect(urls[0]).toBe("https://example.com/cdata.xml")
    })

    it("handles mixed text and CDATA", async () => {
      const xml = `<?xml version="1.0"?>
        <sitemapindex>
          <sitemap>
            <loc>https://<![CDATA[example.com]]>/path.xml</loc>
          </sitemap>
        </sitemapindex>`

      const urls = await collectAll(parseSitemapIndexLocs(stringToChunks(xml)))

      expect(urls).toHaveLength(1)
      expect(urls[0]).toBe("https://example.com/path.xml")
    })
  })

  describe("output normalization", () => {
    it("trims whitespace from URLs", async () => {
      const xml = `<sitemapindex>
        <sitemap><loc>  https://example.com/spaces.xml  </loc></sitemap>
        <sitemap><loc>
          https://example.com/newlines.xml
        </loc></sitemap>
      </sitemapindex>`

      const urls = await collectAll(parseSitemapIndexLocs(stringToChunks(xml)))

      expect(urls).toHaveLength(2)
      expect(urls[0]).toBe("https://example.com/spaces.xml")
      expect(urls[1]).toBe("https://example.com/newlines.xml")
    })

    it("rejects empty URLs", async () => {
      const xml = `<sitemapindex>
        <sitemap><loc></loc></sitemap>
        <sitemap><loc>   </loc></sitemap>
        <sitemap><loc>https://example.com/valid.xml</loc></sitemap>
      </sitemapindex>`

      const urls = await collectAll(parseSitemapIndexLocs(stringToChunks(xml)))

      expect(urls).toHaveLength(1)
      expect(urls[0]).toBe("https://example.com/valid.xml")
    })

    it("rejects non-http(s) URLs", async () => {
      const xml = `<sitemapindex>
        <sitemap><loc>ftp://example.com/file.xml</loc></sitemap>
        <sitemap><loc>file:///local/path.xml</loc></sitemap>
        <sitemap><loc>javascript:alert(1)</loc></sitemap>
        <sitemap><loc>https://example.com/valid.xml</loc></sitemap>
        <sitemap><loc>http://example.com/also-valid.xml</loc></sitemap>
      </sitemapindex>`

      const urls = await collectAll(parseSitemapIndexLocs(stringToChunks(xml)))

      expect(urls).toHaveLength(2)
      expect(urls).toContain("https://example.com/valid.xml")
      expect(urls).toContain("http://example.com/also-valid.xml")
    })

    it("rejects malformed URLs", async () => {
      const xml = `<sitemapindex>
        <sitemap><loc>not-a-url</loc></sitemap>
        <sitemap><loc>://missing-scheme.com</loc></sitemap>
        <sitemap><loc>https://example.com/valid.xml</loc></sitemap>
      </sitemapindex>`

      const urls = await collectAll(parseSitemapIndexLocs(stringToChunks(xml)))

      expect(urls).toHaveLength(1)
      expect(urls[0]).toBe("https://example.com/valid.xml")
    })
  })

  describe("limit enforcement", () => {
    it("enforces maxLocLengthChars limit", async () => {
      const longPath = "a".repeat(3000)
      const xml = `<sitemapindex>
        <sitemap><loc>https://example.com/${longPath}</loc></sitemap>
      </sitemapindex>`

      await expect(collectAll(parseSitemapIndexLocs(stringToChunks(xml)))).rejects.toThrow(
        StreamingParserLimitError
      )

      try {
        await collectAll(parseSitemapIndexLocs(stringToChunks(xml)))
      } catch (e) {
        expect(e).toBeInstanceOf(StreamingParserLimitError)
        const error = e as StreamingParserLimitError
        expect(error.limitName).toBe("maxLocLengthChars")
        expect(error.limit).toBe(STREAMING_PARSER_DEFAULTS.maxLocLengthChars)
        expect(error.source).toBe("sitemapindex")
      }
    })

    it("enforces maxLocsPerFile limit", async () => {
      // Create sitemap with 101 URLs, limit to 100
      let xml = "<sitemapindex>"
      for (let i = 0; i < 101; i++) {
        xml += `<sitemap><loc>https://example.com/sitemap${i}.xml</loc></sitemap>`
      }
      xml += "</sitemapindex>"

      await expect(
        collectAll(parseSitemapIndexLocs(stringToChunks(xml), { maxLocsPerFile: 100 }))
      ).rejects.toThrow(StreamingParserLimitError)

      try {
        await collectAll(parseSitemapIndexLocs(stringToChunks(xml), { maxLocsPerFile: 100 }))
      } catch (e) {
        expect(e).toBeInstanceOf(StreamingParserLimitError)
        const error = e as StreamingParserLimitError
        expect(error.limitName).toBe("maxLocsPerFile")
        expect(error.value).toBe(101)
        expect(error.limit).toBe(100)
      }
    })

    it("enforces maxBytesPerFile limit", async () => {
      // Create a large XML that exceeds byte limit
      let xml = "<sitemapindex>"
      for (let i = 0; i < 1000; i++) {
        xml += `<sitemap><loc>https://example.com/sitemap${i}.xml</loc></sitemap>`
      }
      xml += "</sitemapindex>"

      // Set a small byte limit
      const smallLimit = 1000

      await expect(
        collectAll(parseSitemapIndexLocs(stringToChunks(xml), { maxBytesPerFile: smallLimit }))
      ).rejects.toThrow(StreamingParserLimitError)

      try {
        await collectAll(
          parseSitemapIndexLocs(stringToChunks(xml), { maxBytesPerFile: smallLimit })
        )
      } catch (e) {
        expect(e).toBeInstanceOf(StreamingParserLimitError)
        const error = e as StreamingParserLimitError
        expect(error.limitName).toBe("maxBytesPerFile")
        expect(error.source).toBe("sitemapindex")
      }
    })

    it("only counts valid URLs toward maxLocsPerFile", async () => {
      // 5 valid + 5 invalid URLs, limit 8
      // Should NOT throw because only 5 valid URLs count
      const xml = `<sitemapindex>
        <sitemap><loc>https://example.com/valid1.xml</loc></sitemap>
        <sitemap><loc></loc></sitemap>
        <sitemap><loc>https://example.com/valid2.xml</loc></sitemap>
        <sitemap><loc>ftp://invalid.com</loc></sitemap>
        <sitemap><loc>https://example.com/valid3.xml</loc></sitemap>
        <sitemap><loc>not-a-url</loc></sitemap>
        <sitemap><loc>https://example.com/valid4.xml</loc></sitemap>
        <sitemap><loc>   </loc></sitemap>
        <sitemap><loc>https://example.com/valid5.xml</loc></sitemap>
        <sitemap><loc>file:///local</loc></sitemap>
      </sitemapindex>`

      const urls = await collectAll(
        parseSitemapIndexLocs(stringToChunks(xml), { maxLocsPerFile: 8 })
      )

      expect(urls).toHaveLength(5)
    })
  })

  describe("error handling", () => {
    it("rejects nested loc tags", async () => {
      const xml = `<sitemapindex>
        <sitemap>
          <loc>
            <loc>https://example.com/nested.xml</loc>
          </loc>
        </sitemap>
      </sitemapindex>`

      await expect(collectAll(parseSitemapIndexLocs(stringToChunks(xml)))).rejects.toThrow(
        StreamingParserError
      )

      try {
        await collectAll(parseSitemapIndexLocs(stringToChunks(xml)))
      } catch (e) {
        expect(e).toBeInstanceOf(StreamingParserError)
        const error = e as StreamingParserError
        expect(error.message).toContain("nested")
        expect(error.source).toBe("sitemapindex")
      }
    })

    it("fails on truncated XML", async () => {
      // Missing closing tags
      const xml = `<sitemapindex>
        <sitemap>
          <loc>https://example.com/truncated.xml`

      await expect(collectAll(parseSitemapIndexLocs(stringToChunks(xml)))).rejects.toThrow()
    })
  })

  describe("defaults verification", () => {
    it("has correct default values", () => {
      expect(STREAMING_PARSER_DEFAULTS.maxLocLengthChars).toBe(2048)
      expect(STREAMING_PARSER_DEFAULTS.maxLocsPerFile).toBe(100_000)
      expect(STREAMING_PARSER_DEFAULTS.maxBytesPerFile).toBe(50 * 1024 * 1024)
    })
  })
})

describe("parseUrlsetLocs", () => {
  describe("basic functionality", () => {
    it("parses simple urlset", async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url>
            <loc>https://example.com/page1.html</loc>
          </url>
          <url>
            <loc>https://example.com/page2.html</loc>
          </url>
        </urlset>`

      const urls = await collectAll(parseUrlsetLocs(stringToChunks(xml)))

      expect(urls).toHaveLength(2)
      expect(urls[0]).toBe("https://example.com/page1.html")
      expect(urls[1]).toBe("https://example.com/page2.html")
    })

    it("handles urlset with extra elements", async () => {
      const xml = `<?xml version="1.0"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url>
            <loc>https://example.com/page.html</loc>
            <lastmod>2024-01-01</lastmod>
            <changefreq>weekly</changefreq>
            <priority>0.8</priority>
          </url>
        </urlset>`

      const urls = await collectAll(parseUrlsetLocs(stringToChunks(xml)))

      expect(urls).toHaveLength(1)
      expect(urls[0]).toBe("https://example.com/page.html")
    })
  })

  describe("chunk boundary handling", () => {
    it("handles split URL text across chunks", async () => {
      const chunks = ["<urlset><url><loc>https://exa", "mple.com/page.html</loc></url></urlset>"]

      const urls = await collectAll(parseUrlsetLocs(stringsToChunks(chunks)))

      expect(urls).toHaveLength(1)
      expect(urls[0]).toBe("https://example.com/page.html")
    })
  })

  describe("limit enforcement", () => {
    it("enforces maxLocLengthChars limit", async () => {
      const longPath = "x".repeat(3000)
      const xml = `<urlset><url><loc>https://example.com/${longPath}</loc></url></urlset>`

      await expect(collectAll(parseUrlsetLocs(stringToChunks(xml)))).rejects.toThrow(
        StreamingParserLimitError
      )

      try {
        await collectAll(parseUrlsetLocs(stringToChunks(xml)))
      } catch (e) {
        const error = e as StreamingParserLimitError
        expect(error.source).toBe("urlset")
      }
    })
  })

  describe("canonicalization stability", () => {
    it("produces consistent output for equivalent URLs", async () => {
      const xml = `<urlset>
        <url><loc>https://example.com/path</loc></url>
        <url><loc>https://EXAMPLE.COM/path</loc></url>
        <url><loc>  https://example.com/path  </loc></url>
      </urlset>`

      const urls = await collectAll(parseUrlsetLocs(stringToChunks(xml)))

      // All should normalize to same canonical form
      expect(urls).toHaveLength(3)
      const uniqueUrls = new Set(urls)
      expect(uniqueUrls.size).toBe(1)
    })
  })
})
