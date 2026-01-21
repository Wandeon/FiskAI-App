import { describe, it, expect } from "vitest"
import { parseHtml } from "../html-parser"
import { ProvisionNodeType } from "@/generated/regulatory-client"

describe("HTML Parser", () => {
  it("parses simple article structure", () => {
    const html = `
      <html><body>
        <p class="clanak">Članak 1.</p>
        <p>This is the content of article 1.</p>
        <p class="clanak">Članak 2.</p>
        <p>(1) First paragraph of article 2.</p>
        <p>(2) Second paragraph of article 2.</p>
      </body></html>
    `

    const result = parseHtml(html)

    expect(result.status).toBe("SUCCESS")
    expect(result.nodes.some((n) => n.nodePath === "/članak:1")).toBe(true)
    expect(result.nodes.some((n) => n.nodePath === "/članak:2")).toBe(true)
    expect(result.nodes.some((n) => n.nodePath === "/članak:2/stavak:1")).toBe(true)
  })

  it("extracts document metadata", () => {
    const html = `
      <html><head><title>Pravilnik o paušalnom oporezivanju</title></head>
      <body>
        <p class="clanak">Članak 1.</p>
        <p>Content here.</p>
      </body></html>
    `

    const result = parseHtml(html)

    expect(result.docMeta.title).toContain("Pravilnik")
  })

  it("computes coverage stats", () => {
    const html = `
      <html><body>
        <p class="clanak">Članak 1.</p>
        <p>(1) Full paragraph content here.</p>
      </body></html>
    `

    const result = parseHtml(html)

    expect(result.stats.nodeCount).toBeGreaterThan(0)
    expect(result.stats.coveragePercent).toBeGreaterThan(0)
  })

  it("validates invariants and reports issues", () => {
    const html = `<html><body><p>No structure here</p></body></html>`

    const result = parseHtml(html)

    // Should still succeed but with warnings about no articles found
    expect(["SUCCESS", "PARTIAL"]).toContain(result.status)
  })
})
